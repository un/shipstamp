import { ensureHuskyHookAppends } from "./huskyHooks";
import {
  getGitPreflightPostCommitHookLine,
  getGitPreflightPushReviewHookLine,
  getGitPreflightReviewHookLine
} from "./hookCommand";
import { readPackageJson, writePackageJson } from "./packageJson";

function ensureScripts(pkg: any): Record<string, string> {
  if (!pkg.scripts || typeof pkg.scripts !== "object") pkg.scripts = {};
  return pkg.scripts as Record<string, string>;
}

function ensureDevDependencies(pkg: any): Record<string, string> {
  if (!pkg.devDependencies || typeof pkg.devDependencies !== "object") pkg.devDependencies = {};
  return pkg.devDependencies as Record<string, string>;
}

function ensurePrepareIncludesHuskyInstall(scripts: Record<string, string>) {
  const want = "husky install";
  const current = scripts.prepare;

  if (!current) {
    scripts.prepare = want;
    return;
  }

  if (current.includes("husky install")) return;
  scripts.prepare = `${current} && ${want}`;
}

export type InitResult = {
  updatedPackageJson: boolean;
  createdOrUpdatedHooks: boolean;
};

export type InitHookMode = "pre-commit" | "pre-push" | "both";

export type InitOptions = {
  hook?: InitHookMode;
};

export function initRepo(repoRoot: string, opts: InitOptions = {}): InitResult {
  const pkg = readPackageJson(repoRoot);

  const scripts = ensureScripts(pkg);
  const devDeps = ensureDevDependencies(pkg);

  // v0: ensure team members get hooks on install.
  ensurePrepareIncludesHuskyInstall(scripts);

  // v0: ensure Husky and GitPreflight are present as dev deps.
  if (!devDeps.husky) devDeps.husky = "^9.0.0";
  if (!devDeps.gitpreflight) devDeps.gitpreflight = "^0.0.0";

  writePackageJson(repoRoot, pkg);

  const hook = opts.hook ?? "pre-commit";

  if (hook === "pre-commit" || hook === "both") {
    // Pre-commit hook (append-only, idempotent).
    const reviewLine = getGitPreflightReviewHookLine(repoRoot);
    ensureHuskyHookAppends(repoRoot, "pre-commit", reviewLine);

    // Post-commit hook reserved for unchecked backlog capture.
    const postCommitLine = getGitPreflightPostCommitHookLine(repoRoot);
    ensureHuskyHookAppends(repoRoot, "post-commit", postCommitLine);
  }

  if (hook === "pre-push" || hook === "both") {
    const pushReviewLine = getGitPreflightPushReviewHookLine(repoRoot);
    ensureHuskyHookAppends(repoRoot, "pre-push", pushReviewLine);
  }

  return {
    updatedPackageJson: true,
    createdOrUpdatedHooks: true
  };
}
