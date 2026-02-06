import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type StoredToken = {
  token: string;
  createdAtMs: number;
};

function ensureDir(absDir: string) {
  mkdirSync(absDir, { recursive: true });
}

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim().length > 0) return join(xdg, "gitpreflight");

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "gitpreflight");
  }

  return join(homedir(), ".config", "gitpreflight");
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
  const dir = configDir();
  ensureDir(dir);
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
