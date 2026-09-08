# ADR 004 — Storage split: local chains, synced settings, one-time migration

- Date: 2025-06-02
- Status: Accepted
- Commits: 1684c51 (split + migration), dcc8e7d (duplicate migration call fix), 8aad824 (fractional units)

## Context

Chains are unbounded and can be large; `chrome.storage.sync` has a small quota (~100KB total) and prompted quota errors. Settings are tiny and benefit from following the user across devices. The first version stored everything in sync.

## Decision

- **Chains** → `chrome.storage.local` key `prompts` (`string[]`), device-specific, effectively unlimited.
- **Settings** → `chrome.storage.sync` key `extensionSettings` (`{ separator, defaultDelayMs, imageThrottleCount, imageThrottleDelayMs, enableSleepIndicator, enableFloatingProgress, controlPanelPosition }`), ms internally.
- On popup load, `migratePromptsToLocal()` runs once: merge (dedupe) any sync-stored prompts into local, then remove them from sync. A duplicate invocation was introduced and removed (dcc8e7d).
- All storage reads/writes handle `chrome.runtime.lastError` and surface failures in the popup status line.

## Consequences

- No quota pressure; settings still roam.
- Fresh installs on second devices don't inherit chains — accepted, documented in the README/privacy policy.
- Migration is idempotent and safe to leave running on every popup open.
- Popup converts ms ↔ seconds/minutes (one decimal) at the UI boundary, stored values stay integers via `Math.round`.
