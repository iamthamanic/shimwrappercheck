/**
 * Browser-safe check library descriptions (summary, info, settings, tags, role).
 * Single source of truth for dashboard Check Library and docs parity.
 */
export type CheckSettingOption = {
    key: string;
    label: string;
    type: 'boolean' | 'number' | 'string' | 'select';
    default?: unknown;
    options?: {
        value: string;
        label: string;
    }[];
};
export type CheckTag = 'frontend' | 'backend';
export type CheckRole = 'enforce' | 'hook';
export type CheckDescription = {
    id: string;
    label: string;
    summary: string;
    info: string;
    techStack: string;
    settings: CheckSettingOption[];
    tags: CheckTag[];
    role: CheckRole;
};
/** Option „Review-Report anlegen“ for checks that support review output. */
export declare const REVIEW_MODE_SETTING: CheckSettingOption;
export declare const CHECK_DESCRIPTIONS: CheckDescription[];
export declare function getCheckDescription(id: string): CheckDescription | undefined;
export declare function getCheckRole(id: string): CheckRole;
//# sourceMappingURL=check-descriptions.d.ts.map