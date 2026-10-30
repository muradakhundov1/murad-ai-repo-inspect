import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp.js";
import { makeRepo } from "./helpers.js";

async function connect(allowedRoot: string): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(allowedRoot).connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as { type: string; text: string }[])[0].text;
}

describe("MCP review_repository", () => {
  it("reviews the repository given in repo_path", async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "agent.txt"), "x\n");
    const client = await connect(dirname(dir));

    const result = await client.callTool({ name: "review_repository", arguments: { repo_path: dir } });

    expect(result.isError).toBeFalsy();
    const report = JSON.parse(textOf(result));
    expect(report.changedFiles).toEqual([{ path: "agent.txt", status: "untracked" }]);
  });

  it("does not accept validation commands", async () => {
    const dir = makeRepo();
    const client = await connect(dirname(dir));

    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: dir, validationCommands: ["touch hacked"] },
    });

    expect(result.isError).toBe(true);
  });

  it("refuses repositories outside the allowed root", async () => {
    const allowed = makeRepo();
    const other = makeRepo();
    const client = await connect(allowed);

    const result = await client.callTool({ name: "review_repository", arguments: { repo_path: other } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("outside the allowed root");
  });

  it("returns a tool error for a bad base ref", async () => {
    const dir = makeRepo();
    const client = await connect(dir);

    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: ".", base_ref: "--output=x" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Invalid base ref");
  });

  it("advertises a read-only tool", async () => {
    const client = await connect(makeRepo());
    const { tools } = await client.listTools();
    expect(tools[0].name).toBe("review_repository");
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(tools[0].inputSchema.properties ?? {})).toEqual(["repo_path", "base_ref", "format"]);
  });
});
