#!/usr/bin/env node
/**
 * ai-review-utils.js — barrel file for review utilities.
 * Re-exports from ai-git-utils, ai-report-utils, and ai-parse-utils.
 * Why: keeps require() paths stable for consumers; internal modules can evolve.
 */
const git = require("./ai-git-utils");
const report = require("./ai-report-utils");
const parse = require("./ai-parse-utils");

module.exports = {
  // from ai-git-utils
  getBranch: git.getBranch,
  hasHead: git.hasHead,
  getSnippetDiff: git.getSnippetDiff,
  getChunkDiff: git.getChunkDiff,
  getDiff: git.getDiff,
  collectChangedPaths: git.collectChangedPaths,
  isExplanationEligiblePath: git.isExplanationEligiblePath,
  readWorktreeFile: git.readWorktreeFile,
  readCommitFile: git.readCommitFile,
  // from ai-report-utils
  jsonEscape: report.jsonEscape,
  writeMarkdownReport: report.writeMarkdownReport,
  writeFailedJson: report.writeFailedJson,
  writeMachineReport: report.writeMachineReport,
  // from ai-parse-utils
  toIntOrDefault: parse.toIntOrDefault,
  limitDiff: parse.limitDiff,
  parseReviewJson: parse.parseReviewJson,
  evaluateReviewResponse: parse.evaluateReviewResponse,
  validateCustomConfig: parse.validateCustomConfig,
};
