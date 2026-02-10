# Refactor-Mix: Full-Scan und Snippet-Review

Dieses Dokument beschreibt den empfohlenen **Mix-Workflow**: Full-Scan über die ganze Codebase für Refactoring, beim Push nur schnelle Checks plus AI-Review für das **Diff** (gepushte Änderungen). So bleibt der Push schnell, der Gesamtstand wird trotzdem regelmäßig per Full-Scan geprüft.

## Warum dieser Mix?

- **Full-Scan (CHECK_MODE=full):** Zeigt alle Probleme in der gesamten Codebase (chunked pro Verzeichnis: src, supabase, scripts, dashboard). Ideal zum Refactoring und um auf ≥95% pro Chunk zu kommen. Dauert länger (mehrere Codex-Läufe).
- **Snippet-Review (CHECK_MODE=snippet):** Nur die geänderten Zeilen werden bewertet. Schnell, ideal für jeden Push. Verhindert, dass neue Änderungen Qualität verschlechtern.
- **Kombination:** Du holst dir mit dem Full-Scan den vollen Überblick und arbeitest die Punkte ab; beim Push läuft nur die Snippet-Review, damit der Push nicht ewig dauert. Danach wieder Full-Scan, bis alles durch ist.

## Ablauf

### 1. Full-Scan (ganze Codebase)

```bash
./scripts/run-checks.sh
# oder explizit:
./scripts/run-checks.sh --refactor
# bzw. --until-95 (Alias für Refactor-Modus)
```

- Es laufen alle Chunks (src, supabase, scripts, ggf. dashboard).
- Alle gemeldeten Probleme sind sichtbar (Deductions in `.shimwrapper/reviews/review-full-…`).
- **Schleife:** Fix → Commit → Enter → nächster Lauf, bis alle Chunks ≥ 95%.

### 2. Teile fixen, dann pushen

- Du arbeitest die Punkte aus dem Full-Scan ab und committest.
- Beim **Push** (`git push` mit aktivem Pre-Push-Hook) gilt automatisch **CHECK_MODE=snippet**:
  - Schnelle Checks (Prettier, Lint, TypeScript, Build, …) laufen wie gewohnt.
  - Die **AI-Review** läuft nur für das **Diff** (gepushte Änderungen).
- Der Push bleibt relativ schnell (kein Full-Scan mit mehreren Chunks).

### 3. Danach wieder Full-Scan

- Du startest erneut `./scripts/run-checks.sh` (oder `--refactor` / `--until-95`).
- Noch nicht überall ≥ 95%? → weiter fixen → commit → push (wieder nur Snippet-Review) → erneut Full-Scan.
- Der Zyklus wiederholt sich, bis der Full-Scan durchgeht.

## Technische Umsetzung im Repo

| Ort                                          | Verhalten                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **run-checks.sh**                            | `CHECK_MODE` wird nur gesetzt, wenn noch nicht gesetzt: `CHECK_MODE="${CHECK_MODE:-full}"`. Default bei manuellem Lauf also **full**. Mit `--refactor` oder `--until-95` wird `CHECK_MODE=full` erzwungen. |
| **Pre-Push (git-pre-push / husky-pre-push)** | Setzt **CHECK_MODE=snippet** vor dem Aufruf von `run-checks.sh` bzw. `npx shimwrappercheck run --full`. Die AI-Review läuft damit nur für das Diff.                                                        |
| **AI-Code-Review**                           | Liest `CHECK_MODE` aus der Umgebung; bei `diff` ein Lauf fürs Diff, bei `full` chunked pro Verzeichnis. Review-Dateien: `review-snippet-…` bzw. `review-full-…`.                                           |

Es wird bewusst **nicht** mehr über Pre-Push die AI-Review ausgesetzt (kein pauschales SKIP_AI_REVIEW beim Push). Stattdessen: AI-Review immer, aber beim Push nur im **Diff-Modus**.

## Kurzfassung

- **Full-Scan** für den Gesamtstand und Refactoring (alle Chunks, alle Probleme).
- **Snippet-Review** beim Push für die geänderten Teile (schnell, trotzdem geprüft).
- Beides zusammen deckt sowohl „ganze Codebase verbessern“ als auch „jeden Push absichern“ ab.
