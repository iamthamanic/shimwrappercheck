/**
 * GET/POST /api/ui-config – Port-Einstellung für die grafische UI (auto oder fester Port).
 * Speichert in .shimwrappercheck-ui.json im Projekt-Root (oder Dashboard-Ordner).
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

const FILENAME = ".shimwrappercheck-ui.json";

function getConfigPath(): string {
  const root = getProjectRoot();
  return path.join(root, FILENAME);
}

function readConfig(): { portAuto: boolean; port: number } {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      return {
        portAuto: data.portAuto !== false,
        port: typeof data.port === "number" && data.port > 0 ? data.port : 3000,
      };
    }
  } catch {
    // ignore
  }
  return { portAuto: true, port: 3000 };
}

function writeConfig(config: { portAuto: boolean; port: number }) {
  const p = getConfigPath();
  const root = path.dirname(p);
  if (!fs.existsSync(root)) return;
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
}

export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("ui-config GET error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const portAuto = body.portAuto !== false;
    const port = typeof body.port === "number" && body.port > 0 && body.port < 65536 ? Math.floor(body.port) : 3000;
    const config = { portAuto, port };
    writeConfig(config);
    return NextResponse.json(config);
  } catch (err) {
    console.error("ui-config POST error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
