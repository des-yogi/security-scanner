# Security Scanner – Shai-Hulud & npm Supply Chain Checker

> Centralized scanner to detect suspicious npm lifecycle scripts and known malicious packages (like the Shai‑Hulud worm) across all repositories of a GitHub user.

## Overview

This repository contains a small toolset that:

- scans all repositories of a given GitHub user via the GitHub API;
- finds `package.json` files;
- looks for:
  - dangerous **lifecycle scripts** (`preinstall`, `install`, `postinstall`, `prepare`);
  - dependencies from a configurable **blocklist** (e.g. known malicious or typosquatted packages);
- produces a summary report.

The primary goal is to reduce the risk of **npm supply‑chain attacks**, especially those that hide in lifecycle scripts and try to steal tokens, SSH keys, or other secrets during `npm install`.

---

## How it works

1. A GitHub Actions workflow runs on a schedule or on demand.
2. It uses a fine‑grained Personal Access Token (PAT) from GitHub Secrets to:
   - list all repositories of the target user;
   - read `package.json` files via the GitHub API (no full clone).
3. A Node.js script:
   - parses each `package.json`;
   - checks the `scripts` section for risky lifecycle hooks;
   - checks dependencies against a JSON blocklist (known compromised/suspicious packages);
   - logs findings and writes a JSON report.

The scanner is **read‑only**: it does not modify repositories and does not push any changes.

---

## Requirements

- Node.js (for local development / running the scanner script).
- A GitHub **fine‑grained PAT** with:
  - **Contents: Read** permission;
  - access to repositories you want to scan.

The PAT is injected into workflows via a secret named, for example, `GH_PAT_SH_SCAN`.

---

## GitHub Actions workflow

The repository includes a workflow that:

- runs on a schedule (e.g. daily) or manually;
- uses `secrets.GH_PAT_SH_SCAN` to authenticate;
- runs the central scan script;
- stores/prints a brief summary of findings.

Example environment usage in a workflow:

```yaml
env:
  GH_PAT_SH_SCAN: ${{ secrets.GH_PAT_SH_SCAN }}
  TARGET_USER: des-yogi
```

---

## Local usage

You can also run the scanner locally (exact command may differ depending on the final script name):

```bash
node central-scan.js
```

Before running locally, export your PAT as an environment variable:

```bash
export GH_PAT_SH_SCAN=github_pat_...
```

The script will:

- query your repositories via GitHub API;
- scan `package.json` files;
- print a summary (and optionally write a JSON report).

---

## What the scanner looks for

### 1. Lifecycle scripts

In each `package.json`, these keys are inspected:

- `preinstall`
- `install`
- `postinstall`
- `prepare`

Any non‑trivial code in these hooks can be a potential red flag, especially when it:

- sends HTTP requests,
- reads files from `~/.ssh` or other sensitive locations,
- executes downloaded binaries.

The scanner does **not** automatically classify scripts as malicious; it highlights them for manual review.

### 2. Blocklisted packages

The scanner maintains a JSON list of packages that should never appear in dependencies, for example:

- `shai-hulud`
- `@shai-hulud/core`
- suspicious typosquats like `lodash-ts-fixer`

If such a package is found in:

- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

it will be reported as a **critical finding**.

---

## Security notes

- The PAT used by the scanner has **read‑only** access and is stored only in **GitHub Secrets**, not in the repository.
- The scanner never writes to scanned repositories.
- If a secret ever leaks, you can rotate it by:
  - generating a new fine‑grained PAT;
  - updating the corresponding GitHub secret;
  - re‑running the workflow.

See `UPDATE_TOKEN_MANUAL.md` in this repository for a detailed step‑by‑step guide on rotating the token.

---

## Roadmap / ideas

- Per‑repository GitHub Actions workflow for on‑push scans.
- E‑mail / issue notifications when suspicious scripts or packages are found.
- White‑list mode for very stable stacks: warn on **any** new dependency not present in a trusted baseline.
- Optional integration with SCA tools (Snyk, etc.) for known vulnerabilities.

---

## License

Add a license here (e.g. MIT) if you want others to be able to reuse this code more freely.

---

# Security Scanner – перевірка Shai‑Hulud та npm‑ланцюга постачання (українською)

> Центральний сканер, який шукає підозрілі npm‑lifecycle‑скрипти та відомі шкідливі пакети (наприклад, черв’як Shai‑Hulud) у всіх репозиторіях користувача GitHub.

## Огляд

Цей репозиторій містить невеликий набір інструментів, який:

