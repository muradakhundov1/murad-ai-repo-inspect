import { changedFiles, findRepositoryRoot, resolveBaseRef } from "./git.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest): Promise<ReviewResult> {
  const root = findRepositoryRoot(request.repositoryPath);
  const baseRef = resolveBaseRef(root, request.baseRef);
  const files = changedFiles(root, baseRef);
  const validations = await runValidations(request.validationCommands ?? [], root, request.timeoutMs);

  const shownFiles = request.maxFiles === undefined ? files : files.slice(0, request.maxFiles);
  return {
    repositoryPath: root,
    baseRef,
    totalChangedFiles: files.length,
    changedFiles: shownFiles,
    validationResults: validations,
  };
}
