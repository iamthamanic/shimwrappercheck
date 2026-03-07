/**
 * Generate project-rules.sh from form rules and parse script back to rules.
 * Used by CheckCard when editing Projektregeln in Form view.
 */

export type ProjectRuleForm =
  | { id: string; type: "forbidden_pattern"; pattern: string }
  | { id: string; type: "forbidden_regex"; pattern: string }
  | { id: string; type: "max_lines"; maxLines: number; glob?: string };

const RULES_MARKER = "# RULES_JSON "; // Marker fuer eingebettetes Regel-JSON definieren; ohne kann der Parser spaeter das generierte Format nicht sicher wiederfinden.

/**
 * escapeForBash: Escaped einen String fuer die Einbettung in einfach-quotierte Bash-Literale.
 * Zweck: Benutzerdefinierte Pattern sollen unveraendert in das generierte Shell-Script gelangen, ohne die Quote-Syntax zu zerbrechen.
 * Problem: Ohne dieses Escaping brechen Apostrophe im Pattern das Script oder oeffnen unbeabsichtigte Shell-Syntax.
 * Eingabe: `s` als roher Pattern-String. Ausgabe: Bash-sicher gequoteter String.
 */
function escapeForBash(s: string): string {
  return s.replace(/'/g, "'\"'\"'"); // Einfache Quotes fuer Bash korrekt aufbrechen und wieder schliessen; ohne sind Pattern mit Apostrophen nicht nutzbar.
}

/**
 * generateScriptFromRules: Erzeugt aus Formular-Regeln den Inhalt von `project-rules.sh`.
 * Zweck: Die Dashboard-Form soll in ein ausfuehrbares Shell-Script ueberfuehrt werden, das dieselben Regeln in Checks anwenden kann.
 * Problem: Ohne Generator gaebe es keine stabile Bruecke zwischen Formular-UI und scriptbasierter Projektregel-Pruefung.
 * Eingabe: `rules` als Liste von Formular-Regeln. Ausgabe: vollstaendiger Bash-Script-Text.
 */
export function generateScriptFromRules(rules: ProjectRuleForm[]): string {
  const json = JSON.stringify(
    rules.map((r) => ({
      type: r.type,
      pattern: "pattern" in r ? r.pattern : undefined,
      maxLines: "maxLines" in r ? r.maxLines : undefined,
      glob: "glob" in r ? r.glob : undefined,
    }))
  ); // Regelliste in kompaktes JSON fuer den eingebetteten Marker serialisieren; ohne kann der Parser die Formdaten spaeter nicht rekonstruieren.
  /**
   * escapeForRegex: Escaped Regex-Strings fuer die Einbettung in einfach-quotierte grep-Aufrufe.
   * Zweck: Regex-Regeln sollen sicher in das generierte Shell-Script geschrieben werden.
   * Problem: Ohne dieses Escaping koennen Apostrophe die grep-Kommandozeile syntaktisch zerstoeren.
   * Eingabe: `s` als Regex-Pattern. Ausgabe: Bash-sicherer Regex-String.
   */
  const escapeForRegex = (s: string) => s.replace(/'/g, "'\"'\"'"); // Dasselbe Quote-Escaping auch fuer Regex-Pattern anwenden; ohne bleiben Regex-Regeln mit Apostrophen kaputt.
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# shimwrappercheck-project-rules v1",
    RULES_MARKER + json,
    "# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.",
    "set -e",
    'ROOT="$(cd "$(dirname "$0")/../.." && pwd)"',
    'cd "$ROOT"',
    "",
  ]; // Script-Grundgeruest mit Marker und Root-Wechsel vorbereiten; ohne fehlt dem Ergebnis sowohl Metadaten- als auch Ausfuehrungskontext.

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i]; // Aktuelle Formular-Regel fuer diesen Schleifendurchlauf lesen; ohne kann keine passende Scriptzeile erzeugt werden.
    if (r.type === "forbidden_pattern" && r.pattern.trim()) {
      const pat = escapeForBash(r.pattern.trim()); // Pattern vor dem Einbau ins Shell-Script absichern; ohne zerbrechen Sonderzeichen die grep-Zeile.
      lines.push(`# rule ${i + 1}: forbidden_pattern`); // Menschenlesbaren Kommentar pro Regel einfuegen; ohne ist das generierte Script schwerer zu debuggen.
      lines.push(
        `if grep -rFl --exclude-dir=node_modules --exclude-dir=.next '${pat}' . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster"; exit 1; fi`
      ); // Verbotenes Klartext-Muster als grep-Regel erzeugen; ohne kann diese Regelart im Script nicht durchgesetzt werden.
    } else if (r.type === "forbidden_regex" && r.pattern.trim()) {
      const pat = escapeForRegex(r.pattern.trim()); // Regex-Pattern sicher fuer die Shell vorbereiten; ohne sind Apostrophe und Sonderzeichen gefaehrlich.
      lines.push(`# rule ${i + 1}: forbidden_regex`); // Kommentar fuer die Regex-Regel schreiben; ohne fehlt Kontext im generierten Script.
      lines.push(
        `if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '${pat}' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi`
      ); // Regex-basierte grep-Regel erzeugen; ohne existiert fuer Regex-Regeln keine ausfuehrbare Entsprechung.
    } else if (r.type === "max_lines" && r.maxLines > 0) {
      lines.push(`# rule ${i + 1}: max_lines ${r.maxLines}`); // Kommentar fuer die Zeilenlimit-Regel notieren; ohne ist der Ursprung der Schleife im Script unklar.
      lines.push(
        `find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) 2>/dev/null | while read f; do n=$(wc -l < "$f" 2>/dev/null || echo 0); if [ "$n" -gt ${r.maxLines} ]; then echo "Projektregel verletzt: $f hat $n Zeilen (max ${r.maxLines})"; exit 1; fi; done`
      ); // Zeilenlimit-Pruefung fuer TypeScript-Dateien erzeugen; ohne kann die Max-Lines-Regel nicht ausgefuehrt werden.
    }
  }
  lines.push("exit 0"); // Erfolgsfall explizit mit Exit 0 abschliessen; ohne haengt der Script-Status vom letzten Kommando ab.
  return lines.join("\n"); // Alle vorbereiteten Zeilen zu einem Bash-Script zusammensetzen; ohne erhalten Aufrufer nur ein Zeilenarray statt Script-Text.
}

