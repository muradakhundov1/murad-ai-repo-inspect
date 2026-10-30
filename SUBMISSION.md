# Submission

## What did you investigate first, and why?

I read all of `src/` first (it is small) and looked at where input from outside

reaches something dangerous: the shell (`exec` in `validation.ts`), git

arguments (`git.ts`) and the MCP schema. Then I made a small fixture repo

(branch `master`, a space in the folder name, one committed file, one

untracked file) and reproduced each suspicion before changing code:

- MCP declared `repo_path` but the handler read `input.repoPath`, so it was

  always `undefined` and git ran in the server's working directory. The tool

  never reviewed the repo the agent asked for.

- MCP accepted `validationCommands` and passed them to `exec()` (shell), so an

  agent (or a prompt injection) could run any command.

- `--base-ref "--output=<file>"` is read by git as an option. This really

  wrote a file (`pwned.txt...HEAD`) to disk.

- Default base `main` was hardcoded, so `master` repos crashed.

- `--repo "my repo"` was cut at the space (`split(" ")[0]`).

- A failing validation command rejected the promise and crashed the whole

  review; `status: "failed"` could never happen.

- `--format json` was accepted but ignored; untracked/uncommitted files were

  missing; renames were shown as "modified" with both paths glued together.

I prioritised by impact: wrong results and security first (MCP bug, command

execution, option injection), then reliability, then output and docs.

## What did you choose to implement or fix?

- **MCP**: reads `repo_path` correctly, rejects unknown arguments (strict

  schema), no command execution at all, repo must be inside an allowed root

  (`INSPECTOR_ALLOWED_ROOT`, default: server cwd), JSON output by default,

  file list capped at 300 with `totalChangedFiles`, errors returned as

  `isError` tool results, `readOnlyHint` annotation.

- **Git**: base refs starting with `-` are rejected and refs are verified;

  base is detected (`origin/HEAD`, `main`, `master`); diff from the merge base

  to the working tree plus untracked files; renames/copies parsed with `-z`;

  clear errors for missing path / not a repo / unknown ref; git runs with

  `core.fsmonitor=false` (see below).

- **Validation**: never throws; returns `passed` / `failed` / `timed_out` with

  exit code; per-command timeout that kills the whole process group; output

  capped (last 20k chars, since failures are at the end); stdout and stderr

  both kept; all commands run even if one fails.

- **CLI**: `node:util` `parseArgs` (paths with spaces, unknown flags are

  errors), `--format json`, `--output <file>|-`, `--timeout`, `--help`, exit

  codes 0 / 1 (validation failed) / 2 (could not run).

- **Report**: code fences and inline code that command output / file names

  cannot break out of, validation status in headings, empty states, JSON

  renderer shared by both interfaces.

- **Packaging/docs**: `bin` pointed at `dist/cli.js` but `tsc` (rootDir `.`)

  outputs `dist/src/cli.js`; fixed and added `inspector-mcp`. README documents

  both interfaces and what "changed" means.

- **Tests**: 1 → 23 tests using temporary git repos, plus an MCP contract test

  through the SDK's in-memory transport.

## What did you intentionally not do?

- Validation over MCP. A safe version needs an operator-configured list of

  named checks, and the repo itself still controls what `npm test` does. I

  chose to keep MCP strictly read-only instead of half-solving this.

- Windows support for the process-group kill (`process.kill(-pid)` is POSIX).

- Diff content / line stats in the report; only file names and statuses.

- Automated tests for the CLI binary itself (it was checked by hand, see below).

## Interface decision

- Decision: **hybrid** (one core, two adapters with different permissions).

- Primary user and execution environment: a developer or CI job running the

  CLI in their own shell, and an AI coding agent (Claude Code, Cursor, ...)

  calling the MCP tool on the developer's machine through stdio.

- Trust boundary and allowed capabilities: the CLI is driven by a human, so it

  may run shell commands (`--validate`) with the user's rights. MCP input comes

  from a model that can be prompt-injected, so MCP only reads: no commands,

  only repos under the allowed root, strict input schema, and git config from

  the inspected repo cannot run commands (`core.fsmonitor`).

- Reliability, discoverability, latency/context, and output tradeoffs: MCP is

  discoverable by agents (described schema, read-only annotation) and returns

  JSON because agents parse it more reliably than Markdown; the file list is

  capped so a huge diff does not fill the context window. The CLI defaults to

  Markdown for humans, has JSON for CI, and uses exit codes for scripting.

  Validation is the slow part; keeping it off MCP also keeps tool calls fast.

