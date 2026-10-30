import { describe, expect, it } from "vitest";
import { markdownReport, renderReport } from "../src/report.js";
import type { ReviewResult } from "../src/types.js";

function sampleResult(): ReviewResult {
  return {
    repositoryPath: "/work/sample",
    baseRef: "main",
    totalChangedFiles: 2,
    changedFiles: [
      { path: "src/index.ts", status: "modified" },
      { path: "src/new.ts", oldPath: "src/old.ts", status: "renamed" },
    ],
    validationResults: [{ command: "npm test", status: "passed", exitCode: 0, output: "ok", truncated: false }],
  };
}

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport(sampleResult());

    expect(report).toContain("`src/index.ts` (modified)");
    expect(report).toContain("`src/old.ts` -> `src/new.ts` (renamed)");
    expect(report).toContain("### `npm test`: passed, exit code 0");
    expect(report).toContain("ok");
  });

  it("does not let command output break out of the code block", () => {
    const result = sampleResult();
    result.validationResults[0].output = "before\n```\n# Injected heading\n```";
    const report = markdownReport(result);

    expect(report).toContain("````\nbefore");
    expect(report).toMatch(/```\n````/);
  });

  it("says when there is nothing to show", () => {
    const result = { ...sampleResult(), totalChangedFiles: 0, changedFiles: [], validationResults: [] };
    const report = markdownReport(result);
    expect(report).toContain("No changed files.");
    expect(report).toContain("No validation commands were run.");
  });

  it("mentions files that were cut off", () => {
    const result = { ...sampleResult(), totalChangedFiles: 10 };
    expect(markdownReport(result)).toContain("... and 8 more files");
  });
});

describe("renderReport", () => {
  it("renders valid json", () => {
    const parsed = JSON.parse(renderReport(sampleResult(), "json"));
    expect(parsed.changedFiles).toHaveLength(2);
    expect(parsed.validationResults[0].status).toBe("passed");
  });
});
