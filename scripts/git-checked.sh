#!/usr/bin/env bash
# Shim wrapper for Git: run checks (optional), then call real git.
# Uses real git binary for all git calls so PATH-based shim recursion is avoided.
#
# Verantwortlichkeiten (bewusst in einer Datei): Binary-Resolution, Config, Arg-Parsing,
# Change-Detection, Policy (Push/Enforce), Check-Ausfuehrung, Single-Commit-Enforcement, exec git.
# Aufteilung in Module waere moeglich, erfordert aber anderes Invocation-Modell (Subprozesse/Env).
# cd "$PROJECT_ROOT" ist erforderlich, damit .shimwrappercheckrc und relative Skript-Pfade funktionieren.
# SHIM_* Variablen gelten als vertrauenswuerdig (Projekt/CI); bei unvertrauenswuerdiger Umgebung nur absolute Pfade unter PROJECT_ROOT nutzen.
# SHIM_PROJECT_ROOT: Vertrauens-Anker; wird von resolve_project_root genutzt. In CI/Projekt kontrolliert; bei unvertrauenswuerdiger Env nicht setzen.
# Fehlender Runner/Skript: Checks werden uebersprungen (weiches Verhalten), damit git trotzdem ausfuehrbar bleibt; SHIM_STRICT koennte hartes Fail ergaenzen.
set -euo pipefail # Strikt-Modus: Fehler sofort abbrechen, unset Variablen melden; ohne waeren stille Fehler moeglich.

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" # Verzeichnis des Shims (bin/ -> Projektroot); ohne waere Rekursionspruef-Pfad falsch.

# resolve_real_git: Ermittelt den Pfad zur echten Git-Binary.
# Zweck: Keine Rekursion (Shim ruft nicht sich selbst). Problem: PATH liefert sonst wieder das Shim. Eingabe: keine. Ausgabe: absoluter Pfad oder leer (stdout).
resolve_real_git() {
  # Env/Override: Explizit gesetzte Binary hat Vorrang; ohne waere Rekursion moeglich.
  local r="${SHIM_GIT_REAL_BIN:-${GIT_REAL_BIN:-}}"
  if [[ -z "$r" ]]; then
    # Fallback: command -v findet git in PATH; 2>/dev/null verhindert Fehlerausgabe bei Nichtvorhanden.
    r="$(command -v git 2>/dev/null || true)"
  fi
  # Rekursionsschutz: Pfad in node_modules oder unserem Wrapper-Verzeichnis = kein echtes git; zuruecksetzen.
  if [[ -n "$r" ]] && { [[ "$r" == *"node_modules"* ]] || [[ "$r" == "$WRAPPER_DIR"* ]]; }; then
    r=""
  fi
  if [[ -z "$r" ]]; then
    # Letzter Fallback: bekannte System-Pfade; ohne waere bei verdrehtem PATH kein git verfuegbar.
    for c in /usr/bin/git /usr/local/bin/git /opt/homebrew/bin/git; do
      if [[ -x "$c" ]]; then echo "$c"; return; fi
    done
  fi
  [[ -n "$r" ]] && echo "$r" # Nur ausgeben wenn wir einen gueltigen Pfad haben; ohne wuerde leerer Output weiterverwendet.
}

GIT_CMD="$(resolve_real_git)" # Einmal aufloesen; ohne muesste jede git-Aufrufstelle erneut aufloesen.

# resolve_project_root: Projekt-Root fuer .shimwrappercheckrc und run-checks.
# Zweck: Checks und Config liegen im Repo-Root. Problem: Ohne Root zeigen Pfade ins Leere. Eingabe: keine. Ausgabe: absoluter Pfad (stdout).
resolve_project_root() {
  # Env-Override: Ermoeglicht Tests/CI mit festem Root; ohne waere nur git/pwd moeglich.
  if [[ -n "${SHIM_PROJECT_ROOT:-}" ]]; then
    echo "$SHIM_PROJECT_ROOT"
    return
  fi
  if [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
    local root
    # Git-Repo-Root: rev-parse --show-toplevel; ohne waeren Config/Checks im falschen Verzeichnis.
    root="$("$GIT_CMD" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$root" ]]; then
      echo "$root"
      return
    fi
  fi
  # Fallback: aktuelles Verzeichnis; ohne waere bei nicht-git-Kontext kein Root definiert.
  pwd # Letzter Fallback; ohne waere bei nicht-git-Kontext kein Root definiert.
}

