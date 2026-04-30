#!/usr/bin/env node
/**
 * ai-env-loader.js — loads global AI provider config from ~/.shimwrappercheck/.env.
 * Why: API keys must not be stored in the repo. This module ensures they are available
 * in process.env before any review script runs, without requiring manual exports.
 *
 * Usage: require("./ai-env-loader") at the top of any script that needs AI provider config.
 */
const fs = require("fs");
const path = require("path");

const GLOBAL_ENV_PATH = path.join(
	require("os").homedir(),
	".shimwrappercheck",
	".env",
);

/**
 * loadGlobalEnv: reads ~/.shimwrappercheck/.env into process.env.
 * Only sets vars that are not already defined (local .env or shell exports take precedence).
 */
function loadGlobalEnv() {
	if (!fs.existsSync(GLOBAL_ENV_PATH)) return;
	const content = fs.readFileSync(GLOBAL_ENV_PATH, "utf8");
	for (const line of content.split("\n")) {
		const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
		if (m && !process.env[m[1]]) {
			process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
		}
	}
}

// Auto-load on first require so review scripts get the config automatically.
loadGlobalEnv();

module.exports = { loadGlobalEnv };
