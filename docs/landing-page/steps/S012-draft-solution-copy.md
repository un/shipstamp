# S012 Draft Solution Copy

## Solution (bullets)

- Run review in git hooks at commit time, with optional pre-push mode.
- Review only `git diff --cached` so your agent gets a small, intentional scope.
- Output a stable Markdown report with actionable `suggestion` blocks.
- Use explicit loop semantics: FAIL blocks, UNCHECKED allows with local backlog, PASS is ready to push.
- Close the loop locally: your agent iterates to PASS, then you push a cleaner PR.

## Differentiator line

PR bots review after push. GitPreflight blocks or clears the commit before the PR exists.
