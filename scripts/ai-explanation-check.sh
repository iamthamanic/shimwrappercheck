#!/usr/bin/env bash
# Full Explanation check: Codex only. Enforces "Mandatory Full Explanation Comments" (docstrings + inline comments).
# Called from run-checks.sh. Uses full changed files instead of diff snippets so Rule 4 ("never partial snippets") can be evaluated fairly.
# Output: JSON score/deductions/verdict. PASS only when compliant (score >= 95 and verdict ACCEPT).
# Input limited to whole files up to ~50KB total. Timeout 180s when timeout(1) is available.
set -euo pipefail # Bash-Strict-Mode aktivieren; ohne werden unset Variablen und Fehler in Pipes leichter uebersehen.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" # Repo root bestimmen; ohne laufen git/show/report-Pfade aus dem falschen Verzeichnis.
cd "$ROOT_DIR" # Ins Repo wechseln; ohne greifen relative Dateizugriffe und Git-Kommandos auf den falschen CWD.

INPUT_FILE="" # Temp-Datei fuer den kombinierten Voll-Datei-Prompt; ohne koennen wir den Prompt nicht sukzessive aufbauen.
CHANGED_FILES_FILE="" # Temp-Datei fuer geaenderte Dateipfade; ohne koennen wir den Input nicht dedupliziert sammeln.
CODEX_JSON_FILE="" # Temp-Datei fuer den JSON-Eventstream von codex exec; ohne fehlt spaeter die Rohantwort.
CODEX_LAST_MSG_FILE="" # Temp-Datei fuer die letzte Assistant-Nachricht; ohne gibt es keinen Fallback bei JSONL-Parsing-Problemen.

#
# cleanup: Entfernt alle Tempdateien dieses Scripts.
# Zweck: Keine Prompt-/Eventstream-Artefakte im Temp-Verzeichnis hinterlassen. Ohne cleanup sammeln sich alte Artefakte ueber mehrere Laeufe.
# Eingabe: keine. Ausgabe: kein Rueckgabewert.
cleanup() { # Aufraeumfunktion definieren; ohne ist nicht zentral ersichtlich, wie Temp-Dateien entsorgt werden.
  [[ -n "$INPUT_FILE" ]] && [[ -f "$INPUT_FILE" ]] && rm -f "$INPUT_FILE" # Voll-Datei-Prompt aufraeumen; ohne bleibt gepruefter Code im Tempbereich liegen.
  [[ -n "$CHANGED_FILES_FILE" ]] && [[ -f "$CHANGED_FILES_FILE" ]] && rm -f "$CHANGED_FILES_FILE" # Dateiliste loeschen; ohne koennen spaetere Laeufe alte Pfade sehen.
  [[ -n "$CODEX_JSON_FILE" ]] && [[ -f "$CODEX_JSON_FILE" ]] && rm -f "$CODEX_JSON_FILE" # Eventstream-Datei entfernen; ohne entstehen grosse JSONL-Reste pro Lauf.
  [[ -n "$CODEX_LAST_MSG_FILE" ]] && [[ -f "$CODEX_LAST_MSG_FILE" ]] && rm -f "$CODEX_LAST_MSG_FILE" # Letzte Nachricht entfernen; ohne bleibt veralteter Review-Text liegen.
}
trap cleanup EXIT # Cleanup immer registrieren; ohne bleiben Tempdateien auch bei Fehlern oder Timeout erhalten.

CHECK_MODE="${CHECK_MODE:-commit}" # Standard-Mode explizit setzen; ohne variiert das Verhalten je nach Umgebung.
[[ "$CHECK_MODE" == "diff" ]] && CHECK_MODE="snippet" # Historischen Alias normalisieren; ohne existieren zwei Begriffe fuer denselben Modus.
[[ "$CHECK_MODE" == "mix" ]] && CHECK_MODE="full" # Mix-Workflow auf Full-Scan abbilden; ohne waere Refactor-Mode missverstaendlich.
[[ "$CHECK_MODE" == "full" ]] && CHECK_MODE="snippet" # Full-Datei-Input fuer geaenderte Dateien nutzen; ohne wuerde dieses Script den ganzen Repo-Stand aufblasen.

DIFF_EXCLUDE_SPEC=':(exclude)*.tsbuildinfo' # Generierte Build-Artefakte ausschliessen; ohne erzeugen sie falsche Kommentar-Abzuege.
LIMIT_BYTES="${SHIM_AI_DIFF_LIMIT_BYTES:-51200}" # Groessenlimit lesen; ohne kann der Prompt fuer Codex zu gross werden.
APPENDED_FILES=0 # Zaehlt vollstaendig aufgenommene Dateien; ohne koennen wir die erste Datei nicht bevorzugt zulassen.

