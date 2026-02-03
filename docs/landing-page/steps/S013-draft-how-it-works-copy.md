# S013 Draft How-It-Works Copy

## How it works (protocol steps)

1. Stage changes.
2. Run `git commit`.
3. Shipstamp reviews the staged diff and prints a stable Markdown report (PASS, minor, major).
4. Your agent applies `suggestion` blocks, retries the commit, and iterates until PASS.

## Outcome line (optional)

When you push, the PR is already quiet.
