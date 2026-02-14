/**
 * Default project-rules.sh content based on 7Style-DDD / AGENTS.md rules.
 * Generated from the catalog preset so Script and Form stay in sync; modular and easy to maintain.
 * Location: dashboard/lib/projectRulesDefault.ts
 */

import { generateScriptFromRules } from "./projectRulesScript";
import { getDefaultPresetRules } from "./projectRulesCatalog";

/** Default rules from catalog preset (max lines, no hardcoded colors, no inline styles, etc.). */
export const DEFAULT_PROJECT_RULES = getDefaultPresetRules();

/** Default script content; contains RULES_JSON so parseRulesFromScript() can restore the form view. */
export const PROJECT_RULES_DEFAULT_SCRIPT = generateScriptFromRules(DEFAULT_PROJECT_RULES);
