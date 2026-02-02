import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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

export function getShipstampStateDir(repoRoot: string): string {
  const dir = join(getGitDir(repoRoot), "shipstamp");
  ensureDir(dir);
  return dir;
}

function writeFileAtomic(absPath: string, contents: string) {
  const tmp = `${absPath}.tmp.${process.pid}.${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, absPath);
}

export function readPendingState(repoRoot: string): PendingState {
  const abs = join(getShipstampStateDir(repoRoot), "pending.json");
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
  const abs = join(getShipstampStateDir(repoRoot), "pending.json");
  writeFileAtomic(abs, JSON.stringify(state, null, 2) + "\n");
}

export function readSkipNext(repoRoot: string): SkipNextState | null {
  const abs = join(getShipstampStateDir(repoRoot), "skip-next");
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
  const abs = join(getShipstampStateDir(repoRoot), "skip-next");
  writeFileAtomic(abs, JSON.stringify(state, null, 2) + "\n");
}

export function clearSkipNext(repoRoot: string) {
  // Hook will implement removal; for now overwriting with empty isn't necessary.
  // Keeping as a placeholder API.
  void repoRoot;
}
