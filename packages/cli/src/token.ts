import { chmodSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGitPreflightConfigDir, getGitPreflightConfigDir, migrateLegacyMacConfigIfNeeded } from "./configPaths";

export type StoredToken = {
  token: string;
  createdAtMs: number;
};

function configDir(): string {
  return getGitPreflightConfigDir();
}

function tokenPath(): string {
  return join(configDir(), "token.json");
}

export function clearToken() {
  const abs = tokenPath();
  try {
    unlinkSync(abs);
  } catch {
    // ignore
  }
}

export function saveToken(token: string) {
  ensureGitPreflightConfigDir();
  const abs = tokenPath();
  const data: StoredToken = { token, createdAtMs: Date.now() };
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
  try {
    chmodSync(abs, 0o600);
  } catch {
    // best-effort
  }
}

export function loadToken(): string {
  migrateLegacyMacConfigIfNeeded();
  const abs = tokenPath();
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    const token = raw?.token;
    if (typeof token === "string" && token.length > 0) return token;
  } catch {
    // ignore
  }

  throw new Error("No GitPreflight token found. Run `gitpreflight auth login` first.");
}
