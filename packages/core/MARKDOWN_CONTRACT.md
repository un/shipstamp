# Shipstamp Markdown Output Contract (v0)

This document defines the stable Markdown format that Shipstamp prints from `shipstamp review --staged`.
It is designed to be:

- Deterministic and easy to parse.
- Safe to print in non-TTY contexts (git hooks, CI).
- Friendly for LLMs to apply fixes via suggestion blocks.

## Top-level sections (required)

1) `Result:` one of `PASS`, `FAIL`, `UNCHECKED`
2) `Counts:` a single line with `note`, `minor`, `major`
3) `Findings` grouped by file path

## Output skeleton

```md
# Shipstamp Review

Result: PASS
Counts: note=0 minor=0 major=0

## Findings

### path/to/file.ts

#### <short title>
Path: path/to/file.ts
Line: 42
Severity: minor
Agreement: 2/3

<explanation paragraphs>

```suggestion
<replacement code>
```
```

## Per-finding fields

Each finding MUST include these labeled fields, each on its own line:

- `Path:` repo-relative path
- `Severity:` `note` | `minor` | `major`
- `Agreement:` `<agreed>/<total>`

Optional labeled fields:

- `Line:` best-effort 1-based line number

## Grouping and ordering rules

- Group findings under `### <path>` headings.
- Sort file paths lexicographically.
- Within a file, sort findings by: severity (major, minor, note), then line (ascending), then title.
- If a line is unknown, treat it as after numbered lines.

## Exit code mapping

- Exit `0`: `PASS` (no findings or only `note`).
- Exit `1`: `FAIL` (at least one `minor` or `major`).
- Exit `2`: internal error.
  - v0 policy may still allow the git commit, but the run is treated as `UNCHECKED` and queued locally.
