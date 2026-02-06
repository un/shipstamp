import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function getLegacyMacConfigDir(opts?: { homeDir?: string }): string {
  const home = opts?.homeDir ?? homedir();
  return join(home, "Library", "Application Support", "gitpreflight");
}

export function getGitPreflightConfigDir(opts?: {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}): string {
  const env = opts?.env ?? process.env;
  const home = opts?.homeDir ?? homedir();
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim().length > 0) return join(xdg, "gitpreflight");
  return join(home, ".config", "gitpreflight");
}

function copyMissingRecursively(fromDir: string, toDir: string) {
  mkdirSync(toDir, { recursive: true });
  for (const name of readdirSync(fromDir)) {
    const from = join(fromDir, name);
    const to = join(toDir, name);
    const stat = lstatSync(from);
    if (stat.isDirectory()) {
      copyMissingRecursively(from, to);
      continue;
    }
    if (existsSync(to)) continue;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

export function migrateLegacyMacConfigIfNeeded(opts?: {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}) {
  const platform = opts?.platform ?? process.platform;
  if (platform !== "darwin") return;
  const env = opts?.env ?? process.env;
  if (env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim().length > 0) return;

  const target = getGitPreflightConfigDir({ env, homeDir: opts?.homeDir });
  const legacy = getLegacyMacConfigDir({ homeDir: opts?.homeDir });
  if (target === legacy) return;
  if (!existsSync(legacy)) return;

  copyMissingRecursively(legacy, target);
}

export function ensureGitPreflightConfigDir() {
  migrateLegacyMacConfigIfNeeded();
  mkdirSync(getGitPreflightConfigDir(), { recursive: true });
}