- How supported interfaces remain consistent: both call `reviewRepository()`

  and `renderReport()`; base ref detection, file detection and error messages

  live only in the core. The only differences (validation, allowed root, file

  cap, default format) are listed in the README table.

- Evidence that would change this decision: if agents mostly run inside a

  sandbox/container, I would allow named validation checks over MCP. If almost

  nobody uses the MCP tool, I would go CLI-first and drop it. If agents keep

  hitting the 300 file cap, I would add paging instead of raising the cap.

## How did you use an AI coding agent?

I did the investigation, implementation, debugging and testing myself. I used

Claude Code (Claude Opus 5.5) occasionally for small supporting tasks, such as

suggesting simpler wording for a few comments, checking TypeScript syntax,

and brainstorming edge cases worth testing. I reviewed these suggestions

rather than accepting them automatically. The architecture, security decisions,

code changes, test cases and final verification were my own work. I ran the

typecheck, tests, CI build, and manual checks of the CLI and real stdio MCP server.

## Where did you check, correct, or reject an AI suggestion? (required)

- **Kept the types simple**: AI suggested adding doc comments to every

  field in `types.ts` and introducing a custom error class. I did not use

  those suggestions, since plain types and minimal comments fit this small

  project better.

- **Timeout edge case**: AI suggested that the `exec()` timeout option

  might be enough. I checked it with a command that starts a child `node`

  process: the result said `timed_out`, but the child kept running and wrote a

  file 3 seconds later. I used `spawn(..., { detached: true })` and killed the

  process group instead, then added a regression test.

- **Verified the read-only boundary**: I independently checked whether

  an inspected repo could make git run a command through `core.fsmonitor` in

  `.git/config`. It could, so I disabled that setting with

  `-c core.fsmonitor=false` and added a test rather than relying on the

  read-only label alone.

- **Checked that tests catch real bugs**: I ran the new tests against

  the original `src/` instead of trusting passing results: 18 of 21 failed

  there (the other 3 used the new `src/mcp.ts`, which was not stashed).

## Commands used to verify the result, with outcomes

```bash

npm run typecheck                     # no errors

npm test                              # 23 passed (run 3x in a row, all green)

npm run build                         # ok, produces dist/src/cli.js and dist/src/mcp-server.js

git stash push -- src && npx vitest run   # on original code: 18 failed / 3 passed

```

Manual checks on the fixture repo (`master` branch, space in path):

- `inspector review --repo "<fixture>/my repo" --validate "echo hi" --validate "exit 4" --format json --output -`

  → base `master`, `a.txt` added, `b.txt` untracked, second command `failed`

  with exit code 4, process exit code 1.

- `--base-ref=--output=<path>` → `Error: Invalid base ref`, exit 2, no file written.

- `--format xml` → error, exit 2.

- Raw JSON-RPC to `npm run mcp-server` started in the fixture's parent:

  `repo_path: "my repo"` → correct report; extra `validationCommands` →

  `unrecognized_keys` error and no file created; `repo_path: "/etc"` →

  "outside the allowed root".

- Timeout with a grandchild process: before the fix the child survived, after

  the fix it is killed.

- Repo with `core.fsmonitor = "touch marker"`: before the fix the marker was

  created, after the fix it is not.

## A blocker you hit and how you approached it

To check the MCP rejection message I first wrote a small client script in a

temp folder. It failed twice: tsx compiled it as CommonJS (no top-level

await), and then it could not resolve `@modelcontextprotocol/sdk` from outside

the project. Instead of fighting that, I sent raw JSON-RPC lines to the real

`npm run mcp-server` over stdio. That turned out to be the better test anyway,

because it covers the actual entry point and the env/cwd handling.

(Smaller one: macOS has no `timeout` command, so my first timeout check did

not run at all; I noticed because the output was empty, and re-ran it without it.)

## Known limitations and the next three things you would do

Limitations: process-group kill is POSIX only; MCP cannot run any validation;

the CLI binary has no automated tests; other repo-controlled git settings were

not audited beyond `core.fsmonitor`; very large repos are read into memory

in one go (50 MB buffer).

Next three:

1. Named validation checks for MCP, configured by the person who starts the

   server (e.g. `{"test": "npm test"}`), so agents choose a name, never a command.

2. CLI tests that spawn the binary and assert output and exit codes, plus a

   Windows CI job.

3. Audit git invocation for untrusted repos more fully (run with a minimal

   env / `GIT_CONFIG_NOSYSTEM`, review other config keys that execute commands).

## Approximate focused-work time

- Start: 2026-10-30 19:03 (+04)

- Finish: 2026-10-30 19:57 (+04)