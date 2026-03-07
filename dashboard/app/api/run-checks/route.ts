/**
 * POST /api/run-checks – run Node orchestrator (npx shimwrappercheck run) or fallback to scripts/run-checks.sh.
 * Saves last run stdout/stderr to .shimwrapper/last-run.json for the Logs tab.
 * When review mode is on for a check, writes a .md report to reviewOutputPath.
 * If Accept: text/event-stream: streams SSE events (currentCheck, done) for live progress.
 * Vercel-compatible; uses SHIM_PROJECT_ROOT. Runs in project root.
 * Rate limited to avoid CPU/I/O exhaustion from repeated runs.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "@/lib/projectRoot";
import { getCheckIdFromLine, parseLastRunLog } from "@/lib/runChecksLog";
import { DEFAULT_SETTINGS } from "@/lib/presets";
import { safeReviewOutputDir } from "@/lib/safeReviewPath";
import { getClientIp, isRunChecksRateLimited } from "@/lib/runChecksRateLimit";

const PRESETS_FILE = ".shimwrappercheck-presets.json"; // Dateiname der projektweiten Presets-Datei zentral setzen; ohne waeren Pfadbildung und Lesepfade inkonsistent.

const execAsync = promisify(exec); // Callback-basierte `exec`-API in Promise-Form umwandeln; ohne waere der non-streaming-Pfad deutlich schwerer lesbar.

const LAST_RUN_FILENAME = "last-run.json"; // Einheitlichen Dateinamen fuer den letzten Check-Lauf zentral halten; ohne drohen Pfad-Duplikate und Schreibfehler.

/**
 * getLastRunPath: Baut den absoluten Pfad zur persistierten Last-Run-Datei.
 * Zweck: Logs des letzten Check-Laufs sollen an einer festen Stelle fuer UI und Debugging landen.
 * Problem: Ohne diesen Helper wird die Pfadbildung mehrfach dupliziert und leichter inkonsistent.
 * Eingabe: `root` als Projektwurzel. Ausgabe: absoluter Dateipfad zu `last-run.json`.
 */
function getLastRunPath(root: string): string {
  return path.join(root, ".shimwrapper", LAST_RUN_FILENAME); // Shimwrapper-Unterordner und Dateiname konsistent zusammenfuehren; ohne landet der Log an wechselnden Orten. root aus getProjectRoot(), kein User-Input. nosemgrep
}

/**
 * writeLastRun: Schreibt stdout/stderr des letzten Check-Laufs in die persistierte Log-Datei.
 * Zweck: Die Logs-Ansicht im Dashboard soll den juengsten Lauf auch nach Abschluss noch anzeigen koennen.
 * Problem: Ohne Persistenz geht der letzte Run nach Prozessende oder Seitenreload verloren.
 * Eingabe: `root`, `stdout`, `stderr`. Ausgabe: kein Rueckgabewert.
 */
function writeLastRun(root: string, stdout: string, stderr: string): void {
  try {
    // Schreibversuch kapseln; ohne wuerde ein fehlender Ordner den Aufrufer mit unbehandeltem Fehler beenden.
    const dir = path.join(root, ".shimwrapper"); // Zielordner fuer Persistenzdateien bestimmen; ohne kann die Datei nicht sauber geschrieben werden. root aus getProjectRoot(). nosemgrep
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // Shimwrapper-Ordner bei Bedarf anlegen; ohne scheitert der erste Schreibversuch auf neuen Projekten.
    const p = getLastRunPath(root); // Volle Last-Run-Dateiadresse berechnen; ohne wird an einen uneinheitlichen Pfad geschrieben.
    fs.writeFileSync(p, JSON.stringify({ stdout, stderr, timestamp: new Date().toISOString() }), "utf8"); // Logs plus Zeitstempel als JSON persistieren; ohne fehlt der UI ein stabiler letzter Lauf.
  } catch (e) {
    // Schreib-/Ordnerfehler abfangen; ohne bricht der gesamte Check-Lauf bei Log-Persistenz-Problemen.
    console.warn("run-checks: could not write last-run.json", e); // Schreibfehler nur warnen, aber den Check-Lauf nicht komplett abbrechen; ohne macht Log-Persistenz den Endpoint fragil.
  }
}

