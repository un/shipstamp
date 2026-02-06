import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const DEFAULT_INSTRUCTION_FILES = [
  "AGENTS.md",
  "agents.md",
  "codex.md",
  "claude.md",
  ".cursorrules"
];

const GitPreflightConfigSchema = z
  .object({
    // apiBaseUrl is intentionally NOT supported in v0; use env GITPREFLIGHT_API_BASE_URL.
    apiBaseUrl: z.never().optional(),
    instructionFiles: z.array(z.string().min(1)).optional(),
    timeoutMs: z.number().int().positive().optional(),
    linters: z
      .object({
        enabled: z.boolean().optional(),
        skipIfRepoAlreadyHasPrecommit: z.boolean().optional()
      })
      .optional()
  })
  .strict();

const PackageJsonSchema = z
  .object({
    gitpreflight: GitPreflightConfigSchema.optional()
  })
  .passthrough();

export type GitPreflightRepoConfig = {
  instructionFiles: string[];
  timeoutMs: number;
  linters: {
    enabled: boolean;
    skipIfRepoAlreadyHasPrecommit: boolean;
  };
};

export function loadGitPreflightRepoConfig(repoRoot: string): GitPreflightRepoConfig {
  const packageJsonPath = join(repoRoot, "package.json");

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    throw new Error(`Failed to read ${packageJsonPath}. GitPreflight expects a package.json at the repo root.`);
  }

  const parsed = PackageJsonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid ${packageJsonPath}: ${parsed.error.message}`);
  }

  const cfg = parsed.data.gitpreflight ?? {};

  // If someone still has apiBaseUrl set, produce a clearer error.
  // (The schema already rejects it, but this message is friendlier.)
  if ((raw as any)?.gitpreflight?.apiBaseUrl != null) {
    throw new Error(
      "package.json: gitpreflight.apiBaseUrl is not supported. Set GITPREFLIGHT_API_BASE_URL in your environment instead."
    );
  }

  return {
    instructionFiles: cfg.instructionFiles ?? DEFAULT_INSTRUCTION_FILES,
    timeoutMs: cfg.timeoutMs ?? 5 * 60 * 1000,
    linters: {
      enabled: cfg.linters?.enabled ?? true,
      skipIfRepoAlreadyHasPrecommit: cfg.linters?.skipIfRepoAlreadyHasPrecommit ?? true
    }
  };
}
