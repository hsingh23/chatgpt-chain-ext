# AGENTS.md — Engineering guide for the Chains extension

Guidance for coding agents (and humans) working in this repository. Read this before making changes.

## What this is

A Chrome Manifest V3 extension ("Chains") that automates multi-step prompt chains on AI chat sites (chatgpt.com fully supported; gemini.google.com / claude.ai registered with placeholder selectors). No framework, no runtime dependencies — plain ES2021 JavaScript loaded directly by the browser. Dev-only npm packages: mocha, eslint, terser, crx.

## Commands

```bash
npm install     # install dev dependencies
npm test        # mocha unit tests (test/parseCommand.test.js)
npm run lint    # eslint over *.js and test/*.js
npm run build   # terser-minify JS into dist/, copy assets, zip + pack CRX into build/
```

There is no dev server and no bundler. To test changes end-to-end: load the repo root (or `dist/` after a build) as an unpacked extension at `chrome://extensions/` with Developer mode on, open chatgpt.com, and use the popup.

## Architecture map

Three runtime contexts communicate over `chrome.runtime` / `chrome.tabs` messages:

```
popup.html/popup.js (toolbar)        background.js (service worker)
        |                                      |
        |  chrome.tabs.sendMessage             | contextMenus -> sidePanel / tabs.sendMessage
        v                                      v
content script on the AI page:  siteAdapters.js -> parseCommand.js -> content.js
        |
        +-- floating control panel + sleep indicator (injected DOM)
        +-- Document Picture-in-Picture window (iframe of the page)
        +-- localStorage["chatgpt-chain-states"]  (per-chat chain state)
```

- **`siteAdapters.js`** (runs first): `getSiteAdapter()` returns per-domain DOM selectors merged over ChatGPT defaults. All site-specific coupling lives here. Exposed on `window` for the content script; also CommonJS-exportable for tests.
- **`parseCommand.js`**: pure function `parseCommand(text) -> { command, explicitDelayMs, isPauseCommand }`. Parses `$pause$`, `$wait 30s$`/`$wait 2m$`, and legacy `$sleep30s$`. Dual-environment: used by the content script and `require`d by mocha. **Note:** `popup.js` contains a second, near-duplicate copy of this logic for previews/dropdowns — keep them behaviorally in sync and extend both when changing syntax.
- **`content.js`** (the engine, ~1650 lines): message listener (`usePrompt`, `ping`, `togglePip`, `getState`, `showProgress`, `updateConfig`), the `processNextCommand()` loop, `submitPrompt()` (poll for an enabled send button every 200ms, up to ~5 min; detect busy state via the speech button; click the retry button and resubmit on failure), image throttling, pausable `sleep()` with countdown indicator, draggable control panel, state persistence (`saveChatState`/`loadChatState`/`restoreStateIfAvailable`/`findChainPosition`), URL-change monitor, and `togglePiP()`.
- **`background.js`**: registers three context menus on install; opens the side panel; must call `chrome.sidePanel.open()` synchronously within the user gesture (see gotchas).
- **`popup.js`**: chain CRUD in `chrome.storage.local.prompts`, settings in `chrome.storage.sync.extensionSettings`, start-position dropdown, `ensureContentScript()` ping/inject fallback, one-time `migratePromptsToLocal()` from old sync storage.
- **`sidepanel.html`**: same UI as popup.html with fluid width; loaded via the side panel API.
- **`build.js`**: minifies the five JS files (drop_console) into `dist/`, copies assets, zips to `build/Chains.zip`, packs signed CRX to `build/Chains.crx` using `key.pem` (generated on first run, git-ignored).

### Message actions (contract)
| Action | From → to | Payload / response |
|---|---|---|
| `ping` | popup → content | responds `{status:"ready"}`; used to detect/inject the content script |
| `usePrompt` | popup → content | `{prompt, separator, startPosition}` → `{status:"started", message}` |
| `updateConfig` | popup → content | `{newConfig}` merges into the content script's config |
| `togglePip` | popup/background → content | toggles the PiP window |
| `getState` / `showProgress` | popup/background → content | chain state / force-show control panel |

