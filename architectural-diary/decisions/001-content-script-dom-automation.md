# ADR 001 — Content-script DOM automation as the engine

- Date: 2025-05-31 → 2025-06-02
- Status: Accepted (foundational)
- Commits: 0fbaf25 (initial import), 30914fa (engine rewrite), 35e6f09 (re-entry guards), 0731f18 (draggable panel)

## Context

The extension must drive a conversation on a chat website the way a user would: type a prompt, send it, wait for the answer, then send the next one. There is no official API for the site's conversation loop, and the product explicitly avoids accounts, servers, and network calls.

## Decision

Automate the page's own DOM from a content script. `submitPrompt()` writes to the composer (`textarea.value` **and** `textarea.textContent`, then dispatches `input` and `change` events for React), polls for an enabled send button at 200ms intervals with an attempt budget, clicks it, and the engine polls a completion heuristic before advancing. The engine is an explicit state machine in one file (`content.js`): `currentChain`, `currentCommandIndex`, `isPaused`, `isCommandExecuting`, `isWaitingForResponse`, with `processNextCommand()` as the single loop entry point guarded against re-entry.

## Consequences

- No background coordination needed for execution; everything runs where the conversation lives.
- Breakage risk is site UI churn — mitigated later by the adapter layer (ADR 008) and by retry-button recovery.
- React quirk required setting `textContent` too (77d5d62) or the composer ignores injected text.
- The single-file engine grew to ~1650 lines; acceptable for this scope but the main refactor hazard going forward.
