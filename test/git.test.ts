import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { commitAll, makeRepo, run } from "./helpers.js";

describe("reviewRepository git inspection", () => {
  it("finds committed, uncommitted, renamed and untracked files", async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "added.txt"), "new\n");
    run(dir, ["mv", "old-name.txt", "new-name.txt"]);
    commitAll(dir, "change");
    writeFileSync(join(dir, "readme.txt"), "changed but not committed\n");
    writeFileSync(join(dir, "untracked file.txt"), "x\n");

    const result = await reviewRepository({ repositoryPath: dir });

    expect(result.baseRef).toBe("main");
    expect(result.changedFiles).toEqual(
      expect.arrayContaining([
        { path: "added.txt", status: "added" },
        { path: "new-name.txt", oldPath: "old-name.txt", status: "renamed" },
        { path: "readme.txt", status: "modified" },
        { path: "untracked file.txt", status: "untracked" },
      ]),
    );
    expect(result.changedFiles).toHaveLength(4);
  });

  it("falls back to master when there is no main branch", async () => {
    const dir = makeRepo("master");
    writeFileSync(join(dir, "a.txt"), "a\n");
    commitAll(dir, "a");

    const result = await reviewRepository({ repositoryPath: dir });

    expect(result.baseRef).toBe("master");
    expect(result.changedFiles).toEqual([{ path: "a.txt", status: "added" }]);
  });

  it("works with a path that contains spaces", async () => {
    const dir = makeRepo("main", "my repo");
    const result = await reviewRepository({ repositoryPath: dir });
    expect(result.repositoryPath.endsWith("my repo")).toBe(true);
  });

  it("rejects a base ref that looks like a git option", async () => {
    const dir = makeRepo();
    await expect(
      reviewRepository({ repositoryPath: dir, baseRef: "--output=pwned.txt" }),
    ).rejects.toThrow("Invalid base ref");
    expect(readdirSync(dir).some((name) => name.startsWith("pwned"))).toBe(false);
  });

  it("does not run commands from the repository's git config", async () => {
    const dir = makeRepo();
    const marker = join(dirname(dir), "fsmonitor-ran");
    run(dir, ["config", "core.fsmonitor", `touch '${marker}'; false`]);

    await reviewRepository({ repositoryPath: dir });

    expect(existsSync(marker)).toBe(false);
  });

  it("gives clear errors for unknown refs and non-repositories", async () => {
    const dir = makeRepo();
    await expect(reviewRepository({ repositoryPath: dir, baseRef: "nope" })).rejects.toThrow(
      "Base ref not found: nope",
    );
    await expect(reviewRepository({ repositoryPath: dirname(dir) })).rejects.toThrow(
      "Not a git repository",
    );
    const missing = join(dir, "missing");
    expect(existsSync(missing)).toBe(false);
    await expect(reviewRepository({ repositoryPath: missing })).rejects.toThrow("does not exist");
  });

  it("limits the number of files when maxFiles is set", async () => {
    const dir = makeRepo();
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(dir, `f${i}.txt`), "x\n");
    }
    const result = await reviewRepository({ repositoryPath: dir, maxFiles: 2 });
    expect(result.changedFiles).toHaveLength(2);
    expect(result.totalChangedFiles).toBe(5);
  });
});
