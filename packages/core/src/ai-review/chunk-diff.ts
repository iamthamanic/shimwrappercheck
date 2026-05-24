import { runCommand } from "../runners/command-runner.js";
import type { DiffBuildResult } from "./types.js";

export type GitRunner = (
  gitPath: string,
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; exitCode: number }>;

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** Default git runner using command-runner (injectable in tests). */
export const defaultGitRunner: GitRunner = async (gitPath, args, cwd) => {
  const result = await runCommand(gitPath, args, { cwd, timeoutMs: 120_000 });
  return { stdout: result.stdout, exitCode: result.exitCode ?? 1 };
};

/** Limit diff bytes using head/tail split (matches bash ai-code-review.sh). */
export function limitDiffBytes(content: string, limitBytes: number): string {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes <= limitBytes * 2) return content;
  const half = Math.floor(limitBytes / 2);
  const buf = Buffer.from(content, "utf8");
  const head = buf.subarray(0, half).toString("utf8");
  const tail = buf.subarray(buf.length - half).toString("utf8");
  return `${head}\n...[truncated, was ${bytes} bytes]...\n${tail}`;
}

/**
 * Build diff for commit mode (HEAD~1..HEAD or empty tree..HEAD).
 * Ported from scripts/ai-code-review.sh commit path.
 */
export async function buildCommitDiff(
  projectRoot: string,
  gitPath: string,
  runGit: GitRunner = defaultGitRunner,
): Promise<DiffBuildResult> {
  const hasParent = await runGit(gitPath, ["rev-parse", "--verify", "HEAD~1"], projectRoot);
  const range =
    hasParent.exitCode === 0 ? "HEAD~1..HEAD" : `${EMPTY_TREE}..HEAD`;

  const diff = await runGit(
    gitPath,
    ["diff", "--no-color", range],
    projectRoot,
  );
  if (diff.exitCode !== 0 && diff.exitCode !== 1) {
    return {
      content: "",
      source: "commit",
      empty: true,
      error: `git diff ${range} failed (exit ${diff.exitCode})`,
    };
  }

  const content = diff.stdout;
  if (!content.trim()) {
    return { content: "", source: "commit", empty: true };
  }
  return { content, source: "commit", empty: false };
}

/**
 * Build diff for snippet mode (staged + unstaged, then push range fallback).
 * Ported from scripts/ai-code-review.sh snippet path (simplified).
 */
export async function buildSnippetDiff(
  projectRoot: string,
  gitPath: string,
  runGit: GitRunner = defaultGitRunner,
): Promise<DiffBuildResult> {
  let content = "";

  const unstaged = await runGit(gitPath, ["diff", "--no-color"], projectRoot);
  if (unstaged.exitCode !== 0 && unstaged.exitCode !== 1) {
    return {
      content: "",
      source: "snippet",
      empty: true,
      error: `git diff unstaged failed (exit ${unstaged.exitCode})`,
    };
  }
  content += unstaged.stdout;

  const staged = await runGit(
    gitPath,
    ["diff", "--cached", "--no-color"],
    projectRoot,
  );
  if (staged.exitCode !== 0 && staged.exitCode !== 1) {
    return {
      content: "",
      source: "snippet",
      empty: true,
      error: `git diff cached failed (exit ${staged.exitCode})`,
    };
  }
  content += staged.stdout;

  if (!content.trim()) {
    const upstream = await runGit(
      gitPath,
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      projectRoot,
    );
    let range = "";
    if (upstream.exitCode === 0 && upstream.stdout.trim()) {
      range = "@{u}...HEAD";
    } else {
      const parent = await runGit(
        gitPath,
        ["rev-parse", "--verify", "HEAD~1"],
        projectRoot,
      );
      if (parent.exitCode === 0) range = "HEAD~1...HEAD";
    }
    if (range) {
      const ranged = await runGit(
        gitPath,
        ["diff", "--no-color", range],
        projectRoot,
      );
      if (ranged.exitCode !== 0 && ranged.exitCode !== 1) {
        return {
          content: "",
          source: "snippet",
          empty: true,
          error: `git diff range failed (exit ${ranged.exitCode})`,
        };
      }
      content += ranged.stdout;
    }
  }

  if (!content.trim()) {
    return { content: "", source: "snippet", empty: true };
  }
  return { content, source: "snippet", empty: false };
}

/** Resolve diff for check mode (commit or snippet only; full uses legacy script). */
export async function buildDiffForMode(
  mode: string,
  projectRoot: string,
  gitPath: string,
  runGit?: GitRunner,
): Promise<DiffBuildResult> {
  if (mode === "commit") {
    return buildCommitDiff(projectRoot, gitPath, runGit);
  }
  return buildSnippetDiff(projectRoot, gitPath, runGit);
}
