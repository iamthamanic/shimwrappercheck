#!/usr/bin/env node
/**
 * AI Code Review — Node.js entry point for custom LLM providers.
 */
require("./ai-env-loader"); // load ~/.shimwrappercheck/.env before anything else
const { buildReviewPrompt } = require("./ai-review-prompts");
const path = require("path");
const { sendReview } = require("./ai-llm-request");
const { runFullReview } = require("./ai-code-review-full");
const {
	toIntOrDefault,
	getBranch,
	getDiff,
	limitDiff,
	evaluateReviewResponse,
	writeMarkdownReport,
	writeFailedJson,
	writeMachineReport,
	validateCustomConfig,
} = require("./ai-review-utils");

const ROOT_DIR = process.env.SHIM_PROJECT_ROOT || process.cwd();
const CHECK_MODE = process.env.CHECK_MODE || "commit";
const PROVIDER = process.env.SHIM_AI_REVIEW_PROVIDER || "custom";
const BASE_URL = process.env.SHIM_AI_CUSTOM_BASE_URL || "";
const API_KEY = process.env.SHIM_AI_CUSTOM_API_KEY || "";
const MODEL = process.env.SHIM_AI_CUSTOM_MODEL || "";
const FORMAT = process.env.SHIM_AI_CUSTOM_FORMAT || "openai";
const TIMEOUT_SEC = toIntOrDefault(process.env.SHIM_AI_TIMEOUT_SEC, 180);
const LIMIT_BYTES = toIntOrDefault(process.env.SHIM_AI_DIFF_LIMIT_BYTES, 51200);
const CHUNK_TIMEOUT = toIntOrDefault(process.env.SHIM_AI_CHUNK_TIMEOUT, 600);
const CHUNK_LIMIT_BYTES = toIntOrDefault(
	process.env.SHIM_AI_CHUNK_LIMIT_BYTES,
	153600,
);
const MIN_RATING = toIntOrDefault(process.env.SHIM_AI_MIN_RATING, 95);
const REVIEWS_DIR = path.resolve(
	ROOT_DIR,
	process.env.SHIM_AI_REVIEW_DIR || ".shimwrapper/reviews",
);
const REPORT_FILE =
	process.env.SHIM_REPORT_FILE || process.env.REFACTOR_REPORT_FILE || "";
const REVIEW_FAILED_JSON = path.resolve(
	ROOT_DIR,
	".shimwrapper/review-failed.json",
);
const REVIEW_DATE = new Date().toLocaleDateString("de-DE");
const REVIEW_TIME = new Date().toLocaleTimeString("de-DE", {
	hour: "2-digit",
	minute: "2-digit",
});
const BRANCH = getBranch(ROOT_DIR);

function validateConfig() {
	if (PROVIDER !== "custom") return;
	validateCustomConfig("AI review (custom provider)");
}

async function runSnippetOrCommit() {
	const diff = getDiff(ROOT_DIR, CHECK_MODE);
	if (!diff.trim()) {
		console.error(
			`Skipping AI review (CHECK_MODE=${CHECK_MODE}): no changes to review.`,
		);
		writeMachineReport(REPORT_FILE || null, {
			kind: "ai-review",
			mode: CHECK_MODE,
			status: "skipped",
			reason: "no diff",
		});
		return 0;
	}
	const limited = limitDiff(diff, LIMIT_BYTES);
	const systemPrompt = buildReviewPrompt(MIN_RATING);
	let text = "";
	let tokens;
	try {
		const res = await sendReview({
			baseUrl: BASE_URL,
			apiKey: API_KEY,
			model: MODEL,
			systemPrompt,
			userPrompt: limited,
			format: FORMAT,
			timeoutSec: TIMEOUT_SEC,
		});
		text = res.text;
		tokens = res.usage;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`AI review failed: ${msg}`);
		writeMachineReport(REPORT_FILE || null, {
			kind: "ai-review",
			mode: CHECK_MODE,
			status: "fail",
			reason: msg,
		});
		return 1;
	}

	const { score, verdict, deductions, pass } = evaluateReviewResponse(
		text,
		MIN_RATING,
	);

	const ts = new Date().toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const reviewFile = path.join(
		REVIEWS_DIR,
		`review-${CHECK_MODE}-${REVIEW_DATE.replace(/\./g, "-")}-${ts.replace(/:/g, "-")}.md`,
	);
	writeMarkdownReport({
		reviewFile,
		mode: CHECK_MODE,
		branch: BRANCH,
		pass,
		verdict,
		score,
		minRating: MIN_RATING,
		tokens,
		deductions,
		rawText: text,
		diffSource: CHECK_MODE === "commit" ? "commit" : "snippet",
	});

	writeMachineReport(REPORT_FILE || null, {
		kind: "ai-review",
		mode: CHECK_MODE,
		status: pass ? "pass" : "fail",
		pass: !!pass,
		score,
		minRating: MIN_RATING,
		verdict,
		findings: deductions.length,
		diffSource: CHECK_MODE === "commit" ? "commit" : "snippet",
		reviewFile,
	});

	console.error(`Review saved: ${reviewFile}`);
	console.error(`AI review: ${pass ? "PASS" : "FAIL"}`);
	if (!pass) {
		writeFailedJson({
			reviewFailedJson: REVIEW_FAILED_JSON,
			verdict,
			score,
			reviewFile,
		});
		console.error(
			`REVIEW_FAILED_AGENT_ACTION: Read ${REVIEW_FAILED_JSON} and AGENTS.md; fix all deductions, commit, then re-run.`,
		);
	}
	return pass ? 0 : 1;
}

(async () => {
	validateConfig();
	try {
		const rc =
			CHECK_MODE === "full"
				? await runFullReview({
						rootDir: ROOT_DIR,
						baseUrl: BASE_URL,
						apiKey: API_KEY,
						model: MODEL,
						format: FORMAT,
						chunkTimeout: CHUNK_TIMEOUT,
						chunkLimitBytes: CHUNK_LIMIT_BYTES,
						minRating: MIN_RATING,
						reviewsDir: REVIEWS_DIR,
						reviewFailedJson: REVIEW_FAILED_JSON,
						reportFile: REPORT_FILE,
						branch: BRANCH,
						reviewDate: REVIEW_DATE,
						reviewTime: REVIEW_TIME,
					})
				: await runSnippetOrCommit();
		process.exit(rc);
	} catch (err) {
		console.error(
			`AI review unexpected error: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
})();
