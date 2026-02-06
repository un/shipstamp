import { formatReviewResultMarkdown, GITPREFLIGHT_CORE_VERSION } from "@gitpreflight/core";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import {
  getBranchName,
  getDefaultBranchFromOrigin,
  getHeadSha,
  getOriginUrl,
  getRepoRoot,
  normalizeOriginUrl
} from "./git";
import { loadGitPreflightRepoConfig } from "./repoConfig";
import { collectStagedFiles } from "./staged";
import { collectStagedPatch } from "./stagedPatch";
import { discoverInstructionFiles } from "./instructions";
import { hashFilesSha256 } from "./hash";
import {
  clearSkipNext,
  readPendingState,
  readSkipNext,
  writePendingNextCommit,
  writePendingState,
  writeSkipNext
} from "./state";
import { repoHasExistingPrecommitLinting } from "./precommitDetection";
import { getGitPreflightEnv } from "./env";
import { detectLinters } from "./lintersDetect";
import { selectStagedFilesForLinters } from "./linterFiles";
import { detectPackageManager } from "./packageManager";
import { runLintersInCheckMode } from "./runLinters";
import { initRepo, type InitHookMode } from "./init";
import { isOfflineOrTimeoutError } from "./errors";
import { runPostCommit } from "./postCommit";
import { deviceAuthLogin } from "./deviceAuth";
import { loadToken } from "./token";
import { readTextFile } from "./files";
import { loadRepoEnv } from "./dotenvFile";
import { GitPreflightApiClient, GitPreflightApiError } from "./apiClient";
import { assertSourceBuild, GITPREFLIGHT_OFFICIAL_BUILD } from "./buildFlags";
import { emitMarkdown, resolveGitPreflightUi } from "./ui";
import { GITPREFLIGHT_CLI_VERSION } from "./version";
import { collectPushReviewInputFromHook, parsePrePushStdin } from "./pushReview";

function printHelp() {
  process.stdout.write(
    [
      `gitpreflight ${GITPREFLIGHT_CLI_VERSION} — core ${GITPREFLIGHT_CORE_VERSION}`,
      "",
      "Usage:",
      "  gitpreflight <command> [options]",
      "",
      "Commands:",
      "  review --staged        Review staged changes",
      "  review --push          Review commits being pushed",
      "  init [--hook ...]      Install git hooks + config (v0: stub)",
      "  auth login             Authenticate the CLI (v0: stub)",
      "  skip-next --reason ... Bypass next hook run (v0: stub)",
      "",
      "Global options:",
      "  -h, --help             Show help",
      "  -v, --version          Show version",
      ""
    ].join("\n")
  );
}

function printVersion() {
  process.stdout.write(`${GITPREFLIGHT_CLI_VERSION}\n`);
}

