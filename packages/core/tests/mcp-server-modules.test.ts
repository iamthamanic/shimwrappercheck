import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const require = createRequire(import.meta.url);

describe("MCP server modules", () => {
  it("server.js stays a thin dispatcher", () => {
    const serverPath = path.join(repoRoot, "mcp/server.js");
    const lines = fs.readFileSync(serverPath, "utf8").split("\n").length;
    expect(lines).toBeLessThanOrEqual(120);
  });

  it("definitions include run_checks with infra-aware description", () => {
    const { TOOLS } = require(path.join(repoRoot, "mcp/tools/definitions.js"));
    const runChecks = TOOLS.find((t: { name: string }) => t.name === "run_checks");
    expect(runChecks).toBeDefined();
    expect(runChecks.description).toContain("infra_error");
  });

  it("mcp-config re-exports shared client list", () => {
    const mcpConfig = require(path.join(repoRoot, "mcp/tools/mcp-config.js"));
    const shared = require(
      path.join(repoRoot, "scripts/lib/mcp-client-config.js"),
    );
    const listed = mcpConfig.handleListMcpClients();
    expect(listed.clients.length).toBe(shared.listMcpClients().length);
  });

  it("dispatch exports handleToolCall", () => {
    const dispatch = require(path.join(repoRoot, "mcp/tools/dispatch.js"));
    expect(typeof dispatch.handleToolCall).toBe("function");
  });
});