/**
 * getRunCommand: Waehlt den bestmoeglichen Check-Runner fuer das aktuelle Projekt.
 * Zweck: Der Endpoint soll sowohl lokale Scripts als auch installierte Paket-Runner unterstuetzen.
 * Problem: Ohne diese Aufloesungslogik weiss der Endpoint nicht, welchen Befehl er ueberhaupt starten soll.
 * Eingabe: `root` als Projektwurzel. Ausgabe: Kommando plus Argumente oder `null`, wenn kein Runner gefunden wurde.
 */
function getRunCommand(root: string): { cmd: string; args: string[] } | null {
  const runnerPath = path.join(root, "scripts", "shim-runner.js"); // Lokalen Projekt-Runner zuerst pruefen; ohne uebergehen wir repo-spezifische Startlogik. root aus getProjectRoot(). nosemgrep
  const hasPackageRunner = fs.existsSync(
    path.join(root, "node_modules", "shimwrappercheck", "scripts", "shim-runner.js") // Pfad zum Paket-Runner; root aus getProjectRoot(), keine User-Eingabe. Ohne existiert der Fallback nicht. nosemgrep
  ); // Installierten Paket-Runner separat erkennen; ohne kann der Endpoint nur mit lokalem Script arbeiten.
  if (fs.existsSync(runnerPath)) {
    // Lokalen Runner zuerst nutzen; ohne wuerden wir installierte Paket-Runner bevorzugen und Repo-Scripts ignorieren.
    return { cmd: "node", args: [runnerPath] }; // Lokalen JS-Runner direkt mit Node starten; ohne wird das Projekt-Script nicht genutzt.
  }
  if (hasPackageRunner) {
    // Installierten Paket-Runner nutzen, wenn kein lokales Script; ohne haetten nur-repo-Projekte keinen Runner.
    return { cmd: "npx", args: ["shimwrappercheck", "run"] }; // Paket-Runner ueber npx starten; ohne faellt installierte Shimwrappercheck-Logik unter den Tisch.
  }
  const scriptPath = path.join(root, "scripts", "run-checks.sh"); // Klassisches Shell-Script als letzte Fallback-Option pruefen; ohne haben aeltere Projekte keinen Runner. root aus getProjectRoot(). nosemgrep
  if (fs.existsSync(scriptPath)) {
    // Shell-Script als Fallback; ohne haben Projekte ohne Node-Runner keine Ausfuehrung.
    return { cmd: "bash", args: [scriptPath] }; // Shell-Runner als kompatiblen Fallback zurueckgeben; ohne gibt es fuer scriptbasierte Projekte keinen Ausfuehrungspfad.
  }
  return null; // Kein bekannter Runner gefunden; ohne koennte der Endpoint mit leerem Kommando spaeter abstuerzen.
}

/**
 * sendSSE: Schreibt ein Event im Server-Sent-Events-Format in den Response-Stream.
 * Zweck: Die UI soll Live-Statusupdates wie aktuellen Check und Abschlusszeitpunkt erhalten.
 * Problem: Ohne diese Hilfsfunktion wird das SSE-Format mehrfach inline gebaut und leichter fehlerhaft.
 * Eingabe: `controller`, `event`, `data`. Ausgabe: kein Rueckgabewert.
 */
function sendSSE(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); // SSE-konforme Event-Zeilen kodieren und enqueuen; ohne kann der Browser den Stream nicht als Events parsen.
}

/**
 * readReviewSettings: Liest Review-Zielpfad und check-spezifische Review-Settings aus der Presets-Datei.
 * Zweck: Review-Reports sollen in den vom Projekt konfigurierten Ordner geschrieben werden koennen.
 * Problem: Ohne diese Funktion ignoriert der Endpoint individuelle Review-Konfigurationen im Preset-File.
 * Eingabe: `root` als Projektwurzel. Ausgabe: `reviewOutputPath` und `checkSettings`.
 */
