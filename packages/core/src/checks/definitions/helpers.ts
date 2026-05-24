import fs from "node:fs";
import path from "node:path";
import type { CheckContext, CheckResult } from "../types.js";
import { runCommand } from "../../runners/command-runner.js";
import { resolveChecktoolsBinary } from "../../binary/resolve-checktools.js";
import { commandSucceeded } from "../../runners/result.js";
import { classifyCommandFailure } from "../../runners/error-classifier.js";
import { applyInfraPolicy } from "../../runners/network-infra.js";

/** Build a passed check result. */
export function pass(
  id: string,
  message: string,
  blocking = true,
): CheckResult {
  return { id, status: "passed", blocking, message };
}

/** Build a skipped check result. */
export function skip(id: string, message: string): CheckResult {
  return { id, status: "skipped", blocking: false, message };
}

/** Build a warning (non-blocking unless caller sets blocking). */
export function warn(id: string, message: string): CheckResult {
  return { id, status: "warning", blocking: false, message };
}

function combinedOutput(result: { stdout: string; stderr: string }): string {
  return `${result.stderr}\n${result.stdout}`;
}

/** Map command failure to CheckResult with strict-network and optional-check policy. */
export function fromCommandFailure(
  ctx: CheckContext,
  id: string,
  result: Awaited<ReturnType<typeof runCommand>>,
  label: string,
  optionalCheck = false,
): CheckResult {
  if (commandSucceeded(result)) {
    return pass(id, `${label}: passed`);
  }

  const classified = classifyCommandFailure(result, label);
  const policy = applyInfraPolicy(classified, combinedOutput(result), {
    strictNetworkChecks: ctx.config.strictNetworkChecks,
    optionalCheck,
  });

  return {
    id,
    status: policy.status,
    blocking: policy.blocking,
    message: policy.message,
    details: {
      exitCode: result.exitCode,
      stderr: result.stderr.slice(0, 2000),
    },
  };
}

/** Run npm script if package.json defines it; otherwise skip. */
export async function runNpmScriptIfPresent(
  ctx: CheckContext,
  id: string,
  scriptName: string,
  label: string,
): Promise<CheckResult> {
  const pkgPath = path.join(ctx.projectRoot, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (!pkg.scripts?.[scriptName]) {
      return skip(id, `${label}: no npm script "${scriptName}"`);
    }
  } catch {
    return skip(id, `${label}: package.json not found`);
  }

  const result = await runCommand("npm", ["run", scriptName], {
    cwd: ctx.projectRoot,
    env: ctx.env,
    timeoutMs: 600_000,
  });

  return fromCommandFailure(ctx, id, result, label);
}

/** Run node script when file exists under project or package root. */
export async function runNodeScriptIfExists(
  ctx: CheckContext,
  id: string,
  relativePaths: string[],
  label: string,
): Promise<CheckResult> {
  for (const rel of relativePaths) {
    const candidates = [
      path.join(ctx.projectRoot, rel),
      path.join(ctx.packageRoot, rel),
    ];
    for (const scriptPath of candidates) {
      if (!fs.existsSync(scriptPath)) continue;
      const result = await runCommand(process.execPath, [scriptPath], {
        cwd: ctx.projectRoot,
        env: ctx.env,
        timeoutMs: 600_000,
      });
      return fromCommandFailure(ctx, id, result, label);
    }
  }
  return skip(id, `${label}: script not found`);
}

/** Run bash script when present. */
export async function runBashScriptIfExists(
  ctx: CheckContext,
  id: string,
  relativePath: string,
  label: string,
): Promise<CheckResult> {
  const scriptPath = path.join(ctx.projectRoot, relativePath);
  if (!fs.existsSync(scriptPath)) {
    return skip(id, `${label}: ${relativePath} not found`);
  }
  const result = await runCommand("bash", [scriptPath], {
    cwd: ctx.projectRoot,
    env: ctx.env,
    timeoutMs: 600_000,
  });
  return fromCommandFailure(ctx, id, result, label);
}

/** Run npx tool; optional checks skip when tool is missing (non-strict). */
export async function runNpxTool(
  ctx: CheckContext,
  id: string,
  tool: string,
  args: string[],
  label: string,
  optionalCheck = false,
): Promise<CheckResult> {
  return runExternalTool(ctx, id, "npx", [tool, ...args], label, optionalCheck);
}

/** Resolve command: prefer .shimwrapper/checktools binary when present. */
export function resolveToolCommand(
  ctx: CheckContext,
  toolName: string,
): string {
  return resolveChecktoolsBinary(ctx.projectRoot, toolName) ?? toolName;
}

/** Run external CLI when available on PATH; optional checks skip if missing. */
export async function runExternalTool(
  ctx: CheckContext,
  id: string,
  command: string,
  args: string[],
  label: string,
  optionalCheck = false,
  preferChecktools = false,
  envOverride?: NodeJS.ProcessEnv,
): Promise<CheckResult> {
  const resolved = preferChecktools
    ? resolveToolCommand(ctx, command)
    : command;
  const result = await runCommand(resolved, args, {
    cwd: ctx.projectRoot,
    env: envOverride ? { ...ctx.env, ...envOverride } : ctx.env,
    timeoutMs: 600_000,
  });
  return fromCommandFailure(ctx, id, result, label, optionalCheck);
}

/** True when a config file exists in project root. */
export function projectFileExists(ctx: CheckContext, name: string): boolean {
  return fs.existsSync(path.join(ctx.projectRoot, name));
}
