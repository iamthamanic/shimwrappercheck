# shimwrappercheck

CLI-Shim, der Projekt-Checks ausführt, bevor ein echtes CLI-Kommando (z. B. Supabase, Git) läuft. Optional: Web-Dashboard zum Konfigurieren von Presets, Trigger-Befehlen, Checks und AGENTS.md.

---

## Features

### CLI & Wrapper

- **Supabase-, Git- und generischer Shim**: Wraps `supabase`, `git` oder beliebige CLIs; führt vorher Checks aus.
- **Diff-bewusste Checks**: Frontend/Backend je nach geänderten Dateien (z. B. `src/` vs. `supabase/functions/` oder `src/supabase/functions/`).
- **Befehlsfilter**: Nur für bestimmte Befehle Checks/Hooks (z. B. `functions`, `db`, `migration`, `push`).
- **Netzwerk-Retry** bei flaky Supabase-CLI-Aufrufen.
- **Post-Deploy-Hooks**: Health-Ping und Logs nach Deploy.
- **Optionaler Auto-Push**: Nach Erfolg automatisch `git push`.
- **AI-Review**: Provider wählbar (`SHIM_AI_REVIEW_PROVIDER=auto|codex|api`). **Streng:** Senior-Software-Architekt-Checkliste (SOLID, Performance, Sicherheit, Robustheit, Wartbarkeit), Start 100 Punkte, Abzüge pro Verstoß. Ausgabe: Score, Deductions (point, minus, reason), Verdict. **PASS nur bei Score ≥ Mindestwert (Standard 95 %) und Verdict ACCEPT.** Integriert in Checks; Reviews in `.shimwrapper/reviews/` und optional als JSON-Report.
- **Refactor-Orchestrierung (optional)**: `SHIM_REFACTOR_MODE=interactive|agent` erzeugt TODO-Liste, State und `refactor-current-item.json` für Resume/Handoff pro Item.
- **Interaktiver Setup-Wizard**: Repo-Scan, Konfiguration in einem Durchlauf.
- **Global Install**: PATH-Shims (`supabase`, `git`, `shim`) in z. B. `~/.local/bin`.

### Dashboard (Web-UI)

- **Check Library**: Alle integrierten Checks mit Filter (Frontend / Backend / Enforce / Hooks), Suche, Drag & Drop in „My Shim“. Pro Check: **Tool-Status** (ob z. B. ESLint/Deno installiert ist) und **Copy-Paste-Befehl** zum Nachinstallieren. Check-Infos folgen einem festen Schema (Zweck/Prueft/Bestanden/Nicht bestanden/Anpassen/Hinweis).
- **My Shim (Sidebar)**:
  - **Trigger Commandos**: Tags pro Tab (Enforce / Hooks) – z. B. `git push`, `supabase functions deploy`. Neue Tags mit **Enter** bestätigen; Speichern schreibt `.shimwrappercheckrc` und Presets.
  - **My Checks**: Reihenfolge der aktiven Checks, Suchen, Entfernen, Drag zum Sortieren; „aktualisiert“-Zeitstempel.
- **Einstellungen**:
  - **Templates**: Preset wählen (z. B. „Vibe Code“), bei aktivem Preset **⋮** (Optionen: Export, Umbenennen). Eigenes Preset: Provider (Supabase/Git) hinzufügen. **Trigger Commandos & My Checks** 1:1 wie in der Sidebar konfigurierbar.
  - **Information**: Port/Version, **Status** (`.shimwrappercheckrc`, Presets-Datei, AGENTS.md, run-checks.sh, Shim Runner, Husky, Git pre-push, Supabase), Projekt-Root, letzter Check-Fehler, **Aktionen** („Nur Checks ausführen“, Config, AGENTS.md), letzte Check-Ausgabe.
- **Config (Raw)**: `.shimwrappercheckrc` direkt bearbeiten.
- **AGENTS.md**: Agent-Anweisungen für Cursor/Codex im Dashboard bearbeiten; Änderungen sofort wirksam.

### Checks (Beispiele)

