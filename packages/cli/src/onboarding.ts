import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InstallStatus } from "./scopedInstall";
import { ensureGitPreflightConfigDir, getGitPreflightConfigDir, migrateLegacyMacConfigIfNeeded } from "./configPaths";

const NOTICE_MARKER = "onboarding-notice-v1";

function configDir(): string {
  return getGitPreflightConfigDir();
}

function markerPath() {
  return join(configDir(), NOTICE_MARKER);
}

export function hasShownOnboardingNotice(): boolean {
  migrateLegacyMacConfigIfNeeded();
  return existsSync(markerPath());
}

export function markOnboardingNoticeShown() {
  ensureGitPreflightConfigDir();
  writeFileSync(markerPath(), `${Date.now()}\n`, "utf8");
}

export function shouldShowOnboardingNotice(opts: {
  cmd: string | undefined;
  inCi: boolean;
  inHook: boolean;
  status: InstallStatus;
}): boolean {
  if (opts.inCi || opts.inHook) return false;
  if (hasShownOnboardingNotice()) return false;
  if (opts.status.effectiveScope) return false;

  const quietCommands = new Set([undefined, "--help", "-h", "--version", "-v", "install", "status", "setup", "auth", "internal"]);
  if (quietCommands.has(opts.cmd)) return false;

  return true;
}

export function onboardingNoticeText() {
  return [
    "GitPreflight is installed but not configured yet.",
    "Run `gitpreflight install` to choose setup mode (global, local, or repo).",
    "Tip: `gitpreflight install --scope local --yes` for non-interactive setup."
  ].join("\n");
}
