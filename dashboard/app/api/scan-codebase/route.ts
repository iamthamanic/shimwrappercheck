/**
 * GET /api/scan-codebase – detect which checks are relevant for the current project and why.
 * Returns recommendations: { [checkId]: reason } for purple tooltips in Check Library. No AI.
 * Reasons are grouped via prefixes:
 * - "Best Practice: ..." (useful defaults, even when tooling is not fully wired yet)
 * - "Ready to run: ..." (detected in this repo and likely runnable now)
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckId } from "@/lib/checks";

type Pkg = {
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

/**
 * hasDep: Prueft, ob ein package.json-Objekt eine der gesuchten Dependencies enthaelt.
 * Zweck: Die Check-Empfehlung soll erkennen, welche Tools im Projekt bereits installiert oder namespaced vorhanden sind.
 * Problem: Ohne diesen Helper muesste jede Dependency-Erkennung ihre Merge- und Prefix-Logik selbst duplizieren.
 * Eingabe: `pkg` und `names`. Ausgabe: `true`, wenn eine passende Dependency gefunden wurde.
 */
function hasDep(pkg: Pkg, names: string[]): boolean {
  const dev = { ...pkg.devDependencies, ...pkg.dependencies }; // Prod- und Dev-Dependencies in eine gemeinsame Sicht mergen; ohne muessten beide Listen getrennt durchsucht werden.
  const keys = Object.keys(dev); // Nur die Paketnamen extrahieren; ohne werden die spaeteren Vergleiche unnoetig auf dem ganzen Objekt gemacht.
  /**
   * matchesRequestedName: Prueft, ob ein installierter Dependency-Key zu einem gesuchten Toolnamen passt.
   * Zweck: Neben exakten Namen sollen auch Namespace-Varianten und Unterpakete erkannt werden.
   * Problem: Ohne diesen Helper bleibt die Matching-Logik als anonymer some-Callback im Ausdruck versteckt.
   * Eingabe: `installedKey`, `requestedName`. Ausgabe: `true` bei passendem Toolnamen.
   */
  const matchesRequestedName = (installedKey: string, requestedName: string): boolean => {
    return (
      installedKey === requestedName ||
      installedKey.startsWith(requestedName + "/") ||
      installedKey.startsWith("@" + requestedName)
    ); // Exakten Namen und typische Namespace-/Unterpaket-Varianten pruefen; ohne uebersehen wir reale Installationen haeufig.
  };
  /**
   * hasMatchingInstalledDependency: Sucht fuer einen gesuchten Namen einen passenden installierten Dependency-Key.
   * Zweck: Die aeussere Namensliste soll ohne anonymen Callback gegen die installierten Keys geprueft werden.
   * Problem: Ohne diesen Helper verbleibt auch die zweite some-Schleife anonym im Ausdruck.
   * Eingabe: `requestedName`. Ausgabe: `true`, wenn ein passender Key gefunden wurde.
   */
  const hasMatchingInstalledDependency = (requestedName: string): boolean => {
    if (keys.includes(requestedName)) return true; // Exakten Treffer sofort akzeptieren; ohne machen wir bei einfachsten Faellen unnoetige Praefixpruefungen.
    for (const installedKey of keys) {
      if (matchesRequestedName(installedKey, requestedName)) return true; // Auch Namespace- und Unterpaket-Treffer erkennen; ohne bleiben viele Toolnamen unsichtbar.
    }
    return false; // Kein passender Dependency-Key gefunden; ohne waere das Ergebnis implizit und schwerer lesbar.
  };
  for (const requestedName of names) {
    if (hasMatchingInstalledDependency(requestedName)) return true; // Ersten passenden Toolnamen direkt als Treffer melden; ohne laufen wir die gesamte Liste unnoetig weiter.
  }
  return false; // Keiner der gesuchten Namen wurde in den Dependencies gefunden; ohne bliebe die Funktion implizit auf `undefined`.
}