- **Frontend**: **Prettier**, **ESLint**, **TypeScript Check**, Projektregeln, Check Mock Data, **Vitest**, **Vite Build**, npm Audit, Snyk, **Update README** (Version aus package.json in README syncen).
- **Backend**: Deno fmt/lint/audit für Supabase Functions.
- **Beides**: AI Review (streng: Senior-Architekt-Checkliste, Score ≥ 95 %, Verdict ACCEPT), SAST, Architecture, Complexity, Mutation, E2E (Templates/geplant).
- **Hooks**: Post-Deploy Health Ping, Edge Logs.

### Konfiguration

- **Presets**: `.shimwrappercheck-presets.json` (Presets, Trigger-Befehle, Check-Reihenfolge, Toggles). Dashboard schreibt zusätzlich `.shimwrappercheckrc` für die Shell-Skripte.
- **Env & RC**: Alle Optionen per Umgebungsvariablen oder `.shimwrappercheckrc` steuerbar.
- **Check-Tools (pro Projekt):** Optional `.shimwrapper/checktools/` mit eigener `package.json` (ESLint, Prettier, TypeScript, Vitest, Vite). Beim `init` anlegbar; danach `npx shimwrappercheck install-tools`. `run-checks.sh` verwendet diese Binaries, wenn vorhanden – so sind die Tools pro Projekt getrennt (Variante B).

---

## Anleitung: shimwrappercheck benutzen

### 1. Installieren

```bash
npm i -D shimwrappercheck
```

### 2. Einmal-Setup (Wizard + Dashboard)

Alles in einem Schritt: Paket einrichten, Wizard durchlaufen, Dashboard starten:

```bash
npx shimwrappercheck setup
```

Der Wizard fragt u. a.:

- Supabase/Git-Nutzung
- Welche Befehle Checks/Hooks auslösen
- Pre-Push-Hooks (Husky)
- AI-Review (streng: Checkliste, Score ≥ 95 %, Verdict ACCEPT; mit `--no-ai-review` deaktivierbar)
- Erzeugt `.shimwrappercheckrc` und optional `scripts/run-checks.sh`, Templates.

