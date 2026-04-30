#!/usr/bin/env node
/**
 * ai-review-prompts.js — German architect checklist prompts for AI Review and Full Explanation.
 * Why: both review scripts need the same prompts; centralising avoids drift (DRY).
 * @param {number} minRating
 * @returns {string}
 */
function buildReviewPrompt(minRating) {
  return `Du bist ein extrem strenger Senior-Software-Architekt. Bewerte den folgenden Code-Diff.

Starte mit 100 Punkten. Gehe die Checkliste durch und ziehe fuer jeden Verstoss die angegebenen Punkte ab.
Ziel: mindestens ${minRating}%.

Script-Ausnahme: Glue-/Shell-/Node-Scripts (wenige hundert Zeilen) duerfen bei SRP/Kopplung milder bewertet werden,
wenn sie dokumentiert sind und Sicherheit sowie Robustheit stimmen.

1. Architektur & SOLID
- SRP: Zu viele Verantwortlichkeiten? (-15)
- Dependency Inversion: Hart instanziierte Abhaengigkeiten? (-10)
- Kopplung: Zirkulaere/tiefe Abhaengigkeiten? (-10)
- YAGNI: Unnoetiger Code? (-5)

2. Performance
- Zeitkomplexitaet: O(n^2) bei grossen Daten? (-20)
- N+1: DB-Abfragen in Schleifen? (-20)
- Memory Leaks: Streams/Listener nicht geschlossen? (-15)
- Bundle-Size: Riesige Lib fuer kleine Funktion? (-5)

3. Sicherheit
- IDOR: ID ohne Berechtigungspruefung? (-25)
- Data Leakage: Sensitive Daten sichtbar? (-20)
- Rate Limiting: Kein Schutz gegen Massenaufrufe? (-10)
- Path Traversal: Nutzer-Input in Pfaden? (-25)
- Command Injection: Nutzer-Input in Shell-Aufrufen? (-25)

4. Robustheit
- Silent Fails: Leere catch-Bloecke? (-15)
- Input Validation: Externe Daten ungeprueft? (-15)
- Edge Cases: null, undefined, [], riesige Strings? (-10)

5. Wartbarkeit
- DRY: Duplizierte Logik ohne Abstraktion? (-5)
- Naming: Unbeschreibende Namen? (-5)
- Side Effects: Unvorhersehbarer globaler Zustand? (-10)
- Kommentar-Qualitaet: Nur "Was" statt "Warum"? (-2)

Gib DAS ERGEBNIS NUR als ein einziges gueltiges JSON-Objekt aus, kein anderer Text.
Format: {"score": number, "deductions": [{"point": "Kurzname", "minus": number, "reason": "Begruendung"}], "verdict": "ACCEPT" oder "REJECT"}
verdict: "ACCEPT" nur wenn score >= ${minRating}, sonst "REJECT".

--- DIFF ---`;
}

/**
 * buildExplanationPrompt: Full Explanation standard prompt.
 * @param {number} minRating
 * @returns {string}
 */
function buildExplanationPrompt(minRating) {
  return `Du pruefst ausschliesslich die Einhaltung des Standards "Mandatory Full Explanation Comments".
Keine Architektur-, Performance- oder Sicherheitsbewertung.

Regeln (alle muessen erfuellt sein):
1. Jede Funktion hat eine Docstring: warum sie existiert, welches Problem sie loest, Ein-/Ausgaben.
2. Jede nicht-triviale Zeile hat einen Inline-Kommentar: was passiert, warum noetig, was kaputtgeht wenn entfernt.
3. Kein "nur sauberer Code" ohne Erklaerung; Erklaerung ist Pflicht.
4. Ausgabe sind immer vollstaendige Dateien, nie Teil-Snippets.

Script-Ausnahme: Kleine Scripts/Dateien (eine Datei, <~300 Zeilen, Glue-/Shell-/Node-Script):
Block-Kommentare fuer logische Bloecke ausreichend, wenn jede Funktion Docstring hat.

Zusatzregel: Code nicht vollstaendig kommentiert = Ausgabe ungueltig.

Starte mit 100 Punkten. Pro Verstoss: Abzug (z.B. -10 fehlende Docstrings, -5 pro fehlendem Kommentar).
verdict: "ACCEPT" nur wenn score >= ${minRating} UND Regeln erfuellt; sonst "REJECT".

Gib DAS ERGEBNIS NUR als ein einziges gueltiges JSON-Objekt aus:
{"score": number, "deductions": [{"point": "Kurzname", "minus": number, "reason": "Begruendung"}], "verdict": "ACCEPT" oder "REJECT"}

--- VOLLSTAENDIGE DATEIEN ---`;
}

module.exports = { buildReviewPrompt, buildExplanationPrompt };
