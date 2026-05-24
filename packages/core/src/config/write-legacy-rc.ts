import {
  CONFIG_KEY_ORDER,
  DEFAULT_CHECK_CATALOG,
  type ShimConfig,
} from "./schema.js";
import { serializeRcValue } from "./legacy-rc-parser.js";

export { serializeRcValue };

/** Convert canonical config back to legacy RC key/value pairs. */
export function configToLegacyRc(config: ShimConfig): Record<string, string> {
  const values: Record<string, string> = {};

  if (config.enforceCommands != null) {
    values.SHIM_ENFORCE_COMMANDS = config.enforceCommands;
  }
  if (config.hookCommands != null) {
    values.SHIM_HOOK_COMMANDS = config.hookCommands;
  }
  values.SHIM_AUTO_PUSH = config.autoPush ? "1" : "0";
  if (config.gitEnforceCommands != null) {
    values.SHIM_GIT_ENFORCE_COMMANDS = config.gitEnforceCommands;
  }
  if (config.gitCheckModeOnPush != null) {
    values.SHIM_GIT_CHECK_MODE_ON_PUSH = config.gitCheckModeOnPush;
  }
  values.SHIM_AI_REVIEW_PROVIDER = config.aiReview.provider;
  values.CHECK_MODE = config.checkMode;
  values.SHIM_AUDIT_LEVEL = config.auditLevel;
  values.SHIM_CONTINUE_ON_ERROR = config.continueOnError ? "1" : "0";
  values.SHIM_STRICT_NETWORK_CHECKS = config.strictNetworkChecks ? "1" : "0";
  values.SHIM_I18N_REQUIRE_MESSAGES_DIR = config.i18nRequireMessagesDir
    ? "1"
    : "0";
  if (config.checkOrder?.length) {
    values.SHIM_CHECK_ORDER = config.checkOrder.join(",");
  }
  values.SHIM_AI_REVIEW_BLOCKING = config.aiReview.blocking ? "1" : "0";
  if (config.aiReview.minRating != null) {
    values.SHIM_AI_MIN_RATING = String(config.aiReview.minRating);
  }
  if (config.aiReview.timeoutSec != null) {
    values.SHIM_AI_TIMEOUT_SEC = String(config.aiReview.timeoutSec);
  }
  values.SHIM_EXPLANATION_MIN_RATING = String(
    config.explanationCheck.minRating,
  );
  values.SHIM_BACKEND_PATH_PATTERNS = config.backendPathPatterns;

  for (const entry of DEFAULT_CHECK_CATALOG) {
    const enabled = config.checks[entry.id] ?? entry.defaultEnabled;
    values[entry.envKey] = enabled ? "1" : "0";
  }

  return values;
}

/** Serialize RC values to file lines (stable key order). */
export function formatLegacyRcFile(
  values: Record<string, string>,
  headerLine = "# shimwrappercheck config (managed by shimwrappercheck)",
): string {
  const lines = [headerLine];
  const used = new Set<string>();

  for (const key of CONFIG_KEY_ORDER) {
    if (!(key in values)) continue;
    lines.push(`${key}=${serializeRcValue(values[key])}`);
    used.add(key);
  }

  const remaining = Object.keys(values)
    .filter((k) => !used.has(k))
    .sort((a, b) => a.localeCompare(b));
  for (const key of remaining) {
    lines.push(`${key}=${serializeRcValue(values[key])}`);
  }

  return lines.join("\n") + "\n";
}
