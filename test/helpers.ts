import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function run(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

// Creates a repo with one commit on `baseBranch` and switches to a "feature" branch.
export function makeRepo(baseBranch = "main", folderName = "repo"): string {
  const parent = mkdtempSync(join(tmpdir(), "inspector-test-"));
  const dir = join(parent, folderName);
  execFileSync("mkdir", [dir]);
  run(dir, ["init", "-q", "-b", baseBranch]);
  run(dir, ["config", "user.email", "test@example.com"]);
  run(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "readme.txt"), "hello\n");
  writeFileSync(join(dir, "old-name.txt"), "some content that is long enough for rename detection\n");
  run(dir, ["add", "."]);
  run(dir, ["commit", "-q", "-m", "init"]);
  run(dir, ["checkout", "-q", "-b", "feature"]);
  return dir;
}

export function commitAll(dir: string, message: string): void {
  run(dir, ["add", "-A"]);
  run(dir, ["commit", "-q", "-m", message]);
}
