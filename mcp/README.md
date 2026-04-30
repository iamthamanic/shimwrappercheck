# shimwrappercheck MCP Server

MCP (Model Context Protocol) server that lets AI agents control shimwrappercheck through structured tool calls instead of shell commands. Zero dependencies — uses only Node.js builtins.

## Quick start

### Option A: Agent self-configures (recommended)

An agent in the terminal can configure its own MCP client:

```bash
# From the terminal — configure all detected clients
npx shimwrappercheck mcp-setup

# Or specific client
npx shimwrappercheck mcp-setup --client codex-cli
npx shimwrappercheck mcp-setup --client cursor

# Dry-run (show what would be written)
npx shimwrappercheck mcp-setup --print
```

### Option B: Via MCP tool call (for agents already connected)

If the agent already has MCP access, it can call:

1. `list_mcp_clients` — see which clients are available
2. `configure_mcp` — write the config automatically (e.g. `{"client": "codex-cli"}`)

### Option B2: Structured CLI parity

If you want the same operations without opening an MCP connection first:

```bash
npx shimwrappercheck mcp clients --json
npx shimwrappercheck mcp configure --client codex-cli --dry-run --json
npx shimwrappercheck checks list --json
npx shimwrappercheck config get --json
npx shimwrappercheck status last-error --json
```

### Option C: Manual config

Add to your MCP client config:

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "shimwrappercheck": {
      "command": "node",
      "args": ["/path/to/shimwrappercheck/mcp/server.js"],
      "env": { "SHIM_PROJECT_ROOT": "/path/to/your/project" }
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.shimwrappercheck]
command = "node"
args = ["/path/to/shimwrappercheck/mcp/server.js"]
[mcp_servers.shimwrappercheck.env]
SHIM_PROJECT_ROOT = "/path/to/your/project"
```

## Tools (10)

| Tool                | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `run_checks`        | Run checks with structured pass/fail results, stdout, stderr, last error |
| `get_check_status`  | Get last check error from `.shim/last_error.json` for self-healing       |
| `get_config`        | Read `.shimwrappercheckrc` as structured key-value pairs                 |
| `set_config`        | Update config keys in `.shimwrappercheckrc`                              |
| `list_checks`       | List all checks with enabled/disabled status                             |
| `toggle_check`      | Enable or disable a specific check by env-key                            |
| `get_latest_report` | Read the latest AI review report                                         |
| `configure_mcp`     | **Self-configure** an MCP client (Cursor, Claude Desktop, Codex CLI)     |
| `list_mcp_clients`  | List supported MCP clients with config paths and status                  |
| `get_agents_md`     | Read the project's AGENTS.md for current rules                           |

## Agent self-configure flow

This is the key feature: an agent can configure itself without human intervention.

```
Agent in terminal:
  1. Runs: npx shimwrappercheck mcp-setup --client codex-cli
  2. Shimwrappercheck writes the [mcp_servers.shimwrappercheck] entry
     to ~/.codex/config.toml (or .cursor/mcp.json, etc.)
  3. Agent restarts MCP client → shimwrappercheck tools available

Agent via MCP tool call (if already connected):
  1. Calls list_mcp_clients → sees available clients
  2. Calls configure_mcp → {"client": "cursor"}
  3. Config written automatically
```

Supported clients and formats:

- **Cursor IDE**: `~/.cursor/mcp.json` (JSON)
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (JSON)
- **Codex CLI**: `~/.codex/config.toml` (TOML)

## Architecture

- **Zero dependencies**: Uses only Node.js builtins (no `@modelcontextprotocol/sdk` needed)
- **JSON-RPC 2.0 over stdio**: Standard MCP protocol
- **Reuses internal modules**: Loads `scripts/lib/check-catalog.js` when available
- **TOML support**: Codex CLI config.toml is read/written correctly (preserves other sections)

## CLI-Anything Integration

[CLI-Anything](https://github.com/HKUDS/CLI-Anything) can auto-generate an MCP wrapper from CLI help text. For shimwrappercheck, the purpose-built server above is recommended because it provides structured JSON, direct config I/O, and check catalog integration. CLI-Anything can supplement for broader command coverage now that `npx shimwrappercheck --help` exposes stable non-interactive subcommands such as:

```bash
npx shimwrappercheck checks list --json
npx shimwrappercheck config get --json
npx shimwrappercheck mcp clients --json
npx shimwrappercheck mcp configure --client codex-cli --dry-run --json
```
