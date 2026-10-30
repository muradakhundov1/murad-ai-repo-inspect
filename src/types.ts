export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked";
  oldPath?: string;
};

export type ValidationResult = {
  command: string;
  status: "passed" | "failed" | "timed_out";
  exitCode: number | null;
  output: string;
  truncated: boolean;
};

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: string[];
  timeoutMs?: number;
  maxFiles?: number;
};

export type ReviewResult = {
  repositoryPath: string;
  baseRef: string;
  totalChangedFiles: number;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};
