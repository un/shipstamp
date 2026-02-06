import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGitPreflightConfigDir, getLegacyMacConfigDir, migrateLegacyMacConfigIfNeeded } from "../src/configPaths";

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "gitpreflight-config-paths-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("config paths", () => {
  it("uses XDG_CONFIG_HOME when provided", () => {
    const home = makeTempDir();
    const xdg = makeTempDir();
    const out = getGitPreflightConfigDir({ homeDir: home, env: { XDG_CONFIG_HOME: xdg } as NodeJS.ProcessEnv });
    expect(out).toBe(join(xdg, "gitpreflight"));
  });

  it("uses ~/.config/gitpreflight when XDG_CONFIG_HOME is missing", () => {
    const home = makeTempDir();
    const out = getGitPreflightConfigDir({ homeDir: home, env: {} as NodeJS.ProcessEnv });
    expect(out).toBe(join(home, ".config", "gitpreflight"));
  });

  it("migrates legacy macOS config files into ~/.config", () => {
    const home = makeTempDir();
    const legacyDir = getLegacyMacConfigDir({ homeDir: home });
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, "token.json"), '{"token":"abc"}\n', "utf8");

    migrateLegacyMacConfigIfNeeded({ platform: "darwin", homeDir: home, env: {} as NodeJS.ProcessEnv });

    const targetDir = getGitPreflightConfigDir({ homeDir: home, env: {} as NodeJS.ProcessEnv });
    const targetToken = join(targetDir, "token.json");
    expect(existsSync(targetToken)).toBeTrue();
    expect(readFileSync(targetToken, "utf8")).toContain("abc");
  });
});
