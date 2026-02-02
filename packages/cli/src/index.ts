import { formatReviewResultMarkdown, SHIPSTAMP_CORE_VERSION } from "@shipstamp/core";
import { parseArgs } from "node:util";
import { getBranchName, getHeadSha, getRepoRoot } from "./git";

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
  try {
    getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  // Collected for later API requests/backlog logic.
  void getBranchName();
  void getHeadSha();

  // v0 scaffold: real staged diff collection lands in later steps.
  const md = formatReviewResultMarkdown({ status: "PASS", findings: [] });
  process.stdout.write(md);
  process.stdout.write("\n");
  return 0;
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

  process.stdout.write("shipstamp init (stub)\n");
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

  const reason = parsed.values.reason;
  if (!reason) {
    process.stderr.write("Missing required flag: --reason\n");
    return 2;
  }

  process.stdout.write(`shipstamp skip-next (stub): ${reason}\n`);
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

  return unknownCommand(cmd);
}

if (require.main === module) {
  const code = runCli();
  process.exitCode = code;
}