PROJECT_ROOT="$(resolve_project_root)" # Einmal ermitteln; ohne waeren CONFIG_FILE und Skript-Pfade relativ zum falschen Verzeichnis.
cd "$PROJECT_ROOT" # In Repo-Root wechseln; ohne laesst source und spätere Pfade fehlschlagen.

# canonical_under_root: Gibt Pfad nur aus wenn er unter root liegt (canonicalisiert). Path-Traversal- und Symlink-Schutz.
# Zweck: Kein source/bash von Pfaden ausserhalb PROJECT_ROOT. Problem: Env-Pfade mit .. oder Symlinks koennten sonst beliebige Dateien ausfuehren. Eingabe: path, root. Ausgabe: stdout nur wenn unter root, sonst leer. Ohne Funktion waere Path-Traversal moeglich.
canonical_under_root() {
  local path="$1" # Zu pruefender Pfad; ohne keine Pruefung moeglich.
  local root="$2" # Erlaubter Anchor (PROJECT_ROOT); ohne waere Unterverzeichnis-Check sinnlos.
  local cano=""
  if command -v realpath >/dev/null 2>&1; then
    cano="$(realpath -m "$path" 2>/dev/null)" # realpath -m: fehlende Teile erlaubt; GNU/BSD; ohne waere Symlink/.. nicht aufgeloest.
  elif command -v python3 >/dev/null 2>&1; then
    # Portable Fallback (macOS/BSD): Python os.path.realpath; Pfad als Arg uebergeben (kein Injection). Ohne waere auf macOS keine Canonicalisierung moeglich.
    cano="$(python3 -c 'import os, sys; p=sys.argv[1]; print(os.path.abspath(os.path.realpath(p)) if os.path.exists(p) else os.path.abspath(p))' "$path" 2>/dev/null)" || true
  fi
  if [[ -z "$cano" ]]; then
    # Letzter Fallback: .. ablehnen, Pfad unveraendert; ohne waere bei fehlendem realpath/python Path-Traversal moeglich.
    [[ "$path" == *".."* ]] && return 1
    cano="$path"
  fi
  [[ -z "$cano" ]] && return 1 # Kein gueltiger Pfad; ohne wuerde leerer String weiterverwendet.
  [[ "$cano" == "$root"/* ]] || [[ "$cano" == "$root" ]] && echo "$cano" # Nur ausgeben wenn unter root; ohne koennte ausserhalb liegender Pfad zurueckgegeben werden.
}

# Konfiguration: Projekt-RC oder Env; ohne waeren Timeouts/CHECK_MODE nicht konfigurierbar.
CONFIG_FILE="${SHIM_CONFIG_FILE:-$PROJECT_ROOT/.shimwrappercheckrc}"
# Path-Traversal-Schutz: Nur sourcen wenn Pfad canonical unter PROJECT_ROOT liegt; ohne koennte SHIM_CONFIG_FILE auf beliebige Datei zeigen.
CONFIG_CANO="$(canonical_under_root "$CONFIG_FILE" "$PROJECT_ROOT" || true)"
if [[ -n "$CONFIG_CANO" ]] && [[ -f "$CONFIG_CANO" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_CANO" # Variablen/Config laden; ohne waeren SHIM_*-Werte nicht gesetzt.
fi

ARGS_IN=("$@") # Roh-Argumente sichern; ohne waeren sie nach dem case verloren.
ARGS_TEXT_RAW=" ${*:-} " # Mit Leerzeichen fuer Substring-Checks (z. B. " --no-ai-review "); ohne waeren Flag-Checks fehleranfaellig.
GIT_ARGS=() # Reine Git-Argumente nach dem Parsing; ohne wuerde exec git falsche Args bekommen.
CHECKS_PASSTHROUGH=() # Shim-Flags die an run-checks durchgereicht werden; ohne waeren --no-ai-review etc. ignoriert.

RUN_CHECKS=true # Standard: Checks laufen; Env/case koennen abschalten.
CHECKS_ONLY=false # Wenn true: nur Checks, danach exit ohne git; fuer "git --checks-only".

# is_push_command: Liefert 0, wenn "push" als Token in GIT_ARGS vorkommt (beliebige Position).
# Zweck: Push-Erkennung auch bei "git -C repo push" / "git --no-pager push". Problem: Nur GIT_ARGS[0] wuerde diese Faelle verpassen. Trade-off: "git commit -m push" wird als Push erkannt (selten; dann laufen Checks). Eingabe: keine (nutzt GIT_ARGS). Ausgabe: Exit-Code 0/1.
is_push_command() {
  local a
  for a in "${GIT_ARGS[@]}"; do # Jedes Arg prufen; "push" kann bei "git -C dir push" nicht an Index 0 stehen.
    [[ "$a" == "push" ]] && return 0 # Treffer: Token "push" gefunden; ohne waere Push-Erkennung unvollstaendig.
  done
  return 1 # Kein "push" gefunden; ohne waere RuECKGABE bei Nicht-Push unklar.
}

# build_checks_passthrough_filtered: Baut CHECKS_PASSTHROUGH_FILTERED; bei push ohne --no-ai-review.
# Zweck: Ein zentraler Ort fuer die Filterlogik (DRY); Push erzwingt AI-Review. Problem: Ohne zentrale Funktion waere die Filterlogik an zwei Stellen dupliziert. Eingabe: keine. Ausgabe: setzt CHECKS_PASSTHROUGH_FILTERED (Array).
build_checks_passthrough_filtered() {
  if is_push_command; then
    # Bei Push: --no-ai-review ausfiltern, damit run-checks AI-Review nicht deaktivieren kann.
    CHECKS_PASSTHROUGH_FILTERED=()
    for a in "${CHECKS_PASSTHROUGH[@]}"; do
      [[ "$a" != "--no-ai-review" ]] && CHECKS_PASSTHROUGH_FILTERED+=("$a") # Nur andere Flags durchlassen; ohne koennte User Push-Bypass erzwingen.
    done
  else
    # Kein Push: alle Passthrough-Argumente unveraendert durchreichen.
    CHECKS_PASSTHROUGH_FILTERED=("${CHECKS_PASSTHROUGH[@]}") # Kopie; ohne waere Filterung bei Nicht-Push trotzdem aktiv.
  fi
}

# matches_command_list: Prueft, ob einer der Begriffe in list im Text vorkommt (z. B. "push").
# Zweck: SHIM_GIT_ENFORCE_COMMANDS gegen die Nutzer-Eingabe matchen. Problem: Ohne Match wuessten wir nicht, ob Checks fuer diesen Befehl laufen sollen. Eingabe: list (kommasepariert), text (Befehlskette). Ausgabe: Exit-Code 0/1.
matches_command_list() {
  local list="$1"
  local text="$2"

  # Normalisierung: case-insensitives Matching; ohne waeren "Push" und "push" unterschiedlich.
  list="$(echo "$list" | tr '[:upper:]' '[:lower:]')"
  text="$(echo "$text" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$list" ]] || [[ "$list" == "all" ]]; then
    return 0 # Leer oder "all" = immer matchen; ohne waere Enforce-Liste nicht konfigurierbar.
  fi
  if [[ "$list" == "none" ]]; then
    return 1 # Explizit keine Befehle erzwingen; ohne waere "none" wie "all" behandelt.
  fi

  # Liste an Kommas splitten; Leerzeichen um Items mit xargs entfernen.
  IFS=',' read -r -a items <<< "$list" # Items einzeln prufen; ohne waere nur exakter String-Match moeglich.
  for item in "${items[@]}"; do
    item="$(echo "$item" | xargs)" # Trim; ohne verhindern Leerzeichen in der Config das Match.
    [[ -z "$item" ]] && continue # Leere Eintraege ueberspringen; ohne wuerde "" im Text matchen.
    # Wortgrenze: " $item " verhindert Teilstring-Treffer (z. B. "push" nicht in "git pushurl").
    if [[ "$text" == *" $item "* ]]; then
      return 0 # Treffer; ohne waere kein positives Ergebnis signalisiert.
    fi
  done
  return 1 # Kein Item hat gematcht; ohne waere "nicht in Liste" nicht von "leer" unterscheidbar.
}

# trim: Entfernt fuehrende und nachfolgende Leerzeichen. Zweck: Konfig-Werte normalisieren. Problem: Ohne Trim koennten "push" und " push " nicht matchen. Eingabe: ein String. Ausgabe: getrimmter String (stdout).
trim() {
  local s="$1" # Eingabe-String; ohne waere keine Normalisierung moeglich.
  # Fuehrende/nachfolgende Leerzeichen entfernen; ohne waeren Konfig-Werte mit Spaces falsch.
  # shellcheck disable=SC2001
  s="$(echo "$s" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" # sed: Anfang/Ende; ohne blieben Spaces im Prefix-Match.
  echo "$s" # Getrimmten Wert ausgeben; ohne haette Aufrufer keinen Rueckgabewert.
}

# has_backend_changes: Prueft, ob in der Dateiliste Pfade unter Backend-Mustern vorkommen.
# Zweck: Backend-Checks nur bei Aenderungen z. B. in supabase/functions. Problem: Ohne wuerden immer alle Checks laufen. Eingabe: files (mehrzeilig), patterns ueber Env. Ausgabe: Exit-Code 0/1.
has_backend_changes() {
  local files="$1" # Mehrzeilige Dateiliste (z. B. diff --name-only); ohne keine Pruefung moeglich.
  local patterns="${SHIM_BACKEND_PATH_PATTERNS:-supabase/functions,src/supabase/functions}" # Env oder Default; ohne feste Liste.
  local line=""
  local raw=""
  local prefix=""

  while IFS= read -r line; do # Zeile fuer Zeile; ohne wuerde nur eine Zeile geprueft.
    [[ -z "$line" ]] && continue # Leerzeilen ueberspringen; ohne koennte leerer String matchen.
    IFS=',' read -r -a items <<< "$patterns" # Pattern-Liste aufsplitten; ohne nur ein Pattern.
    for raw in "${items[@]}"; do # Jedes Pattern prufen; ohne wuerde nur erstes Pattern gelten.
      prefix="$(trim "$raw")" # Normalisieren; ohne verhindern Spaces das Match.
      prefix="${prefix#/}" # Fuehrenden Slash entfernen; ohne waere "supabase" != "/supabase".
      prefix="${prefix%/}" # Trailing Slash entfernen; ohne waere Vergleich mit "$prefix/" inkonsistent.
      [[ -z "$prefix" ]] && continue # Leeres Pattern ueberspringen; ohne wuerde jeder Pfad matchen.
      # Pruefen ob Dateipfad mit Muster beginnt; ohne waeren Backend-Checks nie getriggert.
      if [[ "$line" == "$prefix/"* ]]; then
        return 0 # Treffer: mindestens eine Datei unter Backend-Pfad; ohne kein positives Ergebnis.
      fi
    done # Ende Pattern-Schleife; naechste Zeile aus files.
  done <<< "$files" # Mehrzeilige Variable als Eingabe fuer while; ohne waere nur eine Zeile verarbeitet.

  return 1 # Kein Treffer; ohne waere "keine Backend-Aenderung" nicht signalisiert.
}

# Arg-Parsing: Shim-Flags auslesen, Rest als GIT_ARGS; ohne waeren --no-checks etc. an git weitergegeben.
for arg in "${ARGS_IN[@]}"; do
  case "$arg" in
    --no-checks) RUN_CHECKS=false ;; # Checks komplett deaktivieren; ohne waere nur Env moeglich.
    --checks-only) CHECKS_ONLY=true ;; # Nur Checks, danach exit; fuer "git --checks-only".
    --no-ai-review|--ai-review) CHECKS_PASSTHROUGH+=("$arg") ;; # An run-checks durchreichen; bei Push wird --no-ai-review gefiltert.
    --no-explanation-check|--explanation-check) CHECKS_PASSTHROUGH+=("$arg") ;; # An run-checks durchreichen; ohne waere Flag wirkungslos.
    *) GIT_ARGS+=("$arg") ;; # Alles andere ist Git-Argument; ohne wuerde git sie nicht sehen.
  esac
done

[[ -n "${SHIM_DISABLE_CHECKS:-}" ]] && RUN_CHECKS=false # Env-Bypass; ohne waere nur --no-checks moeglich.
case "${SHIM_ENABLED:-1}" in
  0|false|FALSE|no|NO|off|OFF) RUN_CHECKS=false ;; # Shim global abschaltbar; ohne muesste User den Shim entfernen.
esac

if [[ "${#GIT_ARGS[@]}" -eq 0 ]] && [[ "$CHECKS_ONLY" != true ]]; then # Weder reines --checks-only noch git-Args; Fehler.
  echo "No git command provided. Usage: git [shim flags] <git args>" >&2 # Stderr: Nutzer hinweisen; ohne keine Fehlermeldung.
  echo "Shim flags: --no-checks --checks-only --no-ai-review --no-explanation-check" >&2 # Hilfetext; ohne wuesste User nicht welche Flags es gibt.
  exit 1 # Ohne exit wuerde Script mit leeren GIT_ARGS weiterlaufen und spaeter exec fehlschlagen.
fi

# Nur bei erzwungenen Befehlen (z. B. push) Checks laufen lassen; sonst z. B. bei "git status" keine Checks.
ARGS_TEXT=" ${GIT_ARGS[*]:-} " # Leerzeichen fuer matches_command_list; ohne waere "push" nicht als Wort erkennbar.
if [[ "$CHECKS_ONLY" != true ]]; then # Bei --checks-only keine Enforce-Logik; User will nur Checks.
  enforce_list="${SHIM_GIT_ENFORCE_COMMANDS:-push}" # Konfigurierbar; Default push.
  if ! matches_command_list "$enforce_list" "$ARGS_TEXT"; then # Kein Match: Befehl nicht in Enforce-Liste.
    RUN_CHECKS=false # Befehl nicht in Liste: Checks nicht erzwungen; ohne wuerden z. B. "git status" Checks ausloesen.
  fi
fi

# resolve_checks_script: Liefert den absoluten Pfad zum Check-Skript (run-checks.sh oder SHIM_GIT_CHECKS_SCRIPT).
# Zweck: Check-Skript bei wechselndem CWD finden. Problem: Ohne Absolutpfad schlaegt bash "$script" fehl. Eingabe: keine. Ausgabe: absoluter Pfad oder leer (stdout).
resolve_checks_script() {
  local script="${SHIM_GIT_CHECKS_SCRIPT:-}" # Env fuer Git-Shim-spezifisches Skript; Vorrang vor SHIM_CHECKS_SCRIPT.
  local script_cano # Immer local, damit in beiden Branches kein globaler Zustand geschrieben wird.
  if [[ -n "$script" ]]; then
    if [[ "$script" != /* ]]; then
      script="$PROJECT_ROOT/$script" # Relativer Pfad: vom Repo-Root aufloesen; ohne waere Pfad bei anderem CWD falsch.
    fi
    # Path-Traversal-Schutz: Canonicalisierung; nur zurueckgeben wenn unter PROJECT_ROOT; ohne koennte Env auf beliebiges Skript zeigen.
    script_cano="$(canonical_under_root "$script" "$PROJECT_ROOT" || true)"
    if [[ -n "$script_cano" ]]; then
      echo "$script_cano"
      return
    fi
    # Ungueltiger Pfad: nicht ausfuehren, Fallthrough zu naechster Quelle.
  fi
  script="${SHIM_CHECKS_SCRIPT:-}" # Allgemeines Check-Skript-Env.
  if [[ -n "$script" ]]; then
    if [[ "$script" != /* ]]; then
      script="$PROJECT_ROOT/$script"
    fi
    script_cano="$(canonical_under_root "$script" "$PROJECT_ROOT" || true)"
    if [[ -n "$script_cano" ]]; then
      echo "$script_cano"
      return
    fi
  fi
  # Fallback: Standard-Pfade im Repo; ohne waere bei fehlendem Env kein Skript gefunden.
  local candidates=("scripts/run-checks.sh" "scripts/shim-checks.sh")
  for candidate in "${candidates[@]}"; do
    if [[ -f "$PROJECT_ROOT/$candidate" ]]; then # Ersten existierenden Kandidaten zurueckgeben; Pfad immer unter PROJECT_ROOT.
      echo "$PROJECT_ROOT/$candidate"
      return
    fi
  done
  echo "" # Kein Skript gefunden; ohne waere leerer Output nicht von "nicht gesetzt" unterscheidbar.
}

if [[ "$RUN_CHECKS" = true ]]; then
  run_frontend=false # Nur true wenn Aenderungen unter src/; steuert --frontend an run-checks.
  run_backend=false # Nur true wenn Backend-Pfade geaendert; steuert --backend.
  run_ai_review=true # Standard an; kann durch Flag/Env abgeschaltet werden, bei Push immer true.
  run_explanation_check=true # Standard an; kann durch Flag/Env abgeschaltet werden.

  # Geaenderte Dateien: fuer Frontend/Backend-Entscheidung und Snippet-Review; ohne waeren alle Checks immer full.
  changed_files=""
  if [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
    if "$GIT_CMD" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then # Upstream existiert.
      RANGE="@{u}...HEAD" # Diff gegen Upstream; ohne waeren nur lokale ungepushte Aenderungen sichtbar.
      changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR "$RANGE" || true)"
    else
      if "$GIT_CMD" rev-parse --verify HEAD~1 >/dev/null 2>&1; then # Mindestens ein Commit.
        changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR HEAD~1...HEAD || true)" # Letzter Commit.
      else
        changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR --root HEAD || true)" # Erster Commit: gegen leeren Baum.
      fi
    fi
  fi

  if [[ -n "$changed_files" ]]; then
    echo "$changed_files" | grep -q '^src/' && run_frontend=true # Frontend-Checks nur bei src/-Aenderungen; ohne immer/nie.
    if has_backend_changes "$changed_files"; then
      run_backend=true # Backend-Checks nur bei Backend-Pfaden; ohne wuerden Backend-Checks immer/nie laufen.
    fi
  fi

  if [[ "$ARGS_TEXT_RAW" == *" --no-ai-review "* ]]; then
    run_ai_review=false # User hat Flag gesetzt; bei Push wird das spaeter ueberschrieben.
  fi
  if [[ -n "${SKIP_AI_REVIEW:-}" ]]; then
    run_ai_review=false # Env-Bypass; bei Push wird run_ai_review wieder true gesetzt.
  fi
  # On push: AI review always runs in commit mode and must pass; no bypass.
  if is_push_command; then
    run_ai_review=true # Push erzwingt AI-Review; ohne koennte User mit --no-ai-review umgehen.
  fi
  if [[ "$ARGS_TEXT_RAW" == *" --no-explanation-check "* ]]; then
    run_explanation_check=false
  fi
  if [[ -n "${SKIP_EXPLANATION_CHECK:-}" ]]; then
    run_explanation_check=false
  fi

  if [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; then # Nur wenn mindestens eine Kategorie getriggert; sonst keine Check-Ausfuehrung.
    build_checks_passthrough_filtered # Einmal aufbauen; beide Pfade (Runner/Skript) nutzen CHECKS_PASSTHROUGH_FILTERED.
    RUNNER_FULL=""
    PUSH_CHECK_MODE=""
    if is_push_command; then
      RUNNER_FULL="--full" # Runner bekommt --full bei Push; ohne waere Run-Scope unklar.
      PUSH_CHECK_MODE="commit" # CHECK_MODE=commit an run-checks; ohne wuerde AI-Review nicht im Commit-Modus laufen.
    fi
    # Runner (Node) vs. direktes Bash-Skript: Runner bevorzugt, falls vorhanden; sonst run-checks.sh.
    HAS_RUNNER=false
    [[ -f "$PROJECT_ROOT/scripts/shim-runner.js" ]] && HAS_RUNNER=true # Lokales Repo.
    [[ -f "$PROJECT_ROOT/node_modules/shimwrappercheck/scripts/shim-runner.js" ]] && HAS_RUNNER=true # Installiertes Paket.
    if [[ "$HAS_RUNNER" = true ]]; then
      CHECKS_ARGS=()
      [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend) # Runner braucht explizite Flags; ohne laeuft falscher Scope.
      [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
      [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
      [[ "$run_explanation_check" = false ]] && CHECKS_ARGS+=(--no-explanation-check)
      CHECKS_ARGS+=("${CHECKS_PASSTHROUGH_FILTERED[@]}") # Gefilterte User-Flags anhaengen; ohne waeren --no-ai-review bei Push wirksam.
      if [[ -f "$PROJECT_ROOT/scripts/cli.js" ]]; then
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" node "$PROJECT_ROOT/scripts/cli.js" run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}" # Bei Push: SKIP_AI_REVIEW entfernen und CHECK_MODE setzen; ohne waere Bypass moeglich.
        else
          node "$PROJECT_ROOT/scripts/cli.js" run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        fi
      elif command -v npx >/dev/null 2>&1; then
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" npx shimwrappercheck run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        else
          npx shimwrappercheck run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        fi
      else
        echo "Git shim: neither local scripts/cli.js nor npx found; skipping checks." >&2 # Ohne Node-Pfad keine Checks; User informieren.
      fi
    else
      CHECKS_SCRIPT="$(resolve_checks_script)" # Absoluten Pfad zu run-checks.sh (oder Env-Skript) holen.
      if [[ -n "$CHECKS_SCRIPT" ]]; then
        CHECKS_ARGS=()
        if [[ -n "${SHIM_GIT_CHECKS_ARGS:-}" ]]; then
          read -r -a CHECKS_ARGS <<< "${SHIM_GIT_CHECKS_ARGS}" # Env-basierte zusaetzliche Args; ohne nur Defaults.
        elif [[ -n "${SHIM_CHECKS_ARGS:-}" ]]; then
          read -r -a CHECKS_ARGS <<< "${SHIM_CHECKS_ARGS}"
        fi
        [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend)
        [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
        [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
        [[ "$run_explanation_check" = false ]] && CHECKS_ARGS+=(--no-explanation-check)
        CHECKS_ARGS+=("${CHECKS_PASSTHROUGH_FILTERED[@]}")
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}" # Wie beim Runner: bei Push Env bereinigen und CHECK_MODE setzen.
        else
          bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}" # Direktes Skript; ohne Runner ist das der einzige Weg.
        fi
      else
        echo "Git shim checks: no checks script found; skipping." >&2 # Weder Runner noch Skript; Checks ueberspringen und melden.
      fi
    fi
  fi
fi

# Enforce single commit when pushing: AI review (commit mode) only reviews HEAD~1..HEAD; older commits would stay unreviewed.
# Only when upstream exists (normal push); first push (no upstream yet) is not enforced.
if is_push_command && [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
  if "$GIT_CMD" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then # Upstream vorhanden.
    AHEAD="$("$GIT_CMD" rev-list --count @{u}..HEAD 2>/dev/null || true)" # Anzahl lokaler Commits vor Upstream; ohne keine Pruefung.
    # Mehr als ein Commit vor Upstream: Blockieren, damit nicht unreviewte Commits gepusht werden.
    if [[ -n "$AHEAD" ]] && [[ "$AHEAD" =~ ^[0-9]+$ ]] && [[ "$AHEAD" -gt 1 ]]; then
      echo "Pre-push: Multiple local commits ($AHEAD) ahead of upstream. AI review only reviews the latest commit. Squash (e.g. git rebase -i @{u}) or push one commit at a time." >&2
      exit 1 # Ohne exit wuerde Push mit mehreren Commits durchgehen; aeltere Commits waeren nicht reviewed.
    fi
  fi
fi

if [[ "$CHECKS_ONLY" = true ]]; then
  exit 0 # Nur Checks gewuenscht; git nicht aufrufen; ohne wuerde exec git folgen.
fi

if [[ -z "$GIT_CMD" ]] || [[ ! -x "$GIT_CMD" ]]; then
  echo "Real git binary not found. Set SHIM_GIT_REAL_BIN or ensure /usr/bin/git exists." >&2
  exit 1 # Ohne exit wuerde exec mit leerem/ungueltigem Pfad fehlschlagen mit kryptischer Meldung.
fi

# Echtes git mit allen verbleibenden Argumenten aufrufen; exec ersetzt Shell-Prozess (kein Subshell); ohne bliebe Shim als Parent-Prozess.
exec "$GIT_CMD" "${GIT_ARGS[@]}"
