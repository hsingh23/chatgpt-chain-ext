# ADR 005 — Per-chat state persistence with DOM reconciliation

- Date: 2025-06-04 → 2025-06-05
- Status: Accepted
- Commits: a6451fb (persistence + retry), a20e7e0 (3.5s delay), 67408a7 (keep state on stop), 8d1894a (retry-based restore)

## Context

Long chains outlive a single page view: users refresh, navigate between chats, or hit connection errors. Losing position forces restarting the whole chain, and ChatGPT pages reject re-submitting already-answered prompts gracefully only if the position is accurate.

## Decision

Persist the engine's state to the **page's own `localStorage`** under key `chatgpt-chain-states`, keyed by the chat ID parsed from the URL (`/c/<uuid>`). `saveChatState()` runs on start, navigation, pause, and after each command completes; state merges with prior per-chat data (which also stores PiP geometry). On load, `attemptRestoreState()` polls (up to 10 × 1s) for user messages in the DOM, then `restoreStateIfAvailable()`:

- ignores state older than 24 hours,
- reconciles the claimed position against prompts actually visible on the page (`findChainPosition` matches the tail of each parsed command, up to 50 chars, against submitted user messages),
- resumes automatically unless the state was paused, and only if the chain is not already complete.

A URL-change monitor re-keys the state when the user switches chats. `stopSequence()` keeps (not deletes) the final state so the popup can show last-run info.

## Consequences

- Refresh-safe execution; per-chat isolation for free.
- Restore timing had two iterations (fixed 1s → fixed 3.5s → retry polling) before the DOM-ready problem was properly solved.
- Truth is the DOM, not the stored index — resilient to the page having executed more/less than recorded.
- Storage is per-origin and could collide with other extensions in theory; namespaced key mitigates.
