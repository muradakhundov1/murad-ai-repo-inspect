import type { ReviewResult } from "./types.js";

export type ReportFormat = "markdown" | "json";

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

// Wraps text in backticks that can't be closed by backticks inside the text.
function inlineCode(text: string): string {
  const clean = text.replace(/\r?\n/g, "\\n");
  const ticks = "`".repeat(longestBacktickRun(clean) + 1);
  const pad = clean.startsWith("`") || clean.endsWith("`") ? " " : "";
  return `${ticks}${pad}${clean}${pad}${ticks}`;
}

function codeBlock(text: string): string[] {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(text) + 1));
  return [fence, text, fence];
}

export function markdownReport(result: ReviewResult): string {
  const lines = [
    `# Review Report: ${inlineCode(result.repositoryPath)}`,
    "",
    `Base: ${inlineCode(result.baseRef)}`,
    "",
    "## Changed files",
  ];

  if (result.changedFiles.length === 0) {
    lines.push("No changed files.");
  }
  for (const file of result.changedFiles) {
    if (file.oldPath) {
      lines.push(`- ${inlineCode(file.oldPath)} -> ${inlineCode(file.path)} (${file.status})`);
    } else {
      lines.push(`- ${inlineCode(file.path)} (${file.status})`);
    }
  }
  if (result.totalChangedFiles > result.changedFiles.length) {
    lines.push(`- ... and ${result.totalChangedFiles - result.changedFiles.length} more files`);
  }

  lines.push("", "## Validation output");
  if (result.validationResults.length === 0) {
    lines.push("No validation commands were run.");
  }
  for (const validation of result.validationResults) {
    const exit = validation.exitCode === null ? "" : `, exit code ${validation.exitCode}`;
    lines.push("", `### ${inlineCode(validation.command)}: ${validation.status}${exit}`);
    if (validation.truncated) {
      lines.push("Output was truncated, showing the last part.");
    }
    lines.push(...codeBlock(validation.output));
  }
  return lines.join("\n") + "\n";
}

export function renderReport(result: ReviewResult, format: ReportFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2) + "\n";
  }
  return markdownReport(result);
}
