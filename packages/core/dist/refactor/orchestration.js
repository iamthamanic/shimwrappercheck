import fs from "node:fs";
import path from "node:path";
import { runCommand } from "../runners/command-runner.js";
import { commandSucceeded } from "../runners/result.js";
/** Normalize SHIM_REFACTOR_MODE env value. */
export function normalizeRefactorMode(raw) {
    const mode = String(raw ?? "off").toLowerCase();
    if (mode === "interactive" || mode === "agent")
        return mode;
    return "off";
}
/** Resolve refactor artifact paths (mirrors scripts/run-checks.sh). */
export function resolveRefactorPaths(projectRoot, env = process.env) {
    const toAbs = (p) => path.isAbsolute(p) ? p : path.join(projectRoot, p);
    const refactorDir = toAbs(env.SHIM_REFACTOR_DIR ?? ".shimwrapper/refactor");
    return {
        refactorDir,
        todoFile: toAbs(env.SHIM_REFACTOR_TODO_FILE ??
            path.join(refactorDir, "refactor-todo.json")),
        stateFile: toAbs(env.SHIM_REFACTOR_STATE_FILE ??
            path.join(refactorDir, "refactor-state.json")),
        currentItemFile: toAbs(env.SHIM_REFACTOR_CURRENT_ITEM_FILE ??
            path.join(refactorDir, "refactor-current-item.json")),
        reviewsDir: toAbs(env.SHIM_AI_REVIEW_DIR ?? ".shimwrapper/reviews"),
    };
}
/** Locate extract-refactor-todo.sh in project or package root. */
export function resolveExtractRefactorScript(projectRoot, packageRoot) {
    const candidates = [
        path.join(projectRoot, "scripts", "extract-refactor-todo.sh"),
        path.join(packageRoot, "scripts", "extract-refactor-todo.sh"),
        path.join(projectRoot, "node_modules", "shimwrappercheck", "scripts", "extract-refactor-todo.sh"),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    return null;
}
function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch {
        return fallback;
    }
}
/** Find newest review-full-*.md, then any review-*.md. */
export function findLatestReviewFile(reviewsDir) {
    if (!fs.existsSync(reviewsDir))
        return null;
    const files = fs
        .readdirSync(reviewsDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => ({
        name,
        fullPath: path.join(reviewsDir, name),
        mtimeMs: fs.statSync(path.join(reviewsDir, name)).mtimeMs,
    }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    const full = files.find((f) => f.name.startsWith("review-full-"));
    if (full)
        return full.fullPath;
    return files[0]?.fullPath ?? null;
}
/** Update state/current-item JSON from TODO list (port of embedded node in bash). */
export function buildRefactorHandoff(todoPath, statePath, currentItemPath, sourceReviewPath, mode, options = {}) {
    const todoDoc = readJson(todoPath, {
        items: [],
    });
    const allItems = Array.isArray(todoDoc.items) ? todoDoc.items : [];
    const openItems = allItems.filter((item) => item && item.status !== "done" && item.status !== "resolved");
    const stateDoc = readJson(statePath, {});
    let currentIndex = 0;
    if (/^\d+$/.test(String(options.overrideIndex ?? ""))) {
        currentIndex = Number(options.overrideIndex);
    }
    else if (Number.isInteger(stateDoc.currentIndex)) {
        currentIndex = stateDoc.currentIndex;
    }
    if (options.advance)
        currentIndex += 1;
    if (currentIndex < 0)
        currentIndex = 0;
    if (openItems.length > 0 && currentIndex >= openItems.length) {
        currentIndex = openItems.length - 1;
    }
    const currentItem = openItems[currentIndex] ?? null;
    const timestamp = new Date().toISOString();
    const phase = currentItem ? "item" : "verify";
    const state = {
        mode,
        phase,
        workflowPhases: ["scan", "item", "verify"],
        sourceReview: sourceReviewPath,
        currentIndex: currentItem ? currentIndex : 0,
        totalItems: openItems.length,
        updatedAt: timestamp,
    };
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    const currentItemPayload = {
        mode,
        phase,
        workflowPhases: ["scan", "item", "verify"],
        sourceReview: sourceReviewPath,
        itemIndex: currentItem ? currentIndex : 0,
        totalItems: openItems.length,
        remainingItems: currentItem ? openItems.length - currentIndex : 0,
        generatedAt: timestamp,
        resume: {
            advanceEnv: "SHIM_REFACTOR_ADVANCE=1",
            selectIndexEnv: "SHIM_REFACTOR_ITEM_INDEX=<n>",
            rerunCommand: "./scripts/run-checks.sh --refactor",
        },
        item: currentItem,
    };
    fs.mkdirSync(path.dirname(currentItemPath), { recursive: true });
    fs.writeFileSync(currentItemPath, `${JSON.stringify(currentItemPayload, null, 2)}\n`, "utf8");
    let message;
    if (!currentItem) {
        message = "Refactor backlog clean: no open TODO items found.";
    }
    else {
        const label = currentItem.title ||
            currentItem.point ||
            currentItem.id ||
            `item-${currentIndex + 1}`;
        message = `Refactor current item ${currentIndex + 1}/${openItems.length}: ${label}`;
    }
    return { message, openItems, state };
}
/**
 * Post-check refactor orchestration (extract TODO + handoff artifacts).
 * Mirrors run_refactor_orchestration in scripts/run-checks.sh.
 */
export async function runRefactorOrchestration(options) {
    const env = options.env ?? process.env;
    const mode = normalizeRefactorMode(env.SHIM_REFACTOR_MODE);
    if (!options.refactorRequested || mode === "off") {
        return { skipped: true, reason: "refactor not requested or mode off" };
    }
    const paths = resolveRefactorPaths(options.projectRoot, env);
    const extractScript = resolveExtractRefactorScript(options.projectRoot, options.packageRoot);
    if (!extractScript) {
        console.error("Refactor orchestration: extract-refactor-todo.sh not found; skipping TODO/current-item generation.");
        return { skipped: true, reason: "extract script missing", paths };
    }
    fs.mkdirSync(paths.refactorDir, { recursive: true });
    const latestReview = findLatestReviewFile(paths.reviewsDir);
    if (!latestReview) {
        console.error(`Refactor orchestration: no review file found under ${paths.reviewsDir}; skipping.`);
        return { skipped: true, reason: "no review file", paths };
    }
    const extract = await runCommand("bash", [extractScript, latestReview, paths.todoFile], {
        cwd: options.projectRoot,
        env,
        timeoutMs: 120_000,
    });
    if (!commandSucceeded(extract)) {
        console.error(`Refactor orchestration: failed to extract TODO from ${latestReview}.`);
        return { skipped: true, reason: "extract failed", paths };
    }
    const handoff = buildRefactorHandoff(paths.todoFile, paths.stateFile, paths.currentItemFile, latestReview, mode, {
        overrideIndex: env.SHIM_REFACTOR_ITEM_INDEX,
        advance: env.SHIM_REFACTOR_ADVANCE === "1",
    });
    console.log(handoff.message);
    console.log(`Refactor TODO: ${paths.todoFile}`);
    console.log(`Refactor current item: ${paths.currentItemFile}`);
    console.log(`Refactor state: ${paths.stateFile}`);
    if (mode === "interactive") {
        console.log("Interactive resume: fix the current item, then run SHIM_REFACTOR_ADVANCE=1 ./scripts/run-checks.sh --refactor");
    }
    return {
        skipped: false,
        message: handoff.message,
        paths,
        openItems: handoff.openItems.length,
    };
}
//# sourceMappingURL=orchestration.js.map