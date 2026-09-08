# ADR 007 — Image throttling with skippable countdown

- Date: 2025-06-04
- Status: Accepted
- Commits: 30914fa (throttling), 8a3f55a (skip control + countdown)

## Context

Image-generation prompts pushed back-to-back hit the site's rate limits and fail. Users wanted automatic pacing but not an unavoidable multi-minute freeze when they know it is unnecessary.

## Decision

Count commands containing the literal substring `"create image"` (case-insensitive). After every N-th such command (setting `imageThrottleCount`, default 5), pause execution for `imageThrottleDelayMs` (default 2 minutes). The control panel shows a live countdown while `isImageThrottleActive` is set, plus a **Skip Image Wait** button (`skipImageThrottle()`) that ends the pause immediately; the remaining throttle time is honored across pause/resume cycles and cleared on stop. Quick-wait buttons (30s/1m/2m/5m) reuse the same pause-sleep-resume machinery for user-initiated waits.

## Consequences

- Rate-limit survival without global slowdowns of text-only chains.
- The heuristic misses image intents phrased differently ("draw", "generate a picture") and over-triggers on prose mentioning the phrase — known limitation, trivially adjustable.
- Throttle state is persisted in the per-chat state (`imageCounter`) so reloads keep their place.
