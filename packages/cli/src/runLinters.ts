import { spawnSync } from "node:child_process";
import type { Finding } from "@gitpreflight/core";

import type { LintersDetection } from "./lintersDetect";
import type { PackageManager } from "./packageManager";
import { makeExecCommand } from "./packageManager";

export type RunLintersInput = {
  repoRoot: string;
  detected: LintersDetection;
  selectedFiles: {
    biome: string[];
    eslint: string[];
    prettier: string[];
  };
  packageManager: PackageManager;
  timeoutMs: number;
};

type RunResult = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  errorMessage?: string;
};

function run(repoRoot: string, command: string, args: string[], timeoutMs: number): RunResult {
  const started = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    command,
    args,
    exitCode: typeof started.status === "number" ? started.status : 1,
    stdout: started.stdout ?? "",
    stderr: started.stderr ?? "",
    timedOut: started.signal === "SIGTERM" && started.status === null,
    errorMessage: started.error ? String(started.error.message ?? started.error) : undefined
  };
}

function formatCommand(cmd: string, args: string[]) {
  return [cmd, ...args].join(" ");
}

function makeFailureFinding(tool: string, result: RunResult): Finding {
  const output = [result.stdout, result.stderr].filter((s) => s && s.trim().length > 0).join("\n");
  const cmdLine = formatCommand(result.command, result.args);

  const extra = result.timedOut
    ? `\n\nTimed out after ${Math.round(result.args.length)} args (timeout applied).`
    : "";

  const err = result.errorMessage ? `\n\nError: ${result.errorMessage}` : "";

  return {
    path: "package.json",
    severity: "minor",
    title: `${tool} check failed`,
    message:
      `Command:\n\`${cmdLine}\`\n\n` +
      (output ? `Output:\n\n\`\`\`\n${output.trimEnd()}\n\`\`\`\n` : "No output.\n") +
      extra +
      err
  };
}

export function runLintersInCheckMode(input: RunLintersInput): Finding[] {
  const findings: Finding[] = [];

  // Keep per-tool time bounded.
  const perToolTimeout = Math.min(input.timeoutMs, 120_000);

  if (input.detected.biome.detected && input.selectedFiles.biome.length > 0) {
    const exec = makeExecCommand(input.packageManager, "biome", ["check", ...input.selectedFiles.biome]);
    const result = run(input.repoRoot, exec.command, exec.args, perToolTimeout);
    if (result.exitCode !== 0) findings.push(makeFailureFinding("Biome", result));
  }

  if (input.detected.eslint.detected && input.selectedFiles.eslint.length > 0) {
    const exec = makeExecCommand(input.packageManager, "eslint", [...input.selectedFiles.eslint]);
    const result = run(input.repoRoot, exec.command, exec.args, perToolTimeout);
    if (result.exitCode !== 0) findings.push(makeFailureFinding("ESLint", result));
  }

  if (input.detected.prettier.detected && input.selectedFiles.prettier.length > 0) {
    const exec = makeExecCommand(input.packageManager, "prettier", ["--check", ...input.selectedFiles.prettier]);
    const result = run(input.repoRoot, exec.command, exec.args, perToolTimeout);
    if (result.exitCode !== 0) findings.push(makeFailureFinding("Prettier", result));
  }

  return findings;
}
