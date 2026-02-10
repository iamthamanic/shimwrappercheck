# Check Description Style

Goal: make each check understandable for non-experts and still precise for experts.

## Required structure

Every check has two fields: `summary` and `info`.

1. `summary`:
- One short sentence in plain language.
- Do not list steps or thresholds here.
- Avoid tool names unless they are essential to understand the check.

2. `info`:
- Use a fixed label sequence (all in one paragraph or as short sentences):
  - `Zweck:` Why the check exists (risk it avoids).
  - `Prueft:` What exactly is checked (files, scope, command).
  - `Bestanden, wenn:` The exact pass condition.
  - `Nicht bestanden, wenn:` The exact fail condition.
  - `Anpassen:` Where the user can configure it (file, flag, env var).
  - `Hinweis:` Optional; mention skips, prerequisites, or where output is stored.

## Precision rules

- Match real behavior. Do not claim strict pass/fail if the script only logs.
- State actual commands (e.g. `npm run build`, `deno fmt --check`).
- If a tool can be missing, mention that the check is skipped.
- If thresholds exist, name the default and where it is configured.
- If output/report files exist, mention the path in `Hinweis`.

## Examples

`summary`:
- "Findet Regel- und Qualitaetsverstoesse im Code."

`info`:
- "Zweck: Verhindert typische Fehler und Stilbrueche, bevor sie in Produktion landen. Prueft: Projektdateien mit ESLint-Regeln. Bestanden, wenn: Der ESLint-Lauf endet ohne Fehler (Exit 0). Nicht bestanden, wenn: ESLint Fehler meldet (Exit != 0). Anpassen: ESLint-Config und Regeln im Projekt. Hinweis: ..."
