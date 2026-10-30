#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { reviewRepository } from "./core.js";
import { renderReport } from "./report.js";

const USAGE = `Usage: inspector review --repo <path> [options]

Options:
  --base-ref <ref>      branch or commit to compare with (default: origin/HEAD, main, master)
  --validate <command>  shell command to run in the repo, can be repeated
  --timeout <seconds>   timeout for each validation command (default: 300)
  --format <format>     markdown or json (default: markdown)
  --output <file>       where to write the report, "-" for stdout (default: review-report.md)

Exit codes: 0 = ok, 1 = a validation command failed, 2 = review could not run`;

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        repo: { type: "string" },
        "base-ref": { type: "string" },
        validate: { type: "string", multiple: true },
        timeout: { type: "string", default: "300" },
        format: { type: "string", default: "markdown" },
        output: { type: "string", default: "review-report.md" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    return 2;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (positionals[0] !== "review" || positionals.length > 1 || !values.repo) {
    console.error(USAGE);
    return 2;
  }
  if (values.format !== "markdown" && values.format !== "json") {
    console.error(`Unknown format: ${values.format} (use markdown or json)`);
    return 2;
  }
  const timeoutSeconds = Number(values.timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    console.error(`Invalid timeout: ${values.timeout}`);
    return 2;
  }

  let result;
  try {
    result = await reviewRepository({
      repositoryPath: values.repo,
      baseRef: values["base-ref"],
      validationCommands: values.validate ?? [],
      timeoutMs: timeoutSeconds * 1000,
    });
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return 2;
  }

  const report = renderReport(result, values.format);
  if (values.output === "-") {
    process.stdout.write(report);
  } else {
    writeFileSync(values.output, report, "utf8");
    console.error(`Review report written to ${values.output}`);
  }

  const failed = result.validationResults.some((validation) => validation.status !== "passed");
  return failed ? 1 : 0;
}

main().then((code) => {
  process.exitCode = code;
});
