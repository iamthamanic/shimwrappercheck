/**
 * Lazy loader for @shimwrappercheck/core from the MCP server (CommonJS).
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const PACKAGE_ROOT = path.join(__dirname, "..");
const CORE_DIST = path.join(PACKAGE_ROOT, "packages", "core", "dist", "index.js");

let coreModulePromise = null;

/** Load built core ESM bundle once; null when dist is missing. */
function loadCoreModule() {
  if (!fs.existsSync(CORE_DIST)) return Promise.resolve(null);
  if (!coreModulePromise) {
    coreModulePromise = import(pathToFileURL(CORE_DIST).href);
  }
  return coreModulePromise;
}

module.exports = {
  PACKAGE_ROOT,
  CORE_DIST,
  loadCoreModule,
};