CHANGED_FILES_FILE="$(mktemp)" # Temp-Datei fuer Pfadliste anlegen; ohne haben wir keine Zwischenablage fuer git diff --name-only.
INPUT_FILE="$(mktemp)" # Temp-Datei fuer Voll-Datei-Bloecke anlegen; ohne koennen wir Prompt-Teile nicht geordnet sammeln.
CODEX_JSON_FILE="$(mktemp)" # Eventstream-Datei reservieren; ohne kann codex exec nicht sauber in eine Datei schreiben.
CODEX_LAST_MSG_FILE="$(mktemp)" # Fallback-Datei fuer --output-last-message reservieren; ohne geht diese Rueckfallebene verloren.

#
# collect_changed_paths: Ermittelt betroffene Dateipfade passend zum CHECK_MODE.
# Zweck: Der Explanation-Check soll nur wirklich geaenderte Dateien pruefen. Ohne diese Sammlung wuerde entweder zu viel oder gar nichts an Codex gehen.
# Eingabe: `mode` (`commit` oder `snippet`). Ausgabe: schreibt Pfade nach CHANGED_FILES_FILE.
collect_changed_paths() { # Sammellogik als Funktion kapseln; ohne waere CHECK_MODE-Verzweigung im Hauptfluss schwer wartbar.
  local mode="$1" # Zielmodus uebernehmen; ohne wissen wir nicht, ob Commit- oder Worktree-Dateien gesucht werden muessen.
  local range="" # Vergleichsrange vorbelegen; ohne koennen wir spaeter keinen Fallback-Diff setzen.
  local empty_tree="4b825dc642cb6eb9a060e54bf8d69288fbee4904" # Leeren Baum fuer den ersten Commit merken; ohne funktioniert Initial-Commit nicht.

  if [[ "$mode" == "commit" ]]; then # Commit-Modus separat behandeln; ohne wuerden Worktree-Aenderungen den Commit-Check verfaelschen.
    range="HEAD~1..HEAD" # Standard-Commitrange setzen; ohne commit-Mode nicht auf den letzten Commit begrenzt.
    if ! git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
      range="${empty_tree}..HEAD" # Beim ersten Commit gegen leeren Baum diffen; ohne gibt es dort keine Referenz.
    fi
    git diff --name-only --diff-filter=ACMR "$range" -- . "$DIFF_EXCLUDE_SPEC" >> "$CHANGED_FILES_FILE" 2>/dev/null || true # Nur neue/geaenderte lesbare Dateien sammeln.
    return
  fi

  git diff --name-only --diff-filter=ACMR -- . "$DIFF_EXCLUDE_SPEC" >> "$CHANGED_FILES_FILE" 2>/dev/null || true # Unstaged Pfade sammeln; ohne fehlen lokale Fixes.
  git diff --cached --name-only --diff-filter=ACMR -- . "$DIFF_EXCLUDE_SPEC" >> "$CHANGED_FILES_FILE" 2>/dev/null || true # Staged Pfade sammeln; ohne bleibt Index-Code ungeprueft.

  if [[ ! -s "$CHANGED_FILES_FILE" ]]; then # Nur bei leerer Worktree-Liste auf Branch-/Commit-Fallbacks gehen; ohne wuerden echte lokale Aenderungen unnötig vermischt.
    if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then # Upstream nur nutzen, wenn einer existiert; ohne scheitert dieser Pfad auf lokalen Branches.
      range="@{u}...HEAD" # Upstream-Range fuer cleanen Worktree waehlen; ohne sieht pre-push keine reinen Commit-Aenderungen.
    elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then # Sonst auf letzten lokalen Commit zurueckfallen; ohne gibt es ohne Upstream keinen Vergleich.
      range="HEAD~1...HEAD" # Lokalen Fallback nutzen; ohne fehlt auf Branches ohne Upstream jede Vergleichsbasis.
    fi
    if [[ -n "$range" ]]; then # Nur mit sinnvoller Range einen zusaetzlichen Diff fahren; ohne laeuft git diff mit leerem Bereich.
      git diff --name-only --diff-filter=ACMR "$range" -- . "$DIFF_EXCLUDE_SPEC" >> "$CHANGED_FILES_FILE" 2>/dev/null || true # Auch pushed-but-clean Dateien einsammeln.
    fi
  fi
}

