import type { CheckContext, CheckResult } from "../types.js";
import { runCommand } from "../../runners/command-runner.js";
/** Build a passed check result. */
export declare function pass(
  id: string,
  message: string,
  blocking?: boolean,
): CheckResult;
/** Build a skipped check result. */
export declare function skip(id: string, message: string): CheckResult;
/** Build a warning (non-blocking unless caller sets blocking). */
export declare function warn(id: string, message: string): CheckResult;
/** Map command failure to CheckResult with strict-network and optional-check policy. */
export declare function fromCommandFailure(
  ctx: CheckContext,
  id: string,
  result: Awaited<ReturnType<typeof runCommand>>,
  label: string,
  optionalCheck?: boolean,
): CheckResult;
/** Run npm script if package.json defines it; otherwise skip. */
export declare function runNpmScriptIfPresent(
  ctx: CheckContext,
  id: string,
  scriptName: string,
  label: string,
): Promise<CheckResult>;
/** Run node script when file exists under project or package root. */
export declare function runNodeScriptIfExists(
  ctx: CheckContext,
  id: string,
  relativePaths: string[],
  label: string,
): Promise<CheckResult>;
/** Run bash script when present. */
export declare function runBashScriptIfExists(
  ctx: CheckContext,
  id: string,
  relativePath: string,
  label: string,
): Promise<CheckResult>;
/** Run npx tool; optional checks skip when tool is missing (non-strict). */
export declare function runNpxTool(
  ctx: CheckContext,
  id: string,
  tool: string,
  args: string[],
  label: string,
  optionalCheck?: boolean,
): Promise<CheckResult>;
/** Resolve command: prefer .shimwrapper/checktools binary when present. */
export declare function resolveToolCommand(
  ctx: CheckContext,
  toolName: string,
): string;
/** Run external CLI when available on PATH; optional checks skip if missing. */
export declare function runExternalTool(
  ctx: CheckContext,
  id: string,
  command: string,
  args: string[],
  label: string,
  optionalCheck?: boolean,
  preferChecktools?: boolean,
  envOverride?: NodeJS.ProcessEnv,
): Promise<CheckResult>;
/** True when a config file exists in project root. */
export declare function projectFileExists(
  ctx: CheckContext,
  name: string,
): boolean;
//# sourceMappingURL=helpers.d.ts.map