function readReviewSettings(root: string): {
  reviewOutputPath: string;
  checkSettings: Record<string, Record<string, unknown>>;
} {
  const p = path.join(root, PRESETS_FILE); // Pfad zur Presets-Datei aus der Projektwurzel ableiten; ohne lesen wir Konfiguration am falschen Ort. root aus getProjectRoot(), PRESETS_FILE Konstante. nosemgrep
  if (!fs.existsSync(p)) {
    // Keine Presets-Datei: Defaults zurueckgeben; ohne wuerde der naechste Zugriff auf p fehlschlagen.
    return {
      reviewOutputPath: DEFAULT_SETTINGS.reviewOutputPath ?? "reports", // Default-Reportordner liefern, wenn keine Presets-Datei existiert; ohne haetten neue Projekte keinen definierten Ausgabepfad.
      checkSettings: {}, // Keine Check-spezifischen Settings bei fehlender Datei; ohne waere das Rueckgabeobjekt unvollstaendig.
    }; // Fehlende Datei auf Default-Reports und leere Check-Settings abbilden; ohne bricht der Endpoint auf frischen Projekten.
  }
  try {
    // Lesen und Parsen kapseln; ohne wuerde JSON.parse bei kaputter Datei den Aufrufer mit unbehandeltem Fehler beenden.
    const raw = fs.readFileSync(p, "utf8"); // Rohes Preset-JSON aus der Datei lesen; ohne koennen keine Review-Settings extrahiert werden.
    const parsed = JSON.parse(raw) as {
      reviewOutputPath?: string; // Optionalen Pfad aus Presets erwarten; ohne waere die Typisierung ungenau.
      checkSettings?: Record<string, Record<string, unknown>>; // Optionale Check-Settings pro Check-ID; ohne waeren verschachtelte Review-Optionen nicht typisiert.
    }; // Presets-Datei in lose typisierte Struktur parsen; ohne waeren die Folgezugriffe unkontrolliert.
    return {
      reviewOutputPath:
        typeof parsed.reviewOutputPath === "string"
          ? parsed.reviewOutputPath
          : (DEFAULT_SETTINGS.reviewOutputPath ?? "reports"), // String-Pfad aus Presets uebernehmen oder Default; ohne koennte ein falscher Typ den Report-Writer brechen.
      checkSettings: parsed.checkSettings && typeof parsed.checkSettings === "object" ? parsed.checkSettings : {}, // Check-Settings nur bei gueltigem Objekt uebernehmen; ohne koennte ein falscher Typ zu Laufzeitfehlern fuehren.
    }; // Konfigurierten Reportpfad uebernehmen oder sicher auf Defaults zurueckfallen; ohne koennen leere oder falsche JSON-Werte spaeter den Dateischreibpfad brechen.
  } catch {
    // Parse- oder Lese-Fehler: sichere Defaults; ohne waere das Rueckgabeobjekt bei kaputter Datei undefiniert.
    return {
      reviewOutputPath: DEFAULT_SETTINGS.reviewOutputPath ?? "reports", // Bei Parse-Fehler sicheren Default-Pfad liefern; ohne waere das Rueckgabeobjekt bei kaputter JSON-Datei undefiniert.
      checkSettings: {}, // Bei Fehler keine Check-Settings; ohne waeren die Rueckgabefelder inkonsistent.
    }; // Parse-Fehler genauso defensiv auf Defaults normieren; ohne macht eine kaputte Presets-Datei den ganzen Endpoint instabil.
  }
}

/**
 * writeReviewReports: Extrahiert Review-Segmente aus dem Lauf und schreibt sie als Markdown-Dateien.
 * Zweck: Check-spezifische AI-/Review-Ausgaben sollen fuer spaetere Analyse als einzelne Report-Dateien erhalten bleiben.
 * Problem: Ohne diese Persistenz verschwinden Review-Ergebnisse nach dem Request im zusammengefassten stdout/stderr.
 * Eingabe: `root`, `stdout`, `stderr`. Ausgabe: kein Rueckgabewert.
 */
