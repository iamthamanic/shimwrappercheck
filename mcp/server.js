#!/usr/bin/env node
/**
 * MCP server for shimwrappercheck — JSON-RPC over stdio, zero npm deps.
 * Tools delegate to @shimwrappercheck/core (build required) and scripts/lib helpers.
 */
const readline = require("readline");
const { TOOLS } = require("./tools/definitions.js");
const { handleToolCall } = require("./tools/dispatch.js");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();

function sendResponse(id, result) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n",
  );
}

function sendError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );
}

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "shimwrappercheck", version: "0.1.0" },
      });
      break;

    case "notifications/initialized":
      break;

    case "tools/list":
      sendResponse(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      if (!toolName) {
        sendError(id, -32602, "Missing tool name in params");
        break;
      }
      void (async () => {
        try {
          const result = await handleToolCall(toolName, toolArgs, {
            projectRoot,
          });
          sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        } catch (err) {
          sendError(
            id,
            -32603,
            `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
      break;
    }

    case "ping":
      sendResponse(id, {});
      break;

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  process.on("uncaughtException", (err) => {
    console.error("[MCP shimwrappercheck] uncaughtException:", err.message);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[MCP shimwrappercheck] unhandledRejection:", err);
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      handleRequest(JSON.parse(trimmed));
    } catch (err) {
      sendError(null, -32700, `Parse error: ${err.message}`);
    }
  });

  rl.on("close", () => process.exit(0));

  console.error(
    "[MCP shimwrappercheck] Server started on stdio. Project root:",
    projectRoot,
  );
}

main();
