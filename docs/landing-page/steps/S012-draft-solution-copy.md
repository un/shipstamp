# S012 Draft Solution Copy

## Solution (bullets)

- Run review at commit time, not in GitHub.
- Review the staged diff only (`git diff --cached`) so the scope is small and intentional.
- Output a stable Markdown report with actionable `suggestion` blocks your agent can apply.
- Close the loop locally: the agent iterates until PASS, then you push a quieter PR.

## Differentiator line

PR bots comment on your PR. GitPreflight fixes your commit before it becomes a PR.
