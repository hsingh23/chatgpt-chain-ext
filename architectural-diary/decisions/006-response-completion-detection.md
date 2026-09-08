# ADR 006 — Response-completion detection via the composer speech button

- Date: 2025-06-02 → 2025-06-05
- Status: Accepted
- Commits: 0fbaf25 (initial polling), 40de5e6 (speech-button heuristic), e846471 (busy-aware submission), 7dd47f2 (budget), a6451fb (retry button recovery)

## Context

To advance a chain, the engine must know when the site finished generating its answer. The site provides no completion event; DOM signals (streaming indicators, disabled buttons) are the only options, and generation can take minutes.

## Decision

`isResponseComplete()` returns whether the composer's **speech button** (`button[data-testid="composer-speech-button"]`) is present — deliberately ignoring the send button's disabled state, which proved unreliable (40de5e6). Submission is busy-aware (e846471): while a response is in flight, `submitPrompt()` waits without consuming its attempt budget, reserving the timeout (~5 min at 200ms polls) for genuine send-button availability. If the send button disappears or the budget is exhausted, the engine looks for the site's **regenerate/retry button** (`button[data-testid="regenerate-thread-error-button"]`), clicks it, and resubmits; `retryLastPrompt()` reuses this for manual recovery.

## Consequences

- Works without touching the site's network layer; survives UI redesigns only if the testids survive.
- The heuristic is ChatGPT-specific; other adapters share the selector shape but not the reliability (see ADR 008 placeholders).
- The speech-button selector lives in `siteAdapters.speechButtonSelector`, so sites without a speech control need a different completion signal — an open integration task.
