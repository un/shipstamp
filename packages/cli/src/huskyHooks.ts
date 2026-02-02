import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function ensureDir(absDir: string) {
  mkdirSync(absDir, { recursive: true });
}

function ensureExecutable(absPath: string) {
  try {
    chmodSync(absPath, 0o755);
  } catch {
    // best-effort
  }
}

function normalizeNewline(s: string) {
  return s.replaceAll("\r\n", "\n");
}

export function ensureHuskyHookAppends(repoRoot: string, hookName: string, shipstampLine: string) {
  const huskyDir = join(repoRoot, ".husky");
  ensureDir(huskyDir);

  const hookPath = join(huskyDir, hookName);
  const marker = "# shipstamp";

  if (!existsSync(hookPath)) {
    const contents =
      "#!/usr/bin/env sh\n" +
      '. "$(dirname "$0")/_/husky.sh"\n\n' +
      `${marker}\n` +
      `${shipstampLine}\n`;
    writeFileSync(hookPath, contents, "utf8");
    ensureExecutable(hookPath);
    return;
  }

  const before = normalizeNewline(readFileSync(hookPath, "utf8"));
  if (before.includes(shipstampLine)) return;

  const next = before.replace(/\s*$/, "\n\n") + `${marker}\n${shipstampLine}\n`;
  writeFileSync(hookPath, next, "utf8");
  ensureExecutable(hookPath);
}
