import path from "node:path";
import type { CheckDefinition } from "../types.js";
import {
  skip,
  runExternalTool,
  projectFileExists,
  fromCommandFailure,
  resolveToolCommand,
} from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";
import fs from "node:fs";

export const licenseCheckerCheck: CheckDefinition = {
  id: "licenseChecker",
  label: "License Checker",
  category: "security",
  envKey: "SHIM_RUN_LICENSE_CHECKER",
  defaultEnabled: false,
  requiredTools: ["license-checker"],
  async run(ctx) {
    const result = await runCommand("npx", ["license-checker", "--summary"], {
      cwd: ctx.projectRoot,
      env: ctx.env,
      timeoutMs: 120_000,
    });
    if (result.exitCode === 127) {
      return skip("licenseChecker", "license-checker not available");
    }
    return fromCommandFailure(
      ctx,
      "licenseChecker",
      result,
      "License checker",
      true,
    );
  },
};

export const architectureCheck: CheckDefinition = {
  id: "architecture",
  label: "dependency-cruiser",
  category: "other",
  envKey: "SHIM_RUN_ARCHITECTURE",
  defaultEnabled: false,
  requiredTools: ["depcruise"],
  async run(ctx) {
    if (!projectFileExists(ctx, ".dependency-cruiser.json")) {
      return skip(
        "architecture",
        "Architecture: .dependency-cruiser.json not found",
      );
    }
    const entry = projectFileExists(ctx, "src")
      ? "src"
      : projectFileExists(ctx, "dashboard")
        ? "dashboard"
        : ".";
    return runExternalTool(
      ctx,
      "architecture",
      "npx",
      ["depcruise", entry, "--output-type", "err"],
      "Architecture (dependency-cruiser)",
      true,
    );
  },
};

export const complexityCheck: CheckDefinition = {
  id: "complexity",
  label: "Complexity",
  category: "other",
  envKey: "SHIM_RUN_COMPLEXITY",
  defaultEnabled: false,
  requiredTools: ["eslint"],
  async run(ctx) {
    const localConfig = path.join(ctx.projectRoot, "eslint.complexity.json");
    const templateConfig = path.join(
      ctx.packageRoot,
      "templates/eslint.complexity.json",
    );
    let configPath = localConfig;
    if (!projectFileExists(ctx, "eslint.complexity.json")) {
      if (!fs.existsSync(templateConfig)) {
        return skip(
          "complexity",
          "Complexity: eslint.complexity.json not found",
        );
      }
      configPath = templateConfig;
    }

    const result = await runCommand(
      resolveToolCommand(ctx, "eslint"),
      [".", "-c", configPath],
      {
        cwd: ctx.projectRoot,
        env: { ...ctx.env, ESLINT_USE_FLAT_CONFIG: "false" },
        timeoutMs: 600_000,
      },
    );
    return fromCommandFailure(ctx, "complexity", result, "Complexity", true);
  },
};

export const mutationCheck: CheckDefinition = {
  id: "mutation",
  label: "Stryker Mutation",
  category: "other",
  envKey: "SHIM_RUN_MUTATION",
  defaultEnabled: false,
  requiredTools: ["stryker"],
  async run(ctx) {
    if (!projectFileExists(ctx, "stryker.config.json")) {
      return skip("mutation", "Mutation: stryker.config.json not found");
    }
    return runExternalTool(
      ctx,
      "mutation",
      "npx",
      ["stryker", "run"],
      "Stryker mutation",
      true,
    );
  },
};

export const e2eCheck: CheckDefinition = {
  id: "e2e",
  label: "E2E",
  category: "other",
  envKey: "SHIM_RUN_E2E",
  defaultEnabled: false,
  requiredTools: ["playwright"],
  async run(ctx) {
    const hasPlaywright =
      projectFileExists(ctx, "playwright.config.ts") ||
      projectFileExists(ctx, "playwright.config.js");
    if (!hasPlaywright) {
      return skip("e2e", "E2E: no Playwright config found");
    }
    return runExternalTool(
      ctx,
      "e2e",
      "npx",
      ["playwright", "test"],
      "E2E (Playwright)",
      true,
    );
  },
};
