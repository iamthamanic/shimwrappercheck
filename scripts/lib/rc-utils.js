const fs = require("fs");

/**
 * Safe existence check used by CLI scripts.
 */
function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Parse a shell-style rc value into plain text.
 */
function parseRcValue(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read .shimwrappercheckrc-like files into a key/value object.
 */
function readRcFile(filePath) {
  if (!exists(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    result[match[1]] = parseRcValue(match[2]);
  }
  return result;
}

/**
 * Parse a comma-separated list into normalized entries.
 */
function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalize boolean-ish values used in rc files.
 */
function isEnabled(value, defaultEnabled) {
  if (value == null || value === "") return defaultEnabled === 1;
  const normalized = String(value).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
}

/**
 * Convert text to a quoted/escaped shell value.
 */
function serializeRcValue(value) {
  const normalized = String(value == null ? "" : value);
  if (/^[0-9]+$/.test(normalized)) {
    return normalized;
  }
  const escaped = normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Write rc values with preferred key ordering and stable output.
 */
function writeRcFile(filePath, values, orderedKeys, headerLine) {
  const lines = [headerLine || "# shimwrappercheck config"];
  const usedKeys = new Set();

  for (const key of orderedKeys || []) {
    if (!(key in values)) continue;
    lines.push(`${key}=${serializeRcValue(values[key])}`);
    usedKeys.add(key);
  }

  const remainingKeys = Object.keys(values)
    .filter((key) => !usedKeys.has(key))
    .sort((a, b) => a.localeCompare(b));
  for (const key of remainingKeys) {
    lines.push(`${key}=${serializeRcValue(values[key])}`);
  }

  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

module.exports = {
  exists,
  parseRcValue,
  readRcFile,
  parseCsv,
  isEnabled,
  serializeRcValue,
  writeRcFile,
};
