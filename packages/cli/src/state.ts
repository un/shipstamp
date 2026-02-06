import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type PendingCommit = {
  sha: string;
  createdAtMs: number;
  reason?: string;
};

export type PendingState = {
  branches: Record<string, PendingCommit[]>;
};

export type SkipNextState = {
  createdAtMs: number;
  reason: string;
};

export type PendingNextCommitMarker = {
  createdAtMs: number;
  branch: string;
  reason: string;
};

function ensureDir(absDir: string) {
  mkdirSync(absDir, { recursive: true });
}

export function getGitDir(repoRoot: string): string {
  const out = execFileSync("git", ["rev-parse", "--git-dir"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();

  const gitDir = out.length > 0 ? out : ".git";
  return resolve(repoRoot, gitDir);
}

export function getGitpreflightStateDir(repoRoot: string): string {
  const dir = join(getGitDir(repoRoot), "gitpreflight");
  ensureDir(dir);
  return dir;
}

function writeFileAtomic(absPath: string, contents: string) {
  const tmp = `${absPath}.tmp.${process.pid}.${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, absPath);
}

export function readPendingState(repoRoot: string): PendingState {
  const abs = join(getGitpreflightStateDir(repoRoot), "pending.json");
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!raw || typeof raw !== "object") return { branches: {} };
    const branches = (raw as any).branches;
    if (!branches || typeof branches !== "object") return { branches: {} };
    return { branches } as PendingState;
  } catch {
    return { branches: {} };
  }
}

export function writePendingState(repoRoot: string, state: PendingState) {
  const abs = join(getGitpreflightStateDir(repoRoot), "pending.json");
  writeFileAtomic(abs, JSON.stringify(state, null, 2) + "\n");
}

export function readSkipNext(repoRoot: string): SkipNextState | null {
  const abs = join(getGitpreflightStateDir(repoRoot), "skip-next");
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    const reason = (raw as any).reason;
    const createdAtMs = (raw as any).createdAtMs;
    if (typeof reason !== "string" || typeof createdAtMs !== "number") return null;
    return { reason, createdAtMs };
  } catch {
    return null;
  }
}

export function writeSkipNext(repoRoot: string, state: SkipNextState) {
  const abs = join(getGitpreflightStateDir(repoRoot), "skip-next");
  writeFileAtomic(abs, JSON.stringify(state, null, 2) + "\n");
}

export function clearSkipNext(repoRoot: string) {
  const abs = join(getGitpreflightStateDir(repoRoot), "skip-next");
  try {
    unlinkSync(abs);
  } catch {
    // ignore
  }
}

export function readPendingNextCommit(repoRoot: string): PendingNextCommitMarker | null {
  const abs = join(getGitpreflightStateDir(repoRoot), "pending-next-commit");
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    const branch = (raw as any).branch;
    const createdAtMs = (raw as any).createdAtMs;
    const reason = (raw as any).reason;
    if (typeof branch !== "string" || typeof createdAtMs !== "number" || typeof reason !== "string") return null;
    return { branch, createdAtMs, reason };
  } catch {
    return null;
  }
}

export function writePendingNextCommit(repoRoot: string, marker: PendingNextCommitMarker) {
  const abs = join(getGitpreflightStateDir(repoRoot), "pending-next-commit");
  writeFileAtomic(abs, JSON.stringify(marker, null, 2) + "\n");
}

export function clearPendingNextCommit(repoRoot: string) {
  const abs = join(getGitpreflightStateDir(repoRoot), "pending-next-commit");
  try {
    unlinkSync(abs);
  } catch {
    // ignore
  }
}
