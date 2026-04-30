#!/usr/bin/env node
/**
 * ai-git-utils.js — Git operations and file reading for review scripts.
 * Single Responsibility: diff generation, file reading, path filtering.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/**
 * getBranch: returns the current git branch name.
 * @param {string} projectRoot
 * @returns {string}
 */
function getBranch(projectRoot) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * hasHead: checks whether the repo has at least one commit.
 * @param {string} projectRoot
 * @returns {boolean}
 */
function hasHead(projectRoot) {
  try {
    execSync("git rev-parse --verify HEAD", {
      cwd: projectRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * getSnippetDiff: returns staged + unstaged changes, falling back to last commit or upstream.
 * @param {string} projectRoot
 * @returns {string}
 */
function getSnippetDiff(projectRoot) {
  let out = "";
  try {
    out = execSync("git diff --no-color", {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    /* ignore */
  }
  try {
    out += execSync("git diff --cached --no-color", {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    /* ignore */
  }
  if (!out.trim()) {
    try {
      execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
        cwd: projectRoot,
        stdio: "ignore",
      });
      out = execSync("git diff --no-color @{u}...HEAD", {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch {
      try {
        out = execSync("git diff --no-color HEAD~1...HEAD", {
          cwd: projectRoot,
          encoding: "utf8",
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

/**
 * getChunkDiff: returns the diff of a single directory against the empty tree.
 * @param {string} projectRoot
 * @param {string} chunkDir
 * @returns {string}
 */
function getChunkDiff(projectRoot, chunkDir) {
  if (hasHead(projectRoot)) {
    try {
      return execSync(
        `git diff --no-color ${EMPTY_TREE}..HEAD -- "${chunkDir}"`, // nosemgrep: detect-child-process
        { cwd: projectRoot, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
      );
    } catch {
      return "";
    }
  }
  try {
    const chunkPath = path.join(projectRoot, chunkDir); // nosemgrep: path-join-resolve-traversal
    const cmd =
      "diff -ruN --exclude='.git' --exclude='node_modules' /dev/null \"" +
      chunkPath +
      '"';
    // nosemgrep: detect-child-process
    return execSync(cmd, {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

/**
 * getDiff: route helper that returns the correct diff for the given CHECK_MODE.
 * @param {string} projectRoot
 * @param {string} mode
 * @param {string} [chunkDir]
 * @returns {string}
 */
function getDiff(projectRoot, mode, chunkDir) {
  if (mode === "full" && chunkDir) return getChunkDiff(projectRoot, chunkDir);
  if (mode === "commit") {
    const range = hasHead(projectRoot) ? "HEAD~1..HEAD" : `${EMPTY_TREE}..HEAD`;
    try {
      return execSync(`git diff --no-color ${range}`, {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch {
      return "";
    }
  }
  return getSnippetDiff(projectRoot);
}

/**
 * collectChangedPaths: returns a deduplicated list of changed file paths for the current mode.
 * @param {string} projectRoot
 * @param {string} mode
 * @returns {string[]}
 */
function collectChangedPaths(projectRoot, mode) {
  let raw = "";
  if (mode === "commit") {
    const range = hasHead(projectRoot) ? "HEAD~1..HEAD" : `${EMPTY_TREE}..HEAD`;
    try {
      raw = execSync(
        `git diff --name-only --diff-filter=ACMR ${range} -- . :(exclude)*.tsbuildinfo`,
        { cwd: projectRoot, encoding: "utf8" },
      );
    } catch {
      /* ignore */
    }
  } else {
    try {
      raw += execSync(
        "git diff --name-only --diff-filter=ACMR -- . :(exclude)*.tsbuildinfo",
        { cwd: projectRoot, encoding: "utf8" },
      );
    } catch {
      /* ignore */
    }
    try {
      raw += execSync(
        "git diff --cached --name-only --diff-filter=ACMR -- . :(exclude)*.tsbuildinfo",
        { cwd: projectRoot, encoding: "utf8" },
      );
    } catch {
      /* ignore */
    }
    if (!raw.trim()) {
      let range = "";
      try {
        execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
          cwd: projectRoot,
          stdio: "ignore",
        });
        range = "@{u}...HEAD";
      } catch {
        if (hasHead(projectRoot)) range = "HEAD~1...HEAD";
      }
      if (range) {
        try {
          raw = execSync(
            `git diff --name-only --diff-filter=ACMR ${range} -- . :(exclude)*.tsbuildinfo`,
            { cwd: projectRoot, encoding: "utf8" },
          );
        } catch {
          /* ignore */
        }
      }
    }
  }
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return Array.from(new Set(lines));
}

/**
 * isExplanationEligiblePath: returns true only for commentable source files.
 * @param {string} filePath
 * @returns {boolean}
 */
function isExplanationEligiblePath(filePath) {
  return /\.(sh|js|jsx|ts|tsx|mjs|cjs)$/i.test(filePath);
}

/**
 * readWorktreeFile: reads the current working-tree version of a file.
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {string|null}
 */
function readWorktreeFile(projectRoot, relPath) {
  const abs = path.join(projectRoot, relPath); // nosemgrep: path-join-resolve-traversal
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * readCommitFile: reads the HEAD-committed version of a file.
 * @param {string} projectRoot
 * @param {string} relPath
 * @returns {string|null}
 */
function readCommitFile(projectRoot, relPath) {
  try {
    // nosemgrep: detect-child-process
    return execSync(`git show HEAD:"${relPath}"`, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

module.exports = {
  getBranch,
  hasHead,
  getSnippetDiff,
  getChunkDiff,
  getDiff,
  collectChangedPaths,
  isExplanationEligiblePath,
  readWorktreeFile,
  readCommitFile,
};
