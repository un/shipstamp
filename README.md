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
gitpreflight install
# or non-interactive:
# gitpreflight install --scope local --hook pre-commit --yes
# gitpreflight install --scope global --hook pre-commit --yes
# gitpreflight install --scope repo --hook pre-commit --yes
```

`gitpreflight install` is interactive in a TTY and explains scope options:

- `global`: enable across all repos on your machine
- `local`: enable for this repo only, without committed integration files
- `repo`: committed repo-owned setup for all contributors

Compatibility: `gitpreflight init` still works for repo-scoped Husky setup.

GitPreflight integrates via Husky:

- Adds/extends `package.json#scripts.prepare` to include `husky install`
- Creates/appends `.husky/pre-commit` to run `gitpreflight review --staged`
- Creates/appends `.husky/post-commit` for unchecked-commit capture

Optional push-gate mode:

- `gitpreflight install --scope repo --hook pre-push --yes` creates/appends `.husky/pre-push` to run `gitpreflight review --push`
- `gitpreflight install --scope repo --hook both --yes` installs both commit + push hooks

Inspect or remove setup:

```bash
gitpreflight status --verbose
gitpreflight uninstall --scope local
# or
gitpreflight uninstall --scope global
```

Policy overrides (optional):

```bash
# global default policy
git config --global gitpreflight.policy optional

# local repo override (for example, opt out in one repo)
git config --local gitpreflight.policy disabled
```

Repo owners can commit policy in `package.json`:

```json
{
  "gitpreflight": {
    "policy": "required"
  }
}
```

Policy precedence is: repo policy > local git config > global git config > default (`optional`).

After repo-scoped install (`gitpreflight install --scope repo ...` or `gitpreflight init`), run your package manager install so Husky activates:

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

## Enforcement note

Repo-scoped hooks are a strong local default, but true "required" enforcement needs protected branch checks in your git host.

- Recommended: require a GitPreflight CI status check for merges to protected branches.
- Client hooks alone are bypassable via `--no-verify`.

## Privacy stance

GitPreflight avoids storing customer repo source code at rest.

- The server stores:
  - instruction file contents (by hash) when configured (e.g. `AGENTS.md`)
  - review outputs and aggregated usage/statistics
- The server does not store arbitrary repo files.

## Source builds / local service

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

## Local-agent mode

Local-agent mode shells out to a configured local agent command and expects GitPreflight Markdown output.

Configure it once:

```bash
gitpreflight setup local-agent
```

The setup flow lets you choose a provider (`Codex`, `Claude`, or `OpenCode`), probes the command with a live check, and saves config under `~/.config/gitpreflight/config.json`.

Then run reviews with local-agent mode:

```bash
gitpreflight review --staged --local-agent
```
