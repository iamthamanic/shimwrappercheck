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
export function commandSucceeded(result: CommandRunResult): boolean {
  return !result.timedOut && result.exitCode === 0;
}
