# S014 Draft Proof + Privacy Copy

## Proof (bullets)

- Stable Markdown output contract (designed for LLMs and agents, not humans skimming a UI).
- `suggestion` blocks make fixes copy/pasteable and machine-applicable.
- Runs on the staged diff only, so review scope stays small and intentional.

## Privacy stance (bullets)

- GitPreflight avoids storing customer repo source code at rest.
- The server stores instruction file contents (by hash) when configured (e.g. `AGENTS.md`).
- The server stores review outputs and aggregated usage/statistics.
- The server does not store arbitrary repo files.

## Notes

- Mirrors `code/README.md` privacy language; do not overpromise.
