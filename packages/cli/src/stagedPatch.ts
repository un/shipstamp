import { execFileSync } from "node:child_process";

export function collectStagedPatch(repoRoot: string, contextLines = 3): string {
  const out = execFileSync(
    "git",
    [
      "diff",
      "--cached",
      "--patch",
      "--no-color",
      "--no-ext-diff",
      `--unified=${contextLines}`,
      "--find-renames"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  return out;
}