- сканує всі репозиторії вказаного користувача GitHub через GitHub API;
- знаходить файли `package.json`;
- шукає:
  - небезпечні **lifecycle‑скрипти** (`preinstall`, `install`, `postinstall`, `prepare`);
  - залежності з налаштовуваного **чорного списку** (наприклад, відомі шкідливі або typosquat‑пакети);
- формує зведений звіт.

Основна мета — зменшити ризик **supply‑chain атак в npm**, особливо тих, що ховаються в lifecycle‑скриптах і намагаються вкрасти токени, SSH‑ключі чи інші секрети під час `npm install`.

---

## Як це працює

1. Workflow GitHub Actions запускається за розкладом або вручну.
2. Він використовує fine‑grained Personal Access Token (PAT) з GitHub Secrets, щоб:
   - отримати список усіх репозиторіїв цільового користувача;
   - прочитати файли `package.json` через GitHub API (без повного клонування).
3. Node.js‑скрипт:
   - парсить кожен `package.json`;
   - перевіряє секцію `scripts` на наявність ризикових lifecycle‑хуків;
   - перевіряє залежності за JSON‑чорним списком (відомі скомпрометовані/підозрілі пакети);
   - логувує знахідки та записує JSON‑звіт.

Сканер працює лише в режимі **read‑only**: він не змінює репозиторії й нічого не пушить.

---

## Вимоги

- Node.js (для локального запуску скриптів).
- GitHub **fine‑grained PAT** з правами:
  - **Contents: Read**;
  - доступом до репозиторіїв, які потрібно сканувати.

PAT передається у workflow через секрет, наприклад `GH_PAT_SH_SCAN`.

---

## Workflow GitHub Actions

У репозиторії є workflow, який:

- виконується за розкладом або вручну;
- використовує `secrets.GH_PAT_SH_SCAN` для автентифікації;
- запускає центральний скан;
- виводить короткий підсумок і за потреби зберігає звіт.

Приклад використання змінних оточення у workflow:

```yaml
env:
  GH_PAT_SH_SCAN: ${{ secrets.GH_PAT_SH_SCAN }}
  TARGET_USER: des-yogi
```

---

## Локальний запуск

Сканер можна запустити і локально (точна команда залежить від назви фінального скрипта), наприклад:

```bash
node central-scan.js
```

Перед запуском локально потрібно експортувати PAT у змінну оточення:

```bash
export GH_PAT_SH_SCAN=github_pat_...
```

Скрипт:

- отримає список репозиторіїв через GitHub API;
- просканує файли `package.json`;
- виведе підсумок (і, за потреби, збереже JSON‑звіт).

---

## Що саме шукає сканер

### 1. Lifecycle‑скрипти

У кожному `package.json` перевіряються такі ключі:

- `preinstall`
- `install`
- `postinstall`
- `prepare`

Будь‑який нетривіальний код у цих хуках може бути підозрілим, особливо якщо він:

- робить HTTP‑запити,
- читає файли з `~/.ssh` чи інших чутливих місць,
- виконує завантажені бінарники.

Сканер **не** визначає автоматично, що скрипт шкідливий; він підсвічує важливі місця для ручного перегляду.

### 2. Пакети з чорного списку

Сканер тримає JSON‑список пакетів, яких **не повинно** бути у залежностях, наприклад:

- `shai-hulud`
- `@shai-hulud/core`
- підозрілі typosquat‑пакети на кшталт `lodash-ts-fixer`

Якщо такий пакет знайдений у:

- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

— він потрапляє в звіт як **критична знахідка**.

---

## Нотатки щодо безпеки

- PAT для сканера має лише **read‑only**‑доступ і зберігається тільки в **GitHub Secrets**, а не в репозиторії.
- Сканер ніколи не записує нічого в цільові репозиторії.
- Якщо PAT колись скомпрометують, його можна легко замінити:
  - створити новий fine‑grained PAT;
  - оновити відповідний GitHub Secret;
  - перезапустити workflow.

Детальний покроковий гайд з ротації токена — у файлі `UPDATE_TOKEN_MANUAL.md` в цьому репозиторії.

---

## Плани / ідеї

- Пер‑репозиторні GitHub Actions, які запускають скан при кожному push.
- Сповіщення (e‑mail / issue), коли знайдені підозрілі скрипти або пакети.
- Режим білого списку для дуже стабільних стеків: попереджати про **будь‑яку** нову залежність, якої немає в довіреній базі.
- Опційна інтеграція з SCA‑інструментами (Snyk тощо) для пошуку відомих вразливостей.

---

## Ліцензія

Додай файл ліцензії (наприклад, MIT), якщо хочеш, щоб інші могли вільно використовувати цей код.
