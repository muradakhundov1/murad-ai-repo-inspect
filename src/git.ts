import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function refExists(repositoryPath: string, ref: string): boolean {
  try {
    git(repositoryPath, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export function findRepositoryRoot(repositoryPath: string): string {
  if (!existsSync(repositoryPath)) {
    throw new Error(`Repository path does not exist: ${repositoryPath}`);
  }
  try {
    return git(repositoryPath, ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    throw new Error(`Not a git repository: ${repositoryPath}`);
  }
}

export function resolveBaseRef(repositoryPath: string, baseRef?: string): string {
  if (baseRef !== undefined) {
    // a ref starting with "-" would be read by git as an option (e.g. --output=<file>)
    if (baseRef === "" || baseRef.startsWith("-")) {
      throw new Error(`Invalid base ref: "${baseRef}"`);
    }
    if (!refExists(repositoryPath, baseRef)) {
      throw new Error(`Base ref not found: ${baseRef}`);
    }
    return baseRef;
  }

  for (const candidate of ["origin/HEAD", "main", "master"]) {
    if (refExists(repositoryPath, candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not find a base branch (tried origin/HEAD, main, master). Pass a base ref.");
}

function statusFromCode(code: string): ChangedFile["status"] {
  if (code === "A") return "added";
  if (code === "D") return "deleted";
  return "modified";
}

// Files changed since the branch left baseRef, including uncommitted and untracked files.
export function changedFiles(repositoryPath: string, baseRef: string): ChangedFile[] {
  let mergeBase: string;
  try {
    mergeBase = git(repositoryPath, ["merge-base", baseRef, "HEAD"]).trim();
  } catch {
    throw new Error(`No common history between ${baseRef} and HEAD`);
  }

  const files: ChangedFile[] = [];
  const parts = git(repositoryPath, ["diff", "--name-status", "-z", "-M", mergeBase]).split("\0");
  let i = 0;
  while (i < parts.length) {
    const code = parts[i];
    if (code === "") {
      i++;
      continue;
    }
    if (code.startsWith("R") || code.startsWith("C")) {
      files.push({
        path: parts[i + 2],
        oldPath: parts[i + 1],
        status: code.startsWith("R") ? "renamed" : "copied",
      });
      i += 3;
    } else {
      files.push({ path: parts[i + 1], status: statusFromCode(code[0]) });
      i += 2;
    }
  }

  const untracked = git(repositoryPath, ["ls-files", "--others", "--exclude-standard", "-z"]);
  for (const path of untracked.split("\0")) {
    if (path !== "") {
      files.push({ path, status: "untracked" });
    }
  }
  return files;
}
