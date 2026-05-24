import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { runCommandWithSpawn } from "../src/runners/command-runner.js";

function mockSpawnSuccess() {
  return vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    setImmediate(() => {
      child.stdout.emit("data", Buffer.from("ok"));
      child.emit("close", 0, null);
    });
    return child as unknown as ReturnType<
      typeof import("node:child_process").spawn
    >;
  });
}

describe("runCommandWithSpawn", () => {
  it("captures stdout and exit code 0", async () => {
    const spawnFn = mockSpawnSuccess();
    const result = await runCommandWithSpawn(spawnFn, "echo", ["hi"], {
      cwd: process.cwd(),
      timeoutMs: 5000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok");
    expect(result.timedOut).toBe(false);
  });
});
