import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { getGitPreflightConfigDir, getLegacyMacConfigDir } from "./configPaths";
import { initRepo, type InitHookMode } from "./init";

export type InstallScope = "global" | "local" | "repo";

export type InstallStatus = {
  global: {
    installed: boolean;
    hooksPath: string | null;
    managedHooksPath: string;
  };
  local: {
    installed: boolean;
    hooksPath: string | null;
    managedHooksPath: string | null;
  };
  repo: {
    installed: boolean;
  };
  effectiveScope: InstallScope | null;
};

function configDir(): string {
  return getGitPreflightConfigDir();
}

function ensureDir(absDir: string) {
  mkdirSync(absDir, { recursive: true });
}

function normalizeNewline(s: string) {
  return s.replaceAll("\r\n", "\n");
}

function ensureHookContains(hooksDir: string, hookName: string, hookLine: string) {
  ensureDir(hooksDir);
  const hookPath = join(hooksDir, hookName);
  const marker = "# gitpreflight";

  if (!existsSync(hookPath)) {
    const contents = "#!/usr/bin/env sh\n" + `${marker}\n` + `${hookLine}\n`;
    writeFileSync(hookPath, contents, "utf8");
    try {
      chmodSync(hookPath, 0o755);
    } catch {
      // best-effort
    }
    return;
  }

  const before = normalizeNewline(readFileSync(hookPath, "utf8"));
  if (before.includes(hookLine)) return;
  const next = before.replace(/\s*$/, "\n\n") + `${marker}\n${hookLine}\n`;
  writeFileSync(hookPath, next, "utf8");
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // best-effort
  }
}