/**
 * hasScript: Prueft, ob ein package.json-Objekt ein bestimmtes npm-Script besitzt.
 * Zweck: Empfehlungen sollen auch dann "ready to run" sein, wenn sie ueber Scripts statt direkte Dependencies verdrahtet sind.
 * Problem: Ohne diesen Helper wird die Script-Pruefung in jeder Heuristik wiederholt und uneinheitlich.
 * Eingabe: `pkg` und `name`. Ausgabe: `true`, wenn das Script vorhanden ist.
 */
function hasScript(pkg: Pkg, name: string): boolean {
  return !!pkg.scripts?.[name]; // Vorhandenes Script auf boolean normieren; ohne muessten Aufrufer mit string/undefined arbeiten.
}

/**
 * readJson: Liest eine JSON-Datei sicher ein und faellt bei Fehlern auf einen Fallback zurueck.
 * Zweck: Codebase-Scanning soll robust gegen fehlende oder kaputte package.json-Dateien bleiben.
 * Problem: Ohne diesen Helper brechen Empfehlungen schon an einem parse-fehlerhaften JSON-File ab.
 * Eingabe: `filePath` und `fallback`. Ausgabe: geparste Daten oder der Fallback-Wert.
 */
function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback; // Fehlende Datei direkt auf den Fallback abbilden; ohne wirft readFileSync spaeter unnoetige Fehler.
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T; // JSON-Datei lesen und typisiert zurueckgeben; ohne koennen package-Heuristiken nicht arbeiten.
  } catch {
    return fallback; // Parse-Fehler ebenfalls auf den Fallback normieren; ohne stoppt ein defektes JSON die gesamte Empfehlung.
  }
}

/**
 * setBestPractice: Setzt eine Empfehlung nur, wenn fuer den Check noch kein staerkerer Grund existiert.
 * Zweck: Allgemeine Best-Practice-Hinweise sollen spaeter von "ready to run" ueberschrieben werden koennen.
 * Problem: Ohne diese Priorisierungslogik koennen spaetere konkrete Detection-Hinweise verloren gehen oder bestaendige Defaults alles ueberschreiben.
 * Eingabe: `recommendations`, `checkId`, `reason`. Ausgabe: kein Rueckgabewert.
 */
function setBestPractice(recommendations: Record<string, string>, checkId: string, reason: string): void {
  if (!recommendations[checkId]) recommendations[checkId] = `Best Practice: ${reason}`; // Default-Hinweis nur setzen, wenn noch nichts Spezifischeres existiert; ohne koennen spaetere Ready-to-run-Gruende nicht sauber priorisiert werden.
}

/**
 * setReadyToRun: Markiert einen Check als konkret im Projekt erkennbar und voraussichtlich sofort ausfuehrbar.
 * Zweck: UI-Tooltips sollen deutlicher zwischen allgemeinen Empfehlungen und real verifizierten Projekt-Signalen unterscheiden.
 * Problem: Ohne diese Kennzeichnung koennen Nutzer nicht sehen, welche Checks schon praktisch verdrahtet sind.
 * Eingabe: `recommendations`, `checkId`, `reason`. Ausgabe: kein Rueckgabewert.
 */
function setReadyToRun(recommendations: Record<string, string>, checkId: string, reason: string): void {
  recommendations[checkId] = `Ready to run: ${reason}`; // Konkrete Erkennungsgruende immer als hoehere Prioritaet speichern; ohne bleibt nur der schwammigere Best-Practice-Text.
}

/**
 * GET: Scannt die Projektstruktur heuristisch und liefert passende Check-Empfehlungen fuer die Check-Library.
 * Zweck: Das Dashboard soll ohne AI erkennen, welche Checks im aktuellen Repo sinnvoll oder direkt ausfuehrbar sind.
 * Problem: Ohne diesen Endpoint fehlt der UI die automatische Herleitung, warum ein Check im Projekt relevant ist.
 * Eingabe: keine Nutzlast. Ausgabe: JSON mit `recommendations` oder Fehlerantwort.
 */
