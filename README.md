# Shipstamp (v0)

Shipstamp is a staged-only, pre-commit code review gate designed for AI coding agents.

- Runs on `git commit` via a pre-commit hook.
- Reviews the staged diff only (`git diff --cached`).
- Prints a stable, LLM-friendly Markdown report with actionable ```suggestion blocks.
- Blocks commits when it finds `minor` or `major` issues.

## Requirements

End users:

- Node.js (for the npm installer wrapper)
- Git

Contributors / source builds:

- Bun (repo package manager + CLI build/runtime for the interactive UI)
- Node.js (used by Next.js/Convex tooling)

## Install (recommended)

Global install via npm (downloads a platform binary on install/first run):

```bash
npm i -g shipstamp
shipstamp --help
```

Curl install (OpenCode-style):

```bash
curl -fsSL https://shipstamp.ai/install | bash
shipstamp --help
```

## Run (web + Convex)

```bash
bun dev
```

- Web app: http://localhost:3000
- Run individually:
  - `bun run dev:web`
  - `bun run dev:convex`

## Configure

Shipstamp is SaaS-first. You must point the CLI at a Shipstamp API base URL:

```bash
export SHIPSTAMP_API_BASE_URL="https://<your-shipstamp-app-domain>"
```

Authenticate the CLI:

```bash
shipstamp auth login
```

## Hook setup

In a repo you want to protect:

```bash
shipstamp init
```

Shipstamp integrates via Husky:

- Adds/extends `package.json#scripts.prepare` to include `husky install`
- Creates/appends `.husky/pre-commit` to run `shipstamp review --staged`
- Creates/appends `.husky/post-commit` for unchecked-commit capture

After `shipstamp init`, run your package manager install so Husky activates:

```bash
npm install
# or: pnpm install / yarn install / bun install
```

## Run a review

```bash
shipstamp review --staged
```

Hooks/CI output is always plain Markdown. In an interactive terminal, Shipstamp prefers a Bun-powered TUI (and falls back to a pager when needed).

Force plain Markdown output:

```bash
shipstamp review --staged --plain
# or
SHIPSTAMP_UI=plain shipstamp review --staged
```

## Unchecked policy (offline/timeout)

If Shipstamp cannot complete a review (network/timeout/server issues):

- The commit is allowed.
- The commit is marked as `UNCHECKED` locally under `.git/shipstamp/`.
- The next run on the same branch is blocked until the backlog is cleared or explicitly bypassed.

## Bypass

- One-shot bypass (preferred):

```bash
shipstamp skip-next --reason "<why>"
```

- Universal bypass:

```bash
git commit --no-verify
```

## Privacy stance

Shipstamp avoids storing customer repo source code at rest.

- The server stores:
  - instruction file contents (by hash) when configured (e.g. `AGENTS.md`)
  - review outputs and aggregated usage/statistics
- The server does not store arbitrary repo files.

## Source builds / local service

Official installs ship SaaS mode only; source-only features (like local-agent mode) are compile-time disabled in official builds.

To run against a locally running Shipstamp service, build/run from source and point `SHIPSTAMP_API_BASE_URL` at localhost.

```bash
cd code
bun install
```

Run the CLI from source:

```bash
bun packages/cli/src/index.ts --help
bun packages/cli/src/index.ts review --staged
```

## Source-only local-agent mode

Local-agent mode shells out to a user-provided command and expects Shipstamp Markdown output.

Use it with:

```bash
export SHIPSTAMP_LOCAL_AGENT_COMMAND="<command that reads prompt from stdin>"
bun packages/cli/src/index.ts review --staged --local-agent
```
