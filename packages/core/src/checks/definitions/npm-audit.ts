import type { CheckDefinition } from "../types.js";
import { runCommand } from "../../runners/command-runner.js";
import { commandSucceeded } from "../../runners/result.js";
import { classifyCommandFailure } from "../../runners/error-classifier.js";
import { applyInfraPolicy } from "../../runners/network-infra.js";
import { pass } from "./helpers.js";

export const npmAuditCheck: CheckDefinition = {
  id: "npmAudit",
  label: "npm audit",
  category: "security",
  envKey: "SHIM_RUN_NPM_AUDIT",
  defaultEnabled: true,
  requiredTools: ["npm"],
  async run(ctx) {
    const level =
      ctx.config.auditLevel ?? ctx.env.SHIM_AUDIT_LEVEL ?? "moderate";
    const result = await runCommand(
      "npm",
      ["audit", "--audit-level", String(level)],
      { cwd: ctx.projectRoot, env: ctx.env, timeoutMs: 300_000 },
    );

    if (commandSucceeded(result)) {
      return pass("npmAudit", "npm audit: no issues at configured level");
    }

    const classified = classifyCommandFailure(result, "npm audit");
    const combined = `${result.stderr}\n${result.stdout}`;
    const policy = applyInfraPolicy(classified, combined, {
      strictNetworkChecks: ctx.config.strictNetworkChecks,
      optionalCheck: false,
    });

    return {
      id: "npmAudit",
      status: policy.status,
      blocking: policy.blocking,
      message: policy.message,
    };
  },
};
