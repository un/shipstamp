import { execFileSync } from "node:child_process";

export type StagedChangeType = "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";

export type StagedFile = {
  changeType: StagedChangeType;
  path: string;
  oldPath?: string;
  isBinary: boolean;
};

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

function collectBinaryPaths(repoRoot: string): Set<string> {
  const out = execFileSync("git", ["diff", "--cached", "--numstat", "--find-renames"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

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

export function collectStagedFiles(repoRoot: string): StagedFile[] {
  const binaryPaths = collectBinaryPaths(repoRoot);

  const out = execFileSync("git", ["diff", "--cached", "--name-status", "-z", "--find-renames"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

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
