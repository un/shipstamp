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

export function getOriginUrl(cwd: string = process.cwd()): string | null {
  try {
    const out = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const url = out.trim();
    return url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

export function normalizeOriginUrl(originUrl: string): string {
  const raw = originUrl.trim();
  if (!raw) return raw;

  // Common GitHub forms:
  // - git@github.com:owner/repo.git
  // - ssh://git@github.com/owner/repo.git
  // - https://github.com/owner/repo.git
  // Normalize to: github.com/owner/repo (lowercased).
  const sshScp = raw.match(/^git@([^:]+):(.+)$/i);
  if (sshScp) {
    const host = sshScp[1]!.toLowerCase();
    const path = sshScp[2]!.replace(/\.git$/i, "");
    return `${host}/${path}`.toLowerCase();
  }

  const sshUrl = raw.match(/^ssh:\/\/git@([^/]+)\/(.+)$/i);
  if (sshUrl) {
    const host = sshUrl[1]!.toLowerCase();
    const path = sshUrl[2]!.replace(/\.git$/i, "");
    return `${host}/${path}`.toLowerCase();
  }

  try {
    const u = new URL(raw);
    const host = u.host.toLowerCase();
    const path = u.pathname.replace(/^\/+/, "").replace(/\.git$/i, "");
    return `${host}/${path}`.toLowerCase();
  } catch {
    return raw;
  }
}
