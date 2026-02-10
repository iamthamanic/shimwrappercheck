#!/usr/bin/env node
/**
 * Single-entry setup: ensure shimwrappercheck is installed, then run init wizard.
 * Usage: npx shimwrappercheck setup
 */
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

const projectRoot = process.cwd();
const pkgPath = path.join(projectRoot, "package.json");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function main() {
  const pkg = readJson(pkgPath);
  const hasDep =
    pkg &&
    ((pkg.dependencies && pkg.dependencies.shimwrappercheck) ||
      (pkg.devDependencies && pkg.devDependencies.shimwrappercheck));

  if (!hasDep && pkg) {
    console.log(
      "shimwrappercheck nicht in package.json. Installiere als devDependency...",
    );
    try {
      cp.execSync("npm install shimwrappercheck --save-dev", {
        cwd: projectRoot,
        stdio: "inherit",
      });
    } catch (e) {
      console.error(
        "Installation fehlgeschlagen. Führe manuell aus: npm i -D shimwrappercheck",
      );
      process.exit(1);
    }
  } else if (!pkg) {
    console.log(
      "Kein package.json gefunden. Führe init trotzdem aus (globale Nutzung).",
    );
  }

  process.env.SHIM_LAUNCH_DASHBOARD = "1";
  require(path.join(__dirname, "init"));
}

main();
