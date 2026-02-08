#!/usr/bin/env node
/**
 * Update README before push: sync version from package.json into README.md.
 * Run from project root (e.g. by run-checks.sh when "Update README" check is enabled).
 * - Replaces {{version}} in README with package.json version.
 * - Optionally replaces first "version": "x.y.z" or "Version x.y.z" pattern.
 * Exits 0 on success or when nothing to do; exits 1 on read/write errors.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const readmePath = path.join(root, "README.md");

let version;
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  version = pkg.version;
} catch (e) {
  console.error("update-readme: could not read package.json:", e.message);
  process.exit(1);
}

if (!version || typeof version !== "string") {
  console.error("update-readme: no version in package.json");
  process.exit(1);
}

let readme;
try {
  readme = fs.readFileSync(readmePath, "utf8");
} catch (e) {
  if (e.code === "ENOENT") {
    process.exit(0);
  }
  console.error("update-readme: could not read README.md:", e.message);
  process.exit(1);
}

let updated = readme;

// 1) Replace {{version}} placeholder
if (updated.includes("{{version}}")) {
  updated = updated.replace(/\{\{version\}\}/g, version);
}

// 2) Replace "version": "x.y.z" (e.g. in JSON snippet or badge) with current version
const versionInQuotes = /("version"\s*:\s*")[^"]+(")/;
if (versionInQuotes.test(updated)) {
  updated = updated.replace(versionInQuotes, `$1${version}$2`);
}

// 3) Replace first "Version x.y.z" or "version x.y.z" line (common in headings)
const versionLine = /^(#?\s*(?:Version|version)\s+)(\d+\.\d+\.\d+(?:-[^]\s]*)?)(\s*)$/m;
if (versionLine.test(updated)) {
  updated = updated.replace(versionLine, (_, prefix, _old, suffix) => `${prefix}${version}${suffix}`);
}

if (updated === readme) {
  process.exit(0);
}

try {
  fs.writeFileSync(readmePath, updated, "utf8");
} catch (e) {
  console.error("update-readme: could not write README.md:", e.message);
  process.exit(1);
}

console.log("update-readme: README.md updated with version", version);
