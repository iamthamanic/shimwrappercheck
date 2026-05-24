import fs from "node:fs";
import path from "node:path";
import type { CheckDefinition } from "../types.js";
import { skip, fromCommandFailure } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";

function findShellScripts(projectRoot: string): string[] {
  const skipParts = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".shim",
    ".shimwrapper",
    ".stryker-tmp",
    ".codex-home",
  ];
  const found: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > 8 || found.length > 200) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (skipParts.some((p) => ent.name === p)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name.endsWith(".sh")) {
        found.push(full);
      } else if (ent.isDirectory()) {
        walk(full, depth + 1);
      }
    }
  }

  walk(projectRoot, 0);
  return found;
}

export const shellcheckCheck: CheckDefinition = {
  id: "shellcheck",
  label: "Shellcheck",
  category: "other",
  envKey: "SHIM_RUN_SHELLCHECK",
  defaultEnabled: false,
  requiredTools: ["shellcheck"],
  async run(ctx) {
    if (ctx.flags.noShellcheck) {
      return skip("shellcheck", "Shellcheck disabled via --no-shellcheck");
    }
    const files = findShellScripts(ctx.projectRoot);
    if (files.length === 0) {
      return skip("shellcheck", "Shellcheck: no .sh files found");
    }
    const result = await runCommand("shellcheck", files, {
      cwd: ctx.projectRoot,
      env: ctx.env,
      timeoutMs: 300_000,
    });
    return fromCommandFailure(ctx, "shellcheck", result, "Shellcheck", true);
  },
};
