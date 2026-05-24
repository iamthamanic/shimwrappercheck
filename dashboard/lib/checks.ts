/**
 * Check definitions for dashboard UI — sourced from @shimwrappercheck/core/catalog.
 * Location: dashboard/lib/checks.ts
 */

import type { CheckToggles } from "./presets";
import {
  CHECK_CATALOG_METADATA,
  CHECK_DESCRIPTIONS,
  DEFAULT_CHECK_ORDER,
  getCheckDescription,
  getCheckRole as getCoreCheckRole,
  type CheckDescription,
  type CheckRole,
  type CheckSettingOption,
  type CheckTag,
} from "./core-catalog";

/** Canonical label for the Check Library (rechte Spalte: alle integrierten Checks). */
export const CHECK_LIBRARY_LABEL = "Check Library";

export type CheckId = keyof CheckToggles | "healthPing" | "edgeLogs";

export type { CheckSettingOption, CheckTag, CheckRole };

export type CheckDef = CheckDescription & { id: CheckId };

export { REVIEW_MODE_SETTING } from "./core-catalog";

/** Full Check Library metadata (registry + hook checks). */
export const CHECK_DEFINITIONS: CheckDef[] =
  CHECK_DESCRIPTIONS as CheckDef[];

/**
 * Empfohlene Laufreihenfolge der Checks (aligned with core DEFAULT_CHECK_ORDER).
 * Nur enforce-Checks; Hooks (healthPing, edgeLogs) sind nicht enthalten.
 */
export const IDEAL_CHECK_ORDER: CheckId[] = DEFAULT_CHECK_ORDER.filter(
  (id): id is CheckId =>
    CHECK_DEFINITIONS.some((def) => def.id === id),
);

/** Lookup core catalog label (single source of truth for ids). */
export function getCoreCheckLabel(id: string): string | undefined {
  return CHECK_CATALOG_METADATA.find((entry) => entry.id === id)?.label;
}

export function getCheckDef(id: CheckId): CheckDef | undefined {
  return getCheckDescription(id) as CheckDef | undefined;
}

export function getCheckRole(id: CheckId): CheckRole {
  return getCoreCheckRole(id);
}
