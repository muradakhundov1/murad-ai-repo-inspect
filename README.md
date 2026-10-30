# Repository Inspector

This is a small TypeScript developer tool that inspects changes in a Git
repository, runs optional validation commands, and produces a Markdown report.
It can be used from a command line or exposed to AI clients through MCP.

## Your task

Investigate the repository and improve it as you judge best. The starter works
for a narrow happy path, but production use may expose correctness, safety,
reliability, contract, output, documentation, or testing weaknesses.

You are not expected to finish everything. We care about how you investigate,
prioritize, implement, verify, and explain a meaningful scope.

## Product decision

This tool may be used directly by developers and by AI coding agents. Decide
whether its production interface should be **CLI-first**, **MCP-first**, or
**hybrid**. Implement improvements consistent with your decision.

There is no preferred label. Explain:

- The primary user and execution environment you assumed.
- The trust boundary and allowed capabilities.
- Reliability, discoverability, latency/context, and output-size tradeoffs.
- How the interfaces you continue to advertise stay behaviorally consistent.
- What evidence would change your decision.

## Time and rules

- Maximum **90 focused minutes** within 48 hours of receiving the invitation.
- Use AI coding tools freely. Verify their work and document at least one
  suggestion you corrected or rejected.
- Work in your own repository created from this template.
- Commit as you work and complete `SUBMISSION.md` in your final commit.
- Completion is not required. Accurate scope and verification matter more than
  a large diff.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## Interfaces (hybrid)

Both interfaces call the same `reviewRepository()` in `src/core.ts` and the
same `renderReport()` in `src/report.ts`, so file detection, base branch
detection and error messages are the same. The difference is what each one is
allowed to do:

| | CLI | MCP |
|---|---|---|
| Who runs it | a developer or CI, in their own shell | an AI agent |
| Runs validation commands | yes (`--validate`) | no, read-only |
| Which repos | any path | only inside the allowed root |
| Default format | markdown | json |
| File list | full | first 300 (`totalChangedFiles` has the real count) |

### What counts as "changed"

Everything on the current branch that is not in the base: commits since
`git merge-base <base> HEAD`, uncommitted changes and untracked files
(ignored files are skipped). Renames are detected. If no base is given the
tool tries `origin/HEAD`, then `main`, then `master`.

## CLI

```bash
npm run inspector -- review --repo ./path/to/repo
npm run inspector -- review --repo ./path/to/repo --base-ref develop --validate "npm test" --validate "npm run lint"
npm run inspector -- review --repo ./path/to/repo --format json --output -
```

| Option | Default | |
|---|---|---|
| `--repo <path>` | required | repository to inspect |
| `--base-ref <ref>` | origin/HEAD, main, master | branch or commit to compare with |
| `--validate <command>` | none | shell command run in the repo root, can be repeated |
| `--timeout <seconds>` | 300 | per validation command |
| `--format markdown\|json` | markdown | |
| `--output <file>` | `review-report.md` | `-` writes to stdout |

Exit codes: `0` ok, `1` a validation command failed or timed out, `2` the
review could not run (bad arguments, not a repo, unknown ref).

`--validate` runs the command through a shell with your permissions. Only use
commands you would run yourself.

## MCP

```bash
INSPECTOR_ALLOWED_ROOT=/path/to/workspace npm run mcp-server
```

If `INSPECTOR_ALLOWED_ROOT` is not set, the folder the server was started in is
used. Tool `review_repository`:

| Argument | |
|---|---|
| `repo_path` (required) | absolute, or relative to the allowed root |
| `base_ref` | same default as the CLI |
| `format` | `json` (default) or `markdown` |

Unknown arguments are rejected (for example the old `validationCommands`).
Errors come back as tool results with `isError: true`.

## Project layout

```text
src/core.ts         shared review orchestration
src/cli.ts          command-line adapter
src/mcp.ts          MCP tool definition (createServer)
src/mcp-server.ts   MCP stdio entry point
src/git.ts          Git inspection
src/validation.ts   validation execution
src/report.ts       Markdown / JSON report generation
test/               tests (use temporary git repos)
```

When finished, submit via **Security → Report a vulnerability** on this
repo — see `SECURITY.md` for exactly what to include. Do not reply by email;
that submission channel is not monitored.
