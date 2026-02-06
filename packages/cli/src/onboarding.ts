import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InstallStatus } from "./scopedInstall";

const NOTICE_MARKER = "onboarding-notice-v1";

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim().length > 0) return join(xdg, "gitpreflight");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "gitpreflight");
  return join(homedir(), ".config", "gitpreflight");
}

function markerPath() {
  return join(configDir(), NOTICE_MARKER);
}

export function hasShownOnboardingNotice(): boolean {
  return existsSync(markerPath());
}

export function markOnboardingNoticeShown() {
  const dir = configDir();
  mkdirSync(dir, { recursive: true });
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

  const quietCommands = new Set([undefined, "--help", "-h", "--version", "-v", "install", "status", "internal"]);
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
