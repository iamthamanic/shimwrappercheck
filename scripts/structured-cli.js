#!/usr/bin/env node
/**
 * Non-interactive CLI surface for machine-oriented shimwrappercheck operations.
 * Purpose: Expose the same core information/actions as MCP through stable subcommands and optional JSON output.
 * Problem solved: CLI-Anything and shell automation need deterministic commands, not interactive prompts or stdout scraping.
 * Location: scripts/structured-cli.js
 */

const path = require("path");

const {
  emitResult,
  parseRunCommand,
  parseToggleValue,
  printCommandHelp,
  printTopLevelHelp,
  takeFlag,
  takeOption,
} = require("./lib/structured-cli-helpers");
const {
  getConfig,
  getProjectPaths,
  listChecks,
  setConfig,
  toggleCheck,
} = require("./lib/project-config-api");
const {
  findLatestReport,
  getAgentsMd,
  readLastError,
  runChecks,
} = require("./lib/project-runtime-api");
const {
  configureMcpClient,
  listMcpClients,
  resolveServerPath,
} = require("./lib/mcp-client-config");
const { serializeRcValue } = require("./lib/rc-utils");

/**
 * Render "config get" output in a shell-friendly form.
 * Purpose: Humans should still be able to read the structured command output without JSON.
 * Input: result ({ path, config }). Output: void.
 */
function printConfig(result) {
  console.log(result.path);
  for (const [key, value] of Object.entries(result.config)) {
    console.log(`${key}=${serializeRcValue(value)}`);
  }
}

/**
 * Render "report latest" output in a readable form.
 * Purpose: Human callers should see the report body directly when they omit --json.
 * Input: result object. Output: void.
 */
function printLatestReport(result) {
  if (!result.found) {
    console.log(`No markdown review report found in ${result.directory}`);
    return;
  }

  console.log(result.path);
  console.log("");
  process.stdout.write(result.content);
  if (!result.content.endsWith("\n")) console.log("");
}

/**
 * Render "agents-md" output in a readable form.
 * Purpose: Project instructions are usually most useful as raw text.
 * Input: result object. Output: void.
 */
function printAgentsMd(result) {
  if (!result.found) {
    console.log(result.message);
    return;
  }

  process.stdout.write(result.content);
  if (!result.content.endsWith("\n")) console.log("");
}

/**
 * Execute one structured CLI command.
 * Purpose: Allow the main dispatcher and tests to call the same implementation.
 * Inputs: argv (string[]), options (object). Output: process exit code number.
 */
