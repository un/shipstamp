# S017 Draft FAQ Copy

## FAQ

### Do you store my repo code?

GitPreflight avoids storing customer repo source code at rest. The server stores instruction file contents (by hash) when configured (e.g. `AGENTS.md`), plus review outputs and aggregated usage/statistics. It does not store arbitrary repo files.

### What happens if GitPreflight is offline or times out?

The commit is allowed. The commit is marked `UNCHECKED` locally under `.git/gitpreflight/`. The next run on the same branch is blocked until the backlog is cleared or explicitly bypassed.

### How do I bypass GitPreflight?

- One-shot bypass: `gitpreflight skip-next --reason "<why>"`
- Universal bypass: `git commit --no-verify`

### Is GitHub required?

For now, yes. GitPreflight sign-in uses GitHub.

### What does "reviews up to 5 files" mean on LLM Dabbler?

If a commit changes more than 5 files, GitPreflight reviews the first 5 files only (unique staged paths sorted lexicographically). The commit is still allowed, and the report includes a note listing skipped paths plus an upgrade CTA.