#
# append_if_fits: Fuegt einen vorbereiteten Dateiblock nur an, wenn das Byte-Limit eingehalten bleibt.
# Zweck: Vollstaendige Dateien senden, aber den Prompt nicht ueber das konfigurierte Limit aufblasen. Ohne Limit steigen Tokens und Timeout-Risiko stark.
# Eingabe: Pfad auf eine Temp-Datei mit genau einem Voll-Datei-Block. Ausgabe: kein Rueckgabewert.
append_if_fits() { # Byte-Limit-Pruefung als eigenen Schritt kapseln; ohne ist Voll-Datei-Logik und Groessenkontrolle vermischt.
  local block_file="$1" # Kandidat fuer den Prompt-Anhang.
  local current_bytes=0 # Aktuelle Prompt-Groesse vorbelegen; ohne ist die Rechenlogik mit set -u fragiler.
  local block_bytes=0 # Groesse des neuen Blocks vorbelegen; ohne fehlt die Vergleichsbasis.
  [[ -f "$block_file" ]] || return 0 # Fehlende Blockdateien still ignorieren; ohne bricht der gesamte Check an einer Datei.
  current_bytes="$(wc -c < "$INPUT_FILE" 2>/dev/null || echo 0)" # Bisherige Prompt-Groesse messen; ohne kann das Limit nicht berechnet werden.
  block_bytes="$(wc -c < "$block_file" 2>/dev/null || echo 0)" # Groesse des neuen Blocks messen; ohne keine Additionspruefung.
  if [[ "$APPENDED_FILES" -gt 0 ]] && [[ $((current_bytes + block_bytes)) -gt "$LIMIT_BYTES" ]]; then
    return 0 # Spaetere Dateien ueberspringen, wenn sie das Limit sprengen; ohne entstuenden wieder Trunkierungen.
  fi
  cat "$block_file" >> "$INPUT_FILE" # Vollstaendigen Block anhaengen; ohne sieht Codex diese Datei nie.
  APPENDED_FILES=$((APPENDED_FILES + 1)) # Erfolgreiche Aufnahme zaehlen; ohne funktioniert die Erste-Datei-Sonderregel nicht.
}

#
# append_worktree_file: Schreibt eine geaenderte Datei aus dem aktuellen Worktree als Voll-Datei-Block in den Prompt.
# Zweck: Snippet-Pruefungen sollen den echten lokalen Code bewerten. Ohne diese Funktion wuerde der Check nur committed Inhalte sehen.
# Eingabe: relativer Dateipfad. Ausgabe: kein Rueckgabewert.
append_worktree_file() { # Worktree-Variante fuer Snippet-Modus kapseln; ohne muesste der Hauptfluss Datei-IO selbst bauen.
  local path="$1" # Relativen Pfad uebernehmen; ohne wissen wir nicht, welche Datei gelesen werden soll.
  local block_file="" # Temp-Puffer fuer genau einen Voll-Datei-Block.
  [[ -f "$ROOT_DIR/$path" ]] || return 0 # Fehlende Dateien still ignorieren; ohne wuerde geloeschter Code den Check hart abbrechen.
  block_file="$(mktemp)" # Einzelblockdatei anlegen; ohne ist keine Groessenpruefung vor dem globalen Prompt moeglich.
  { # Dateiblock atomar in eine Temp-Datei schreiben; ohne ist die spaetere Limit-Pruefung nicht isoliert.
    printf '\n===== FILE: %s =====\n' "$path" # Dateitrenner setzen; ohne verschwimmen mehrere Dateien im Prompt.
    cat "$ROOT_DIR/$path" # Vollstaendigen lokalen Dateiinhalt uebernehmen; ohne verletzt der Input wieder die Full-Files-Regel.
    printf '\n' # Leerzeile als Abschluss; ohne koennen Blockgrenzen schlechter lesbar sein.
  } > "$block_file"
  append_if_fits "$block_file" # Block nur komplett anhaengen; ohne entstuenden erneut Teil-Snippets.
  rm -f "$block_file" # Einzelblock loeschen; ohne bleiben pro Datei Temp-Artefakte uebrig.
}

#
# append_commit_file: Schreibt die Version einer geaenderten Datei aus HEAD als Voll-Datei-Block in den Prompt.
# Zweck: Commit-Modus soll stabil den letzten committed Stand bewerten. Ohne diese Funktion wuerde CHECK_MODE=commit versehentlich den Worktree lesen.
# Eingabe: relativer Dateipfad. Ausgabe: kein Rueckgabewert.
append_commit_file() { # Commit-Variante getrennt kapseln; ohne ist nicht klar, woher CHECK_MODE=commit seinen Inhalt bezieht.
  local path="$1" # Relativen Pfad uebernehmen; ohne kann `git show` keine Datei adressieren.
  local block_file="" # Temp-Puffer fuer den committed Voll-Datei-Block.
  block_file="$(mktemp)" # Einzelblockdatei anlegen; ohne ist keine Groessenpruefung moeglich.
  { # Committed Voll-Datei-Block in Tempdatei aufbauen; ohne kann dieselbe Limit-Logik nicht wiederverwendet werden.
    printf '\n===== FILE: %s =====\n' "$path" # Dateitrenner setzen; ohne koennen mehrere Dateien im Prompt kollidieren.
    git show "HEAD:$path" 2>/dev/null || true # Dateiinhalt aus HEAD lesen; ohne commit-Mode nicht deterministisch auf dem letzten Commit.
    printf '\n' # Leerzeile als Blockabschluss; ohne kleben Dateien direkt aneinander.
  } > "$block_file"
  append_if_fits "$block_file" # Nur komplette committed Datei aufnehmen; ohne waeren wir wieder bei Teil-Snippets.
  rm -f "$block_file" # Einzelblock loeschen; ohne verbleiben Temp-Dateien nach jedem Lauf.
}

