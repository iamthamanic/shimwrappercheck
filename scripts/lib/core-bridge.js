/**
 * Lazy loader for @shimwrappercheck/core (ESM) from CommonJS scripts.
 * Purpose: structured-cli and project-*-api use built core without duplicating logic.
 */
const path = require("path");
const { pathToFileURL } = require("url");

let corePromise = null;
let cachedCore = null;

/**
 * Resolve path to built core entry (repo dev or installed package).
 */
function resolveCoreEntry() {
  const fs = require("fs");
  const candidates = [
    path.join(__dirname, "../../packages/core/dist/index.js"),
    path.join(__dirname, "../../../packages/core/dist/index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "shimwrappercheck core not built. Run: npm run build (packages/core/dist missing)",
  );
}

/** Load core module once (async). */
function loadCore() {
  if (!corePromise) {
    const entry = resolveCoreEntry();
    corePromise = import(pathToFileURL(entry).href).then((mod) => {
      cachedCore = mod;
      return mod;
    });
  }
  return corePromise;
}

/** Return cached core after preload, or null. */
function getCoreIfReady() {
  return cachedCore;
}

/** Preload core for sync callers (structured-cli main). */
async function preloadCore() {
  return loadCore();
}

module.exports = {
  loadCore,
  preloadCore,
  getCoreIfReady,
};
