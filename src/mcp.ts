import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { renderReport } from "./report.js";

export const MCP_MAX_FILES = 300;

const inputSchema = z
  .object({
    repo_path: z
      .string()
      .min(1)
      .describe("Path to a git repository. Relative paths are resolved from the allowed root."),
    base_ref: z
      .string()
      .optional()
      .describe("Branch or commit to compare with. Default: origin/HEAD, then main, then master."),
    format: z.enum(["json", "markdown"]).optional().describe("Report format. Default: json."),
  })
  .strict();

// The agent may only inspect repositories inside this folder.
function checkAllowed(allowedRoot: string, repoPath: string): string {
  const root = realpathSync(allowedRoot);
  let target: string;
  try {
    target = realpathSync(resolve(root, repoPath));
  } catch {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Repository path is outside the allowed root (${root}): ${repoPath}`);
  }
  return target;
}

export function createServer(allowedRoot: string): McpServer {
  const server = new McpServer({ name: "repository-inspector", version: "2.1.0" });

  server.registerTool(
    "review_repository",
    {
      description:
        "Lists files changed on the current branch compared to a base branch, including uncommitted " +
        `and untracked files. Read-only: it never runs commands in the repository. At most ${MCP_MAX_FILES} ` +
        "files are listed; totalChangedFiles shows the real count.",
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        const repositoryPath = checkAllowed(allowedRoot, input.repo_path);
        const result = await reviewRepository({
          repositoryPath,
          baseRef: input.base_ref,
          maxFiles: MCP_MAX_FILES,
        });
        return { content: [{ type: "text", text: renderReport(result, input.format ?? "json") }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    },
  );

  return server;
}
