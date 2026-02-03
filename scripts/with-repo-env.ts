import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(absPath: string, env: NodeJS.ProcessEnv) {
  let txt: string;
  try {
    txt = readFileSync(absPath, "utf8");
  } catch {
    return;
  }

  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const noExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;

    const eq = noExport.indexOf("=");
    if (eq === -1) continue;

    const key = noExport.slice(0, eq).trim();
    if (!key) continue;
    if (env[key] != null) continue;

    let value = noExport.slice(eq + 1).trim();

    if (!(value.startsWith('"') || value.startsWith("'"))) {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

function parseArgs(argv: string[]) {
  let cwd: string | undefined;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--cwd") {
      cwd = argv[i + 1];
      i += 2;
      continue;
    }
    if (a === "--") {
      i += 1;
      break;
    }
    break;
  }

  return { cwd, cmd: argv[i], cmdArgs: argv.slice(i + 1) };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const { cwd, cmd, cmdArgs } = parseArgs(process.argv.slice(2));

if (!cmd) {
  console.error(
    "Usage: bun scripts/with-repo-env.ts [--cwd <dir>] -- <command> [args...]"
  );
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env };
loadEnvFile(path.join(repoRoot, ".env"), env);
loadEnvFile(path.join(repoRoot, ".env.local"), env);

const resolvedCwd = cwd ? path.resolve(repoRoot, cwd) : repoRoot;
env.PWD = resolvedCwd;

const child = spawn(cmd, cmdArgs, {
  cwd: resolvedCwd,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
