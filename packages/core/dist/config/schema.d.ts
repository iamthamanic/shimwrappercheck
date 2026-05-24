import { z } from "zod";
/** v1 canonical config shape (internal); legacy RC maps to/from this. */
export declare const ShimConfigSchema: z.ZodObject<
  {
    version: z.ZodDefault<z.ZodLiteral<1>>;
    checkMode: z.ZodDefault<z.ZodEnum<["snippet", "commit", "full"]>>;
    checkOrder: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    checks: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    enforceCommands: z.ZodOptional<z.ZodString>;
    hookCommands: z.ZodOptional<z.ZodString>;
    autoPush: z.ZodDefault<z.ZodBoolean>;
    gitEnforceCommands: z.ZodOptional<z.ZodString>;
    gitCheckModeOnPush: z.ZodOptional<z.ZodEnum<["snippet", "commit", "full"]>>;
    auditLevel: z.ZodDefault<
      z.ZodEnum<["low", "moderate", "high", "critical"]>
    >;
    continueOnError: z.ZodDefault<z.ZodBoolean>;
    strictNetworkChecks: z.ZodDefault<z.ZodBoolean>;
    i18nRequireMessagesDir: z.ZodDefault<z.ZodBoolean>;
    aiReview: z.ZodDefault<
      z.ZodObject<
        {
          provider: z.ZodDefault<z.ZodEnum<["auto", "codex", "api", "custom"]>>;
          /** When false, AI review failures are warnings (non-blocking). Set SHIM_AI_REVIEW_BLOCKING=1 to block. */
          blocking: z.ZodDefault<z.ZodBoolean>;
          minRating: z.ZodDefault<z.ZodNumber>;
          timeoutSec: z.ZodOptional<z.ZodNumber>;
        },
        "strip",
        z.ZodTypeAny,
        {
          provider: "auto" | "codex" | "api" | "custom";
          blocking: boolean;
          minRating: number;
          timeoutSec?: number | undefined;
        },
        {
          provider?: "auto" | "codex" | "api" | "custom" | undefined;
          blocking?: boolean | undefined;
          minRating?: number | undefined;
          timeoutSec?: number | undefined;
        }
      >
    >;
    explanationCheck: z.ZodDefault<
      z.ZodObject<
        {
          enabled: z.ZodDefault<z.ZodBoolean>;
          minRating: z.ZodDefault<z.ZodNumber>;
        },
        "strip",
        z.ZodTypeAny,
        {
          minRating: number;
          enabled: boolean;
        },
        {
          minRating?: number | undefined;
          enabled?: boolean | undefined;
        }
      >
    >;
    backendPathPatterns: z.ZodDefault<z.ZodString>;
    projectRoot: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    version: 1;
    checkMode: "snippet" | "commit" | "full";
    checks: Record<string, boolean>;
    autoPush: boolean;
    auditLevel: "low" | "moderate" | "high" | "critical";
    continueOnError: boolean;
    strictNetworkChecks: boolean;
    i18nRequireMessagesDir: boolean;
    aiReview: {
      provider: "auto" | "codex" | "api" | "custom";
      blocking: boolean;
      minRating: number;
      timeoutSec?: number | undefined;
    };
    explanationCheck: {
      minRating: number;
      enabled: boolean;
    };
    backendPathPatterns: string;
    checkOrder?: string[] | undefined;
    enforceCommands?: string | undefined;
    hookCommands?: string | undefined;
    gitEnforceCommands?: string | undefined;
    gitCheckModeOnPush?: "snippet" | "commit" | "full" | undefined;
    projectRoot?: string | undefined;
  },
  {
    version?: 1 | undefined;
    checkMode?: "snippet" | "commit" | "full" | undefined;
    checkOrder?: string[] | undefined;
    checks?: Record<string, boolean> | undefined;
    enforceCommands?: string | undefined;
    hookCommands?: string | undefined;
    autoPush?: boolean | undefined;
    gitEnforceCommands?: string | undefined;
    gitCheckModeOnPush?: "snippet" | "commit" | "full" | undefined;
    auditLevel?: "low" | "moderate" | "high" | "critical" | undefined;
    continueOnError?: boolean | undefined;
    strictNetworkChecks?: boolean | undefined;
    i18nRequireMessagesDir?: boolean | undefined;
    aiReview?:
      | {
          provider?: "auto" | "codex" | "api" | "custom" | undefined;
          blocking?: boolean | undefined;
          minRating?: number | undefined;
          timeoutSec?: number | undefined;
        }
      | undefined;
    explanationCheck?:
      | {
          minRating?: number | undefined;
          enabled?: boolean | undefined;
        }
      | undefined;
    backendPathPatterns?: string | undefined;
    projectRoot?: string | undefined;
  }
>;
export type ShimConfig = z.infer<typeof ShimConfigSchema>;
/** Default catalog check IDs and their default enabled state. */
export declare const DEFAULT_CHECK_CATALOG: Array<{
  id: string;
  envKey: string;
  defaultEnabled: boolean;
}>;
export declare const DEFAULT_CHECK_ORDER: string[];
/** Preferred key order when writing .shimwrappercheckrc (matches scripts/lib/project-config-api.js). */
export declare const CONFIG_KEY_ORDER: string[];
//# sourceMappingURL=schema.d.ts.map
