import { execFileSync } from "node:child_process";

export function getRepoRoot(cwd: string = process.cwd()): string {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    const root = out.trim();
    if (!root) {
      throw new Error("git returned empty repo root");
    }
    return root;
  } catch {
    throw new Error(
      "Not in a git repository. Run Shipstamp from inside a git repo (or `cd` into one) and try again."
    );
  }
}

export function getBranchName(cwd: string = process.cwd()): string | null {
  try {
    const out = execFileSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    const branch = out.trim();
    return branch.length > 0 ? branch : null;
  } catch {
    return null;
  }
}

export function getHeadSha(cwd: string = process.cwd()): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    const sha = out.trim();
    return sha.length > 0 ? sha : null;
  } catch {
    // Empty repo (no commits) or not a repo.
    return null;
  }
}
