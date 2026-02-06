# S013 Draft How-It-Works Copy

## How it works (protocol steps)

1. Stage changes.
2. Run `git commit`.
3. GitPreflight reviews only the staged diff and prints stable Markdown with Result: PASS, FAIL, or UNCHECKED.
4. If FAIL, your agent applies `suggestion` blocks and retries.
5. If UNCHECKED, commit is allowed but backlog must clear before the next run on that branch.
6. Repeat until PASS, then push.

## Outcome line (optional)

When you push, the PR is already quiet and focused on intent.