/**
 * parseRulesFromScript: Liest eingebettete Regel-Metadaten wieder aus einem generierten Script aus.
 * Zweck: Bereits gespeicherte Scripts sollen im Dashboard wieder in Formular-Regeln zurueckverwandelt werden koennen.
 * Problem: Ohne Parser ist die Formularansicht nach dem Speichern nicht mehr aus dem Script rekonstruierbar.
 * Eingabe: `raw` als voller Script-Inhalt. Ausgabe: Formular-Regeln oder `null`, wenn das Format nicht erkannt/parst werden kann.
 */
export function parseRulesFromScript(raw: string): ProjectRuleForm[] | null {
  const idx = raw.indexOf(RULES_MARKER); // Markerposition des eingebetteten JSON suchen; ohne wissen wir nicht, ob das Script aus unserem Generator stammt.
  if (idx === -1) return null; // Fremde oder manuell stark geaenderte Scripts frueh ablehnen; ohne wuerde der Parser auf Zufallstext arbeiten.
  const start = idx + RULES_MARKER.length; // Start der JSON-Nutzlast direkt hinter dem Marker berechnen; ohne wird der Markertext mitgeparst.
  const end = raw.indexOf("\n", start); // Ende der Markerzeile bestimmen; ohne ist die JSON-Nutzlast nicht sauber abgegrenzt.
  const jsonStr = end === -1 ? raw.slice(start) : raw.slice(start, end); // Nur die JSON-Zeile extrahieren; ohne landet restlicher Script-Code im Parser.
  try {
    const arr = JSON.parse(jsonStr) as { type: string; pattern?: string; maxLines?: number; glob?: string }[]; // Marker-JSON in eine lose Regel-Liste parsen; ohne kann keine Formularstruktur rekonstruiert werden.
    return arr.map((item, i) => {
      const id = `rule-${i}-${Math.random().toString(36).slice(2, 9)}`; // Stabile UI-ID pro rekonstruierter Regel erzeugen; ohne koennen Formlisten keine eindeutigen Keys erhalten.
      if (item.type === "forbidden_pattern")
        return { id, type: "forbidden_pattern" as const, pattern: item.pattern ?? "" }; // Klartext-Regel zur Formularform zurueckbauen; ohne gingen diese Regeln im UI verloren.
      if (item.type === "forbidden_regex") return { id, type: "forbidden_regex" as const, pattern: item.pattern ?? "" }; // Regex-Regel in die erwartete Formularform ueberfuehren.
      if (item.type === "max_lines")
        return { id, type: "max_lines" as const, maxLines: item.maxLines ?? 300, glob: item.glob }; // Max-Lines-Regel inklusive optionalem Glob wiederherstellen.
      return { id, type: "forbidden_pattern" as const, pattern: "" }; // Unbekannte Typen defensiv auf harmlose leere Pattern-Regel abbilden; ohne koennte das UI an unbekannten Typen scheitern.
    });
  } catch {
    return null; // Parse-Fehler als nicht rekonstruierbares Script behandeln; ohne wuerde das Dashboard mit halbgueltigen Regeln weiterarbeiten.
  }
}
