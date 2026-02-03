import { spawnSync } from "node:child_process";

export type ShipstampUi = "plain" | "tui" | "pager";

function parseEnvUi(value: string | undefined): ShipstampUi | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "plain" || v === "tui" || v === "pager") return v;
  return null;
}

export function resolveShipstampUi(opts: {
  inCi: boolean;
  inHook: boolean;
  stdoutIsTty: boolean;
  isBunRuntime: boolean;
  argv: { plain: boolean; tui: boolean };
  env: NodeJS.ProcessEnv;
}): ShipstampUi {
  // Stable contract: hooks/CI/non-tty are always plain Markdown.
  if (opts.inCi || opts.inHook || !opts.stdoutIsTty) return "plain";

  if (opts.argv.plain) return "plain";
  if (opts.argv.tui && opts.isBunRuntime) return "tui";

  const envUi = parseEnvUi(opts.env.SHIPSTAMP_UI);
  if (envUi === "plain") return "plain";
  if (envUi === "tui") return opts.isBunRuntime ? "tui" : "plain";
  if (envUi === "pager") return "pager";

  // Interactive default: preserve current behavior (TUI when Bun is available).
  if (opts.isBunRuntime) return "tui";
  return "pager";
}

export async function emitMarkdown(opts: { ui: ShipstampUi; markdown: string }): Promise<void> {
  if (opts.ui === "tui") {
    const { renderReviewTui } = await import("./tui");
    await renderReviewTui(opts.markdown);
    return;
  }

  if (opts.ui === "pager") {
    const pager = process.env.PAGER && process.env.PAGER.trim().length > 0 ? process.env.PAGER : "less -FRX";
    const res = spawnSync(pager, {
      shell: true,
      input: `${opts.markdown}\n`,
      stdio: ["pipe", "inherit", "inherit"],
      env: { ...process.env, LESSCHARSET: process.env.LESSCHARSET ?? "utf-8" }
    });

    // If no pager is available, fall back to plain.
    if ((res.error as any)?.code === "ENOENT") {
      process.stdout.write(opts.markdown);
      process.stdout.write("\n");
    }
    return;
  }

  process.stdout.write(opts.markdown);
  process.stdout.write("\n");
}
