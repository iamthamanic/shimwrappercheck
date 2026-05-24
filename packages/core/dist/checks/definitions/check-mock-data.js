import { runNpmScriptIfPresent } from "./helpers.js";
export const checkMockDataCheck = {
    id: "checkMockData",
    label: "Check Mock Data",
    category: "frontend",
    envKey: "SHIM_RUN_CHECK_MOCK_DATA",
    defaultEnabled: true,
    requiredTools: [],
    async run(ctx) {
        return runNpmScriptIfPresent(ctx, "checkMockData", "check:mock-data", "Check mock data");
    },
};
//# sourceMappingURL=check-mock-data.js.map