function unknownCommand(cmd: string | undefined) {
  if (!cmd) {
    printHelp();
    return 0;
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  printHelp();
  return 2;
}

async function cmdReview(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      staged: { type: "boolean" },
      push: { type: "boolean" },
      "local-agent": { type: "boolean" },
      tui: { type: "boolean" },
      plain: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    const localAgent = GITPREFLIGHT_OFFICIAL_BUILD ? "" : " [--local-agent]";
    process.stdout.write(`Usage: gitpreflight review (--staged|--push)${localAgent} [--tui|--plain]\n`);
    return 0;
  }

  const wantsStaged = Boolean((parsed.values as any).staged);
  const wantsPush = Boolean((parsed.values as any).push);

  if ((wantsStaged && wantsPush) || (!wantsStaged && !wantsPush)) {
    process.stderr.write("Missing required flag: --staged or --push\n");
    return 2;
  }

  const mode: "staged" | "push" = wantsPush ? "push" : "staged";

  // Ensure we're inside a git repo early.
  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const headSha = getHeadSha(repoRoot);
  if (mode === "push" && !headSha) {
    process.stderr.write("Cannot review push changes in an empty repo (no commits).\n");
    return 2;
  }

  const pushArgs = parsed.positionals;
  const pushRemoteName = mode === "push" ? (pushArgs[0] ?? "origin") : "origin";

  const pushStdin = (() => {
    if (mode !== "push") return "";
    if (process.stdin.isTTY) return "";
    const probablyInHook = process.env.GITPREFLIGHT_HOOK === "1" || Boolean(process.env.GIT_DIR) || pushArgs.length > 0;
    if (!probablyInHook) return "";
    try {
      return readFileSync(0, "utf8");
    } catch {
      return "";
    }
  })();

  const branchFromPush = (() => {
    if (mode !== "push") return null;
    const updates = parsePrePushStdin(pushStdin)
      .map((u) => u.localRef)
      .filter((r) => r.startsWith("refs/heads/"))
      .map((r) => r.replace(/^refs\/heads\//, ""));
    return updates.length === 1 ? updates[0]! : null;
  })();

  const branch = branchFromPush ?? getBranchName() ?? "(detached)";

  const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";

  const env = process.env;
  const inCi = env.CI === "1" || env.CI === "true" || env.GITHUB_ACTIONS === "1" || env.GITHUB_ACTIONS === "true";
  const inHook = env.GITPREFLIGHT_HOOK === "1" || Boolean(env.GIT_DIR);
  const stdoutIsTty = Boolean(process.stdout.isTTY);
  const ui = resolveGitPreflightUi({
    inCi,
    inHook,
    stdoutIsTty,
    isBunRuntime,
    argv: { plain: Boolean((parsed.values as any).plain), tui: Boolean((parsed.values as any).tui) },
    env
  });

  const emit = async (md: string) => {
    await emitMarkdown({ ui, markdown: md });
  };

  const skip = readSkipNext(repoRoot);
  if (skip) {
    clearSkipNext(repoRoot);
    const md = formatReviewResultMarkdown({
      status: "PASS",
      findings: [
        {
          path: "package.json",
          severity: "note",
          title: "GitPreflight skipped",
          message: `GitPreflight skipped this run (skip-next). Reason: ${skip.reason}`
        }
      ]
    });
    await emit(md);
    return 0;
  }

  const pending = readPendingState(repoRoot);
  const pendingOnBranch = pending.branches[branch] ?? [];
  if (pendingOnBranch.length > 0) {
    const list = pendingOnBranch.map((p) => `- ${p.sha}${p.reason ? ` (${p.reason})` : ""}`).join("\n");
    const md = formatReviewResultMarkdown({
      status: "FAIL",
      findings: [
        {
          path: "package.json",
          severity: "minor",
          title: "Unchecked backlog on this branch",
          message:
            (mode === "push"
              ? "GitPreflight previously allowed one or more pushes without a completed review (offline/timeout).\n\n"
              : "GitPreflight previously allowed one or more commits without a completed review (offline/timeout).\n\n") +
            "Unchecked commits:\n" +
            `${list}\n\n` +
            "To proceed, either:\n" +
            "- Run `gitpreflight skip-next --reason \"...\"` to bypass once, or\n" +
            (mode === "push" ? "- Use `git push --no-verify` to bypass hooks\n" : "- Use `git commit --no-verify` to bypass hooks\n")
        }
      ]
    });
    await emit(md);
    return 1;
  }

  try {
    const repoConfig = loadGitPreflightRepoConfig(repoRoot);
    const useLocalAgent = Boolean((parsed.values as any)["local-agent"]);

    const reviewInput =
      mode === "staged"
        ? {
            patch: collectStagedPatch(repoRoot),
            files: collectStagedFiles(repoRoot),
            commitShas: [] as string[]
          }
        : collectPushReviewInputFromHook(repoRoot, {
            remoteName: pushRemoteName,
            stdin: pushStdin,
            headSha: headSha!
          });

    const reviewFiles = reviewInput.files;
    const reviewPatch = reviewInput.patch;
    const pushCommitShas = reviewInput.commitShas;

    const changedPaths = reviewFiles
      .filter((f) => f.path && f.changeType !== "deleted")
      .map((f) => f.path);

    let instructionFilenames = repoConfig.instructionFiles;
    let discovered = discoverInstructionFiles(repoRoot, changedPaths, instructionFilenames);
    void hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles);

    const detectedLinters = detectLinters(repoRoot);
    const selected = selectStagedFilesForLinters(reviewFiles, detectedLinters);

    const pm = detectPackageManager(repoRoot);

    let findings: Array<import("@gitpreflight/core").Finding> = [];

    if (GITPREFLIGHT_OFFICIAL_BUILD && useLocalAgent) {
      findings.push({
        path: "package.json",
        severity: "minor",
        title: "Local-agent mode disabled",
        message: "Local-agent mode is disabled in official GitPreflight builds. Build from source to enable source-only features."
      });

      const md = formatReviewResultMarkdown({ status: "FAIL", findings });
      await emit(md);
      return 1;
    }

    const repoEnv = loadRepoEnv(repoRoot);
    const mergedEnv = { ...process.env, ...repoEnv } as NodeJS.ProcessEnv;

    let apiBaseUrl: string | null = null;
    if (!useLocalAgent) {
      try {
        apiBaseUrl = getGitPreflightEnv(mergedEnv).GITPREFLIGHT_API_BASE_URL;
      } catch (err) {
        findings.push({
          path: "package.json",
          severity: "minor",
          title: "Missing required environment",
          message:
            "GitPreflight needs GITPREFLIGHT_API_BASE_URL to contact the GitPreflight API (separate app/domain).\n\n" +
            "Set it in your environment, e.g.:\n\n" +
            "`export GITPREFLIGHT_API_BASE_URL=https://api.gitpreflight.example`\n\n" +
            `Error: ${(err as Error).message}`
        });
      }
    }

    if (apiBaseUrl) {
      let token: string | null = null;
      try {
        token = loadToken();
      } catch {
        findings.push({
          path: "package.json",
          severity: "minor",
          title: "Not authenticated",
              message: "Run `gitpreflight auth login` to authenticate the CLI."
        });
      }

      if (token) {
        // Best-effort: pull org-managed instruction filenames.
        try {
          const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
          const settings = await apiClient.getJson<{ instructionFilenames?: string[] }>("/api/v1/orgs/settings");
          if (Array.isArray(settings.instructionFilenames) && settings.instructionFilenames.length > 0) {
            instructionFilenames = settings.instructionFilenames;
            discovered = discoverInstructionFiles(repoRoot, changedPaths, instructionFilenames);
          }
        } catch {
          // ignore
        }

        const originUrl = getOriginUrl(repoRoot);
        if (!originUrl) {
          findings.push({
            path: ".git/config",
            severity: "minor",
            title: "Missing git remote origin",
            message:
              "GitPreflight identifies repositories by `remote.origin.url`. Configure a remote named `origin` (e.g. `git remote add origin ...`) and try again."
          });
        }

        // Best-effort instruction sync (never blocks review).
        try {
          const hashed = hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles);
          const files = hashed.hashed.map((h) => ({ path: h.path, sha256: h.sha256 }));

          const checkRes = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/instructions/check`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ files })
          });

          if (checkRes.ok) {
            const payload = (await checkRes.json()) as { missing: Array<{ path: string; sha256: string }> };
            const missingFiles = payload.missing ?? [];
            if (missingFiles.length > 0) {
              const uploadFiles = missingFiles.map((m) => ({
                path: m.path,
                sha256: m.sha256,
                content: readTextFile(repoRoot, m.path)
              }));

              await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/instructions/upload`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ files: uploadFiles })
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (repoConfig.linters.enabled) {
      const hasPrecommitLinting = repoHasExistingPrecommitLinting(repoRoot);
      if (!repoConfig.linters.skipIfRepoAlreadyHasPrecommit || !hasPrecommitLinting) {
        findings = findings.concat(
          runLintersInCheckMode({
            repoRoot,
            detected: detectedLinters,
            selectedFiles: selected,
            packageManager: pm,
            timeoutMs: repoConfig.timeoutMs
          })
        );
      }
    }

    // Local blockers (env/auth/linters) should still block before the network call.
    if (findings.some((f) => f.severity === "minor" || f.severity === "major")) {
      const md = formatReviewResultMarkdown({ status: "FAIL", findings });
      await emit(md);
      return 1;
    }

    if (!GITPREFLIGHT_OFFICIAL_BUILD && useLocalAgent) {
      try {
        assertSourceBuild("Local-agent mode");
      } catch (err) {
        findings.push({
          path: "package.json",
          severity: "minor",
          title: "Local-agent mode disabled",
          message: (err as Error).message
        });
      }

      const cmd = mergedEnv.GITPREFLIGHT_LOCAL_AGENT_COMMAND;
      if (!cmd || cmd.trim().length === 0) {
        findings.push({
          path: ".env.local",
          severity: "minor",
          title: "Missing local agent command",
          message:
            "Set GITPREFLIGHT_LOCAL_AGENT_COMMAND to a command that reads the prompt from stdin and prints GitPreflight Markdown to stdout.\n\n" +
            "Example:\n\n" +
            "`export GITPREFLIGHT_LOCAL_AGENT_COMMAND=\"opencode run\"`"
        });
      }

      if (findings.some((f) => f.severity === "minor" || f.severity === "major")) {
        const md = formatReviewResultMarkdown({ status: "FAIL", findings });
        await emit(md);
        return 1;
      }

      const instructionSections = hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles).hashed
        .map((h) => {
          const content = readTextFile(repoRoot, h.path);
          const clipped = content.length > 20_000 ? `${content.slice(0, 20_000)}\n\n(…truncated)` : content;
          return `--- ${h.path} ---\n${clipped.trimEnd()}\n--- end ${h.path} ---`;
        })
        .join("\n\n");

      const prompt =
        `You are GitPreflight in local-agent mode. Review ONLY the ${mode === "push" ? "push" : "staged"} patch.\n` +
        "Output MUST follow the GitPreflight Markdown contract:\n" +
        "- Start with '# GitPreflight Review'\n" +
        "- Include 'Result: PASS|FAIL|UNCHECKED'\n" +
        "- Include 'Counts: note=<n> minor=<n> major=<n>'\n" +
        "- Include '## Findings' grouped by file\n" +
        "- For each finding include Path/Severity/Agreement lines and optional ```suggestion blocks\n\n" +
        (instructionSections ? `Instruction files:\n\n${instructionSections}\n\n` : "") +
        `${mode === "push" ? "Push patch" : "Staged patch"}:\n${reviewPatch}`;

      const { runLocalAgentMarkdownReview } = await import("./localAgent");
      const local = runLocalAgentMarkdownReview({
        command: cmd!,
        cwd: repoRoot,
        timeoutMs: repoConfig.timeoutMs,
        prompt
      });

      if (!local.ok) {
        const md = formatReviewResultMarkdown({
          status: "FAIL",
          findings: [
            {
              path: "package.json",
              severity: "minor",
              title: "Local agent review failed",
              message: local.errorMessage
            }
          ]
        });
        await emit(md);
        return 1;
      }

      await emit(local.markdown);
      return local.status === "FAIL" ? 1 : 0;
    }

    // SaaS review: send staged patch to server.
    if (apiBaseUrl) {
      const token = (() => {
        try {
          return loadToken();
        } catch {
          return null;
        }
      })();

      if (token) {
        const originUrl = getOriginUrl(repoRoot);
        const normalizedOriginUrl = originUrl ? normalizeOriginUrl(originUrl) : null;
        const defaultBranch = getDefaultBranchFromOrigin(repoRoot);

        if (originUrl && normalizedOriginUrl) {
          // Best-effort: register the repo (non-blocking).
          try {
            const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
            await apiClient.postJson<{ repoId: string }>("/api/v1/repos/register", {
              originUrl,
              normalizedOriginUrl,
              defaultBranch: defaultBranch ?? undefined
            });
          } catch {
            // ignore
          }
        }

        const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
        try {
          const remote = await apiClient.postJson<import("@gitpreflight/core").ReviewResult>("/api/v1/review", {
            originUrl: originUrl ?? undefined,
            normalizedOriginUrl: normalizedOriginUrl ?? undefined,
            branch,
            planTier: "free",
            stagedPatch: reviewPatch,
            stagedFiles: reviewFiles.map((f) => ({
              path: f.path,
              changeType: f.changeType,
              isBinary: f.isBinary
            })),
            instructionFiles: hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles).hashed.map((h) => ({
              path: h.path,
              sha256: h.sha256
            }))
          });

          if (remote.status === "UNCHECKED") {
            if (mode === "staged") {
              writePendingNextCommit(repoRoot, {
                branch,
                createdAtMs: Date.now(),
                reason: "server_unchecked"
              });
            } else {
              const state = readPendingState(repoRoot);
              const list = state.branches[branch] ?? [];
              const existing = new Set(list.map((p) => p.sha));
              const shas = pushCommitShas.length > 0 ? pushCommitShas : headSha ? [headSha] : [];
              for (const sha of shas) {
                if (!existing.has(sha)) list.push({ sha, createdAtMs: Date.now(), reason: "server_unchecked" });
              }
              state.branches[branch] = list;
              writePendingState(repoRoot, state);
            }

            const md = formatReviewResultMarkdown({
              status: "UNCHECKED",
              findings:
                remote.findings.length > 0
                  ? remote.findings
                  : [
                      {
                        path: "package.json",
                        severity: "note",
                        title: "Unchecked review",
                        message:
                          mode === "push"
                            ? "GitPreflight could not complete the review. Push is allowed, but GitPreflight will require reviewing these commits before the next push on this branch."
                            : "GitPreflight could not complete the review. Commit is allowed, but GitPreflight will require reviewing this commit before the next commit on this branch."
                      }
                    ]
            });
            await emit(md);
            return 0;
          }

          findings = findings.concat(remote.findings);
        } catch (err) {
          if (err instanceof GitPreflightApiError && err.status === 401) {
            findings.push({
              path: "package.json",
              severity: "minor",
              title: "Authentication failed",
              message: "GitPreflight API rejected your token. Run `gitpreflight auth login` to re-authenticate."
            });
          } else {
            throw err;
          }
        }
      }
    }

    const status = findings.some((f) => f.severity === "minor" || f.severity === "major") ? "FAIL" : "PASS";
    const md = formatReviewResultMarkdown({ status, findings });
    await emit(md);
    return status === "FAIL" ? 1 : 0;
  } catch (err) {
    if (isOfflineOrTimeoutError(err)) {
      if (mode === "staged") {
        writePendingNextCommit(repoRoot, {
          branch,
          createdAtMs: Date.now(),
          reason: (err as Error).message ?? "offline/timeout"
        });
      } else {
        const input = (() => {
          try {
            return collectPushReviewInputFromHook(repoRoot, {
              remoteName: pushRemoteName,
              stdin: pushStdin,
              headSha: headSha!
            });
          } catch {
            return { patch: "", files: [], commitShas: [], inferredBranch: null };
          }
        })();
        const state = readPendingState(repoRoot);
        const list = state.branches[branch] ?? [];
        const existing = new Set(list.map((p) => p.sha));
        const shas = input.commitShas.length > 0 ? input.commitShas : headSha ? [headSha] : [];
        for (const sha of shas) {
          if (!existing.has(sha)) list.push({ sha, createdAtMs: Date.now(), reason: (err as Error).message ?? "offline/timeout" });
        }
        state.branches[branch] = list;
        writePendingState(repoRoot, state);
      }

      const md = formatReviewResultMarkdown({
        status: "UNCHECKED",
        findings: [
          {
            path: "package.json",
            severity: "note",
            title: "Unchecked review",
            message:
              mode === "push"
                ? "GitPreflight could not complete the review (offline/timeout). Push is allowed, but GitPreflight will require reviewing these commits before the next push on this branch."
                : "GitPreflight could not complete the review (offline/timeout). Commit is allowed, but GitPreflight will require reviewing this commit before the next commit on this branch."
          }
        ]
      });
      await emit(md);
      return 0;
    }

    process.stderr.write(`GitPreflight internal error: ${(err as Error).message}\n`);
    return 2;
  }
}

