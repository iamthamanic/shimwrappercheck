import fs from "node:fs";
import path from "node:path";
import type { CheckDefinition } from "../types.js";
import { skip, fromCommandFailure } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";

const EXCLUDE =
  "node_modules,.git,.next,dist,build,.shim,.shimwrapper,.stryker-tmp,.codex-home";

function hasPythonFiles(projectRoot: string): boolean {
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".shim",
    ".shimwrapper",
    ".stryker-tmp",
    ".codex-home",
  ]);

  function walk(dir: string, depth: number): boolean {
    if (depth > 6) return false;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const ent of entries) {
      if (skipDirs.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isFile()) {
        if (
          ent.name.endsWith(".py") ||
          ent.name === "pyproject.toml" ||
          ent.name === "requirements.txt"
        ) {
          return true;
        }
      } else if (ent.isDirectory() && walk(full, depth + 1)) {
        return true;
      }
    }
    return false;
  }

  return walk(projectRoot, 0);
}

export const ruffCheck: CheckDefinition = {
  id: "ruff",
  label: "Ruff",
  category: "other",
  envKey: "SHIM_RUN_RUFF",
  defaultEnabled: false,
  requiredTools: ["ruff"],
  async run(ctx) {
    if (ctx.flags.noRuff) {
      return skip("ruff", "Ruff disabled via --no-ruff");
    }
    if (!hasPythonFiles(ctx.projectRoot)) {
      return skip("ruff", "Ruff: no Python files found");
    }

    const checkArgs = ["check", ".", "--force-exclude", "--exclude", EXCLUDE];
    let result = await runCommand("ruff", checkArgs, {
      cwd: ctx.projectRoot,
      env: ctx.env,
      timeoutMs: 300_000,
    });
    if (result.exitCode !== 0) {
      return fromCommandFailure(ctx, "ruff", result, "Ruff", true);
    }

    result = await runCommand(
      "ruff",
      ["format", "--check", ".", "--force-exclude", "--exclude", EXCLUDE],
      { cwd: ctx.projectRoot, env: ctx.env, timeoutMs: 300_000 },
    );
    return fromCommandFailure(ctx, "ruff", result, "Ruff format", true);
  },
};
