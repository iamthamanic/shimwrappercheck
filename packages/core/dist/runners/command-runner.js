import { spawn } from "node:child_process";
/**
 * Run an external command with timeout and captured output.
 * Injectable spawn for tests via runCommandWithSpawn.
 */
export async function runCommand(command, args, options) {
    return runCommandWithSpawn(spawn, command, args, options);
}
export async function runCommandWithSpawn(spawnFn, command, args, options) {
    const start = Date.now();
    const timeoutMs = options.timeoutMs ?? 600_000;
    const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024;
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const child = spawnFn(command, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            shell: false,
        });
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, timeoutMs);
        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
            if (stdout.length > maxBuffer)
                stdout = stdout.slice(0, maxBuffer);
        });
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
            if (stderr.length > maxBuffer)
                stderr = stderr.slice(0, maxBuffer);
        });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolve({
                command,
                args,
                cwd: options.cwd,
                exitCode: code,
                signal: signal,
                stdout,
                stderr,
                durationMs: Date.now() - start,
                timedOut,
            });
        });
        child.on("error", (err) => {
            clearTimeout(timer);
            resolve({
                command,
                args,
                cwd: options.cwd,
                exitCode: 1,
                signal: null,
                stdout,
                stderr: `${stderr}\n${err.message}`.trim(),
                durationMs: Date.now() - start,
                timedOut,
            });
        });
    });
}
//# sourceMappingURL=command-runner.js.map