function runGit(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function tryRunGit(args: string[], cwd?: string): string | null {
  try {
    const out = runGit(args, cwd);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function globalManagedHooksPath(): string {
  return resolve(join(configDir(), "hooks"));
}

function legacyGlobalManagedHooksPath(): string | null {
  if (process.platform !== "darwin") return null;
  if (process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.trim().length > 0) return null;
  return resolve(join(getLegacyMacConfigDir(), "hooks"));
}

function localManagedHooksPath(repoRoot: string): string {
  return resolve(join(repoRoot, ".git", "gitpreflight", "hooks"));
}

function toAbsoluteHooksPath(repoRoot: string, hooksPath: string): string {
  return isAbsolute(hooksPath) ? resolve(hooksPath) : resolve(join(repoRoot, hooksPath));
}

function hookLinePreCommit(): string {
  return "GITPREFLIGHT_HOOK=1 GITPREFLIGHT_UI=plain gitpreflight review --staged";
}

function hookLinePrePush(): string {
  return "GITPREFLIGHT_HOOK=1 GITPREFLIGHT_UI=plain gitpreflight review --push \"$@\"";
}

function hookLinePostCommit(): string {
  return "GITPREFLIGHT_HOOK=1 GITPREFLIGHT_UI=plain gitpreflight internal post-commit";
}

function installHooksInDir(hooksDir: string, hook: InitHookMode) {
  if (hook === "pre-commit" || hook === "both") {
    ensureHookContains(hooksDir, "pre-commit", hookLinePreCommit());
    ensureHookContains(hooksDir, "post-commit", hookLinePostCommit());
  }
  if (hook === "pre-push" || hook === "both") {
    ensureHookContains(hooksDir, "pre-push", hookLinePrePush());
  }
}

export function installGlobalScope(opts: { hook: InitHookMode }) {
  const managed = globalManagedHooksPath();
  const legacyManaged = legacyGlobalManagedHooksPath();
  const current = tryRunGit(["config", "--global", "--get", "core.hooksPath"]);
  if (current) {
    const currentAbs = isAbsolute(current) ? resolve(current) : resolve(join(homedir(), current));
    if (currentAbs !== managed && currentAbs !== legacyManaged) {
      throw new Error(
        `Global core.hooksPath is already set to '${current}'. Refusing to overwrite. Unset it first or use a different install scope.`
      );
    }
  }

  installHooksInDir(managed, opts.hook);
  runGit(["config", "--global", "core.hooksPath", managed]);
}

export function uninstallGlobalScope() {
  const managed = globalManagedHooksPath();
  const legacyManaged = legacyGlobalManagedHooksPath();
  const current = tryRunGit(["config", "--global", "--get", "core.hooksPath"]);
  if (!current) return;
  const currentAbs = isAbsolute(current) ? resolve(current) : resolve(join(homedir(), current));
  if (currentAbs !== managed && currentAbs !== legacyManaged) return;
  runGit(["config", "--global", "--unset", "core.hooksPath"]);
}

export function installLocalScope(repoRoot: string, opts: { hook: InitHookMode }) {
  const managed = localManagedHooksPath(repoRoot);
  const current = tryRunGit(["config", "--local", "--get", "core.hooksPath"], repoRoot);
  if (current) {
    const currentAbs = toAbsoluteHooksPath(repoRoot, current);
    if (currentAbs !== managed) {
      throw new Error(
        `Local core.hooksPath is already set to '${current}'. Refusing to overwrite. Unset it first or use repo scope.`
      );
    }
  }

  installHooksInDir(managed, opts.hook);
  runGit(["config", "--local", "core.hooksPath", managed], repoRoot);
}

export function uninstallLocalScope(repoRoot: string) {
  const managed = localManagedHooksPath(repoRoot);
  const current = tryRunGit(["config", "--local", "--get", "core.hooksPath"], repoRoot);
  if (!current) return;
  const currentAbs = toAbsoluteHooksPath(repoRoot, current);
  if (currentAbs !== managed) return;
  runGit(["config", "--local", "--unset", "core.hooksPath"], repoRoot);
}

export function installRepoScope(repoRoot: string, opts: { hook: InitHookMode }) {
  initRepo(repoRoot, { hook: opts.hook });
}

function repoHuskyHasGitPreflight(repoRoot: string): boolean {
  const preCommitPath = join(repoRoot, ".husky", "pre-commit");
  const prePushPath = join(repoRoot, ".husky", "pre-push");
  try {
    const preCommit = existsSync(preCommitPath) ? readFileSync(preCommitPath, "utf8") : "";
    const prePush = existsSync(prePushPath) ? readFileSync(prePushPath, "utf8") : "";
    return preCommit.includes("gitpreflight review --staged") || prePush.includes("gitpreflight review --push");
  } catch {
    return false;
  }
}

export function getInstallStatus(repoRoot: string | null): InstallStatus {
  const globalPath = tryRunGit(["config", "--global", "--get", "core.hooksPath"]);
  const managedGlobal = globalManagedHooksPath();
  const legacyManagedGlobal = legacyGlobalManagedHooksPath();
  const globalInstalled = Boolean(
    globalPath &&
      (() => {
        const resolved = isAbsolute(globalPath) ? resolve(globalPath) : resolve(join(homedir(), globalPath));
        return resolved === managedGlobal || resolved === legacyManagedGlobal;
      })()
  );

  let localPath: string | null = null;
  let managedLocal: string | null = null;
  let localInstalled = false;
  let repoInstalled = false;

  if (repoRoot) {
    localPath = tryRunGit(["config", "--local", "--get", "core.hooksPath"], repoRoot);
    managedLocal = localManagedHooksPath(repoRoot);
    localInstalled = Boolean(localPath && toAbsoluteHooksPath(repoRoot, localPath) === managedLocal);
    repoInstalled = repoHuskyHasGitPreflight(repoRoot);
  }

  const effectiveScope: InstallScope | null = repoInstalled ? "repo" : localInstalled ? "local" : globalInstalled ? "global" : null;

  return {
    global: {
      installed: globalInstalled,
      hooksPath: globalPath,
      managedHooksPath: managedGlobal
    },
    local: {
      installed: localInstalled,
      hooksPath: localPath,
      managedHooksPath: managedLocal
    },
    repo: {
      installed: repoInstalled
    },
    effectiveScope
  };
}
