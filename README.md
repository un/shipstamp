# Shipstamp (v0)

Shipstamp is a staged-only, pre-commit code review gate designed for AI coding agents.

- Runs on `git commit` via a pre-commit hook.
- Reviews the staged diff only (`git diff --cached`).
- Prints a stable, LLM-friendly Markdown report with actionable ```suggestion blocks.
- Blocks commits when it finds `minor` or `major` issues.

## Requirements

- Bun (repo package manager and CLI runtime)
- Node.js (used by Next.js/Convex tooling)

## Install (repo / dev)

```bash
bun install
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

SaaS mode needs an API base URL:

```bash
export SHIPSTAMP_API_BASE_URL="https://<your-shipstamp-app-domain>"
```

Authenticate the CLI:

```bash
bun x shipstamp auth login
```

## Hook setup

In a repo you want to protect:

```bash
bun x shipstamp init
```

Shipstamp integrates via Husky:

- Adds/extends `package.json#scripts.prepare` to include `husky install`
- Creates/appends `.husky/pre-commit` to run `shipstamp review --staged`
- Creates/appends `.husky/post-commit` for unchecked-commit capture

## Run a review

```bash
bun x shipstamp review --staged
```

Output is always Markdown in hooks/CI. In an interactive terminal, Shipstamp shows an OpenTUI viewer by default.

Force plain Markdown output:

```bash
bun x shipstamp review --staged --plain
# or
SHIPSTAMP_UI=plain bun x shipstamp review --staged
```

## Unchecked policy (offline/timeout)

If Shipstamp cannot complete a review (network/timeout/server issues):

- The commit is allowed.
- The commit is marked as `UNCHECKED` locally under `.git/shipstamp/`.
- The next run on the same branch is blocked until the backlog is cleared or explicitly bypassed.

## Bypass

- One-shot bypass (preferred):

```bash
bun x shipstamp skip-next --reason "<why>"
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

## Source-only local-agent mode

Local-agent mode shells out to a user-provided command and expects Shipstamp Markdown output.

- Disabled in official builds at compile time.
- Enabled for source builds.

Use it with:

```bash
export SHIPSTAMP_LOCAL_AGENT_COMMAND="<command that reads prompt from stdin>"
bun x shipstamp review --staged --local-agent
```