async function cmdInit(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      hook: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight init [--hook pre-commit|pre-push|both]\n");
    return 0;
  }

  async function promptInitHookMode(): Promise<InitHookMode> {
    const stdinIsTty = Boolean(process.stdin.isTTY);
    const stdoutIsTty = Boolean(process.stdout.isTTY);
    if (!stdinIsTty || !stdoutIsTty) return "pre-commit";

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

    try {
      process.stdout.write(
        [
          "How do you want GitPreflight to run?",
          "  1) On commit (pre-commit) [recommended]",
          "  2) On push (pre-push)",
          "  3) Both",
          ""
        ].join("\n")
      );

      for (let attempt = 0; attempt < 3; attempt++) {
        const answer = (await question("Select 1-3 [1]: ")).trim();
        if (answer === "" || answer === "1") return "pre-commit";
        if (answer === "2") return "pre-push";
        if (answer === "3") return "both";
        process.stdout.write("Invalid selection.\n");
      }

      return "pre-commit";
    } finally {
      rl.close();
    }
  }

  const hookFlag = parsed.values.hook as string | undefined;
  let selectedHookMode: InitHookMode;

  if (!hookFlag) {
    selectedHookMode = await promptInitHookMode();
  } else if (hookFlag === "pre-commit" || hookFlag === "pre-push" || hookFlag === "both") {
    selectedHookMode = hookFlag;
  } else {
    process.stderr.write(`Invalid --hook value: ${hookFlag}. Expected pre-commit, pre-push, or both.\n`);
    return 2;
  }

  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  try {
    initRepo(repoRoot, { hook: selectedHookMode });
  } catch (err) {
    process.stderr.write(`Failed to initialize GitPreflight: ${(err as Error).message}\n`);
    return 2;
  }

  process.stdout.write("Initialized GitPreflight (Husky hooks + package.json updates).\n");
  process.stdout.write("Next: run your package manager install so the prepare script can run `husky install`.\n");
  return 0;
}

