import { describe, expect, it } from "vitest";
import {
  applyInfraPolicy,
  isTransientNetworkError,
} from "../src/runners/network-infra.js";

describe("isTransientNetworkError", () => {
  it("detects ENOTFOUND", () => {
    expect(isTransientNetworkError("npm ERR! code ENOTFOUND")).toBe(true);
  });

  it("returns false for empty output", () => {
    expect(isTransientNetworkError("")).toBe(false);
  });
});

describe("applyInfraPolicy", () => {
  it("uses warning for network errors when not strict", () => {
    const policy = applyInfraPolicy(
      {
        status: "infra_error",
        message: "npm audit: network",
        infra: true,
      },
      "getaddrinfo ENOTFOUND registry.npmjs.org",
      { strictNetworkChecks: false, optionalCheck: false },
    );
    expect(policy.status).toBe("warning");
    expect(policy.blocking).toBe(false);
  });

  it("uses infra_error for network errors when strict", () => {
    const policy = applyInfraPolicy(
      {
        status: "infra_error",
        message: "npm audit: network",
        infra: true,
      },
      "getaddrinfo ENOTFOUND registry.npmjs.org",
      { strictNetworkChecks: true, optionalCheck: false },
    );
    expect(policy.status).toBe("infra_error");
    expect(policy.blocking).toBe(true);
  });

  it("skips optional checks when tool missing and not network", () => {
    const policy = applyInfraPolicy(
      {
        status: "infra_error",
        message: "Gitleaks: required tool not found",
        infra: true,
      },
      "command not found",
      { strictNetworkChecks: false, optionalCheck: true },
    );
    expect(policy.status).toBe("skipped");
  });
});
