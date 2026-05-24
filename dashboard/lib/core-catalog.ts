/**
 * Re-export browser-safe catalog from @shimwrappercheck/core/catalog.
 * Dashboard Check Library ids/labels/order must stay aligned with the core registry.
 */
export {
  CHECK_CATALOG_METADATA,
  CHECK_DESCRIPTIONS,
  DEFAULT_CHECK_ORDER,
  REVIEW_MODE_SETTING,
  getCheckDescription,
  getCheckRole,
} from "@shimwrappercheck/core/catalog";

export type {
  CheckCatalogEntry,
  CheckDescription,
  CheckRole,
  CheckSettingOption,
  CheckTag,
} from "@shimwrappercheck/core/catalog";