async function main(argv = process.argv.slice(2), options = {}) {
  const args = [...argv];
  const projectRoot = options.projectRoot || getProjectPaths().projectRoot;
  const packageRoot = path.join(__dirname, "..");
  const command = args.shift();

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    printTopLevelHelp();
    return 0;
  }

  try {
    if (command === "config") {
      const subcommand = args.shift();
      const asJson = takeFlag(args, "--json");
      if (subcommand === "get" && args.length === 0) {
        emitResult(getConfig(projectRoot), asJson, printConfig);
        return 0;
      }

      if (subcommand === "set") {
        const assignments = {};
        for (const arg of args) {
          const separatorIndex = arg.indexOf("=");
          if (separatorIndex <= 0) {
            throw new Error(`Expected KEY=VALUE assignment, got: ${arg}`);
          }
          assignments[arg.slice(0, separatorIndex)] = arg.slice(
            separatorIndex + 1,
          );
        }

        if (Object.keys(assignments).length === 0) {
          throw new Error("config set requires at least one KEY=VALUE pair.");
        }

        emitResult(setConfig(projectRoot, assignments), asJson, (result) => {
          console.log(
            `Updated ${result.updatedKeys.length} key(s) in ${result.path}`,
          );
        });
        return 0;
      }

      printCommandHelp("config");
      return 1;
    }

    if (command === "checks") {
      const subcommand = args.shift();
      const asJson = takeFlag(args, "--json");
      if (subcommand === "list" && args.length === 0) {
        emitResult(listChecks(projectRoot), asJson, (result) => {
          for (const check of result.checks) {
            console.log(
              `${check.enabled ? "on " : "off"} ${check.envKey} ${check.label}`,
            );
          }
        });
        return 0;
      }

      if (subcommand === "toggle") {
        const envKey = args.shift();
        const enabled = parseToggleValue(args.shift());
        if (!envKey || args.length > 0) {
          throw new Error("checks toggle requires <ENV_KEY> <on|off>.");
        }

        emitResult(
          toggleCheck(projectRoot, envKey, enabled),
          asJson,
          (result) => {
            console.log(result.message);
          },
        );
        return 0;
      }

      printCommandHelp("checks");
      return 1;
    }

    if (command === "status") {
      const subcommand = args.shift();
      const asJson = takeFlag(args, "--json");
      if (subcommand === "last-error" && args.length === 0) {
        const error = readLastError(projectRoot);
        emitResult(
          error
            ? { hasError: true, error }
            : { hasError: false, message: "No last error found." },
          asJson,
          (result) => {
            if (!result.hasError) {
              console.log(result.message);
              return;
            }
            console.log(
              `${result.error.check || "unknown"}: ${result.error.message || "Unknown error"}`,
            );
            if (result.error.suggestion)
              console.log(`Suggestion: ${result.error.suggestion}`);
          },
        );
        return 0;
      }

      printCommandHelp("status");
      return 1;
    }

    if (command === "report") {
      const subcommand = args.shift();
      const asJson = takeFlag(args, "--json");
      if (subcommand === "latest" && args.length === 0) {
        emitResult(findLatestReport(projectRoot), asJson, printLatestReport);
        return 0;
      }

      printCommandHelp("report");
      return 1;
    }

    if (command === "check-update" || command === "check-update") {
      const asJson = takeFlag(args, "--json");
      const { checkUpdate } = require("./check-update");
      const result = await checkUpdate();
      emitResult(result, asJson, (r) => {
        if (r.outdated) {
          console.log(`⚠️  ${r.message}`);
        } else if (!r.latest) {
          console.log(`⚠️  ${r.message}`);
        } else {
          console.log(`✅ ${r.message}`);
        }
      });
      return 0;
    }

    if (command === "agents-md") {
      const asJson = takeFlag(args, "--json");
      if (args.length > 0) {
        throw new Error(`Unknown agents-md option(s): ${args.join(" ")}`);
      }

      emitResult(getAgentsMd(projectRoot), asJson, printAgentsMd);
      return 0;
    }

    if (command === "mcp") {
      const subcommand = args.shift();
      const asJson = takeFlag(args, "--json");
      if (subcommand === "clients" && args.length === 0) {
        emitResult({ clients: listMcpClients() }, asJson, (result) => {
          for (const client of result.clients) {
            console.log(
              `${client.name}: ${client.configPath} (${client.shimwrappercheckConfigured ? "configured" : "not configured"})`,
            );
          }
        });
        return 0;
      }

      if (subcommand === "configure") {
        const dryRun = takeFlag(args, "--dry-run") || takeFlag(args, "--print");
        const client = takeOption(args, "--client");
        const serverPath =
          takeOption(args, "--server-path") ||
          resolveServerPath(projectRoot, packageRoot);
        if (!client) {
          throw new Error(
            "mcp configure requires --client <cursor|claude-desktop|codex-cli>.",
          );
        }
        if (args.length > 0) {
          throw new Error(`Unknown mcp configure option(s): ${args.join(" ")}`);
        }

        const result = configureMcpClient({
          client,
          projectRoot,
          serverPath,
          write: !dryRun,
        });
        if (!result.success) {
          throw new Error(result.error);
        }

        emitResult(result, asJson, (output) => {
          console.log(
            `${output.client}: ${output.dryRun ? "would" : "did"} ${output.action} ${output.configPath}`,
          );
          if (output.dryRun) {
            console.log("");
            process.stdout.write(output.preview);
            if (!output.preview.endsWith("\n")) console.log("");
          }
        });
        return 0;
      }

      printCommandHelp("mcp");
      return 1;
    }

    if (command === "run") {
      const { asJson, opts } = parseRunCommand(args);
      const result = runChecks(projectRoot, opts);
      emitResult(result, asJson, (output) => {
        if (output.stdout) process.stdout.write(output.stdout);
        if (output.stderr) process.stderr.write(output.stderr);
      });
      return result.exitCode;
    }

    throw new Error(`Unknown structured command: ${command}`);
  } catch (error) {
    console.error(error.message);
    if (
      [
        "config",
        "checks",
        "status",
        "report",
        "mcp",
        "run",
        "agents-md",
      ].includes(command)
    ) {
      printCommandHelp(command);
    } else {
      printTopLevelHelp();
    }
    return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  main,
  printTopLevelHelp,
};