#
# is_explanation_eligible_path: Prueft, ob ein Dateipfad in einem Format vorliegt, das den Full-Explanation-Standard ueberhaupt tragen kann.
# Zweck: Nur kommentierbare Code-Dateien an Codex senden. Ohne Filter laufen JSON/HTML-Dateien in einen Standard, den sie syntaktisch gar nicht erfuellen koennen.
# Eingabe: relativer Dateipfad. Ausgabe: Exit 0 bei geeignetem Codeformat, sonst Exit 1.
is_explanation_eligible_path() { # Formatfilter zentral kapseln; ohne verteilen wir dieselbe Dateiendungslogik ueber mehrere Stellen.
  local path="$1" # Zu pruefenden relativen Dateipfad uebernehmen; ohne weiss die Funktion nicht, welches Format bewertet werden soll.
  case "$path" in
    *.sh|*.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
      return 0 # Kommentierbare Script-/Code-Dateien akzeptieren; ohne verlieren wir genau die Dateien, fuer die der Check gedacht ist.
      ;;
    *)
      return 1 # Nicht-kommentierbare oder nicht-zielgerichtete Formate auslassen; ohne erzeugen JSON/HTML/Assets falsche Abzuege.
      ;;
  esac
}

collect_changed_paths "$CHECK_MODE" # Passende Dateiliste fuer den Modus sammeln; ohne bleibt der Prompt leer oder falsch.

if [[ ! -s "$CHANGED_FILES_FILE" ]]; then # Frueh abbrechen, wenn es nichts Relevantes zu pruefen gibt; ohne wuerde ein leerer Prompt an Codex gehen.
  echo "Skipping Full Explanation check: no changed files for CHECK_MODE=$CHECK_MODE." >&2
  exit 0
fi

sort -u "$CHANGED_FILES_FILE" -o "$CHANGED_FILES_FILE" # Doppelte Pfade entfernen; ohne landet dieselbe Datei mehrfach im Prompt.

while IFS= read -r changed_path; do # Alle geaenderten Pfade nacheinander in Voll-Datei-Bloecke ueberfuehren; ohne erreicht nur die erste Datei den Prompt.
  [[ -z "$changed_path" ]] && continue # Leere Zeilen ignorieren; ohne wuerden append-Funktionen mit leerem Pfad laufen.
  is_explanation_eligible_path "$changed_path" || continue # Nur kommentierbare Code-Dateien weiterreichen; ohne laufen JSON/HTML in einen unpassenden Erklaerungsstandard.
  if [[ "$CHECK_MODE" == "commit" ]]; then # Zwischen Commit- und Worktree-Lesen verzweigen; ohne mischt der Check zwei verschiedene Wahrheiten.
    append_commit_file "$changed_path" # Im Commit-Modus committed Datei lesen; ohne waere das Ergebnis nicht commit-stabil.
  else # Standardfall fuer snippet/worktree-Mode; ohne ist nicht dokumentiert, warum ungecommitteter Code gelesen wird.
    append_worktree_file "$changed_path" # Sonst Worktree-Datei lesen; ohne fehlen ungecommittete Fixes im Review.
  fi
done < "$CHANGED_FILES_FILE"

if [[ ! -s "$INPUT_FILE" ]]; then # Auch nach dem Lesen nur mit echtem Voll-Datei-Inhalt weitermachen; ohne prueft Codex wieder keinen realen Code.
  echo "Skipping Full Explanation check: changed files resolved to no readable full-file content." >&2
  exit 0
fi

INPUT_LIMITED="$(cat "$INPUT_FILE")" # Vollstaendigen Prompt aus den aufgenommenen Dateien zusammensetzen; ohne bekommt Codex keinen Eingabetext.

