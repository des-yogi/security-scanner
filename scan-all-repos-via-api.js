#!/usr/bin/env node

/**
 * Централизованный сканер:
 * - Запускается в репозитории security-scanner (на GitHub Actions).
 * - Через GitHub API получает список всех репозиториев пользователя.
 * - Для каждого репозитория пытается прочитать:
 *   - package.json в корне (через /repos/{owner}/{repo}/contents/package.json).
 * - Анализирует:
 *   - lifecycle-скрипты (preinstall, install, postinstall, prepare);
 *   - зависимости против списка "плохих" пакетов (в COMPROMISED_PACKAGES).
 *
 * НИЧЕГО не клонирует локально, всё идёт через API.
 */

const { Octokit } = require("@octokit/rest");

const GITHUB_TOKEN = process.env.GH_PAT_SH_SCAN; // PAT из secrets
const GITHUB_USER = process.env.SCAN_USER || "des-yogi";

// Простой список подозрительных пакетов (для примера).
// Позже можно вынести в JSON или обновлять.
const COMPROMISED_PACKAGES = [
  {
    name: "shai-hulud",
    reason: "Known Shai-Hulud worm package (example)",
    badVersions: ["*"]
  },
  {
    name: "@shai-hulud/core",
    reason: "Known malicious core worm package (example)",
    badVersions: ["*"]
  },
  {
    name: "lodash-ts-fixer",
    reason: "Typosquat used in Shai-Hulud campaigns (example)",
    badVersions: ["*"]
  }
];

const RISKY_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

if (!GITHUB_TOKEN) {
  console.error(
    "ERROR: Переменная окружения GH_PAT_SH_SCAN не задана. " +
      "В GitHub Actions нужно добавить секрет с этим именем."
  );
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

function matchCompromised(depName, depVersionRange) {
  const found = COMPROMISED_PACKAGES.find((p) => p.name === depName);
  if (!found) return null;
  if (found.badVersions.includes("*")) return found;
  // Здесь можно добавить semver-проверку версий, если понадобится.
  return found;
}

async function fetchPackageJson(owner, repo) {
  try {
    const res = await octokit.repos.getContent({
      owner,
      repo,
      path: "package.json"
    });

    if (!("content" in res.data)) {
      return null;
    }

    const content = Buffer.from(res.data.content, res.data.encoding || "base64").toString(
      "utf-8"
    );
    return JSON.parse(content);
  } catch (e) {
    // 404 или отсутствие package.json — это нормально
    if (e.status === 404) {
      return null;
    }
    console.error(`  [ERROR] Не удалось получить package.json для ${owner}/${repo}:`, e.message);
    return null;
  }
}

async function scanRepo(owner, repo) {
  const findings = [];

  const pkg = await fetchPackageJson(owner, repo);
  if (!pkg) {
    console.log(`  [INFO] ${owner}/${repo}: package.json не найден, пропускаю.`);
    return findings;
  }

  // 1) lifecycle-скрипты
  const scripts = pkg.scripts || {};
  const foundScripts = RISKY_SCRIPTS.filter((s) => scripts[s]);

  if (foundScripts.length > 0) {
    findings.push({
      type: "lifecycle-script",
      repo: `${owner}/${repo}`,
      details: {
        scripts: foundScripts.reduce((acc, s) => {
          acc[s] = scripts[s];
          return acc;
        }, {})
      }
    });
  }

  // 2) зависимости
  const depSections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ];

  for (const section of depSections) {
    const deps = pkg[section];
    if (!deps) continue;

    for (const [name, versionRange] of Object.entries(deps)) {
      const compromised = matchCompromised(name, versionRange);
      if (compromised) {
        findings.push({
          type: "compromised-dependency",
          repo: `${owner}/${repo}`,
          details: {
            section,
            name,
            versionRange,
            reason: compromised.reason,
            badVersions: compromised.badVersions
          }
        });
      }
    }
  }

  return findings;
}

async function main() {
  console.log("=== Central Shai-Hulud scan via GitHub API ===");
  console.log("Scanning user:", GITHUB_USER);

  const allFindings = [];

  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: GITHUB_USER,
    per_page: 100
  });

  console.log(`Всего репозиториев у ${GITHUB_USER}: ${repos.length}`);

  for (const repo of repos) {
    if (repo.archived || repo.fork) {
      console.log(`\n[SKIP] ${repo.full_name} (archived или fork)`);
      continue;
    }

    console.log(`\n[SCAN] ${repo.full_name}`);
    const repoFindings = await scanRepo(repo.owner.login, repo.name);

    if (repoFindings.length === 0) {
      console.log("  [OK] Ничего подозрительного не найдено.");
    } else {
      console.log(`  [WARN] Найдено проблем: ${repoFindings.length}`);
      for (const f of repoFindings) {
        if (f.type === "lifecycle-script") {
          console.log("    [scripts]");
          for (const [k, v] of Object.entries(f.details.scripts)) {
            console.log(`      - ${k}: ${v}`);
          }
        } else if (f.type === "compromised-dependency") {
          const d = f.details;
          console.log(
            `    [dependency] ${d.section}: ${d.name}@${d.versionRange} — ${d.reason} (bad=${d.badVersions.join(
              ", "
            )})`
          );
        }
      }
      allFindings.push(...repoFindings);
    }
  }

  const fs = require("fs");
  const path = require("path");
  const reportPath = path.join(process.cwd(), "scan-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(allFindings, null, 2), "utf-8");

  console.log("\n=== SUMMARY ===");
  console.log(`Всего находок: ${allFindings.length}`);
  console.log(`Отчёт сохранён в ${reportPath}`);

  // Job считается успешной, даже если находки есть — мы только собираем информацию.
  process.exit(0);
}

main().catch((e) => {
  console.error("Фатальная ошибка сканера:", e);
  process.exit(1);
});
