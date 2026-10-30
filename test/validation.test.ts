import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_CHARS, runValidation, runValidations } from "../src/validation.js";

const cwd = tmpdir();

describe("runValidation", () => {
  it("marks a successful command as passed", async () => {
    const result = await runValidation("echo ok", cwd, 5000);
    expect(result).toMatchObject({ status: "passed", exitCode: 0, truncated: false });
    expect(result.output).toContain("ok");
  });

  it("marks a failing command as failed instead of throwing", async () => {
    const result = await runValidation("echo out; echo err 1>&2; exit 3", cwd, 5000);
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain("out");
    expect(result.output).toContain("err");
  });

  it("stops a command that runs too long", async () => {
    const result = await runValidation("sleep 5", cwd, 200);
    expect(result.status).toBe("timed_out");
  });

  it("keeps only the end of very long output", async () => {
    const result = await runValidation(`node -e "console.log('a'.repeat(50000) + 'END')"`, cwd, 5000);
    expect(result.truncated).toBe(true);
    expect(result.output.length).toBe(MAX_OUTPUT_CHARS);
    expect(result.output.trim().endsWith("END")).toBe(true);
  });

  it("runs every command even if one fails", async () => {
    const results = await runValidations(["exit 1", "echo second"], cwd, 5000);
    expect(results.map((r) => r.status)).toEqual(["failed", "passed"]);
  });
});
