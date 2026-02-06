# S016 Draft File Cap Semantics Copy

## LLM Dabbler 5-file cap

If a commit changes more than 5 files:

- GitPreflight reviews the first 5 files only.
- The commit is still allowed.
- The report includes a non-blocking note that lists the skipped paths and suggests upgrading.

Deterministic ordering:

- Unique staged file paths, sorted lexicographically, take the first 5.