**Danach startet das Dashboard automatisch** und öffnet im Browser (z. B. http://localhost:3000). Ein freier Port (3000, 3001, …) wird automatisch gewählt.

### 3. Dashboard nutzen

**Dashboard später starten** (aus dem Projekt-Root, in dem `node_modules/shimwrappercheck` liegt):

```bash
cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev
```

Oder im Repo-Root (wenn `npm run dashboard` in package.json eingetragen ist):

```bash
npm run dashboard
```

Dann die im Terminal angezeigte URL im Browser öffnen.

**Im Dashboard:**

1. **Trigger Commandos (My Shim, links)**
   - Tab **Enforce** oder **Hooks** wählen.
   - Befehle eintippen (z. B. `git push`, `supabase functions deploy`), mit **Enter** als Tag bestätigen.
   - Änderungen werden gespeichert und in `.shimwrappercheckrc` / Presets übernommen.

2. **My Checks (My Shim, links)**
   - Checks aus der **Check Library** (rechts) per Drag in „My Checks“ ziehen.
   - Reihenfolge per Drag ändern, einzeln entfernen.
   - Pro Check: Info/Settings; **Tool-Status** zeigt, ob das Tool (z. B. ESLint, Deno) vorhanden ist, und bietet einen **Kopieren**-Befehl zum Nachinstallieren.

3. **Check Library (rechts)**
   - Filter: Frontend, Backend, Enforce, Hooks (Mehrfachauswahl).
   - Suche, Drag zu My Shim zum Aktivieren.

4. **Einstellungen**
   - **Templates**: Preset wechseln, ⋮ am aktiven Preset für Export/Umbenennen; Trigger Commandos & My Checks wie in der Sidebar bearbeiten.
   - **Information**: Status aller Dateien/Skripte, „Nur Checks ausführen“, Links zu Config und AGENTS.md.

5. **Config / AGENTS.md**
   - Über Einstellungen → Information oder Navigation: Roh-Editor für `.shimwrappercheckrc` und Editor für AGENTS.md.

### 4. Checked Befehle ausführen

Nach dem Setup nutzt du den Shim statt des „nackten“ CLIs:

```bash
# Supabase (Checks laufen vor dem echten Befehl)
npx supabase functions deploy <name>
npm run supabase:checked -- db push

# Git (z. B. pre-push oder manuell)
npx git push
npm run git:checked -- push
```

**Nur Checks ausführen** (ohne Supabase/Git):

- Im Dashboard unter **Einstellungen → Information** auf „Nur Checks ausführen“ klicken,  
  oder
- CLI: `npx supabase --checks-only functions deploy server`

**Wrapper-Flags** (werden nicht an das echte CLI durchgereicht):

- `--no-checks` Checks überspringen
- `--checks-only` Nur Checks, kein Supabase/Git
- `--no-hooks` Post-Deploy-Hooks überspringen
- `--no-push` Auto-Push überspringen

### 5. Konfigurationsdateien

- **`.shimwrappercheckrc`** (Projekt-Root): Wird vom Dashboard beim Speichern (Trigger Commandos, Presets, Checks) geschrieben. Enthält z. B. `SHIM_ENFORCE_COMMANDS`, `SHIM_HOOK_COMMANDS`, `SHIM_CHECK_ORDER`, Toggles.
- **`.shimwrappercheck-presets.json`**: Vollständige Preset- und Check-Daten; Dashboard liest/schreibt diese Datei und leitet daraus die RC ab.

Für **Vercel/gehostetes Dashboard**: `SHIM_PROJECT_ROOT` auf den Pfad zum Repo-Root setzen (dort liegen RC und AGENTS.md).

---

## Install

```bash
npm i -D shimwrappercheck
```

## Global Install (PATH-Shims)

Shims in ein Bin-Verzeichnis (z. B. `~/.local/bin`) legen, dann `supabase` / `git` / `shim` ohne `npx` nutzbar:

```bash
npx shimwrappercheck install
# Optionen: --bin-dir <path>, --add-path, --overwrite, --no-supabase | --no-git | --no-shim
```

Falls das Bin-Verzeichnis nicht in der PATH liegt:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Quick Start (ohne Wizard)

1. Checks-Skript und Hooks anlegen:

```bash
cp node_modules/shimwrappercheck/templates/run-checks.sh scripts/run-checks.sh
cp node_modules/shimwrappercheck/templates/ai-code-review.sh scripts/ai-code-review.sh
cp node_modules/shimwrappercheck/templates/husky-pre-push .husky/pre-push
chmod +x scripts/run-checks.sh scripts/ai-code-review.sh .husky/pre-push
```

2. Optional in `package.json`:

```json
{
  "scripts": {
    "supabase:checked": "supabase",
    "git:checked": "git"
  }
}
```

3. Nutzen:

```bash
npm run supabase:checked -- functions deploy <function-name>
npx git push
```

## Setup-Wizard (init)

Nur den interaktiven Init ausführen (ohne erneutes Installieren):

```bash
npx shimwrappercheck init
```

Erkennung von Supabase/Git, Abfrage der Befehle für Checks/Hooks, Pre-Push-Hooks, AI-Review (streng: Senior-Architekt-Checkliste, Score ≥ 95 %), AI-Review-Provider (`auto|codex|api`) und AI-Review-Scope (`full|snippet|diff`), Erzeugen von `.shimwrappercheckrc`. Optional: Anlegen von `.shimwrapper/checktools/` (Check-Tools pro Projekt).

### Check-Tools (projektlos)

Wenn beim `init` der Ordner `.shimwrapper/checktools/` angelegt wurde (oder manuell mit `package.json` aus `templates/checktools-package.json`), Tools dort installieren:

```bash
npx shimwrappercheck install-tools
```

`run-checks.sh` nutzt dann ESLint, Prettier, tsc, Vitest und Vite aus diesem Ordner, falls vorhanden; sonst Projekt-`node_modules` bzw. npm-Skripte.

## Wie es funktioniert

- Der Shim prüft anhand der konfigurierten **Trigger Commandos**, ob für den ausgeführten Befehl (z. B. `functions`, `db`, `push`) Checks/Hooks laufen sollen.
- Zuerst läuft euer **run-checks.sh** (Frontend/Backend je nach Diff).
- Bei Erfolg wird das echte CLI (Supabase/Git) aufgerufen.
- Optional: Post-Deploy-Hooks (Health-Ping, Logs), optional Auto-Push.
- Git-Push-Checks laufen über den Pre-Push-Hook (Husky oder `.git/hooks/pre-push`).

## Usage (Überblick)

```bash
npx supabase functions deploy <name>
npm run supabase:checked -- db push

npx git push
npm run git:checked -- push

# Nur Checks
npx supabase --checks-only functions deploy server

# Generischer Shim
npm exec --package shimwrappercheck -- shim docker build .
npm exec --package shimwrappercheck -- shim --cli terraform -- plan
```

## Wrapper-Flags

- `--no-checks` Checks für diesen Aufruf überspringen
- `--checks-only` Nur Checks, kein Supabase/Git
- `--no-hooks` Post-Deploy-Hooks überspringen
- `--no-push` Auto-Push überspringen
- `--no-ai-review` An run-checks.sh durchgereicht
- `--with-frontend` Frontend-Checks erzwingen
- `--ai-review` An run-checks.sh durchgereicht
- `--auto-push` (Generischer Shim) Auto-Push nach Befehl

## Befehlsfilter

- **Supabase**: `SHIM_ENFORCE_COMMANDS="functions,db,migration"`, `SHIM_HOOK_COMMANDS="functions,db,migration"` (oder `all` / `none`).
- **Git**: `SHIM_GIT_ENFORCE_COMMANDS` (z. B. `push`, `commit`, `merge`, `rebase`).

Befehle werden als Token gematcht (z. B. `functions`, `db`, `push`).

## Umgebungsvariablen (Auswahl)

- `SHIM_PROJECT_ROOT` Projekt-Root (z. B. für Dashboard auf Vercel)
- `SHIM_CHECKS_SCRIPT` Pfad zum Checks-Skript
- `SHIM_CHECKS_ARGS` Zusätzliche Argumente für run-checks
- `SHIM_CONFIG_FILE` Konfigurationsdatei (Standard: `.shimwrappercheckrc`)
- `SHIM_DISABLE_CHECKS=1` Checks deaktivieren
- `SHIM_DISABLE_HOOKS=1` Hooks deaktivieren
- `SHIM_AUTO_PUSH=1|0` Auto-Push nach Erfolg
- `SHIM_ENFORCE_COMMANDS` Supabase-Befehle für Checks
- `SHIM_HOOK_COMMANDS` Supabase-Befehle für Hooks
- `SHIM_GIT_ENFORCE_COMMANDS` Git-Befehle für Checks
- `SHIM_GIT_CHECK_MODE_ON_PUSH=snippet|full` AI-Review-Scope beim Push (default: `snippet`)
- `CHECK_MODE=snippet|full|diff|mix` AI-Review-Scope für `run-checks.sh`/manuelle Läufe (`diff` = `snippet`)
- `SHIM_AI_REVIEW_PROVIDER=auto|codex|api` AI-Review-Provider (`auto`: Codex bevorzugen, sonst API-Key)
- `SHIM_BACKEND_PATH_PATTERNS` Backend-Pfade für Diff-/Check-Erkennung (default: `supabase/functions,src/supabase/functions`)
- `SHIM_CONTINUE_ON_ERROR=1` Checks sammeln und am Ende fehlschlagen (statt sofort abzubrechen)
- `SHIM_REFACTOR_MODE=off|interactive|agent` Optionaler Refactor-Item-Flow bei `--refactor`
- `SHIM_REFACTOR_DIR`, `SHIM_REFACTOR_TODO_FILE`, `SHIM_REFACTOR_STATE_FILE`, `SHIM_REFACTOR_CURRENT_ITEM_FILE`
- `SHIM_REFACTOR_ITEM_INDEX=<n>`, `SHIM_REFACTOR_ADVANCE=1` Resume/Next-Item-Steuerung
- `SHIM_REPORT_FILE` Optionaler JSON-Report für AI-Review
- `REFACTOR_REPORT_FILE` Alias für `SHIM_REPORT_FILE`
- `AI_REVIEW_DIFF_RANGE`, `AI_REVIEW_DIFF_FILE`, `AI_REVIEW_CHUNK` Zusätzliche AI-Review-Eingaben (Diff-Range, Diff-Datei, Full-Chunk)
- `SHIM_AI_TIMEOUT_SEC`, `SHIM_AI_CHUNK_TIMEOUT`, `SHIM_AI_DIFF_LIMIT_BYTES`, `SHIM_AI_MIN_RATING`, `SHIM_AI_REVIEW_DIR`
- `SHIM_DEFAULT_FUNCTION` Standard-Funktion für Health/Logs
- `SHIM_HEALTH_FUNCTIONS`, `SHIM_LOG_FUNCTIONS`, `SHIM_LOG_LIMIT`
- `SUPABASE_PROJECT_REF`, `SHIM_HEALTH_PATHS`
- Netzwerk-Retry: `SUPABASE_RETRY_MAX`, `SUPABASE_RETRY_BACKOFF_SECONDS`
- Generischer Shim: `SHIM_CLI_*`, `SHIM_CLI_PRE_HOOKS`, `SHIM_CLI_POST_HOOKS`

## Config-Datei

`.shimwrappercheckrc` im Projekt-Root (wird vom Dashboard befüllt; kann manuell angepasst werden):

```bash
SHIM_ENFORCE_COMMANDS="functions,db,migration"
SHIM_HOOK_COMMANDS="functions,db,migration"
SHIM_DEFAULT_FUNCTION="server"
SHIM_AUTO_PUSH=1
SHIM_CHECKS_ARGS="--no-ai-review"
SHIM_BACKEND_PATH_PATTERNS="supabase/functions,src/supabase/functions"
SHIM_GIT_CHECK_MODE_ON_PUSH="snippet"
CHECK_MODE="full"
SHIM_AI_REVIEW_PROVIDER="auto"
SHIM_REFACTOR_MODE="off"
# Optional:
# SHIM_CONTINUE_ON_ERROR=1
# SHIM_REPORT_FILE=".shimwrapper/reports/ai-review.json"
```

Die Datei wird als Shell-Skript eingelesen.

## Templates

- `templates/run-checks.sh` Runner für Lint, Tests, Deno, AI-Review usw.
- `templates/ai-code-review.sh` Optionaler AI-Review-Schritt (streng: Senior-Architekt-Checkliste, 100 Punkte, Abzüge, JSON Score/Deductions/Verdict; PASS bei ≥ 95 % und ACCEPT)
- `templates/extract-refactor-todo.sh` Extrahiert TODO-Items aus AI-Review-Reports (für Refactor-Handoff)
- `templates/husky-pre-push` Husky Pre-Push-Hook
- `templates/git-pre-push` Reiner Git-Hook

## Hard Rules (optionale Tools)

Für SAST, Architektur, Komplexität, Mutation, E2E:

- **dependency-cruiser**: `npm i -D dependency-cruiser`
- **eslint-plugin-complexity**: `npm i -D eslint-plugin-complexity`
- **Stryker**: `npm i -D @stryker-mutator/core`
- **semgrep**: z. B. `brew install semgrep` oder `npx semgrep`

Konfig-Vorlagen in `templates/`: `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`. Optional über den Init-Wizard einrichten.

## Hinweise

- Bei lokaler Installation vermeidet der Shim Rekursion, indem das echte Supabase-CLI erkannt wird.
- Das Git-Wrapper sollte über `npx git` oder `npm run git:checked` aufgerufen werden, um das System-Git nicht zu überschreiben.
- Hooks werden zuerst im Repo gesucht (`scripts/ping-edge-health.sh`, `scripts/fetch-edge-logs.sh`), danach im Paket.

## Lizenz

MIT (siehe package.json).
