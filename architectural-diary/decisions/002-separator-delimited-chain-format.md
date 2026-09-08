# ADR 002 — Separator-delimited plain-text chains

- Date: 2025-05-31 → 2025-06-02
- Status: Accepted
- Commits: 0fbaf25, 30914fa, 7805f53 (start position)

## Context

Users author chains in a textarea. They need multi-line prompts inside one step, quick editing, and portability (copy/paste a chain anywhere). A JSON editor or one-prompt-per-row UI would fight multi-line prompts or add friction.

## Decision

A chain is a single plain-text blob; steps are separated by a **configurable separator**, default `~`. Newline mode (`\n`) splits one prompt per line; arbitrary text separators (`###`, `||`) are supported. On `usePrompt`, the content script splits with `String.split(separator)` (regex `\n+` in newline mode), trims, and drops empties. The start position is passed alongside, clamped to the chain length. Saved chains are stored as raw strings.

## Consequences

- Zero-friction authoring; previews re-split client-side for display and dropdowns.
- A separator that occurs naturally inside a prompt corrupts the split — the docs warn implicitly by offering alternatives.
- Storage stays dumb (`string[]`), which kept the sync→local migration (ADR 004) trivial.
