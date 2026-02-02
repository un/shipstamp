import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STRONG_PRECOMMIT_MARKERS = [
  "lint-staged",
  "@biomejs/biome",
  "biome",
  "eslint",
  "prettier",
  "lefthook"
];

function fileContainsAny(absPath: string, needles: string[]): boolean {
  try {
    const txt = readFileSync(absPath, "utf8");
    return needles.some((n) => txt.includes(n));
  } catch {
    return false;
  }
}

export function repoHasExistingPrecommitLinting(repoRoot: string): boolean {
  // Only return true on strong signals; do not skip when uncertain.

  const huskyPreCommit = join(repoRoot, ".husky", "pre-commit");
  if (existsSync(huskyPreCommit) && fileContainsAny(huskyPreCommit, STRONG_PRECOMMIT_MARKERS)) {
    return true;
  }

  const lefthookYml = join(repoRoot, "lefthook.yml");
  const lefthookYaml = join(repoRoot, "lefthook.yaml");
  if (
    (existsSync(lefthookYml) && fileContainsAny(lefthookYml, STRONG_PRECOMMIT_MARKERS)) ||
    (existsSync(lefthookYaml) && fileContainsAny(lefthookYaml, STRONG_PRECOMMIT_MARKERS))
  ) {
    return true;
  }

  // Presence of lint-staged config alone is not strong enough; a repo may use it elsewhere.
  return false;
}
