/** Outcome of an external command invocation. */
export type CommandRunResult = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};
/** Whether the process exited successfully. */
export declare function commandSucceeded(result: CommandRunResult): boolean;
//# sourceMappingURL=result.d.ts.map
