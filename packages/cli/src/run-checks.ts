import { loadConfig } from "@shimwrappercheck/core";
import {
  formatInfraErrors,
  parseRunChecksFlags,
  runChecksWithRefactorLoop,
} from "@shimwrappercheck/core";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve shimwrappercheck package root (repo root when developing). */
export function resolvePackageRoot(): string {
  return path.resolve(__dirname, "../../..");
}

/** Execute core check engine; returns exit code. */
export async function runChecksCommand(argv: string[]): Promise<number> {
  const packageRoot = resolvePackageRoot();
  const projectRoot = process.env.SHIM_PROJECT_ROOT ?? process.cwd();

  const { config } = loadConfig({ projectRoot, env: process.env });
  const flags = parseRunChecksFlags(argv);

  console.log(`shimwrappercheck core engine (project: ${projectRoot})`);
  const result = await runChecksWithRefactorLoop({
    projectRoot,
    packageRoot,
    config,
    flags,
    env: process.env,
    until95: flags.until95,
  });

  const infraBlock = formatInfraErrors(result.results, result.infraErrorIds);
  if (infraBlock) {
    console.error(infraBlock);
  }

  return result.exitCode;
}
