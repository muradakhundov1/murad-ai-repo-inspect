import { spawn } from "node:child_process";
import type { ValidationResult } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_OUTPUT_CHARS = 20000;

// Keeps the end of the output, because test failures are usually printed last.
export function limitOutput(output: string): { output: string; truncated: boolean } {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return { output, truncated: false };
  }
  return { output: output.slice(-MAX_OUTPUT_CHARS), truncated: true };
}

export function runValidation(command: string, cwd: string, timeoutMs: number): Promise<ValidationResult> {
  return new Promise((resolve) => {
    // detached = own process group, so on timeout we can kill the command and everything it started
    const child = spawn(command, { cwd, shell: true, detached: true, stdio: ["ignore", "pipe", "pipe"] });

    let text = "";
    let cutEarly = false;
    let timedOut = false;

    const addOutput = (chunk: Buffer) => {
      text += chunk.toString("utf8");
      if (text.length > MAX_OUTPUT_CHARS * 2) {
        text = text.slice(-MAX_OUTPUT_CHARS);
        cutEarly = true;
      }
    };
    child.stdout.on("data", addOutput);
    child.stderr.on("data", addOutput);

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    const finish = (status: ValidationResult["status"], exitCode: number | null) => {
      clearTimeout(timer);
      const limited = limitOutput(text);
      resolve({ command, status, exitCode, output: limited.output, truncated: limited.truncated || cutEarly });
    };

    child.on("error", (error) => {
      text += `\n[inspector] ${error.message}`;
      finish("failed", null);
    });

    child.on("close", (code) => {
      if (timedOut) {
        text += `\n[inspector] command timed out after ${timeoutMs} ms`;
        finish("timed_out", null);
      } else {
        finish(code === 0 ? "passed" : "failed", code);
      }
    });
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd, timeoutMs));
  }
  return results;
}
