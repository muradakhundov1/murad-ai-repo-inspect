import { exec } from "node:child_process";
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
    exec(command, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      let text = stdout;
      if (stderr) {
        text += (text ? "\n" : "") + stderr;
      }

      let status: ValidationResult["status"] = "passed";
      let exitCode: number | null = 0;
      if (error) {
        status = "failed";
        exitCode = typeof error.code === "number" ? error.code : null;
        // node types say code is a number, but for this error it is a string
        if ((error.code as unknown) === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          text += "\n[inspector] output was too large, command was stopped";
        } else if (error.killed) {
          status = "timed_out";
          text += `\n[inspector] command timed out after ${timeoutMs} ms`;
        } else if (exitCode === null) {
          text += `\n[inspector] ${error.message}`;
        }
      }

      const limited = limitOutput(text);
      resolve({ command, status, exitCode, output: limited.output, truncated: limited.truncated });
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
