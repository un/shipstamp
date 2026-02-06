import { spawnSync } from "node:child_process";

export type LocalAgentRunResult =
  | { ok: true; markdown: string; status: "PASS" | "FAIL" | "UNCHECKED" }
  | { ok: false; errorMessage: string };

export type LocalAgentProbeResult =
  | { ok: true; stdout: string }
  | {
      ok: false;
      reason: "spawn_error" | "exit_nonzero" | "empty_output";
      message: string;
      exitCode: number | null;
      stderr: string;
    };

function parseResultStatus(markdown: string): "PASS" | "FAIL" | "UNCHECKED" | null {
  const m = markdown.match(/^Result:\s*(PASS|FAIL|UNCHECKED)\s*$/m);
  return (m?.[1] as any) ?? null;
}

function looksLikeGitpreflightMarkdown(markdown: string): boolean {
  const hasHeader = /^#\s+GitPreflight\s+Review\s*$/m.test(markdown);
  const hasCounts = /^Counts:\s*note=\d+\s+minor=\d+\s+major=\d+\s*$/m.test(markdown);
  const hasFindingsHeader = /^##\s+Findings\s*$/m.test(markdown);
  return hasHeader && hasCounts && hasFindingsHeader;
}

export function runLocalAgentMarkdownReview(opts: {
  command: string;
  cwd: string;
  timeoutMs: number;
  prompt: string;
}): LocalAgentRunResult {
  const res = spawnSync(opts.command, {
    cwd: opts.cwd,
    shell: true,
    input: opts.prompt,
    encoding: "utf8",
    timeout: opts.timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  });

  if (res.error) {
    return { ok: false, errorMessage: res.error.message };
  }

  const stdout = (res.stdout ?? "").toString();
  const stderr = (res.stderr ?? "").toString();

  if (typeof res.status === "number" && res.status !== 0) {
    const msg = stderr.trim() ? `Command failed: ${stderr.trim()}` : `Command failed with exit code ${res.status}`;
    return { ok: false, errorMessage: msg };
  }

  const status = parseResultStatus(stdout);
  if (!looksLikeGitpreflightMarkdown(stdout) || !status) {
    return {
      ok: false,
      errorMessage:
        "Local agent output did not match the GitPreflight Markdown contract (missing required header/Counts/Findings/Result lines)."
    };
  }

  return { ok: true, markdown: stdout.trimEnd(), status };
}

export function probeLocalAgentCommand(opts: {
  command: string;
  cwd: string;
  timeoutMs: number;
}): LocalAgentProbeResult {
  const res = spawnSync(opts.command, {
    cwd: opts.cwd,
    shell: true,
    input: "hi are you alive",
    encoding: "utf8",
    timeout: opts.timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  });

  const stderr = (res.stderr ?? "").toString().trim();

  if (res.error) {
    return {
      ok: false,
      reason: "spawn_error",
      message: res.error.message,
      exitCode: typeof res.status === "number" ? res.status : null,
      stderr
    };
  }

  if (typeof res.status === "number" && res.status !== 0) {
    return {
      ok: false,
      reason: "exit_nonzero",
      message: stderr || `command exited with code ${res.status}`,
      exitCode: res.status,
      stderr
    };
  }

  const stdout = (res.stdout ?? "").toString().trim();
  if (!stdout) {
    return {
      ok: false,
      reason: "empty_output",
      message: "command produced empty output",
      exitCode: typeof res.status === "number" ? res.status : null,
      stderr
    };
  }

  return { ok: true, stdout };
}
