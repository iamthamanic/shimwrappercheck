/** Whether the process exited successfully. */
export function commandSucceeded(result) {
    return !result.timedOut && result.exitCode === 0;
}
//# sourceMappingURL=result.js.map