#!/usr/bin/env node
/**
 * CLI command for MCP client setup.
 * Purpose: Configure Cursor, Claude Desktop, or Codex CLI so agents can use shimwrappercheck as an MCP server.
 * Problem solved: Users and agents should not have to hand-edit JSON/TOML config files.
 * Usage: npx shimwrappercheck mcp-setup [--client cursor|claude-desktop|codex-cli] [--print]
 * Location: scripts/mcp-setup.js
 */

const path = require("path");

const {
  MCP_CLIENT_CONFIGS,
  configureMcpClient,
  resolveServerPath,
} = require("./lib/mcp-client-config");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();
const packageRoot = path.join(__dirname, "..");

/**
 * Read an option value from argv, supporting both --name value and --name=value.
 * Purpose: Keep the setup command dependency-free while still supporting standard CLI syntax.
 * Inputs: args (string[]), flag (string). Output: string|undefined.
 */
function takeOption(args, flag) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === flag) {
      if (!args[index + 1]) {
        throw new Error(`Missing value for ${flag}`);
      }
      const optionValue = args[index + 1];
      args.splice(index, 2);
      return optionValue;
    }

    if (value.startsWith(`${flag}=`)) {
      const optionValue = value.slice(flag.length + 1);
      args.splice(index, 1);
      return optionValue;
    }
  }

  return undefined;
}

/**
 * Print command help.
 * Purpose: Setup should be self-explanatory when invoked manually or from an agent shell session.
 * Input: none. Output: void.
 */
function printHelp() {
  console.log("shimwrappercheck mcp-setup");
  console.log("");
  console.log("Configure an MCP client so AI agents can use shimwrappercheck tools.");
  console.log("");
  console.log("Usage:");
  console.log("  npx shimwrappercheck mcp-setup");
  console.log("  npx shimwrappercheck mcp-setup --client cursor");
  console.log("  npx shimwrappercheck mcp-setup --client codex-cli");
  console.log("  npx shimwrappercheck mcp-setup --client claude-desktop");
  console.log("  npx shimwrappercheck mcp-setup --print");
  console.log("");
  console.log("Supported clients: cursor, claude-desktop, codex-cli");
  console.log("Project root:", projectRoot);
}

/**
 * Print one setup result in a readable form.
 * Purpose: Dry-runs and real writes should both explain exactly what happened.
 * Input: result (object). Output: void.
 */
function printResult(result) {
  console.log(`${result.client}:`);
  console.log(`  Config: ${result.configPath}`);
  console.log(`  Format: ${result.format}`);
  console.log(`  Action: ${result.dryRun ? `would ${result.action}` : result.action}`);

  if (result.dryRun) {
    console.log("  Preview:");
    console.log(
      result.preview
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n"),
    );
  }

  console.log("");
}

/**
 * Main entrypoint for mcp-setup.
 * Purpose: Reuse the shared MCP config writer for all supported clients.
 * Input: argv (string[]). Output: process exit code number.
 */
function main(argv = process.argv.slice(2)) {
  try {
    const args = [...argv];
    const dryRun = args.includes("--print") || args.includes("--dry-run");
    const helpFlag = args.includes("--help") || args.includes("-h");
    const targetClient = takeOption(args, "--client");

    if (helpFlag) {
      printHelp();
      return 0;
    }

    const serverPath = resolveServerPath(projectRoot, packageRoot);
    if (!serverPath) {
      console.error("Error: Could not find mcp/server.js. Install shimwrappercheck first.");
      return 1;
    }

    const clientsToConfigure = targetClient ? [targetClient] : Object.keys(MCP_CLIENT_CONFIGS);
    console.log("shimwrappercheck MCP Setup");
    console.log("Project:", projectRoot);
    console.log("Server:", serverPath);
    console.log("");

    let configuredCount = 0;
    let hadError = false;
    for (const client of clientsToConfigure) {
      const result = configureMcpClient({
        client,
        projectRoot,
        serverPath,
        write: !dryRun,
      });

      if (!result.success) {
        console.error(`${client}: ${result.error}`);
        console.log("");
        hadError = true;
        continue;
      }

      printResult(result);
      if (!result.dryRun) {
        configuredCount += 1;
      }
    }

    if (!dryRun) {
      console.log(`Configured ${configuredCount} client(s).`);
      console.log("");
      console.log("Available MCP tools:");
      console.log("  run_checks, get_check_status, get_config, set_config,");
      console.log("  list_checks, toggle_check, get_latest_report,");
      console.log("  configure_mcp, list_mcp_clients, get_agents_md");
      console.log("");
      console.log("Restart your MCP client to apply changes.");
    }

    return hadError ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    printHelp();
    return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  main,
};
