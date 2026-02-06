import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chmodSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { getInstallStatus, installLocalScope } from "../src/scopedInstall";
import { resolvePolicy } from "../src/policy";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "gitpreflight-cli-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync("git", args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function setupRepo(repoRoot: string) {
  git(repoRoot, ["init"]);
  git(repoRoot, ["config", "user.email", "dev@example.com"]);
  git(repoRoot, ["config", "user.name", "Dev"]);
  git(repoRoot, ["config", "commit.gpgsign", "false"]);
  writeFileSync(
    join(repoRoot, "package.json"),
    JSON.stringify({ name: "tmp-repo", version: "1.0.0", private: true }, null, 2) + "\n",
    "utf8"
  );
  git(repoRoot, ["add", "package.json"]);
  git(repoRoot, ["commit", "-m", "init"]);
}

function makeFakeGitpreflightBin(baseDir: string): { binDir: string; logFile: string } {
  const binDir = join(baseDir, "fake-bin");
  mkdirSync(binDir, { recursive: true });
  const logFile = join(baseDir, "gitpreflight-hook.log");
  const scriptPath = join(binDir, "gitpreflight");
  const script = [
    "#!/usr/bin/env sh",
    `echo \"$@\" >> \"${logFile}\"`,
    "exit 0"
  ].join("\n");
  writeFileSync(scriptPath, script, "utf8");
  chmodSync(scriptPath, 0o755);
  return { binDir, logFile };
}

describe("scoped install integration", () => {
  it("runs pre-commit hook through local scoped install", () => {
    withTempDir((dir) => {
      const repoRoot = join(dir, "repo");
      mkdirSync(repoRoot, { recursive: true });
      setupRepo(repoRoot);

      const { binDir, logFile } = makeFakeGitpreflightBin(dir);
      installLocalScope(repoRoot, { hook: "pre-commit" });

      // Local install should not touch tracked files.
      const status = git(repoRoot, ["status", "--porcelain"]);
      expect(status).toBe("");

      writeFileSync(join(repoRoot, "a.txt"), "hello\n", "utf8");
      git(repoRoot, ["add", "a.txt"]);

      const commit = spawnSync("git", ["commit", "-m", "test local hook"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`
        }
      });

      expect(commit.status).toBe(0);
      const log = readFileSync(logFile, "utf8");
      expect(log.includes("review --staged")).toBeTrue();
    });
  });

  it("runs pre-push hook through local scoped install", () => {
    withTempDir((dir) => {
      const repoRoot = join(dir, "repo");
      const remoteRoot = join(dir, "remote.git");
      mkdirSync(repoRoot, { recursive: true });
      setupRepo(repoRoot);

      git(dir, ["init", "--bare", remoteRoot]);
      git(repoRoot, ["remote", "add", "origin", remoteRoot]);

      const { binDir, logFile } = makeFakeGitpreflightBin(dir);
      installLocalScope(repoRoot, { hook: "pre-push" });

      const push = spawnSync("git", ["push", "-u", "origin", "HEAD"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`
        }
      });

      expect(push.status).toBe(0);
      const log = readFileSync(logFile, "utf8");
      expect(log.includes("review --push")).toBeTrue();
    });
  });

  it("keeps repo required policy over local disabled override", () => {
    withTempDir((dir) => {
      const repoRoot = join(dir, "repo");
      mkdirSync(repoRoot, { recursive: true });

      git(repoRoot, ["init"]);
      writeFileSync(
        join(repoRoot, "package.json"),
        JSON.stringify(
          {
            name: "tmp-repo",
            version: "1.0.0",
            private: true,
            gitpreflight: {
              policy: "required"
            }
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      git(repoRoot, ["config", "--local", "gitpreflight.policy", "disabled"]);
      const policy = resolvePolicy(repoRoot);

      expect(policy.effective.policy).toBe("required");
      expect(policy.effective.source).toBe("repo");
      expect(policy.ignored.local).toBeTrue();
    });
  });

  it("status resolves local install as effective when enabled", () => {
    withTempDir((dir) => {
      const repoRoot = join(dir, "repo");
      mkdirSync(repoRoot, { recursive: true });
      setupRepo(repoRoot);

      installLocalScope(repoRoot, { hook: "pre-commit" });
      const status = getInstallStatus(repoRoot);
      expect(status.local.installed).toBeTrue();
      expect(status.effectiveScope).toBe("local");
    });
  });
});