function writeReviewReports(root: string, stdout: string, stderr: string): void {
  try {
    // Gesamte Report-Schreiblogik kapseln; ohne wuerde ein Dateifehler den Run-Checks-Aufruf abbrechen.
    const { reviewOutputPath, checkSettings } = readReviewSettings(root); // Review-Zielpfad und check-spezifische Settings laden; ohne weiss der Writer nicht, wo und wann Reports geschrieben werden sollen.
    const outDir = safeReviewOutputDir(root, reviewOutputPath); // Ausgabeverzeichnis gegen Path Traversal absichern; ohne koennen Reports ausserhalb des Projekts landen.
    if (outDir == null) {
      // Ungueltigen oder unsicheren Pfad ablehnen; ohne koennten Reports ausserhalb des Projekts geschrieben werden.
      console.warn("run-checks: reviewOutputPath rejected (path traversal or invalid)", reviewOutputPath); // Unsicheren Pfad nur warnen und nicht schreiben; ohne oeffnen wir ein Dateisystem-Risiko.
      return;
    }
    const { segments } = parseLastRunLog(stdout, stderr); // Check-bezogene Reportsegmente aus dem Gesamtlog extrahieren; ohne koennen keine einzelnen Markdown-Reports entstehen.
    const now = new Date(); // Einheitlichen Zeitstempel fuer alle in diesem Lauf erzeugten Reportdateien erzeugen; ohne haben Dateien und Inhalt unterschiedliche Zeiten.
    const dateStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 15); // Dateisystemtauglichen kompakten Zeitstring erzeugen; ohne koennen Doppelpunkte/Trennzeichen den Dateinamen stoeren.
    for (const [checkId, text] of Object.entries(segments)) {
      // Jedes Check-Segment einzeln verarbeiten; ohne wuerden nur aggregierte Logs und keine Einzel-Reports entstehen.
      const cs = checkSettings[checkId]; // Check-spezifische Review-Konfiguration lesen; ohne wissen wir nicht, ob fuer diesen Check Reports gewuenscht sind.
      if (!cs || !cs.reviewMode) continue; // Nur Checks mit aktivem Review-Mode als Datei persistieren; ohne schreiben wir fuer jeden Check ungewuenschte Markdown-Dateien.
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true }); // Reportordner bei Bedarf anlegen; ohne scheitert der erste Report-Schreibversuch.
      const safeId = checkId.replace(/[^a-zA-Z0-9-_]/g, "_"); // Check-ID fuer Dateinamen bereinigen; ohne koennen Sonderzeichen ungueltige Pfade erzeugen.
      const filename = `${safeId}-${dateStr}.md`; // Zeitgestempelten Report-Dateinamen je Check bauen; ohne wuerden spaetere Laeufe Dateien ueberschreiben.
      const fullPath = path.join(outDir, filename); // Vollstaendigen Zielpfad fuer die Markdown-Datei zusammensetzen; ohne fehlt der Schreibort. outDir von safeReviewOutputDir(), filename aus safeId+dateStr. nosemgrep
      const content = `# Review: ${checkId}\n\n**${now.toISOString()}**\n\n\`\`\`\n${text}\n\`\`\`\n`; // Review-Inhalt mit Titel und Zeitstempel in Markdown verpacken; ohne ist die gespeicherte Datei schlechter lesbar.
      fs.writeFileSync(fullPath, content, "utf8"); // Einzelnen Review-Report physisch schreiben; ohne bleibt die Report-Funktion wirkungslos.
    }
  } catch (e) {
    // Report-Schreib- oder Konfigfehler abfangen; ohne wuerde optionale Report-Persistenz den gesamten Lauf stoppen.
    console.warn("run-checks: could not write review reports", e); // Report-Schreibfehler nur warnen; ohne kann optionale Report-Persistenz den ganzen Run abbrechen.
  }
}

/**
 * createRateLimitedSseBody: Baut einen minimalen SSE-Body fuer den Rate-Limit-Fall.
 * Zweck: Stream-Clients sollen auch bei 429 dieselbe `done`-Event-Semantik wie bei normalen Laeufen erhalten.
 * Problem: Ohne diesen Helper bleibt der Rate-Limit-Stream als anonymer Inline-Block schwer dokumentierbar und uneinheitlich.
 * Eingabe: `payload` als Abschlussdaten. Ausgabe: `ReadableStream`, der genau ein done-Event sendet.
 */
function createRateLimitedSseBody(payload: {
  error: string;
  stdout: string;
  stderr: string;
  code: number;
}): ReadableStream<Uint8Array> {
  /**
   * startRateLimitedStream: Sendet das einzige done-Event fuer einen limitierten Stream-Request.
   * Zweck: Der Client soll sofort ein vollstaendiges Abschlussereignis erhalten.
   * Problem: Ohne diesen Start-Handler bleibt die SSE-Initialisierung als anonyme Funktion im Konstruktor verborgen.
   * Eingabe: `controller`. Ausgabe: kein Rueckgabewert.
   */
  const startRateLimitedStream = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    controller.enqueue(new TextEncoder().encode(`event: done\ndata: ${JSON.stringify(payload)}\n\n`)); // Rate-Limit-Antwort im gewohnten done-Format senden; ohne muss der Client einen Sonderfall behandeln.
    controller.close(); // Stream sofort schliessen; ohne bleibt die Verbindung trotz terminalem Zustand offen.
  };
  return new ReadableStream({ start: startRateLimitedStream }); // Fertigen SSE-Body fuer 429-Antworten zurueckgeben; ohne bleibt der Konstruktor-Block im POST-Handler aufgeblasen.
}