export async function GET() {
  try {
    const root = getProjectRoot(); // Effektives Projekt-Root bestimmen; ohne scannen wir Dateien relativ zum falschen Verzeichnis.
    const recommendations: Record<string, string> = {}; // Ergebnisobjekt fuer Check-ID -> Begruendung vorbereiten; ohne koennen wir keine Recommendations sammeln.
    const pkg = readJson<Pkg>(path.join(root, "package.json"), {}); // Haupt-package.json defensiv einlesen; ohne gehen npm-Heuristiken im Root verloren.
    const dashboardPkg = readJson<Pkg>(path.join(root, "dashboard", "package.json"), {}); // Dashboard-package.json separat pruefen; ohne uebersehen wir Frontend-Tools im Subprojekt.

    setBestPractice(recommendations, "prettier", "Consistent formatting improves readability and review quality."); // Formatierungscheck immer als allgemeine Best Practice empfehlen; ohne fehlt ein zentraler Qualitätsstandard.
    setBestPractice(
      recommendations,
      "projectRules",
      "Project-specific rules keep architecture and workflow consistent."
    ); // Projektregeln grundsaetzlich empfehlen; ohne fehlt der Hinweis auf repo-spezifische Governance.
    setBestPractice(recommendations, "snyk", "A second dependency scanner can catch issues beyond npm audit."); // Zweitscan fuer Security standardmaessig empfehlen; ohne bleibt Security-Breite geringer.
    setBestPractice(recommendations, "checkMockData", "Valid mock data reduces flaky tests and broken demos."); // Mock-Data-Pruefung als Qualitaetshilfe vorschlagen; ohne fehlt diese Best-Practice-Heuristik.
    setBestPractice(recommendations, "updateReadme", "Automated README sync keeps docs aligned with real behavior."); // README-Sync als Dokumentationshygiene markieren; ohne fehlt der Doku-Bezug.
    setBestPractice(
      recommendations,
      "licenseChecker",
      "Dependency license visibility helps legal/compliance review (especially in npm projects)."
    ); // Lizenzsichtbarkeit grundsaetzlich empfehlen; ohne bleibt Compliance aus der Check-Library unterrepraesentiert.
    setBestPractice(
      recommendations,
      "architecture",
      "dependency-cruiser can enforce boundaries and prevent architectural drift."
    ); // Architekturcheck als Default-Best-Practice eintragen; ohne fehlt der Hinweis auf Boundary-Checks.
    setBestPractice(
      recommendations,
      "aiReview",
      "Cross-check code quality against architecture and security criteria."
    ); // AI-Review als allgemeine Codequalitaetspruefung empfehlen.
    setBestPractice(
      recommendations,
      "explanationCheck",
      "Enforced explanations improve maintainability and onboarding."
    ); // Explanation-Check als Onboarding-/Maintainability-Hilfe markieren; ohne fehlt dieser Repo-spezifische Standard.
    setBestPractice(recommendations, "sast", "Static analysis helps detect vulnerable code patterns early."); // SAST frueh als Sicherheits-Default empfehlen.
    setBestPractice(recommendations, "gitleaks", "Secret scanning reduces risk of leaked credentials."); // Secret-Scanning als Best Practice aufnehmen; ohne fehlt ein wichtiger Security-Baustein.

    const hasNpm =
      fs.existsSync(path.join(root, "package.json")) || fs.existsSync(path.join(root, "dashboard", "package.json")); // Erkennen, ob das Projekt ueberhaupt npm/Node-Struktur hat; ohne waeren spaetere npm-Heuristiken unnoetig oder falsch.

    if (hasNpm) {
      // npm-/Node-Heuristiken nur anwenden, wenn das Projekt auch package.json-Strukturen besitzt; ohne markieren wir Node-Checks in falschen Projekttypen.
      if (
        hasDep(pkg, ["eslint", "@eslint/core", "biome"]) ||
        hasScript(pkg, "lint") ||
        hasDep(dashboardPkg, ["eslint"])
      ) {
        // Lint-Check nur bei konkretem Tool-/Script-Signal aktivieren; ohne wird er zu oft faelschlich als ready markiert.
        setReadyToRun(recommendations, "lint", "ESLint or lint script found in package.json."); // Linting nur als ready markieren, wenn Tooling/Scripts real auffindbar sind.
      }
      if (
        hasDep(pkg, ["prettier"]) ||
        hasScript(pkg, "format") ||
        hasScript(pkg, "format:check") ||
        hasDep(dashboardPkg, ["prettier"]) ||
        hasScript(dashboardPkg, "format:check")
      ) {
        // Prettier nur bei erkennbarer Formatierungsverdrahtung hochstufen; ohne suggerieren wir falsche sofortige Nutzbarkeit.
        setReadyToRun(recommendations, "prettier", "Prettier or format script found."); // Prettier-Heuristik auf echte Installationen/Scripts hochstufen.
      }
      if (
        (hasDep(pkg, ["typescript"]) && (hasScript(pkg, "typecheck") || hasScript(pkg, "type-check"))) ||
        hasScript(pkg, "typecheck") ||
        (hasDep(dashboardPkg, ["typescript"]) &&
          (hasScript(dashboardPkg, "typecheck") || hasScript(dashboardPkg, "type-check")))
      ) {
        // Typecheck nur bei passender TS-/Script-Lage aktivieren; ohne wird die Empfehlung fachlich zu optimistisch.
        setReadyToRun(recommendations, "typecheck", "TypeScript and typecheck script found."); // Typecheck nur bei erkennbarer TS-Verdrahtung als sofort nutzbar markieren.
      }
      if (hasScript(pkg, "check:mock-data")) {
        // Mock-Data-Check nur bei real vorhandenem Script als ready markieren; ohne bleibt die Heuristik zu spekulativ.
        setReadyToRun(recommendations, "checkMockData", "Script check:mock-data in package.json."); // Mock-Data-Check auf konkretes Script stuetzen; ohne bleibt es nur eine allgemeine Empfehlung.
      }
      if (
        hasDep(pkg, ["jest", "vitest", "mocha", "@jest/core"]) ||
        hasScript(pkg, "test") ||
        hasScript(pkg, "test:run") ||
        hasDep(dashboardPkg, ["vitest"])
      ) {
        // Test-Run nur bei Testrunner-Signal als direkt ausfuehrbar einstufen; ohne fehlen vernuenftige Abgrenzungen.
        setReadyToRun(recommendations, "testRun", "Test runner (e.g. Vitest) in package.json."); // Testrunner nur bei realer Signal-Lage als ready einstufen.
      }
      if (fs.existsSync(path.join(root, "scripts", "checks", "project-rules.sh"))) {
        // Projektregel-Script als klares readiness-Signal pruefen; ohne bleibt dieser Check nur abstrakt empfohlen.
        setReadyToRun(recommendations, "projectRules", "scripts/checks/project-rules.sh found."); // Konkretes Projektregel-Script als sofort laufbar markieren.
      }
      setReadyToRun(recommendations, "npmAudit", "npm project; npm audit checks dependencies."); // npm-Audit in jedem npm-Projekt als lauffaehig markieren; ohne fehlt ein offensichtlicher Security-Check.
      if (hasDep(pkg, ["vite"]) || hasScript(pkg, "build") || hasDep(dashboardPkg, ["vite"])) {
        // Build-Check nur bei Build-Tooling oder Build-Script aktivieren; ohne ist die Empfehlung zu breit.
        setReadyToRun(recommendations, "viteBuild", "Vite or build script found."); // Build-Check nur bei Build-Tooling/Script hochstufen.
      }
      if (hasDep(pkg, ["snyk"])) {
        // Snyk erst bei echter Installation als ready markieren; ohne wird ein nicht vorhandenes Tool suggeriert.
        setReadyToRun(recommendations, "snyk", "Snyk installed in project."); // Snyk erst bei echter Installation als ready markieren.
      }
      if (
        fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "scripts", "update-readme.js")) ||
        fs.existsSync(path.join(root, "scripts", "update-readme.js"))
      ) {
        // README-Update nur bei vorhandenem Script hochstufen; ohne fehlt die Bindung an echte Repo-Dateien.
        setReadyToRun(recommendations, "updateReadme", "Update-README script available."); // README-Check nur bei vorhandenem Script als direkt nutzbar markieren.
      }
      setReadyToRun(recommendations, "licenseChecker", "npm project; license-checker can verify licenses."); // Lizenzpruefung fuer npm-Projekte aktivieren; ohne bleibt sie nur abstrakt empfohlen.
    }

    const messagesRoot = path.join(root, "messages"); // Root-Messages-Ordner fuer i18n-Erkennung vorbereiten; ohne scannen wir nur einen moeglichen Ort.
    const messagesDashboard = path.join(root, "dashboard", "messages"); // Dashboard-Messages-Ordner ebenfalls pruefen; ohne uebersehen wir die hiesige App-Struktur.
    /**
     * dirHasJson: Prueft, ob ein Verzeichnis existiert und mindestens eine JSON-Datei enthaelt.
     * Zweck: i18n-Checks sollen nur dann als ready gelten, wenn wirklich Locale-Dateien vorhanden sind.
     * Problem: Ohne Helper wird Dateisystem-Logik fuer mehrere Message-Pfade dupliziert.
     * Eingabe: `dir` als Verzeichnispfad. Ausgabe: `true`, wenn JSON-Dateien gefunden wurden.
     */
    const dirHasJson = (dir: string) => {
      if (!fs.existsSync(dir)) return false; // Fehlende Verzeichnisse sofort ablehnen; ohne wirft statSync spaeter auf nicht existierende Pfade.
      if (!fs.statSync(dir).isDirectory()) return false; // Nur echte Verzeichnisse akzeptieren; ohne zaehlen gleichnamige Dateien faelschlich als Messages-Ordner.
      for (const filename of fs.readdirSync(dir)) {
        if (filename.endsWith(".json")) return true; // Schon eine JSON-Datei reicht als Signal fuer Locale-Dateien; ohne wuerden echte i18n-Ordner uebersehen.
      }
      return false; // Keine JSON-Datei gefunden; ohne waere das Ergebnis implizit und schwerer nachvollziehbar.
    }; // Existenz, Directory-Typ und JSON-Inhalt zusammen pruefen; ohne kann i18n faelschlich als vorhanden gelten.
    const hasMessages = dirHasJson(messagesRoot) || dirHasJson(messagesDashboard); // Beide moeglichen Message-Orte zusammenfassen; ohne wird das Projektlayout zu eng angenommen.
    if (hasMessages) {
      // i18n-Check nur bei gefundenen Locale-Dateien aktivieren; ohne markieren wir i18n in nicht lokalisierten Projekten.
      setReadyToRun(recommendations, "i18nCheck", "messages/ or dashboard/messages/ with locale JSON files found."); // i18n-Check erst bei echten Message-Dateien als ready markieren.
    }

    const hasSupabaseFunctions =
      fs.existsSync(path.join(root, "supabase", "functions")) ||
      fs.existsSync(path.join(root, "deno.json")) ||
      fs.existsSync(path.join(root, "deno.jsonc")); // Mehrere Deno-/Supabase-Signale zusammenfassen; ohne uebersehen wir Edge-Function-Projekte leicht.
    if (hasSupabaseFunctions) {
      // Deno-/Supabase-nahe Checks nur fuer passende Projektstruktur freischalten; ohne sind diese Empfehlungen in normalen Node-Repos irrefuehrend.
      setReadyToRun(recommendations, "denoFmt", "Supabase functions or deno.json found (Deno formatting)."); // Deno-Formatierung bei Deno-/Supabase-Signal aktivieren.
      setReadyToRun(recommendations, "denoLint", "Supabase functions or deno.json found (Deno lint)."); // Deno-Linting auf denselben Strukturhinweis stuetzen.
      setReadyToRun(recommendations, "denoAudit", "Supabase functions or deno.json found (Deno audit)."); // Deno-Audit nur fuer passende Projekte als ready markieren.
      setReadyToRun(recommendations, "healthPing", "Supabase project; health ping after deploy."); // Health-Ping auf Supabase-Kontext aufbauen; ohne fehlt dieser Deployment-Check.
      setReadyToRun(recommendations, "edgeLogs", "Supabase project; edge logs after deploy."); // Edge-Logs ebenfalls nur im Supabase-Kontext hochstufen.
    }

    if (fs.existsSync(path.join(root, ".dependency-cruiser.json"))) {
      // Architekturcheck an konkrete dependency-cruiser-Konfiguration koppeln; ohne fehlt die toolbasierte Begruendung.
      setReadyToRun(recommendations, "architecture", ".dependency-cruiser.json found."); // Architekturcheck bei echter Config als direkt nutzbar markieren.
    }
    if (
      fs.existsSync(path.join(root, "eslint.complexity.json")) ||
      hasDep(pkg, ["eslint-plugin-complexity"]) ||
      hasDep(dashboardPkg, ["eslint-plugin-complexity"])
    ) {
      // Komplexitaetscheck nur bei Config oder Plugin-Signal aktivieren; ohne bleibt die readiness zu unscharf.
      setReadyToRun(recommendations, "complexity", "eslint-plugin-complexity or eslint.complexity.json found."); // Komplexitaetscheck nur bei passender Config/Dependency aktivieren.
    }
    if (fs.existsSync(path.join(root, "stryker.config.json"))) {
      // Mutationstest an echte Stryker-Config koppeln; ohne wirkt die Empfehlung unbegruendet.
      setReadyToRun(recommendations, "mutation", "stryker.config.json found."); // Mutationstest bei vorhandener Stryker-Config als ready markieren.
    }

    const validIds = new Set<string>(); // Erlaubte Check-IDs gesammelt vorbereiten; ohne haben wir spaeter keine Whitelist gegen inkonsistente Empfehlungen.
    for (const checkDef of CHECK_DEFINITIONS) {
      validIds.add(checkDef.id); // Jede definierte Check-ID in die Whitelist uebernehmen; ohne koennen wir Empfehlungen nicht gegen den Katalog absichern.
    }
    const filtered: Record<string, string> = {}; // Gefiltertes Ergebnisobjekt fuer nur gueltige Check-IDs vorbereiten; ohne geben wir intern erzeugten Muell nach draussen.
    for (const id of Object.keys(recommendations)) {
      // Gesammelte Empfehlungen gegen die echte Check-Definition filtern; ohne koennen tote IDs in die API-Antwort gelangen.
      if (validIds.has(id as CheckId)) filtered[id] = recommendations[id]; // Nur bekannte Checks nach draussen durchreichen; ohne kann die UI unbekannte IDs erhalten.
    }

    return NextResponse.json({ recommendations: filtered }); // Finale Empfehlungsliste als JSON an die Check-Library senden; ohne hat das Dashboard keine Tooltip-Daten.
  } catch (err) {
    console.error("scan-codebase error:", err); // Fehler serverseitig loggen; ohne sind kaputte Repo-Scans spaeter schwer nachvollziehbar.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed", recommendations: {} }, // Fehlermeldung plus leere Empfehlungen stabil zurueckgeben; ohne muesste die UI mit undefiniertem Shape umgehen.
      { status: 500 }
    );
  }
}