PROMPT=$(cat << 'PROMPT_END' # Bewertungsanweisung als einzelnes Heredoc bauen; ohne wird das JSON-Format fuer Codex leichter inkonsistent.
Du prüfst ausschließlich die Einhaltung des Standards "Mandatory Full Explanation Comments". Keine Architektur-, Performance- oder Sicherheitsbewertung.

Regeln (alle müssen erfüllt sein):
1. Jede Funktion hat eine Docstring: warum sie existiert, welches Problem sie löst, was Ein-/Ausgaben bedeuten.
2. Jede nicht-triviale Zeile hat einen Inline-Kommentar: was passiert, warum nötig, was kaputtgeht wenn entfernt.
3. Kein "nur sauberer Code" ohne Erklärung; Erklärung ist Pflicht.
4. Ausgabe sind immer vollständige Dateien, nie Teil-Snippets.

Zusatzregel: Ist der Code nicht vollständig kommentiert, gilt die Ausgabe als ungültig.

Starte mit 100 Punkten. Für jeden Verstoß: Abzug (z. B. -10 für fehlende Docstrings, -5 pro fehlender/trivialer Kommentar bei nicht-trivialen Zeilen). verdict: "ACCEPT" nur wenn score >= 95 und alle vier Regeln erfüllt; sonst "REJECT".

Bei REJECT: In der "reason" der deductions kann kurz stehen, dass der Code nachgebessert (Docstrings/Inline-Kommentare ergänzt) und der Check erneut ausgeführt werden muss, bis er besteht.

Gib das Ergebnis NUR als ein einziges gültiges JSON-Objekt aus, kein anderer Text. Format:
{"score": number, "deductions": [{"point": "Kurzname", "minus": number, "reason": "Begründung"}], "verdict": "ACCEPT" oder "REJECT"}

--- VOLLSTAENDIGE DATEIEN ---
PROMPT_END
)
PROMPT="${PROMPT}
${INPUT_LIMITED}" # Regelprompt und Voll-Datei-Inhalt zusammenfuehren; ohne bewertet Codex nur Theorie statt realen Code.

if ! command -v codex >/dev/null 2>&1; then # Codex-CLI vor dem eigentlichen Lauf absichern; ohne endet das Script spaeter mit einem weniger klaren Kommando-Fehler.
  echo "Skipping Full Explanation check: Codex CLI not available (run codex login or install codex in PATH)." >&2 # Klaren Skip-Grund ausgeben; ohne wirkt der Lauf stillschweigend defekt.
  exit 0
fi

TIMEOUT_SEC="${SHIM_AI_TIMEOUT_SEC:-180}" # Timeout aus Konfiguration lesen; ohne sind laengere Repos schwer steuerbar.
echo "Running Full Explanation check (Codex)..." >&2

CODEX_RC=0 # Exit-Code vorinitialisieren; ohne ist spaetere Fehlerbehandlung mit set -u unklarer.
if command -v timeout >/dev/null 2>&1; then # Timeout bevorzugen, wenn das System es anbietet; ohne kann der Review-Lauf unendlich haengen.
  timeout "$TIMEOUT_SEC" codex exec --json -o "$CODEX_LAST_MSG_FILE" "$PROMPT" 2>/dev/null > "$CODEX_JSON_FILE" || CODEX_RC=$? # Codex-Lauf mit Timeout absichern; ohne kann der Check haengen bleiben.
else # Auf Plattformen ohne timeout(1) sauber auf direkten Codex-Lauf fallen; ohne waere das Script dort unbrauchbar.
  codex exec --json -o "$CODEX_LAST_MSG_FILE" "$PROMPT" 2>/dev/null > "$CODEX_JSON_FILE" || CODEX_RC=$? # Fallback ohne timeout(1); ohne laeuft das Script auf manchen Systemen gar nicht.
fi

if [[ $CODEX_RC -eq 124 ]] || [[ $CODEX_RC -eq 142 ]]; then # Timeout-Codes explizit als Zeitueberschreitung behandeln; ohne erscheinen sie als generischer Fehler.
  echo "Full Explanation check timed out after ${TIMEOUT_SEC}s." >&2 # Timeout explizit melden; ohne ist unklar, ob Codex oder Parsing scheiterte.
  exit 1
fi

if [[ $CODEX_RC -ne 0 ]]; then # Alle anderen Nicht-Null-Exits als Codex-Fehler behandeln; ohne laufen wir mit kaputten Daten weiter.
  echo "Full Explanation check command failed (exit $CODEX_RC)." >&2 # Nicht-Timeout-Fehler kenntlich machen; ohne fehlt die grobe Einordnung des Ausfalls.
  sed -n '1,50p' "$CODEX_JSON_FILE" >&2 # Rohstream anreissen; ohne ist die Fehlerursache kaum nachvollziehbar.
  exit 1
fi

