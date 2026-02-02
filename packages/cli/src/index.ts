import { formatReviewResultMarkdown, SHIPSTAMP_CORE_VERSION } from "@shipstamp/core";
import { parseArgs } from "node:util";
import { getBranchName, getHeadSha, getRepoRoot } from "./git";
import { loadShipstampRepoConfig } from "./repoConfig";
import { collectStagedFiles } from "./staged";
import { collectStagedPatch } from "./stagedPatch";
import { discoverInstructionFiles } from "./instructions";
import { hashFilesSha256 } from "./hash";
import { clearSkipNext, readPendingState, readSkipNext, writePendingNextCommit, writeSkipNext } from "./state";
import { repoHasExistingPrecommitLinting } from "./precommitDetection";
import { getShipstampEnv } from "./env";
import { detectLinters } from "./lintersDetect";
import { selectStagedFilesForLinters } from "./linterFiles";
import { detectPackageManager } from "./packageManager";
import { runLintersInCheckMode } from "./runLinters";
import { initRepo } from "./init";
import { isOfflineOrTimeoutError } from "./errors";
import { runPostCommit } from "./postCommit";

function printHelp() {
  process.stdout.write(
    [
      `shipstamp (v0 scaffold) — core ${SHIPSTAMP_CORE_VERSION}`,
      "",
      "Usage:",
      "  shipstamp <command> [options]",
      "",
      "Commands:",
      "  review --staged        Review staged changes (v0: stub)",
      "  init                  Install git hooks + config (v0: stub)",
      "  auth login             Authenticate the CLI (v0: stub)",
      "  skip-next --reason ... Bypass next commit (v0: stub)",
      "",
      "Global options:",
      "  -h, --help             Show help",
      ""
    ].join("\n")
  );
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

function cmdReview(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      staged: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: shipstamp review --staged\n");
    return 0;
  }

  if (!parsed.values.staged) {
    process.stderr.write("Missing required flag: --staged\n");
    return 2;
  }

  // Ensure we're inside a git repo early.
  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const branch = getBranchName() ?? "(detached)";
  void getHeadSha();

  const skip = readSkipNext(repoRoot);
  if (skip) {
    clearSkipNext(repoRoot);
    const md = formatReviewResultMarkdown({
      status: "PASS",
      findings: [
        {
          path: "package.json",
          severity: "note",
          title: "Shipstamp skipped",
          message: `Shipstamp skipped this run (skip-next). Reason: ${skip.reason}`
        }
      ]
    });
    process.stdout.write(md);
    process.stdout.write("\n");
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
            "Shipstamp previously allowed one or more commits without a completed review (offline/timeout).\n\n" +
            "Unchecked commits:\n" +
            `${list}\n\n` +
            "To proceed, either:\n" +
            "- Run `shipstamp skip-next --reason \"...\"` to bypass once, or\n" +
            "- Use `git commit --no-verify` to bypass hooks\n"
        }
      ]
    });
    process.stdout.write(md);
    process.stdout.write("\n");
    return 1;
  }

  try {
    const repoConfig = loadShipstampRepoConfig(repoRoot);

    // v0 scaffold: start collecting staged metadata.
    const stagedFiles = collectStagedFiles(repoRoot);
    void collectStagedPatch(repoRoot);

    const changedPaths = stagedFiles
      .filter((f) => f.path && f.changeType !== "deleted")
      .map((f) => f.path);

    const discovered = discoverInstructionFiles(repoRoot, changedPaths, repoConfig.instructionFiles);
    void hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles);

    const detectedLinters = detectLinters(repoRoot);
    const selected = selectStagedFilesForLinters(stagedFiles, detectedLinters);

    const pm = detectPackageManager(repoRoot);

    let findings: Array<import("@shipstamp/core").Finding> = [];

    try {
      void getShipstampEnv();
    } catch (err) {
      findings.push({
        path: "package.json",
        severity: "minor",
        title: "Missing required environment",
        message:
          "Shipstamp needs SHIPSTAMP_API_BASE_URL to contact the Shipstamp API (separate app/domain).\n\n" +
          "Set it in your environment, e.g.:\n\n" +
          "`export SHIPSTAMP_API_BASE_URL=https://api.shipstamp.example`\n\n" +
          `Error: ${(err as Error).message}`
      });
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

    const status = findings.some((f) => f.severity === "minor" || f.severity === "major") ? "FAIL" : "PASS";
    const md = formatReviewResultMarkdown({ status, findings });
    process.stdout.write(md);
    process.stdout.write("\n");
    return status === "FAIL" ? 1 : 0;
  } catch (err) {
    if (isOfflineOrTimeoutError(err)) {
      writePendingNextCommit(repoRoot, {
        branch,
        createdAtMs: Date.now(),
        reason: (err as Error).message ?? "offline/timeout"
      });

      const md = formatReviewResultMarkdown({
        status: "UNCHECKED",
        findings: [
          {
            path: "package.json",
            severity: "note",
            title: "Unchecked review",
            message:
              "Shipstamp could not complete the review (offline/timeout). Commit is allowed, but Shipstamp will require reviewing this commit before the next commit on this branch."
          }
        ]
      });
      process.stdout.write(md);
      process.stdout.write("\n");
      return 0;
    }

    process.stderr.write(`Shipstamp internal error: ${(err as Error).message}\n`);
    return 2;
  }
}

function cmdInit(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: shipstamp init\n");
    return 0;
  }

  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  try {
    initRepo(repoRoot);
  } catch (err) {
    process.stderr.write(`Failed to initialize Shipstamp: ${(err as Error).message}\n`);
    return 2;
  }

  process.stdout.write("Initialized Shipstamp (Husky hooks + package.json updates).\n");
  process.stdout.write("Next: run your package manager install so the prepare script can run `husky install`.\n");
  return 0;
}

function cmdAuth(argv: string[]) {
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
      process.stdout.write("Usage: shipstamp auth login\n");
      return 0;
    }

    process.stdout.write("shipstamp auth login (stub)\n");
    return 0;
  }

  process.stderr.write("Usage: shipstamp auth login\n");
  return 2;
}

function cmdInternal(argv: string[]) {
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

  process.stderr.write("Usage: shipstamp internal post-commit\n");
  return 2;
}

function cmdSkipNext(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      reason: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: shipstamp skip-next --reason \"...\"\n");
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
  process.stdout.write(`Shipstamp will skip the next commit hook run. Reason: ${reason}\n`);
  return 0;
}

export function runCli(argv: string[] = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return 0;
  }

  if (cmd === "review") return cmdReview(rest);
  if (cmd === "init") return cmdInit(rest);
  if (cmd === "auth") return cmdAuth(rest);
  if (cmd === "skip-next") return cmdSkipNext(rest);
  if (cmd === "internal") return cmdInternal(rest);

  return unknownCommand(cmd);
}

if (require.main === module) {
  const code = runCli();
  process.exitCode = code;
}
