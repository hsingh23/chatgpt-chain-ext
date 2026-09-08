# ADR 003 — Inline `$wait` / `$pause` command tags

- Date: 2025-06-02 → 2025-06-05
- Status: Accepted
- Commits: 30914fa (`$sleepNs$`), 4dc2123 (`$wait`/`$pause`), 538ca1b (regex fix), 889abc8 (shared module + mocha)

## Context

Timing and checkpoints are per-step properties of a chain, not global settings. They must be authored inline with the prompts, survive as plain text, and degrade harmlessly if the syntax is unknown.

## Decision

Tags are parsed out of the raw prompt text before submission:

- `$pause$` (case-insensitive) — strip the tag; optionally submit the remaining prefix prompt, then halt the chain in the paused state until the user resumes.
- `$wait 30s$` / `$wait 2m$` — strip the tag; apply the parsed delay after this step. Legacy `$sleep30s$`/`$sleep2m$` still parses (whitespace optional after the fix in 538ca1b: `\s+` → `\s*`).
- Anything else — send as-is.

The parser is a pure function in `parseCommand.js`, dual-environment (global for the content script, CommonJS export for mocha), with the canonical test suite in `test/parseCommand.test.js`.

## Consequences

- Chains remain plain text; tags render as badges in previews and step dropdowns.
- **Debt:** `popup.js` carries a second, near-identical copy of the parser (with a different return shape) for previewing; syntax changes must be made twice and tested against both.
- Tag regexes strip only the first occurrence, and tags are positional metadata only — no branching/conditionals by design.
