#!/usr/bin/env node
/**
 * Install check tools into project-local .shimwrapper/checktools/.
 * Creates package.json from template if missing, then runs npm install.
 * Usage: npx shimwrappercheck install-tools [--from-repo] [--with-check-deps]
 *   --from-repo: run from shimwrappercheck repo root (use repo's templates).
 *   --with-check-deps: also install dependencies for enabled checks.
 */
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();
const fromRepo = process.argv.includes("--from-repo");
const withCheckDeps = process.argv.includes("--with-check-deps");
const pkgRoot = fromRepo ? projectRoot : path.resolve(__dirname, "..");
const templatesDir = path.join(pkgRoot, "templates");
const checktoolsDir = path.join(projectRoot, ".shimwrapper", "checktools");
const checktoolsPkg = path.join(checktoolsDir, "package.json");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  if (!exists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  ensureDir(checktoolsDir);
  if (!exists(checktoolsPkg)) {
    const tpl = path.join(templatesDir, "checktools-package.json");
    if (exists(tpl)) {
      fs.copyFileSync(tpl, checktoolsPkg);
      console.log(
        "Created .shimwrapper/checktools/package.json from template.",
      );
    } else {
      const defaultPkg = {
        name: "shimwrapper-checktools",
        private: true,
        devDependencies: {
          eslint: "^9",
          prettier: "^3",
          typescript: "^5",
          vitest: "^2",
          vite: "^6",
        },
      };
      fs.writeFileSync(
        checktoolsPkg,
        JSON.stringify(defaultPkg, null, 2) + "\n",
      );
      console.log("Created .shimwrapper/checktools/package.json.");
    }
  }
  console.log("Running npm install in .shimwrapper/checktools...");
  const result = cp.spawnSync("npm", ["install"], {
    cwd: checktoolsDir,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status != null ? result.status : 1);
  }
  if (withCheckDeps) {
    console.log("Installing dependencies for enabled checks...");
    const installDepsScript = path.join(__dirname, "install-check-deps.js");
    const installDepsResult = cp.spawnSync(
      process.execPath,
      [installDepsScript, "--yes", "--target", "checktools"],
      {
        cwd: projectRoot,
        stdio: "inherit",
        env: { ...process.env, SHIM_PROJECT_ROOT: projectRoot },
      },
    );
    if (installDepsResult.status !== 0) {
      process.exit(
        installDepsResult.status != null ? installDepsResult.status : 1,
      );
    }
  }
  console.log("Done. run-checks.sh will use these tools when present.");
}

main();
