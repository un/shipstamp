# GitPreflight (v0)

Clean PRs by default. Fix issues at commit time.

GitPreflight is a staged-only, pre-commit code review gate designed for AI coding agents. It runs on `git commit`, reviews the staged diff only (`git diff --cached`), and prints stable Markdown your agent can apply before you push.

- Runs on `git commit` via a pre-commit hook.
- Reviews the staged diff only (`git diff --cached`).
- Prints a stable, LLM-friendly Markdown report with actionable suggestion blocks.
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
npm i -g gitpreflight
gitpreflight --help
```

Curl install (OpenCode-style):

```bash
curl -fsSL https://gitpreflight.ai/install | bash
gitpreflight --help
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

GitPreflight is SaaS-first. You must point the CLI at a GitPreflight API base URL:

```bash
export GITPREFLIGHT_API_BASE_URL="https://<your-gitpreflight-app-domain>"
```

Authenticate the CLI:

```bash
gitpreflight auth login
```

## Hook setup

In a repo you want to protect:

```bash
gitpreflight init
# or: gitpreflight init --hook pre-push
```

`gitpreflight init` is interactive in a TTY and will ask whether you want to run on commit or push.

GitPreflight integrates via Husky:

- Adds/extends `package.json#scripts.prepare` to include `husky install`
- Creates/appends `.husky/pre-commit` to run `gitpreflight review --staged`
- Creates/appends `.husky/post-commit` for unchecked-commit capture

Optional push-gate mode:

- `gitpreflight init --hook pre-push` creates/appends `.husky/pre-push` to run `gitpreflight review --push`
- `gitpreflight init --hook both` installs both commit + push hooks

After `gitpreflight init`, run your package manager install so Husky activates:

```bash
npm install
# or: pnpm install / yarn install / bun install
```

## Run a review

```bash
gitpreflight review --staged
```

Hooks/CI output is always plain Markdown. In an interactive terminal, GitPreflight prefers a Bun-powered TUI (and falls back to a pager when needed).

Force plain Markdown output:

```bash
gitpreflight review --staged --plain
# or
GITPREFLIGHT_UI=plain gitpreflight review --staged
```

## Unchecked policy (offline/timeout)

If GitPreflight cannot complete a review (network/timeout/server issues):

- The commit is allowed.
- The commit is marked as `UNCHECKED` locally under `.git/gitpreflight/`.
- The next run on the same branch is blocked until the backlog is cleared or explicitly bypassed.

## Bypass

- One-shot bypass (preferred):

```bash
gitpreflight skip-next --reason "<why>"
```

- Universal bypass:

```bash
git commit --no-verify
# or (if using pre-push mode):
git push --no-verify
```

## Privacy stance

GitPreflight avoids storing customer repo source code at rest.

- The server stores:
  - instruction file contents (by hash) when configured (e.g. `AGENTS.md`)
  - review outputs and aggregated usage/statistics
- The server does not store arbitrary repo files.

## Source builds / local service

Official installs ship SaaS mode only; source-only features (like local-agent mode) are compile-time disabled in official builds.

To run against a locally running GitPreflight service, build/run from source and point `GITPREFLIGHT_API_BASE_URL` at localhost.

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

Local-agent mode shells out to a user-provided command and expects GitPreflight Markdown output.

Use it with:

```bash
export GITPREFLIGHT_LOCAL_AGENT_COMMAND="<command that reads prompt from stdin>"
bun packages/cli/src/index.ts review --staged --local-agent
```