INPUT_T="" # Input-Tokenzahl vorbelegen; ohne kann spaetere Anzeige auf unset-Werte laufen.
OUTPUT_T="" # Output-Tokenzahl vorbelegen; ohne ist die Report-Ausgabe fragil.
RESULT_TEXT="" # Assistenten-Text vorbelegen; ohne ist der Fallback-Pfad spaeter uneindeutig.
if command -v jq >/dev/null 2>&1; then # Eventstream nur mit jq strukturierte auswerten; ohne bleibt nur der Fallback-Pfad.
  while IFS= read -r line; do # JSONL-Events einzeln lesen; ohne kann Usage- und Antwort-Extraktion nicht sequenziell erfolgen.
    [[ -z "$line" ]] && continue # Leere Eventstream-Zeilen ignorieren; ohne laeuft jq unnoetig auf Leerstrings.
    type="$(echo "$line" | jq -r '.type // empty')" # Event-Typ extrahieren; ohne koennen Usage und Assistant-Text nicht unterschieden werden.
    if [[ "$type" == "turn.completed" ]]; then # Usage-Information nur aus dem Abschluss-Event lesen; ohne koennen Tokens aus Zwischenereignissen stammen.
      INPUT_T="$(echo "$line" | jq -r '.usage.input_tokens // empty')" # Input-Tokens fuer den Report lesen; ohne fehlt spaetere Kosten-/Groessenangabe.
      OUTPUT_T="$(echo "$line" | jq -r '.usage.output_tokens // empty')" # Output-Tokens fuer den Report lesen; ohne fehlt die komplette Usage-Summe.
    fi
    if [[ "$type" == "item.completed" ]]; then # Einzelne Items auf Assistant-Nachrichten pruefen; ohne geht der eigentliche Review-Text verloren.
      item_type="$(echo "$line" | jq -r '.item.item_type // empty')" # Item-Typ lesen; ohne kann Assistant-Text nicht gezielt erkannt werden.
      if [[ "$item_type" == "assistant_message" ]]; then # Nur Assistant-Text uebernehmen; ohne koennte Tool-/Systemtext das JSON-Parsing stoeren.
        RESULT_TEXT="$(echo "$line" | jq -r '.item.text // empty')" # Letzte Assistant-Antwort uebernehmen; ohne bleibt spaeter kein parsebarer Review-Text.
      fi
    fi
  done < "$CODEX_JSON_FILE"
fi

if [[ -z "$RESULT_TEXT" ]] && [[ -s "$CODEX_LAST_MSG_FILE" ]]; then # Nur wenn der Eventstream nichts Brauchbares lieferte, auf die letzte Nachricht ausweichen.
  RESULT_TEXT="$(cat "$CODEX_LAST_MSG_FILE")" # Fallback auf --output-last-message nutzen; ohne geht ein valider Review-Text evtl. verloren.
fi

REVIEW_RATING=0 # Numerischen Score vorbelegen; ohne bleibt bei Parse-Fehlern ein undefinierter Wert zurueck.
REVIEW_VERDICT="REJECT" # Konservativen Default setzen; ohne koennte ein Parse-Fehler faelschlich als PASS enden.
REVIEW_DEDUCTIONS="" # Deductions vorbelegen; ohne ist spaetere Report-Ausgabe unklar.

