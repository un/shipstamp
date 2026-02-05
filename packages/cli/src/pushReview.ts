import { execFileSync } from "node:child_process";
import { type StagedFile } from "./staged";

export type PrePushUpdate = {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
};

function isZeroSha(sha: string): boolean {
  const s = sha.trim();
  return s.length > 0 && /^0+$/.test(s);
}

export function parsePrePushStdin(input: string): PrePushUpdate[] {
  const updates: PrePushUpdate[] = [];
  const lines = input.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    const [localRef, localSha, remoteRef, remoteSha] = parts;
    if (!localRef || !localSha || !remoteRef || !remoteSha) continue;
    updates.push({ localRef, localSha, remoteRef, remoteSha });
  }

  return updates;
}

function mergeBase(repoRoot: string, a: string, b: string): string | null {
  try {
    const out = execFileSync("git", ["merge-base", a, b], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const sha = out.trim();
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}

function tryRevParse(repoRoot: string, ref: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const sha = out.trim();
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}

function resolveRemoteHeadRef(repoRoot: string, remoteName: string): string | null {
  // Prefer the remote's configured HEAD symbolic ref.
  try {
    const out = execFileSync("git", ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remoteName}/HEAD`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const ref = out.trim();
    if (ref) return ref;
  } catch {
    // ignore
  }

  if (tryRevParse(repoRoot, `${remoteName}/main`)) return `${remoteName}/main`;
  if (tryRevParse(repoRoot, `${remoteName}/master`)) return `${remoteName}/master`;
  return null;
}

function gitDiff(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function parseNameStatusZ(out: string): Array<{ status: string; paths: string[] }> {
  const parts = out.split("\0").filter((p) => p.length > 0);
  const entries: Array<{ status: string; paths: string[] }> = [];

  for (let i = 0; i < parts.length; ) {
    const status = parts[i++]!;
    const kind = status[0] ?? "";

    if (kind === "R" || kind === "C") {
      const oldPath = parts[i++];
      const newPath = parts[i++];
      entries.push({ status, paths: [oldPath ?? "", newPath ?? ""] });
      continue;
    }

    const path = parts[i++];
    entries.push({ status, paths: [path ?? ""] });
  }

  return entries;
}

function normalizeRenamePath(path: string): string {
  // Best-effort: git numstat rename formatting sometimes uses "old => new" with optional braces.
  // Examples:
  // - "old.js => new.js"
  // - "src/{old => new}/file.ts"
  if (!path.includes("=>")) return path;

  const braceStart = path.indexOf("{");
  const braceEnd = path.indexOf("}");
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    const inside = path.slice(braceStart + 1, braceEnd);
    const arrow = inside.split("=>").map((s) => s.trim());
    if (arrow.length === 2) {
      const before = path.slice(0, braceStart);
      const after = path.slice(braceEnd + 1);
      return `${before}${arrow[1]}${after}`;
    }
  }

  const arrow = path.split("=>").map((s) => s.trim());
  if (arrow.length >= 2) return arrow[arrow.length - 1]!;

  return path;
}

function collectBinaryPathsForRange(repoRoot: string, baseSha: string, headSha: string): Set<string> {
  const out = gitDiff(repoRoot, ["diff", "--numstat", "--find-renames", baseSha, headSha]);
  const set = new Set<string>();

  for (const line of out.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;

    const [ins, del, ...rest] = trimmed.split("\t");
    const rawPath = rest.join("\t");
    if (!rawPath) continue;

    const path = normalizeRenamePath(rawPath);
    if (ins === "-" && del === "-") {
      set.add(path);
    }
  }

  return set;
}

function collectFilesForRange(repoRoot: string, baseSha: string, headSha: string): StagedFile[] {
  const binaryPaths = collectBinaryPathsForRange(repoRoot, baseSha, headSha);

  const out = gitDiff(repoRoot, ["diff", "--name-status", "-z", "--find-renames", baseSha, headSha]);
  const entries = parseNameStatusZ(out);

  return entries.map((e) => {
    const kind = e.status[0] ?? "";
    if (kind === "A") {
      const path = e.paths[0] ?? "";
      return { changeType: "added", path, isBinary: binaryPaths.has(path) };
    }
    if (kind === "M") {
      const path = e.paths[0] ?? "";
      return { changeType: "modified", path, isBinary: binaryPaths.has(path) };
    }
    if (kind === "D") {
      const path = e.paths[0] ?? "";
      return { changeType: "deleted", path, isBinary: binaryPaths.has(path) };
    }
    if (kind === "R") {
      const oldPath = e.paths[0] ?? "";
      const path = e.paths[1] ?? "";
      return { changeType: "renamed", path, oldPath, isBinary: binaryPaths.has(path) };
    }
    if (kind === "C") {
      const oldPath = e.paths[0] ?? "";
      const path = e.paths[1] ?? "";
      return { changeType: "copied", path, oldPath, isBinary: binaryPaths.has(path) };
    }

    const path = e.paths[0] ?? "";
    return { changeType: "unknown", path, isBinary: binaryPaths.has(path) };
  });
}

function collectPatchForRange(repoRoot: string, baseSha: string, headSha: string, contextLines = 3): string {
  return gitDiff(repoRoot, [
    "diff",
    "--patch",
    "--no-color",
    "--no-ext-diff",
    `--unified=${contextLines}`,
    "--find-renames",
    baseSha,
    headSha
  ]);
}

function listCommitShasForRange(repoRoot: string, baseSha: string, headSha: string): string[] {
  try {
    const out = execFileSync("git", ["rev-list", `${baseSha}..${headSha}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type PushReviewInput = {
  patch: string;
  files: StagedFile[];
  commitShas: string[];
  inferredBranch: string | null;
};

export function collectPushReviewInputFromHook(
  repoRoot: string,
  opts: { remoteName?: string; stdin?: string; headSha: string }
): PushReviewInput {
  const remoteName = opts.remoteName ?? "origin";
  const stdin = opts.stdin ?? "";

  const updates = parsePrePushStdin(stdin).filter((u) => !isZeroSha(u.localSha) && u.localRef.startsWith("refs/heads/"));
  const inferredBranch = (() => {
    const heads = updates
      .map((u) => u.localRef)
      .filter((r) => r.startsWith("refs/heads/"))
      .map((r) => r.replace(/^refs\/heads\//, ""));
    return heads.length === 1 ? heads[0]! : null;
  })();

  const patchParts: string[] = [];
  const filesByPath = new Map<string, StagedFile>();
  const commitSet = new Set<string>();
  let processedAnyUpdate = false;

  for (const u of updates) {
    let baseSha = u.remoteSha;

    if (!isZeroSha(baseSha) && !tryRevParse(repoRoot, baseSha)) {
      const remoteBranch = u.remoteRef.startsWith("refs/heads/") ? u.remoteRef.replace(/^refs\/heads\//, "") : null;
      if (remoteBranch) {
        const remoteTrackingRef = `${remoteName}/${remoteBranch}`;
        const trackingSha = tryRevParse(repoRoot, remoteTrackingRef);
        if (trackingSha) baseSha = trackingSha;
      }
    }

    if (isZeroSha(baseSha)) {
      const remoteHeadRef = resolveRemoteHeadRef(repoRoot, remoteName);
      const mb = remoteHeadRef ? mergeBase(repoRoot, u.localSha, remoteHeadRef) : null;
      baseSha = mb ?? (remoteHeadRef ? tryRevParse(repoRoot, remoteHeadRef) ?? baseSha : baseSha);
    }

    if (isZeroSha(baseSha)) {
      // If we still can't establish a base, fall back to reviewing just HEAD.
      continue;
    }

    processedAnyUpdate = true;

    const patch = collectPatchForRange(repoRoot, baseSha, u.localSha);
    if (patch.trim().length > 0) patchParts.push(patch);

    for (const f of collectFilesForRange(repoRoot, baseSha, u.localSha)) {
      if (!f.path) continue;
      filesByPath.set(f.path, f);
    }

    for (const sha of listCommitShasForRange(repoRoot, baseSha, u.localSha)) {
      commitSet.add(sha);
    }
  }

  // Fallback: if we couldn't parse hook input or determine a base, use upstream tracking.
  if (!processedAnyUpdate) {
    const upstreamSha = tryRevParse(repoRoot, "@{u}");
    let baseSha: string | null = upstreamSha;

    if (!baseSha) {
      const remoteHeadRef = resolveRemoteHeadRef(repoRoot, remoteName);
      if (remoteHeadRef) {
        baseSha = mergeBase(repoRoot, opts.headSha, remoteHeadRef);
      }
    }

    if (baseSha) {
      const patch = collectPatchForRange(repoRoot, baseSha, opts.headSha);
      if (patch.trim().length > 0) patchParts.push(patch);

      for (const f of collectFilesForRange(repoRoot, baseSha, opts.headSha)) {
        if (!f.path) continue;
        filesByPath.set(f.path, f);
      }

      for (const sha of listCommitShasForRange(repoRoot, baseSha, opts.headSha)) {
        commitSet.add(sha);
      }
    }
  }

  return {
    patch: patchParts.join("\n"),
    files: Array.from(filesByPath.values()),
    commitShas: Array.from(commitSet.values()),
    inferredBranch
  };
}
