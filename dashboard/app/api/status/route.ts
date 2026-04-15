/**
 * GET /api/status – project status for dashboard (checks script, config, AGENTS.md, husky).
 * Vercel-compatible; uses SHIM_PROJECT_ROOT when deployed.
 * Zweck: Dashboard braucht Projekt-Root, Projektname und Datei-Existenz für Status-Anzeige. Ohne wäre die Info-Seite leer.
 * Ausgabe: JSON mit projectRoot, projectName, config, presetsFile, agentsMd, runChecksScript, shimRunner, prePushHusky, prePushGit, supabase, lastError.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

export async function GET() {
  try {
    const root = getProjectRoot(); // Projekt-Root (SHIM_PROJECT_ROOT oder abgeleitet); ohne kennt die API das Zielprojekt nicht.
    if (!root || typeof root !== "string") {
      return NextResponse.json(
        {
          projectRoot: "",
          projectName: "",
          config: false,
          presetsFile: false,
          agentsMd: false,
          runChecksScript: false,
          shimRunner: false,
          prePushHusky: false,
          prePushGit: false,
          supabase: false,
          lastError: null,
          error: "Project root not available",
        },
        { status: 200 }
      );
    }
    const hasRc = fs.existsSync(path.join(root, ".shimwrappercheckrc"));
    const hasPresets = fs.existsSync(path.join(root, ".shimwrappercheck-presets.json"));
    const hasAgents = fs.existsSync(path.join(root, "AGENTS.md"));
    const hasRunChecks = fs.existsSync(path.join(root, "scripts", "run-checks.sh"));
    const hasRunner =
      fs.existsSync(path.join(root, "scripts", "shim-runner.js")) ||
      fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "scripts", "shim-runner.js"));
    const hasHusky = fs.existsSync(path.join(root, ".husky", "pre-push"));
    const hasGitHook = fs.existsSync(path.join(root, ".git", "hooks", "pre-push"));
    const hasSupabase = fs.existsSync(path.join(root, "supabase", "config.toml"));
    const hasMcpServer =
      fs.existsSync(path.join(root, "mcp", "server.js")) ||
      fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "mcp", "server.js")); // MCP-Server für Agent-Integration; ohne fehlt der MCP-Status in der UI.

    let projectName = path.basename(root); // Fallback: Ordnername des Roots; ohne wäre projectName bei fehlender package.json leer.
    const pkgPath = path.join(root, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); // package.json lesen; ohne kommt kein name.
        if (typeof pkg?.name === "string" && pkg.name.trim() !== "") {
          projectName = pkg.name.trim(); // Offizieller Projektname für Sidebar "# Projekt <name>"; ohne bliebe nur der Ordnername.
        }
      } catch {
        // Parsing-Fehler: Fallback projectName (path.basename) beibehalten; ohne würde projectName evtl. undefined.
      }
    }

    let lastError: { check?: string; message?: string; suggestion?: string; timestamp?: string } | null = null;
    const lastErrorPath = path.join(root, ".shim", "last_error.json");
    if (fs.existsSync(lastErrorPath)) {
      try {
        lastError = JSON.parse(fs.readFileSync(lastErrorPath, "utf8"));
      } catch {
        lastError = { message: "(parse error)" };
      }
    }

    return NextResponse.json({
      projectRoot: root,
      projectName,
      config: hasRc,
      presetsFile: hasPresets,
      agentsMd: hasAgents,
      runChecksScript: hasRunChecks,
      shimRunner: hasRunner,
      prePushHusky: hasHusky,
      prePushGit: hasGitHook,
      supabase: hasSupabase,
      mcpServer: hasMcpServer,
      lastError,
    });
  } catch (err) {
    console.error("status error:", err); // Log für Debugging; ohne fehlt der Grund für 500.
    return NextResponse.json(
      {
        projectRoot: "",
        projectName: "", // Bei Fehler leere Werte; ohne könnte die UI veraltete oder ungültige Daten anzeigen.
        config: false,
        presetsFile: false,
        agentsMd: false,
        runChecksScript: false,
        shimRunner: false,
        prePushHusky: false,
        prePushGit: false,
        supabase: false,
        mcpServer: false,
        lastError: null,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