if [[ -n "$RESULT_TEXT" ]]; then # Parsing nur versuchen, wenn ueberhaupt Antworttext vorhanden ist; ohne laufen JSON-Schritte auf leerem Input.
  RESULT_JSON=""
  if command -v node >/dev/null 2>&1; then # Node fuer robustes JSON-Substring-Parsing nutzen; ohne wird Shell-Regex schnell fragil.
    RESULT_TMP="$(mktemp)" # Temp-Datei fuer die Raw-Response anlegen; ohne wird das Node-Parsing schwerer/quoter-anfaelliger.
    printf '%s' "$RESULT_TEXT" > "$RESULT_TMP" # Raw-Response unveraendert ablegen; ohne kann Regex-Parsing an Shell-Quoting scheitern.
    RESULT_JSON=$(node -e "
      const fs = require('fs');
      const d = fs.readFileSync(process.argv[1], 'utf8');
      const m = d.match(/\{[\s\S]*\}/);
      if (!m) process.exit(1);
      try { console.log(JSON.stringify(JSON.parse(m[0]))); } catch (e) { process.exit(2); }
    " "$RESULT_TMP" 2>/dev/null) # Eingebettetes JSON aus der Raw-Response extrahieren; ohne kann Zusatzausgabe den Parser brechen.
    rm -f "$RESULT_TMP" # Parsing-Tempdatei entfernen; ohne bleibt pro Lauf eine zusaetzliche Hilfsdatei liegen.
  fi
  if [[ -n "$RESULT_JSON" ]] && command -v jq >/dev/null 2>&1; then # Nur valides JSON mit jq weiter zerlegen; ohne drohen Folgefehler im Report.
    REVIEW_RATING=$(echo "$RESULT_JSON" | jq -r '.score // 0') # Score aus dem JSON lesen; ohne bleibt nur der Default 0.
    REVIEW_VERDICT=$(echo "$RESULT_JSON" | jq -r '.verdict // "REJECT"') # Verdict aus dem JSON lesen; ohne bleibt immer REJECT.
    REVIEW_DEDUCTIONS=$(echo "$RESULT_JSON" | jq -r '.deductions // []') # Deductions fuer Report/STDERR auslesen; ohne fehlt jede Begruendung.
  fi
  [[ -z "$REVIEW_RATING" ]] && REVIEW_RATING=0 # Leeren Score absichern; ohne koennte spaetere Arithmetik fehlschlagen.
  [[ "$REVIEW_RATING" =~ ^[0-9]+$ ]] || REVIEW_RATING=0 # Nicht-numerische Werte auf 0 normieren; ohne ist der Pass-Check unsicher.
  [[ "$REVIEW_RATING" -lt 0 ]] 2>/dev/null && REVIEW_RATING=0 # Negative Scores abfangen; ohne waeren unsinnige Reportwerte moeglich.
  [[ "$REVIEW_RATING" -gt 100 ]] 2>/dev/null && REVIEW_RATING=100 # Obergrenze absichern; ohne kann ein kaputter Score den Report sprengen.
  REVIEW_VERDICT="$(echo "$REVIEW_VERDICT" | tr '[:lower:]' '[:upper:]')" # Verdict normalisieren; ohne koennen case-Varianten die Pass-Logik brechen.
  [[ "$REVIEW_VERDICT" != "ACCEPT" ]] && REVIEW_VERDICT="REJECT" # Nur exaktes ACCEPT akzeptieren; ohne reicht ein beliebiger Fremdwert.
fi

PASS=0 # PASS-Flag konservativ mit 0 starten; ohne koennen alte Werte aus dem Shell-Kontext stoeren.
if [[ "$REVIEW_VERDICT" == "ACCEPT" ]] && [[ "$REVIEW_RATING" -ge 95 ]]; then # Harte Pass-Schwelle gem. Check-Regel anwenden; ohne wird ACCEPT allein zu locker.
  PASS=1 # Nur hohes ACCEPT gilt als bestanden; ohne waere die Schwelle des Checks aufgeweicht.
fi

if [[ -n "$INPUT_T" && -n "$OUTPUT_T" ]]; then # Token-Summe nur mit beiden Werten berechnen; ohne kann Arithmetik auf leeren Variablen scheitern.
  TOTAL=$((INPUT_T + OUTPUT_T)) # Gesamt-Tokenzahl berechnen; ohne fehlt die zusammengefasste Usage im Log.
  echo "Token usage: ${INPUT_T} input, ${OUTPUT_T} output (total ${TOTAL})" >&2 # Usage fuer Debugging und Kostenbewusstsein ausgeben; ohne fehlt Kontext zur Promptgroesse.
else # Fallback, falls Codex keine Usage-Daten geliefert hat; ohne sieht fehlende Usage wie ein stiller Fehler aus.
  echo "Token usage: not reported by Codex CLI" >&2 # Fehlende Usage transparent machen; ohne bleibt die Ursache fuer leere Tokenzahlen unklar.
fi

REVIEWS_DIR="${SHIM_AI_REVIEW_DIR:-$ROOT_DIR/.shimwrapper/reviews}" # Report-Zielordner bestimmen; ohne landet der Lauf in keinem stabilen Reportpfad.
mkdir -p "$REVIEWS_DIR" # Report-Ordner sicher anlegen; ohne kann das Schreiben der Review-Datei scheitern.
REVIEW_FILE="$REVIEWS_DIR/explanation-check-$(date +%Y%m%d-%H%M%S).md" # Zeitgestempelten Reportnamen erzeugen; ohne werden alte Reports ueberschrieben.
BRANCH="" # Branchname vorbelegen; ohne ist die spaetere Report-Ausgabe uninitialisiert.
[[ -n "${GIT_BRANCH:-}" ]] && BRANCH="$GIT_BRANCH" || BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")" # Branch aus Env oder git lesen; ohne fehlt der Laufkontext im Report.
{ # Markdown-Report als einen Block schreiben; ohne verteilen sich einzelne Echo-Aufrufe leichter ueber mehrere Writes.
  echo "# Full Explanation Check — $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" # Reporttitel mit Zeitstempel schreiben; ohne fehlt die zeitliche Zuordnung des Laufs.
  echo "" # Leerzeile fuer lesbares Markdown einfuegen; ohne kleben Titel und Metadaten zusammen.
  echo "- **Branch:** $BRANCH" # Branch-Kontext dokumentieren; ohne ist spaeter unklar, auf welchem Stand der Check lief.
  echo "- **Mode:** $CHECK_MODE" # Eingesetzten Pruefmodus dokumentieren; ohne ist spaeter unklar, ob commit oder snippet lief.
  echo "- **Verdict:** $([ "$PASS" -eq 1 ] && echo "PASS" || echo "FAIL") ($REVIEW_VERDICT)" # Menschlichen Pass/Fail-Status plus Rohverdict festhalten; ohne fehlt die knappe Zusammenfassung.
  echo "- **Score:** ${REVIEW_RATING}%" # Prozentwert separat protokollieren; ohne ist die Schwere der Abzuege nicht direkt sichtbar.
  echo "- **Tokens:** ${INPUT_T:-?} input, ${OUTPUT_T:-?} output" # Tokenzahlen in den Report uebernehmen; ohne fehlt Prompt-/Antwort-Kontext fuer spaetere Analyse.
  echo "" # Abschnittstrenner fuer Markdown einfuegen; ohne leidet die Lesbarkeit des Reports.
  echo "## Deductions" # Ueberschrift fuer Abzuege schreiben; ohne ist der wichtigste Reportteil schwer auffindbar.
  echo "" # Leerzeile unter der Ueberschrift setzen; ohne rendert das Markdown dichter und schlechter scanbar.
  if [[ -n "$REVIEW_DEDUCTIONS" ]] && [[ "$REVIEW_DEDUCTIONS" != "[]" ]]; then # Deductions nur listen, wenn wirklich welche vorhanden sind; ohne wirkt jeder Lauf fehlerhaft.
    echo "$REVIEW_DEDUCTIONS" | jq -r '.[] | "- **\(.point)**: -\(.minus) — \(.reason)"' 2>/dev/null || echo "$REVIEW_DEDUCTIONS" # Deductions menschenlesbar ins Markdown schreiben.
  else # Sauberen No-Deductions-Fall dokumentieren; ohne bleibt offen, ob Parsing oder wirklich keine Abzuege vorlagen.
    echo "(none)" # Explizit keine Deductions markieren; ohne sieht ein leerer Abschnitt wie ein Schreibfehler aus.
  fi
  echo "" # Trennzeile vor dem Raw-Response-Abschnitt setzen; ohne laufen Listen und Rohdaten ineinander.
  echo "## Raw response" # Rohantwort-Abschnitt benennen; ohne weiss spaeter niemand, wo Debugdaten beginnen.
  echo "" # Markdown-Abstand vor dem Codeblock einfuegen; ohne wird der Block schwerer lesbar.
  echo '```' # Codeblock fuer die rohe Modellantwort oeffnen; ohne koennen JSON-Zeichen Markdown zerstoeren.
  [[ -n "$RESULT_TEXT" ]] && echo "$RESULT_TEXT" || echo "(no response text)" # Raw-JSON fuer spaetere Analyse konservieren; ohne fehlt die Debug-Basis.
  echo '```' # Codeblock wieder schliessen; ohne ist der restliche Report als Code formatiert.
} >> "$REVIEW_FILE"
echo "Report saved: $REVIEW_FILE" >&2 # Speicherort des Reports ausgeben; ohne muss der Nutzer den neuesten Report manuell suchen.

if [[ $PASS -eq 1 ]]; then # Abschliessenden Konsolenstatus am finalen Pass-Flag ausrichten; ohne koennen Report und STDERR auseinanderlaufen.
  echo "Full Explanation check: PASS" >&2 # Erfolgsstatus direkt fuer CLI-Nutzer sichtbar machen; ohne muss der Report geoeffnet werden.
else # Fehlerpfad fuer nicht bestandenen Check; ohne fehlt die direkte Rueckmeldung im Terminal.
  echo "Full Explanation check: FAIL" >&2 # Fehlstatus explizit ausgeben; ohne sieht der Lauf trotz Exit 1 schnell unklar aus.
  echo "→ Fix: add missing docstrings and inline comments, then re-run the check (e.g. npm run checks or scripts/run-checks.sh) until it passes. See AGENTS.md." >&2 # Naechsten Schritt direkt im Terminal nennen; ohne fehlt die unmittelbare Handlungsanweisung.
fi
echo "Score: ${REVIEW_RATING}%" >&2 # Endscore separat in die CLI schreiben; ohne muesste er aus dem Report extrahiert werden.
echo "Verdict: ${REVIEW_VERDICT}" >&2 # Rohverdict separat ausgeben; ohne ist nur PASS/FAIL, aber nicht ACCEPT/REJECT sichtbar.
if [[ -n "$REVIEW_DEDUCTIONS" ]] && [[ "$REVIEW_DEDUCTIONS" != "[]" ]]; then # Deductions nur bei Inhalt auch auf STDERR wiederholen; ohne entsteht leeres Rauschen.
  echo "Deductions:" >&2 # Deductions-Block fuer das Terminal kennzeichnen; ohne wirken die Einzelzeilen kontextlos.
  echo "$REVIEW_DEDUCTIONS" | jq -r '.[] | "  - \(.point): -\(.minus) — \(.reason)"' 2>/dev/null || echo "$REVIEW_DEDUCTIONS" >&2 # Deductions auch auf STDERR zusammenfassen; ohne sieht der Nutzer nur den Score.
fi

[[ $PASS -eq 1 ]] && exit 0 || exit 1
