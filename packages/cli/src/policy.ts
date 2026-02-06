import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GitPreflightPolicy = "required" | "optional" | "disabled";

export type EffectivePolicy = {
  policy: GitPreflightPolicy;
  source: "repo" | "local" | "global" | "default";
};

export type PolicyResolution = {
  effective: EffectivePolicy;
  configured: {
    repo: GitPreflightPolicy | null;
    local: GitPreflightPolicy | null;
    global: GitPreflightPolicy | null;
  };
  ignored: {
    local: boolean;
    global: boolean;
  };
};

function tryRunGit(args: string[], cwd?: string): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function parsePolicyValue(raw: string | null | undefined): GitPreflightPolicy | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "required" || v === "optional" || v === "disabled") return v;
  return null;
}

export function resolvePolicyFromValues(input: {
  repoPolicy: GitPreflightPolicy | null;
  localPolicy: GitPreflightPolicy | null;
  globalPolicy: GitPreflightPolicy | null;
}): EffectivePolicy {
  if (input.repoPolicy) return { policy: input.repoPolicy, source: "repo" };
  if (input.localPolicy) return { policy: input.localPolicy, source: "local" };
  if (input.globalPolicy) return { policy: input.globalPolicy, source: "global" };
  return { policy: "optional", source: "default" };
}

function readRepoPolicy(repoRoot: string): GitPreflightPolicy | null {
  const abs = join(repoRoot, "package.json");
  try {
    const parsed = JSON.parse(readFileSync(abs, "utf8")) as any;
    return parsePolicyValue(parsed?.gitpreflight?.policy);
  } catch {
    return null;
  }
}

export function resolveEffectivePolicy(repoRoot: string | null): EffectivePolicy {
  return resolvePolicy(repoRoot).effective;
}

export function resolvePolicy(repoRoot: string | null): PolicyResolution {
  const globalPolicy = parsePolicyValue(tryRunGit(["config", "--global", "--get", "gitpreflight.policy"]));
  if (!repoRoot) {
    const effective = resolvePolicyFromValues({ repoPolicy: null, localPolicy: null, globalPolicy });
    return {
      effective,
      configured: { repo: null, local: null, global: globalPolicy },
      ignored: { local: false, global: false }
    };
  }

  const localPolicy = parsePolicyValue(tryRunGit(["config", "--local", "--get", "gitpreflight.policy"], repoRoot));
  const repoPolicy = readRepoPolicy(repoRoot);
  const effective = resolvePolicyFromValues({ repoPolicy, localPolicy, globalPolicy });
  const ignoredLocal = effective.source === "repo" && localPolicy !== null;
  const ignoredGlobal = (effective.source === "repo" || effective.source === "local") && globalPolicy !== null;

  return {
    effective,
    configured: {
      repo: repoPolicy,
      local: localPolicy,
      global: globalPolicy
    },
    ignored: {
      local: ignoredLocal,
      global: ignoredGlobal
    }
  };
}