/**
 * createRunChecksEventStream: Erzeugt den Live-SSE-Stream fuer einen laufenden Check-Prozess.
 * Zweck: Die UI soll aktuellen Check und Abschlussdaten waehrend des Run-Checks-Laufs live verfolgen koennen.
 * Problem: Ohne diesen Helper bleibt die gesamte Spawn-/Stream-Orchestrierung als grosser anonymer Callback-Block im POST-Handler.
 * Eingabe: `root` und `runCommand`. Ausgabe: `ReadableStream` mit `currentCheck`- und `done`-Events.
 */
function createRunChecksEventStream(
  root: string,
  runCommand: { cmd: string; args: string[] }
): ReadableStream<Uint8Array> {
  /**
   * startRunChecksStream: Startet den Child-Prozess und verdrahtet alle Streaming- und Abschluss-Handler.
   * Zweck: ReadableStream.start braucht eine klar benannte Einstiegfunktion fuer die Live-Check-Orchestrierung.
   * Problem: Ohne benannten Start-Handler zieht der Explanation-Check die anonyme Start-Funktion ab.
   * Eingabe: `controller`. Ausgabe: kein Rueckgabewert.
   */
  const startRunChecksStream = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const env = { ...process.env, SHIM_PROJECT_ROOT: root }; // Projektroot in die Child-Umgebung injizieren; ohne kennt der Runner im Dashboard-Kontext evtl. nicht sein Zielprojekt.
    const child = spawn(runCommand.cmd, runCommand.args, { cwd: root, env, shell: true }); // Runner als Child-Prozess im Projektroot starten; ohne kann der Livestream keinen echten Check-Lauf verfolgen. runCommand aus getRunCommand(root), keine User-Eingabe; shell fuer bash/node noetig. nosemgrep
    let stdout = ""; // Gesammeltes stdout fuer Abschlussantwort und Reportpersistenz puffern; ohne gehen Stream-Daten nach dem Senden verloren.
    let stderr = ""; // Gesammeltes stderr analog puffern; ohne fehlen Fehltexte in done-Event und Last-Run-Log.
    let lineBuffer = ""; // Unvollstaendige Chunk-Enden puffern, damit Check-IDs zeilenweise erkannt werden; ohne zerfallen Zeilen ueber Chunkgrenzen.
    /**
     * pushChunk: Fuegt einen neuen stdout/stderr-Chunk in die Buffer ein und extrahiert Check-IDs fuer Live-Events.
     * Zweck: Live-Streaming soll sowohl komplette Logs sammeln als auch progressiv den aktuellen Check melden.
     * Problem: Ohne diesen Helper waeren Chunk-Sammeln und Zeilenparser im Event-Handler dupliziert.
     * Eingabe: `chunk`, `isErr`. Ausgabe: kein Rueckgabewert.
     */
    const pushChunk = (chunk: string, isErr: boolean) => {
      if (isErr)
        // Stderr getrennt von stdout halten; ohne vermischt sich Fehler- und Normalausgabe.
        stderr += chunk; // Stderr-Chunk separat sammeln; ohne kann die Fehlerausgabe spaeter nicht getrennt angezeigt werden.
      else stdout += chunk; // Stdout-Chunk sammeln; ohne fehlt die normale Check-Ausgabe im Abschlusslog.
      lineBuffer += chunk; // Chunk an den Zeilenpuffer anhaengen; ohne gehen Teilzeilen an Chunkgrenzen verloren.
      const lines = lineBuffer.split("\n"); // Puffer in vollstaendige Zeilen aufteilen; ohne kann getCheckIdFromLine nicht sauber arbeiten.
      lineBuffer = lines.pop() ?? ""; // Letzte unvollstaendige Zeile fuer den naechsten Chunk behalten; ohne zerreissen wir Zeileninformationen.
      for (const line of lines) {
        // Jede vollstaendige Zeile auf Check-ID pruefen; ohne fehlt die Live-Fortschrittsmeldung.
        const id = getCheckIdFromLine(line); // Check-ID heuristisch aus jeder fertigen Zeile lesen; ohne fehlt die Live-Fortschrittsanzeige.
        if (id) sendSSE(controller, "currentCheck", { checkId: id }); // Gefundene Check-ID direkt an die UI streamen; ohne sieht der Nutzer keinen aktuellen Check.
      }
    };
    /**
     * onStdoutData: Reagiert auf stdout-Daten des Child-Prozesses.
     * Zweck: Normale Laufausgabe muss gesammelt und fuer Check-Wechsel analysiert werden.
     * Problem: Ohne benannten Handler bleibt dieser Datenpfad ein anonymer Event-Callback.
     * Eingabe: `d` als empfangener Chunk. Ausgabe: kein Rueckgabewert.
     */
    const onStdoutData = (d: Buffer | string) => {
      pushChunk(String(d), false); // Stdout in den gemeinsamen Chunk-Handler leiten; ohne gehen normale Logzeilen verloren.
    };
    /**
     * onStderrData: Reagiert auf stderr-Daten des Child-Prozesses.
     * Zweck: Fehler- und Warn-Ausgaben muessen separat gesammelt und an die UI uebernommen werden.
     * Problem: Ohne benannten Handler bleibt auch der Stderr-Pfad ein anonymer Callback.
     * Eingabe: `d` als empfangener Chunk. Ausgabe: kein Rueckgabewert.
     */
    const onStderrData = (d: Buffer | string) => {
      pushChunk(String(d), true); // Stderr an denselben Parser weiterreichen; ohne fehlt die Fehlerausgabe im Abschlussstatus.
    };
    /**
     * onChildClose: Finalisiert Persistenz und Abschluss-Event, wenn der Child-Prozess endet.
     * Zweck: Stream-Clients sollen nach Prozessende deterministisch done-Daten erhalten.
     * Problem: Ohne benannten Close-Handler bleibt die Abschlusslogik als anonymer Event-Callback schwer nachvollziehbar.
     * Eingabe: `code` des Prozesses. Ausgabe: kein Rueckgabewert.
     */
    const onChildClose = (code: number | null) => {
      writeLastRun(root, stdout, stderr); // Kompletten Lauf fuer spaetere Logs persistieren; ohne ist der Stream-Lauf nach Seitenreload weg.
      writeReviewReports(root, stdout, stderr); // Eventuelle Review-Segmente auch im Stream-Fall als Dateien schreiben; ohne verhalten sich Stream- und JSON-Pfad unterschiedlich.
      sendSSE(controller, "done", { code: code ?? 1, stdout, stderr }); // Finale Laufdaten an die UI schicken; ohne weiss der Client nicht, dass der Prozess fertig ist.
      controller.close(); // Stream nach dem done-Event schliessen; ohne bleibt die Verbindung haengen.
    };
    /**
     * onChildError: Meldet einen Start-/Laufzeitfehler des Child-Prozesses an den Stream-Client.
     * Zweck: Auch Prozessfehler muessen als terminierendes done-Event im SSE-Vertrag auftauchen.
     * Problem: Ohne benannten Error-Handler bleibt der Fehlerpfad ein anonymer Callback und die UI haette keinen Abschluss.
     * Eingabe: keine direkt genutzten Parameter. Ausgabe: kein Rueckgabewert.
     */
    const onChildError = () => {
      sendSSE(controller, "done", { code: 1, stdout: "", stderr: "Process error" }); // Prozessfehler in dieselbe Abschlussform wie normale Runs uebersetzen; ohne muss der Client einen Sonderpfad kennen.
      controller.close(); // Fehlerstream sofort beenden; ohne bleibt die SSE-Verbindung offen.
    };
    child.stdout?.on("data", onStdoutData); // Stdout-Events an den benannten Handler haengen; ohne fehlt normaler Laufoutput im Stream.
    child.stderr?.on("data", onStderrData); // Stderr-Events ebenfalls verdrahten; ohne sieht die UI Fehler nur unvollstaendig.
    child.on("close", onChildClose); // Abschluss-Handler registrieren; ohne fehlen Persistenz und done-Event.
    child.on("error", onChildError); // Fehler-Handler registrieren; ohne endet ein Spawn-Fehler ohne saubere Client-Nachricht.
  };
  return new ReadableStream<Uint8Array>({ start: startRunChecksStream }); // Fertigen Live-Stream an den POST-Handler zurueckgeben; ohne bleibt der komplexe Stream-Aufbau inline.
}

