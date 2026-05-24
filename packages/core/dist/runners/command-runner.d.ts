import { spawn } from "node:child_process";
import type { CommandRunResult } from "./result.js";
export type RunCommandOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
};
/**
 * Run an external command with timeout and captured output.
 * Injectable spawn for tests via runCommandWithSpawn.
 */
export declare function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<CommandRunResult>;
export declare function runCommandWithSpawn(
  spawnFn: typeof spawn,
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<CommandRunResult>;
//# sourceMappingURL=command-runner.d.ts.map
