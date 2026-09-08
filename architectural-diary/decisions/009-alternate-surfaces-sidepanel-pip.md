# ADR 009 — Alternate surfaces: side panel, context menus, Document PiP

- Date: 2025-06-05
- Status: Accepted
- Commits: e291840 + d7c6209 (PiP), 67408a7 (side panel + menus), 5b70e7a (gesture fix + new menu), 217f312 (error handling)

## Context

The floating in-page panel is the primary monitor, but users also wanted the chain visible off-page: a compact always-on-top window (PiP) while working in another tab/app, and Chrome's built-in side panel for a persistent UI. All control entry points should be reachable from the right-click menu.

## Decision

- **Document Picture-in-Picture** (`documentPictureInPicture.requestWindow()`, Chrome 114+ — hence the manifest's `minimum_chrome_version`): `togglePiP()` opens a window whose body holds a full-size absolutely-positioned `<iframe>` of the current chat URL, styled `100%`/`inset:0` so it resizes with the window (d7c6209). Window geometry (width/height/left/top) is saved per chat into the `chatgpt-chain-states` store on resize/pagehide and restored on open; a monitor interval also persists periodically.
- **Background service worker** registers three context menus on install: *Show Chain Progress* (opens the side panel and messages the tab), *Open Side Panel*, and *Toggle Picture-in-Picture* (messages the tab).
- **Side panel**: `sidepanel.html` — a fluid-width clone of the popup page, opened per-tab via `chrome.sidePanel.setOptions` + `open`.
- **User-gesture constraint**: `chrome.sidePanel.open()` must execute synchronously inside the gesture handler; calling it inside the `setOptions` callback loses the gesture and silently fails (fixed in 5b70e7a). All `sidePanel.open`/`tabs.sendMessage` calls are wrapped so missing receivers or rejections log instead of throwing uncaught errors (217f312).

## Consequences

- Three coordinated monitoring surfaces share one content-script engine via messages.
- PiP works because the iframe is the same origin as the page, so the embedded copy shares localStorage state.
- The gesture lesson is now a project gotcha — any new menu handler must call `open()` directly, not after an await/callback.
