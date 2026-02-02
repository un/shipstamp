import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type HashedFile = {
  path: string;
  sha256: string;
};

export type HashFilesResult = {
  hashed: HashedFile[];
  missing: string[];
};

export function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function hashFilesSha256(repoRoot: string, repoRelativePaths: string[]): HashFilesResult {
  const hashed: HashedFile[] = [];
  const missing: string[] = [];

  for (const p of repoRelativePaths) {
    try {
      const abs = join(repoRoot, p);
      const buf = readFileSync(abs);
      hashed.push({ path: p, sha256: sha256Bytes(buf) });
    } catch {
      missing.push(p);
    }
  }

  return {
    hashed,
    missing
  };
}
