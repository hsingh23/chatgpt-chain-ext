# Architectural diary — Chains extension

A narrative history of how this codebase got its shape, reconstructed from the 80 commits on `main` (May 31 – June 6, 2025) plus the 2026-09-08 documentation pass. Each decision has a record in [decisions/](decisions/).

> Note on hashes: commit messages were improved via a messages-only rewrite on 2026-09-08, so hashes cited here (current `main`) differ from pre-rewrite clones. Trees and contents are identical.

## Timeline

### Phase 1 — Core engine (May 31 – Jun 2)
The project starts as a single-purpose ChatGPT automator (0fbaf25): an MV3 content script that splits a saved prompt list by a separator, types each prompt into `#prompt-textarea`, clicks send, and polls until the response finishes. The popup is a plain CRUD list over `chrome.storage.sync`.

The engine rewrite (30914fa) turns this into a *configurable, pausable state machine*: settings loaded from storage, a floating draggable control panel, a pause-aware sleep indicator with countdown, `$sleepNs$` delay tags, image-generation throttling, and retrying send-button clicks. Almost everything later commits do is refinement of this skeleton: fix the send-button selector (40de5e6), set `textContent` as well as `value` for React (77d5d62), guard the loop against re-entry with execution-state flags (35e6f09), and drag + persisted panel position with Back/Forward step navigation while paused (0731f18).

### Phase 2 — UX and storage maturity (Jun 2 – Jun 4)
Storage is split by concern: chains move to `chrome.storage.local` with a one-time deduplicating migration off sync storage (1684c51); settings stay in sync. The popup gains fractional timing inputs in human units (8aad824), start-anywhere step selection, live completed/current/upcoming display, and a page-status banner with ping/inject fallback for the content script (7805f53), plus a progress bar on the panel (9b8394a).

Command syntax gets human-friendly: `$wait 30s$` / `$wait 2m$` with `$pause$` checkpoints replace the old `$sleep30s$` form (4dc2123, regex fix in 538ca1b), badges appear in previews and dropdowns, and quick-wait buttons plus a skippable image-throttle countdown land on the panel (8a3f55a).

Identity work happens here too: rebrand to "Chains" with a new icon and manifest description (0afc9da), first README (311e36b), and PRIVACY.md (8292799) documenting the local-only data stance.

### Phase 3 — Resilience and surfaces (Jun 4 – Jun 5)
Two durability features define this phase:

1. **Per-chat state persistence** (a6451fb): chain progress saved to page `localStorage` keyed by the chat ID from the URL, restored within 24 hours and reconciled against the prompts actually visible in the DOM, with retry-button recovery for failed submissions. Restore timing is then made robust by polling for the conversation DOM instead of a fixed delay (a20e7e0 → 8d1894a).
2. **Alternate monitoring surfaces** (e291840, d7c6209, 67408a7, 5b70e7a, 217f312): a Document Picture-in-Picture window with saved geometry, a background service worker with context menus, and Chrome's side panel — including learning that `chrome.sidePanel.open()` must be called synchronously inside the user gesture.

Submission resilience improves (e846471: wait for the site to finish responding without burning the timeout budget; 7dd47f2: bigger budget), and the parser becomes a shared, unit-tested module under mocha (1457bdc → 889abc8).

### Phase 4 — Multi-site and packaging (Jun 5)
The site adapter layer (a4e2fb5) extracts every DOM selector into `siteAdapters.js` and registers gemini.google.com and claude.ai (with placeholder selectors). Tooling matures: MIT license + eslint (ba0f84f), terser-minified `dist/` builds (b8b58d6), a Material-style visual refresh with viewport-clamped panel (b9689e9), and a signed-CRX packaging pipeline — including the incident of a committed 4.9 MB binary (8f960e2) corrected by moving artifacts to `build/` (1e02c8f) and dropping CI (983cfaa). The phase ends with the GitHub Pages promotion site (8d405b4, daa647b/5cde4f2) and its merges (PRs #23–#25).

### Phase 5 — Documentation (2026-09-08)
Messages-only history rewrite (44 commit messages; trees unchanged), then this documentation set: CHANGELOG.md, README.md, AGENTS.md, this diary, and prompt.md.

## Shape of the system today

- **One engine** (`content.js`) owns execution; every other file either feeds it (popup messages, adapters, parser) or observes it (panel, PiP, side panel).
- **All state is local**: `chrome.storage.local` for chains, `chrome.storage.sync` for settings, page `localStorage` for per-chat runtime state. No servers, no analytics, no network calls of its own.
- **Site coupling is quarantined** in `siteAdapters.js` + manifest matches.
- **Known debt**: duplicate parser in `popup.js`, the literal `"create image"` heuristic, popup's chatgpt.com-only URL gate, and placeholder selectors for Gemini/Claude.

## Decision index

| # | Decision | Record |
|---|---|---|
| 1 | Content-script DOM automation as the engine | [001-content-script-dom-automation.md](decisions/001-content-script-dom-automation.md) |
| 2 | Separator-delimited plain-text chains | [002-separator-delimited-chain-format.md](decisions/002-separator-delimited-chain-format.md) |
| 3 | Inline `$wait`/`$pause` command tags | [003-inline-command-tags.md](decisions/003-inline-command-tags.md) |
| 4 | Storage split: local chains, synced settings, migration | [004-storage-split-and-migration.md](decisions/004-storage-split-and-migration.md) |
| 5 | Per-chat state persistence with DOM reconciliation | [005-per-chat-state-persistence.md](decisions/005-per-chat-state-persistence.md) |
| 6 | Response-completion detection via speech button | [006-response-completion-detection.md](decisions/006-response-completion-detection.md) |
| 7 | Image throttling with skippable countdown | [007-image-throttling.md](decisions/007-image-throttling.md) |
| 8 | Site adapter layer for multi-site support | [008-site-adapter-layer.md](decisions/008-site-adapter-layer.md) |
| 9 | Side panel + context menus + Document PiP surfaces | [009-alternate-surfaces-sidepanel-pip.md](decisions/009-alternate-surfaces-sidepanel-pip.md) |
| 10 | Terser + CRX packaging pipeline | [010-build-packaging-pipeline.md](decisions/010-build-packaging-pipeline.md) |
