import type { DiffBuildResult } from "./types.js";
export type GitRunner = (gitPath: string, args: string[], cwd: string) => Promise<{
    stdout: string;
    exitCode: number;
}>;
/** Default git runner using command-runner (injectable in tests). */
export declare const defaultGitRunner: GitRunner;
/** Limit diff bytes using head/tail split (matches bash ai-code-review.sh). */
export declare function limitDiffBytes(content: string, limitBytes: number): string;
/**
 * Build diff for commit mode (HEAD~1..HEAD or empty tree..HEAD).
 * Ported from scripts/ai-code-review.sh commit path.
 */
export declare function buildCommitDiff(projectRoot: string, gitPath: string, runGit?: GitRunner): Promise<DiffBuildResult>;
/**
 * Build diff for snippet mode (staged + unstaged, then push range fallback).
 * Ported from scripts/ai-code-review.sh snippet path (simplified).
 */
export declare function buildSnippetDiff(projectRoot: string, gitPath: string, runGit?: GitRunner): Promise<DiffBuildResult>;
/** Resolve diff for check mode (commit or snippet only; full uses legacy script). */
export declare function buildDiffForMode(mode: string, projectRoot: string, gitPath: string, runGit?: GitRunner): Promise<DiffBuildResult>;
//# sourceMappingURL=chunk-diff.d.ts.map