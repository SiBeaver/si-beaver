import { spawn } from "node:child_process";

export interface RunOptions {
  timeout?: number;
  signal?: AbortSignal;
  cwd?: string;
  env?: Record<string, string>;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a command and return its stdout, stderr, and exit code.
 * Throws if the process fails to spawn or is killed by signal.
 */
export async function run(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { timeout, signal, cwd, env } = options;

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    let timer: NodeJS.Timeout | undefined;
    if (timeout) {
      timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Command timed out after ${timeout}ms: ${command} ${args.join(" ")}`));
      }, timeout);
    }

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: code ?? 1,
      });
    });
  });
}

/**
 * Check if a binary is available on PATH or at a known location.
 */
export async function hasBinary(name: string): Promise<boolean> {
  try {
    await run("which", [name], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