async function cmdAuth(argv: string[]) {
  const sub = argv[0];
  if (sub === "login") {
    const parsed = parseArgs({
      args: argv.slice(1),
      options: {
        help: { type: "boolean", short: "h" }
      },
      allowPositionals: true
    });

    if (parsed.values.help) {
      process.stdout.write("Usage: gitpreflight auth login\n");
      return 0;
    }

    try {
      let env = process.env as NodeJS.ProcessEnv;
      try {
        const repoRoot = getRepoRoot();
        env = { ...env, ...loadRepoEnv(repoRoot) } as NodeJS.ProcessEnv;
      } catch {
        // auth login can run outside a repo; fall back to process env
      }

      const parsedEnv = getGitPreflightEnv(env);
      await deviceAuthLogin(parsedEnv.GITPREFLIGHT_API_BASE_URL);
      process.stdout.write("GitPreflight CLI authenticated.\n");
      return 0;
    } catch (err) {
      process.stderr.write(`Auth failed: ${(err as Error).message}\n`);
      return 2;
    }
  }

  process.stderr.write("Usage: gitpreflight auth login\n");
  return 2;
}

async function cmdInternal(argv: string[]) {
  const sub = argv[0];

  if (sub === "post-commit") {
    let repoRoot: string;
    try {
      repoRoot = getRepoRoot();
    } catch {
      return 0;
    }

    return runPostCommit(repoRoot);
  }

  process.stderr.write("Usage: gitpreflight internal post-commit\n");
  return 2;
}

async function cmdSkipNext(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      reason: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight skip-next --reason \"...\"\n");
    return 0;
  }

  const reason = parsed.values.reason ?? "(no reason provided)";

  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  writeSkipNext(repoRoot, { reason, createdAtMs: Date.now() });
  process.stdout.write(`GitPreflight will skip the next hook run. Reason: ${reason}\n`);
  return 0;
}

export async function runCli(argv: string[] = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return 0;
  }

  if (cmd === "--version" || cmd === "-v") {
    printVersion();
    return 0;
  }

  if (cmd === "review") return await cmdReview(rest);
  if (cmd === "init") return await cmdInit(rest);
  if (cmd === "auth") return await cmdAuth(rest);
  if (cmd === "skip-next") return await cmdSkipNext(rest);
  if (cmd === "internal") return await cmdInternal(rest);

  return unknownCommand(cmd);
}

if (require.main === module) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