### Data model
- `chrome.storage.local.prompts`: `string[]` of chain texts (separator-embedded)
- `chrome.storage.sync.extensionSettings`: `{ separator, defaultDelayMs, imageThrottleCount, imageThrottleDelayMs, enableSleepIndicator, enableFloatingProgress, controlPanelPosition }`
- `localStorage["chatgpt-chain-states"]`: `{ [chatId]: { chain, isRunning, isPaused, currentIndex, totalCommands, imageCounter, timestamp, pipWidth, pipHeight, pipLeft, pipTop } }` — 24h restore window, position reconciled against the page's submitted user messages

## Conventions

- Conventional commits (`feat:`, `fix:`, `build:`, `style:`, `chore:`, `docs:`, `test:`), imperative subject ≤72 chars, body explaining what/why.
- 2-space indent, double quotes, trailing commas (Prettier-ish; enforced socially, not by a formatter config).
- Settings are stored in **ms** internally; popup displays seconds (1 decimal) / minutes (1 decimal) and converts on load/save.
- New DOM selectors for a site go in `siteAdapters.js` only, plus `manifest.json` matches + host_permissions.
- `console.log` is fine in source (stripped at build); avoid `console.debug`.
- No secrets, keys, or personal data in code or docs. `key.pem` and `.env` are git-ignored.

## Gotchas

- **`chrome.sidePanel.open()` must run in the user-gesture tick.** Wrapping it in the `setOptions()` callback loses the gesture — call both synchronously (see `background.js` and 5b70e7a/217f312).
- **React composers need both `value` and `textContent`** plus `input`/`change` events, or ChatGPT ignores the injected prompt (77d5d62).
- **Response-complete detection** relies on the composer speech button being present (`isResponseComplete()`); the send-button state is deliberately not used (40de5e6).
- **State restore must wait for the conversation DOM.** `attemptRestoreState()` polls for user messages (up to 10 × 1s) before restoring; restoring too early mis-detects the last command (8d1894a).
- **Duplication risk:** prompt parsing exists in `parseCommand.js` *and* inline in `popup.js`; the image command heuristic is the literal substring `"create image"`; the popup gate hard-checks `tabs[0].url.includes("chatgpt.com")` even though the manifest now matches three sites.
- **Sequencing:** `currentCommandIndex` increments only after a response completes, *before* the post-command delay; pause checks happen after sleeps resolve. Re-entry is guarded by `isCommandExecuting`/`isWaitingForResponse`.
- **`dist/` and `build/` are wiped on every build**; the CRX key is generated once and must never be committed.
- History note: commit messages were rewritten (messages-only) on 2026-09-08; hashes changed, trees did not. Local backup branch: `backup/pre-docs-20260908`.

## Verifying changes

1. `npm test` — parser behavior (extend `test/parseCommand.test.js` when touching `parseCommand.js` or the popup's copy).
2. `npm run lint` — must be clean.
3. Manual, on chatgpt.com with the unpacked extension:
   - play a chain from a middle step; pause/resume; Back/Forward while paused
   - `$wait`/`$pause`/legacy `$sleep` steps behave; quick-wait buttons and Skip Image Wait work
   - reload the page mid-chain → state restores and resumes
   - popup settings changes reach the running content script (`updateConfig`)
   - context menu opens the side panel and toggles PiP
   - `npm run build` succeeds and `dist/` loads as an unpacked extension

## Pointers

- Full commit-by-commit history: [CHANGELOG.md](CHANGELOG.md)
- Architecture narrative and decision records: [architectural-diary/](architectural-diary/)
- One-shot recreation spec: [prompt.md](prompt.md)
- Privacy commitments made to users: [PRIVACY.md](PRIVACY.md)
- Promotion site source: [docs/index.html](docs/index.html)
