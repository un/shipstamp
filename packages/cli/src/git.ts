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
