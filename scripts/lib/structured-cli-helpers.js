/**
 * Print the combined top-level help text.
 * Purpose: Keep help centralized so the dispatcher and wrappers show the same structured command inventory.
 * Input: none. Output: void.
 */
function printTopLevelHelp() {
	console.log("shimwrappercheck");
	console.log("");
	console.log("Human-focused commands:");
	console.log("  npx shimwrappercheck init");
	console.log("  npx shimwrappercheck setup");
	console.log("  npx shimwrappercheck config");
	console.log("  npx shimwrappercheck mcp");
	console.log("");
	console.log("Structured CLI commands:");
	console.log("  npx shimwrappercheck config get --json");
	console.log(
		"  npx shimwrappercheck config set CHECK_MODE=full SHIM_RUN_LINT=1 --json",
	);
	console.log("  npx shimwrappercheck checks list --json");
	console.log(
		"  npx shimwrappercheck checks toggle SHIM_RUN_AI_REVIEW off --json",
	);
	console.log("  npx shimwrappercheck status last-error --json");
	console.log("  npx shimwrappercheck report latest --json");
	console.log("  npx shimwrappercheck check-update --json");
	console.log("  npx shimwrappercheck agents-md --json");
	console.log("  npx shimwrappercheck mcp clients --json");
	console.log(
		"  npx shimwrappercheck mcp configure --client codex-cli --dry-run --json",
	);
	console.log("  npx shimwrappercheck run --json --check-mode full");
	console.log("");
	console.log(
		"Use --json on structured commands for stable machine-readable output.",
	);
}

/**
 * Print a short command-specific usage block.
 * Purpose: Invalid structured calls should fail with concrete next steps instead of a vague error.
 * Input: topic (string). Output: void.
 */
function printCommandHelp(topic) {
	const helpByTopic = {
		config:
			"Usage: shimwrappercheck config get [--json]\n       shimwrappercheck config set KEY=VALUE [KEY=VALUE ...] [--json]",
		checks:
			"Usage: shimwrappercheck checks list [--json]\n       shimwrappercheck checks toggle <ENV_KEY> <on|off> [--json]",
		status: "Usage: shimwrappercheck status last-error [--json]",
		report: "Usage: shimwrappercheck report latest [--json]",
		mcp: "Usage: shimwrappercheck mcp clients [--json]\n       shimwrappercheck mcp configure --client <cursor|claude-desktop|codex-cli> [--server-path /abs/path] [--dry-run] [--json]",
		run: "Usage: shimwrappercheck run --json [--check-mode <full|snippet|commit>] [--frontend|--no-frontend] [--backend|--no-backend] [--no-ai-review] [--no-explanation-check] [--no-i18n-check] [--no-sast] [--no-gitleaks] [--no-ruff] [--no-shellcheck] [--refactor] [--until-95] [--timeout-sec <n>]",
		"agents-md": "Usage: shimwrappercheck agents-md [--json]",
	};

	console.log(helpByTopic[topic] || "Usage: shimwrappercheck help");
}

/**
 * Remove a boolean flag from an arg list if present.
 * Purpose: Keep parser code compact while preserving unknown-arg detection.
 * Inputs: args (string[]), flag (string). Output: boolean.
 */
function takeFlag(args, flag) {
	const index = args.indexOf(flag);
	if (index === -1) return false;
	args.splice(index, 1);
	return true;
}

/**
 * Remove an option value from an arg list, supporting --name=value and --name value.
 * Purpose: Structured commands need explicit option parsing without another dependency.
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
 * Convert on/off style text to a boolean.
 * Purpose: "checks toggle" should accept human and machine friendly boolean spellings.
 * Input: rawValue (string). Output: boolean.
 */
function parseToggleValue(rawValue) {
	const normalized = String(rawValue || "")
		.trim()
		.toLowerCase();
	if (["1", "true", "on", "enable", "enabled", "yes"].includes(normalized))
		return true;
	if (["0", "false", "off", "disable", "disabled", "no"].includes(normalized))
		return false;
	throw new Error(`Invalid toggle value: ${rawValue}`);
}

/**
 * Print a structured result as JSON or human-readable text.
 * Purpose: Each command can focus on data, not on repetitive output branching.
 * Inputs: result (any), asJson (boolean), humanPrinter (function). Output: void.
 */
function emitResult(result, asJson, humanPrinter) {
	if (asJson) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	humanPrinter(result);
}

/**
 * Parse the machine-oriented "run --json" flags into runChecks options.
 * Purpose: Preserve familiar check flags while returning structured output.
 * Input: args (string[]). Output: { asJson, opts }.
 */
function parseRunCommand(args) {
	const asJson = takeFlag(args, "--json");
	const includeFrontend = takeFlag(args, "--frontend");
	const excludeFrontend = takeFlag(args, "--no-frontend");
	const includeBackend = takeFlag(args, "--backend");
	const excludeBackend = takeFlag(args, "--no-backend");
	if (
		(includeFrontend && excludeFrontend) ||
		(includeBackend && excludeBackend)
	) {
		throw new Error("Conflicting frontend/backend flags.");
	}

	const timeoutSec = takeOption(args, "--timeout-sec");
	const opts = {
		checkMode: takeOption(args, "--check-mode"),
		frontend: includeFrontend ? true : excludeFrontend ? false : undefined,
		backend: includeBackend ? true : excludeBackend ? false : undefined,
		noAiReview: takeFlag(args, "--no-ai-review"),
		noExplanationCheck: takeFlag(args, "--no-explanation-check"),
		noI18nCheck: takeFlag(args, "--no-i18n-check"),
		noSast: takeFlag(args, "--no-sast"),
		noGitleaks: takeFlag(args, "--no-gitleaks"),
		noRuff: takeFlag(args, "--no-ruff"),
		noShellcheck: takeFlag(args, "--no-shellcheck"),
		refactor: takeFlag(args, "--refactor"),
		until95: takeFlag(args, "--until-95"),
	};

	if (timeoutSec != null) {
		const parsedTimeout = Number(timeoutSec);
		if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
			throw new Error(`Invalid --timeout-sec value: ${timeoutSec}`);
		}
		opts.timeoutSec = parsedTimeout;
	}

	if (args.length > 0) {
		throw new Error(`Unknown run option(s): ${args.join(" ")}`);
	}

	return { asJson, opts };
}

module.exports = {
	emitResult,
	parseRunCommand,
	parseToggleValue,
	printCommandHelp,
	printTopLevelHelp,
	takeFlag,
	takeOption,
};