/**
 * POST: Startet den Projekt-Check-Lauf und liefert entweder JSON oder einen SSE-Livestream zurueck.
 * Zweck: Das Dashboard soll Checks serverseitig triggern, live verfolgen und den Abschluss inklusive Logs erhalten koennen.
 * Problem: Ohne diesen Endpoint kann die UI keine Check-Laeufe ausloesen oder den Fortschritt beobachten.
 * Eingabe: `request` mit optionalem `Accept: text/event-stream`. Ausgabe: JSON- oder SSE-Response.
 */
export async function POST(request: NextRequest) {
  const accept = request.headers.get("accept") ?? ""; // Accept-Header lesen; ohne wissen wir nicht, ob die UI Stream- oder JSON-Antwort erwartet.
  const streamResponse = accept.includes("text/event-stream"); // SSE-Wunsch aus dem Header ableiten; ohne kann die falsche Response-Art geliefert werden.

  const ip = getClientIp(request); // Client-IP fuer das Rate Limit extrahieren; ohne kann derselbe Client beliebig oft teure Checks starten.
  if (isRunChecksRateLimited(ip)) {
    // Rate-Limit ueberschritten: sofort mit 429 antworten; ohne koennte derselbe Client die Ressourcen ueberlasten.
    const payload = {
      error: "Rate limited. Please wait before running checks again.",
      stdout: "",
      stderr: "",
      code: 429,
    }; // Einheitliche Fehlerpayload fuer limitierte Requests vorbereiten; ohne divergieren Stream- und JSON-Fehlerformen.
    if (streamResponse) {
      // Stream-Client: SSE-429-Body liefern; ohne erhaelt die Stream-UI keinen konsistenten Abschluss.
      const body = createRateLimitedSseBody(payload); // Rate-Limit-SSE ueber eigenen Helper bauen; ohne bleibt dieser Sonderfall als anonymer Stream-Callback im Handler.
      return new Response(body, {
        status: 429,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      }); // Rate-Limit als echte SSE-Antwort mit 429 liefern; ohne versteht die Stream-UI den Fehler nicht konsistent.
    }
    return NextResponse.json(payload, { status: 429 }); // JSON-Clients den Rate-Limit-Fehler als standardisierte Antwort geben; ohne fehlt ein sauberer API-Vertrag.
  }

  try {
    // Gesamte Runner- und Response-Logik kapseln; ohne wuerden Pfad- oder Exec-Fehler den Handler unbehandelt verlassen.
    const root = getProjectRoot(); // Effektive Projektwurzel fuer Kommando- und Dateizugriffe aufloesen; ohne laufen Runner und Logpfade im falschen Verzeichnis.
    const runCommand = getRunCommand(root); // Passenden Check-Runner ermitteln; ohne wissen wir nicht, welchen Prozess wir starten sollen.
    if (!runCommand) {
      // Kein Runner verfuegbar: frueh mit Fehler antworten; ohne wuerde spawn/exec mit leerem Kommando abstuerzen.
      return NextResponse.json({
        error: "scripts/run-checks.sh not found; install shimwrappercheck for full runner.",
        stdout: "",
        stderr: "",
        code: 1,
      }); // Frueh mit klarer Fehlermeldung aussteigen, wenn kein Runner gefunden wurde; ohne scheitert spaeter ein leerer Spawn/Exec-Aufruf.
    }

    if (streamResponse) {
      // Client will SSE: Live-Stream zurueckgeben; ohne wuerde JSON statt Stream geliefert.
      const stream = createRunChecksEventStream(root, runCommand); // Komplexe SSE-Spawn-Logik ueber benannten Helper erzeugen; ohne bleibt der POST-Handler zu anonym und schwer kommentierbar.
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
      }); // SSE-Response mit passenden Streaming-Headern zurueckgeben; ohne puffert oder blockiert der Browser den Livestream.
    }

    const opts = {
      cwd: root, // Child-Kommando im Projektroot ausfuehren; ohne laufen relative Pfade im Check-Lauf ins Leere.
      maxBuffer: 4 * 1024 * 1024, // Groesseren Standardpuffer fuer umfangreiche Check-Ausgaben reservieren; ohne bricht exec bei laengeren Logs zu frueh ab.
      shell: "/bin/bash", // Bash explizit als Shell setzen; ohne koennen Script-/Quoting-Pfade auf anderen Shells anders reagieren.
      env: { ...process.env, SHIM_PROJECT_ROOT: root }, // Projektroot auch im exec-Pfad an die Kindumgebung weiterreichen; ohne kennt der Runner sein Zielprojekt nicht immer.
    }; // Gemeinsame Exec-Optionen fuer den non-streaming-Pfad vorbereiten; ohne muessten Spawn-Parameter mehrfach gepflegt werden.
    let stdout = ""; // Stdout im non-streaming-Pfad sammeln; ohne hat die JSON-Antwort keinen Laufoutput.
    let stderr = ""; // Stderr analog sammeln; ohne fehlt der Fehlerkanal in der API-Antwort.
    let code = 0; // Standard-Exitcode vorbelegen; ohne bleibt bei Erfolg der Rueckgabecode implizit.
    const shellCmd =
      runCommand.cmd === "bash"
        ? `bash "${runCommand.args[0]}"`
        : runCommand.cmd === "node"
          ? `node "${runCommand.args[0]}"`
          : "npx shimwrappercheck run"; // Konkretes Shell-Kommando fuer exec bauen; ohne kann promisified exec den Runner nicht starten.
    try {
      // Exec-Pfad kapseln, um stdout/stderr/code aus Fehlerfaellen zu lesen; ohne gingen Fehler-Laufdaten verloren.
      const out = await execAsync(shellCmd, {
        ...opts,
        maxBuffer: runCommand.cmd === "bash" ? 2 * 1024 * 1024 : opts.maxBuffer,
      }); // Kommando mit ggf. angepasstem Buffer starten; ohne koennen grosse Shell-Ausgaben exec ueberlaufen.
      stdout = out.stdout ?? ""; // Erfolgs-Stdout uebernehmen; ohne bleibt die Antwort trotz gelaufenem Check leer.
      stderr = out.stderr ?? ""; // Erfolgs-Stderr ebenfalls erfassen; ohne gehen Warnungen oder Nebenausgaben verloren.
    } catch (e: unknown) {
      // Exec-Fehler (nicht gefunden, Timeout, Exit != 0) abfangen; ohne haette die JSON-Antwort keinen Inhalt.
      const err = e as { stdout?: string; stderr?: string; code?: number }; // Exec-Fehler in lose Struktur casten, um stdout/stderr/code zu lesen; ohne bleiben Fehl-Laufdaten unzugaenglich.
      stdout = err.stdout ?? ""; // Auch bei Fehl-Exit vorhandenes stdout zurueckgeben; ohne fehlt oft der wichtigste Kontext.
      stderr = err.stderr ?? (err instanceof Error ? err.message : String(e)); // Stderr oder Fehlermeldung als Rueckgabe sichern; ohne bleibt der Fehlergrund zu vage.
      code = err.code ?? 1; // Exitcode aus dem Fehlerobjekt uebernehmen; ohne sehen Aufrufer nur einen generischen Fehler.
    }
    writeLastRun(root, stdout, stderr); // Letzten Lauf auch im JSON-Pfad persistieren; ohne unterscheiden sich Stream- und Non-Stream-Verhalten unnoetig.
    writeReviewReports(root, stdout, stderr); // Review-Dateien auch nach exec-basierter Ausfuehrung schreiben; ohne fehlen Reports ausserhalb des Stream-Modus.
    return NextResponse.json({ stdout, stderr, code }); // Abschlussdaten als JSON an den aufrufenden Client senden; ohne hat die Dashboard-UI kein Endergebnis.
  } catch (err) {
    // Unerwartete Fehler (getProjectRoot, getRunCommand, etc.) abfangen; ohne wuerde der Endpoint mit 500 oder unhandled rejection antworten.
    console.error("run-checks error:", err); // Unerwartete Endpoint-Fehler serverseitig loggen; ohne ist ein Produktionsausfall schwer zu diagnostizieren.
    return NextResponse.json(
      {
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        code: 1,
      }, // Unerwarteten Fehler trotzdem in das erwartete Response-Shape bringen; ohne muss die UI zwischen normalen und unnormalen Fehlerformen unterscheiden.
      { status: 200 }
    ); // Status 200 beibehalten, damit die UI den Lauf als inhaltlichen Fehler statt als komplett gebrochenen Transport behandeln kann.
  }
}
