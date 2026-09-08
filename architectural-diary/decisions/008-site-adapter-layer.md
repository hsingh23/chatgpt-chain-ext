# ADR 008 — Site adapter layer for multi-site support

- Date: 2025-06-05
- Status: Accepted (integration incomplete for two sites)
- Commits: a4e2fb5 (adapters), b9689e9 (lint pragma)

## Context

The engine was born hardwired to ChatGPT's selectors. Supporting Gemini and Claude — or any future chat site — by copy-pasting the engine per site would be unmaintainable; the only per-site knowledge is a handful of DOM selectors.

## Decision

Extract the selectors into `siteAdapters.js`: a `defaultAdapter` (ChatGPT's selectors: `#prompt-textarea`, `button[aria-label="Send prompt"][data-testid="send-button"]`, the retry and speech buttons, `[data-message-author-role="user"]`) plus a per-domain override map merged over the defaults by `getSiteAdapter()` (exact host or subdomain match). The file runs **before** `content.js` in the manifest's content-script list and exposes the factory on `window`; it is also CommonJS-exportable for tests. `manifest.json` registers `gemini.google.com` and `claude.ai` in both `content_scripts.matches` and `host_permissions`, with deliberately placeholder selectors (`textarea`, `button[type=submit]`, `.user-message`) marked as needing updates.

## Consequences

- New site = one adapter entry + two manifest lines; engine untouched.
- Honest incompleteness: Gemini/Claude match and load but are not actually usable until their selectors and completion heuristics are tuned; the README says so.
- Residual site coupling outside adapters: the popup's play gate still hard-checks `tabs[0].url.includes("chatgpt.com")` — flagged as debt.
