import fs from "node:fs";
import path from "node:path";
import { loadConfig, getProjectPaths } from "../config/load-config.js";
import { patchLegacyRc } from "../config/save-config.js";
import { listCheckCatalog } from "../checks/registry.js";
import { CONFIG_KEY_ORDER } from "../config/schema.js";
import type { LastErrorEntry } from "../reports/write-report.js";

/** Re-export for structured CLI / MCP parity. */
export { CONFIG_KEY_ORDER, getProjectPaths, loadConfig };

/** Read .shimwrappercheckrc as legacy string map (structured CLI format). */
export function getLegacyConfig(projectRoot?: string): {
  path: string;
  config: Record<string, string>;
} {
  const loaded = loadConfig({ projectRoot });
  return { path: loaded.path, config: loaded.legacy };
}

/** Patch RC keys without dropping other settings. */
export function setLegacyConfig(
  values: Record<string, string>,
  projectRoot?: string,
): {
  success: boolean;
  path: string;
  updatedKeys: string[];
  config: Record<string, string>;
} {
  const result = patchLegacyRc(values, { projectRoot });
  const reloaded = loadConfig({ projectRoot });
  return {
    success: true,
    path: result.path,
    updatedKeys: Object.keys(values),
    config: reloaded.legacy,
  };
}

/** Toggle one SHIM_RUN_* flag by env key. */
export function toggleLegacyCheck(
  envKey: string,
  enabled: boolean,
  projectRoot?: string,
): {
  success: boolean;
  path: string;
  envKey: string;
  enabled: boolean;
  message: string;
  config: Record<string, string>;
} {
  const result = setLegacyConfig(
    { [envKey]: enabled ? "1" : "0" },
    projectRoot,
  );
  return {
    ...result,
    envKey,
    enabled,
    message: `${envKey} is now ${enabled ? "enabled" : "disabled"}`,
  };
}

/** List checks with enabled state from RC (catalog-backed). */
export function listChecksWithState(projectRoot?: string): {
  source: string;
  checks: Array<{
    id: string;
    label: string;
    envKey: string;
    enabled: boolean;
    defaultEnabled: boolean;
  }>;
} {
  const loaded = loadConfig({ projectRoot });
  const catalog = listCheckCatalog();

  return {
    source: "check-catalog",
    checks: catalog.map((check) => ({
      id: check.id,
      label: check.label,
      envKey: check.envKey,
      enabled: loaded.legacy[check.envKey] !== "0",
      defaultEnabled: check.defaultEnabled,
    })),
  };
}

/** Read .shim/last_error.json. */
export function readLastErrorEntry(
  projectRoot?: string,
): LastErrorEntry | null {
  const { projectRoot: root } = getProjectPaths(projectRoot);
  const lastErrorPath = path.join(root, ".shim", "last_error.json");
  if (!fs.existsSync(lastErrorPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(lastErrorPath, "utf8")) as LastErrorEntry;
  } catch {
    return null;
  }
}

/** Resolve review output directory from presets or default. */
export function resolveReviewDirectory(projectRoot?: string): string {
  const { projectRoot: root } = getProjectPaths(projectRoot);
  const presetsPath = path.join(root, ".shimwrappercheck-presets.json");
  let configuredDirectory = "reports";

  if (fs.existsSync(presetsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(presetsPath, "utf8")) as {
        reviewOutputPath?: string;
      };
      if (
        typeof parsed.reviewOutputPath === "string" &&
        parsed.reviewOutputPath.trim()
      ) {
        configuredDirectory = parsed.reviewOutputPath.trim();
      }
    } catch {
      configuredDirectory = "reports";
    }
  }

  const resolvedDirectory = path.resolve(root, configuredDirectory);
  const safePrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolvedDirectory !== root && !resolvedDirectory.startsWith(safePrefix)) {
    return path.join(root, "reports");
  }
  return resolvedDirectory;
}

/** Find newest markdown review report. */
export function findLatestReviewReport(projectRoot?: string): {
  found: boolean;
  directory: string;
  path?: string;
  name?: string;
  content?: string;
} {
  const reviewDirectory = resolveReviewDirectory(projectRoot);
  if (!fs.existsSync(reviewDirectory)) {
    return { found: false, directory: reviewDirectory };
  }

  const markdownFiles = fs
    .readdirSync(reviewDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => ({
      name: fileName,
      fullPath: path.join(reviewDirectory, fileName),
      mtimeMs: fs.statSync(path.join(reviewDirectory, fileName)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (markdownFiles.length === 0) {
    return { found: false, directory: reviewDirectory };
  }

  const latestFile = markdownFiles[0]!;
  return {
    found: true,
    directory: reviewDirectory,
    path: latestFile.fullPath,
    name: latestFile.name,
    content: fs.readFileSync(latestFile.fullPath, "utf8").slice(0, 50_000),
  };
}

/** Read AGENTS.md from project root. */
export function getAgentsMdContent(projectRoot?: string): {
  found: boolean;
  path?: string;
  content?: string;
  message?: string;
} {
  const { projectRoot: root } = getProjectPaths(projectRoot);
  const agentsPath = path.join(root, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    return { found: false, message: "No AGENTS.md found in project root." };
  }

  try {
    return {
      found: true,
      path: agentsPath,
      content: fs.readFileSync(agentsPath, "utf8").slice(0, 50_000),
    };
  } catch {
    return { found: false, message: "Could not read AGENTS.md." };
  }
}
