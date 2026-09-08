# prompt.md — One-shot recreation spec for the Chains extension

Give this document to a competent developer (or agent) with an empty directory and a Chrome browser; they should be able to recreate this extension from scratch, feature-complete, without asking questions. It captures the product goal, exact stack, phased build order, every UI/UX decision, the data model, the browser APIs used by name, and acceptance criteria.

## Goal

Build **"Chains - ChatGPT Workflow Automation - Smart Prompting"** — a Chrome Manifest V3 extension that automates multi-step conversations on AI chat sites. A user authors a *chain*: a sequence of prompts separated by a delimiter. Playing the chain types each prompt into the site's composer, sends it, waits for the response to complete, applies configured delays/throttling, and proceeds. The user can pause/resume, navigate steps, insert waits, monitor progress from three surfaces, and reload the page without losing execution state. Everything is stored locally; the extension makes no network calls of its own and collects nothing.

Primary target: `chatgpt.com` (full support). Also register `gemini.google.com` and `claude.ai` with placeholder selectors (loading but not tuned).

## Stack (exact)

- Plain **ES2021 JavaScript**, no framework, no bundler, no runtime dependencies. Files load directly via the manifest and `<script>` tags.
- **Chrome Manifest V3**, `minimum_chrome_version: "114"` (side panel + Document Picture-in-Picture).
- Dev-only npm packages: `mocha` (tests), `eslint` ^8 with `eslint:recommended` (env: browser, node, es2021, mocha; globals: `chrome`, `documentPictureInPicture`, `parseCommand`), `terser` (minification), `crx` ^5 (packing). `type: "commonjs"`.
- npm scripts: `test` → `mocha`; `lint` → `eslint *.js test/*.js`; `build` → `node build.js`.
- Code style: 2-space indent, double quotes, trailing commas.
- Visual language: Material-ish — Roboto font, primary `#1976d2`, elevation box-shadows, input focus rings, rounded corners.

## File map

```
manifest.json          # MV3 config (below)
siteAdapters.js        # per-site DOM selector adapters; runs before content.js
parseCommand.js        # pure parser for $wait/$sleep/$pause tags; global + CommonJS
content.js             # the chain engine + in-page UI (panel, sleep indicator, PiP)
background.js          # service worker: context menus, side panel opening
popup.html / popup.js  # toolbar popup: chain CRUD, settings, start position, status
sidepanel.html         # side panel (same page as popup.html, width 100% instead of 450px)
test/parseCommand.test.js  # mocha suite
build.js               # terser → dist/, zip + crx pack → build/
docs/index.html        # static promotion page (MUI CSS CDN, YouTube embed) — optional
PRIVACY.md             # local-only privacy policy
```

## Manifest (exact requirements)

- `manifest_version: 3`; name/short_name as in Goal; version `"1.2"`.
- `action.default_popup: "popup.html"`; `background.service_worker: "background.js"`; `side_panel.default_path: "sidepanel.html"`.
- Content scripts on `https://chatgpt.com/*`, `https://gemini.google.com/*`, `https://claude.ai/*`, injected JS in order: `siteAdapters.js`, `parseCommand.js`, `content.js`.
- Permissions: `storage`, `activeTab`, `scripting`, `contextMenus`, `sidePanel`. Host permissions for the three sites.
- `web_accessible_resources`: chains.png, screenshots, markdown-images; CSP `script-src 'self'; object-src 'self'`.
- One icon file (chains.png) reused for 16/32/48/128.

## Data model

- `chrome.storage.local.prompts` → `string[]` — saved chains (separator-embedded raw text).
- `chrome.storage.sync.extensionSettings` → `{ separator: "~", defaultDelayMs: 5000, imageThrottleCount: 5, imageThrottleDelayMs: 120000, enableSleepIndicator: true, enableFloatingProgress: true, controlPanelPosition: null | {x,y} }` — milliseconds internally.
- Page `localStorage["chatgpt-chain-states"]` → `{ [chatId]: { chain: string[], isRunning, isPaused, currentIndex, totalCommands, imageCounter, timestamp, pipWidth, pipHeight, pipLeft, pipTop } }`; chatId parsed from URL `/c/([a-f0-9-]+)`.
- Message actions (runtime/tabs): `ping`, `usePrompt {prompt, separator, startPosition}`, `updateConfig {newConfig}`, `togglePip`, `getState`, `showProgress`.

## Browser APIs by name

`chrome.storage.local`, `chrome.storage.sync`, `chrome.runtime.onMessage`/`sendMessage` (+`lastError` handling), `chrome.tabs.query`/`sendMessage`, `chrome.scripting.executeScript` (fallback injection), `chrome.contextMenus.create`/`onClicked`, `chrome.sidePanel.setOptions`/`open`, `documentPictureInPicture.requestWindow`, standard DOM (`querySelector`, `dispatchEvent(new Event("input"|"change"))`, `setInterval`, `ResizeObserver`-free resize listener).

## Phased build order

### Phase 1 — Engine skeleton
1. Manifest + popup with a textarea, Save/Edit/Delete chain list over `chrome.storage.sync` (later migrated).
2. `content.js` message listener for `usePrompt`: split by separator (regex `\n+` in newline mode), trim, drop empties, clamp `startPosition`.
3. `submitPrompt()`: set `textarea.value` **and** `textarea.textContent`; dispatch `input` + `change`; poll every 200ms for an enabled send button (budget ≈ 1500 attempts ≈ 5 min); click; reject → stop sequence.
4. `processNextCommand()` loop with state flags `isCommandExecuting` / `isWaitingForResponse` (re-entry guarded); increment index only after the response completes, then apply delay before the next command.
5. `isResponseComplete()` = composer speech button present (send-button disabled state deliberately not used).

### Phase 2 — Pausable engine + in-page UI
6. Pause/Resume/Stop semantics; sleep that freezes its countdown while paused.
7. Floating draggable control panel: status line ("Submitting command…", "Waiting for response…"), completed (struck-through) / current (badge: SUBMITTING, WAITING, PAUSED) / upcoming / queued steps, progress bar (6px rounded, width = completion %, tinted by status), Back/Forward buttons visible only while paused, Stop button. Draggable with viewport clamping (20px margin, re-clamped on window resize), position persisted.
8. Sleep indicator overlay: centered fixed box, message + mm:ss countdown, pause-aware.
9. Settings in popup: separator text input; Default Delay in **seconds** (step 0.1), Image Throttle Count (integer), Image Throttle Delay in **minutes** (step 0.1); toggles for sleep indicator and floating panel; Save → `chrome.storage.sync` + `updateConfig` message to the content script (applies immediately).
10. Storage split + `migratePromptsToLocal()` (dedupe merge sync→local, then remove from sync; run once per popup load); `chrome.runtime.lastError` handled everywhere with popup status messages.

### Phase 3 — Command syntax + tests
11. `parseCommand.js`: `$pause$` → `{command, explicitDelayMs: 0, isPauseCommand: true}` (strip tag; if remaining text non-empty, submit it first, then pause); `$wait 30s$` / `$wait 2m$` and legacy `$sleep30s$` / `$sleep2m$` (whitespace optional: `\s*`) → parsed ms delay, tag stripped; otherwise pass-through. Dual export (global + `module.exports`).
12. Mirror parser inline in `popup.js` (different shape: `{command, isPauseCommand, delayMs, isDelayCommand}`) to badge previews, step dropdowns, and the "Start from" select (label: `Step N: <20-char snippet>`).
13. Mocha suite `test/parseCommand.test.js`: table of 10 commands × expected `{command, explicitDelayMs, isPauseCommand}` asserted with `assert.strictEqual`.

### Phase 4 — Resilience + throttling
14. Busy-aware submission: while `!isResponseComplete()`, log-wait without consuming the attempt budget.
15. Retry recovery: on send-button timeout/disappearance, click `button[data-testid="regenerate-thread-error-button"]`, wait 1s, resubmit; keep `lastSubmittedPrompt` and expose `retryLastPrompt()`.
16. Image throttling: count commands containing `"create image"` (case-insensitive substring); after every N-th, pause `imageThrottleDelayMs`; panel shows live countdown + "Skip Image Wait" button; remaining throttle honored across resume; state cleared on stop; counter persisted.
17. Quick-wait row on panel: 30s / 1m / 2m / 5m buttons that pause → sleep → auto-resume (queue if a command is executing).
18. Per-chat state persistence: save on start/navigation/pause/completion; restore on load via `attemptRestoreState()` polling up to 10 × 1s for user messages in the DOM; ignore state >24h old; reconcile position against submitted user messages (match each chain command's first ≤50 chars, from the latest message backwards); resume unless paused; keep (not delete) state on stop so the popup can show last-run info. URL-change monitor (1s interval) re-keys state when the chat ID changes.

### Phase 5 — Surfaces
19. `background.js`: on install create context menus *Show Chain Progress*, *Open Side Panel*, *Toggle Picture-in-Picture* (contexts: all). Handlers: `setOptions` + **synchronously** `open` (user-gesture requirement — never inside a callback/await); wrap `open` and `tabs.sendMessage` in try/catch; ignore missing receivers.
20. `sidepanel.html`: duplicate popup page with `width: 100%`.
21. PiP: `documentPictureInPicture.requestWindow({width, height})`; body = absolute full-bleed iframe of `window.location.href`; html/body styles `width:100%;height:100%;margin:0;padding:0;overflow:hidden`; persist geometry per chat on resize/pagehide + 1s monitor; `moveTo` saved position (try/catch); toggle from popup button "Toggle PIP View" and the context menu via `togglePip` message.
22. Popup gates: warn unless active tab URL contains `chatgpt.com`; `ensureContentScript()` = `ping` then `chrome.scripting.executeScript` fallback; friendly error mapping ("Receiving end does not exist" → "refresh the page").

### Phase 6 — Multi-site, tooling, packaging
23. `siteAdapters.js`: `defaultAdapter = { textareaSelector: '#prompt-textarea', sendButtonSelector: 'button[aria-label="Send prompt"][data-testid="send-button"]', retryButtonSelector: 'button[data-testid="regenerate-thread-error-button"]', speechButtonSelector: 'button[data-testid="composer-speech-button"]', userMessageSelector: '[data-message-author-role="user"]' }`; per-domain overrides merged over defaults; exposed as `window.getSiteAdapter`. Gemini/Claude entries: `textarea`, `button[type="submit"]`, `.user-message` (placeholders).
24. Material restyle pass (Roboto, `#1976d2`, shadows, focus rings) across panel/popup/sidepanel; panel light-blue translucent background.
25. `build.js`: wipe+recreate `dist/`; terser-minify the five JS files (`drop_console`, 2 passes, no comments); copy manifest/HTML/images; generate `key.pem` once (`npx crx keygen`); zip `dist/` → `build/Chains.zip`; `npx crx pack` → `build/Chains.crx`. Gitignore `dist/`, `build/`, `key.pem`, `node_modules/`.
26. Add MIT LICENSE, PRIVACY.md (local-only data, permissions rationale), README, and optionally docs/index.html.

## All UI/UX decisions (checklist)

- Popup width 450px; side panel identical but fluid width.
- Chains listed as cards: numbered per-step preview with `Step N:` labels; inline Edit (textarea + Save/Cancel), Delete; Play Chain button; per-chain "Start from" dropdown with pause/wait badges.
- HTML-escape previews; quote-escape `data-prompt` attributes.
- Status toast in popup (success/error) auto-hiding after 3s; popup closes itself after a chain starts.
- Pro-tips section in popup (placeholder examples, `$wait`/`$pause` syntax).
- Control panel: fixed-position draggable card, z-index 20000+, default bottom-right (higher on short screens), saved position honored, clamped to viewport with 20px margin on resize.
- Step rows: completed = struck-through/muted; current = bold + status badge; queued = plain; colors communicate state; progress bar under the status line.
- Sleep indicator: fixed center overlay, `#1976d2` background, white text, shows "💤 <message>" + countdown `(Next command in MM:SS)` or `(Paused at MM:SS)` / `(Resume to continue)`.
- Panel action row: Play/Pause toggle, Stop (disabled unless running), Back/Forward (paused only), quick-wait buttons, PiP toggle (⧉), Skip Image Wait during throttle.
- Settings use human units with 1-decimal precision, stored as rounded ms.
- Context menu items appear on right-click anywhere on the page.

## Acceptance criteria

1. Load unpacked on Chrome 114+; `npm test` (10 parser cases) and `npm run lint` pass clean.
2. Create a 4-step chain with `~`; play from step 2; all steps submit in order; index advances only after responses complete.
3. `$wait 5s$` inserts exactly a 5s delay with countdown; `$pause$` halts after submitting its prefix; legacy `$sleep5s$` still works; `$wait5s$` (no space) works.
4. Pause freezes countdowns; Resume continues; Back/Forward reposition while paused; Stop halts and clears flags.
5. After every N-th `create image` command a throttle countdown appears and is skippable via the button.
6. Reload the tab mid-chain: after user messages render, the chain resumes at the reconciled position (within 24h).
7. Drag the panel, resize the window smaller: panel stays fully visible; position remembered across sessions.
8. Right-click → Show Chain Progress opens the side panel synchronously with the gesture; Toggle PiP opens an always-on-top window whose geometry is remembered; closing PiP restores nothing broken.
9. Settings edits propagate to a running content script immediately (panel toggles on/off without reload).
10. Storage: chains in `chrome.storage.local`, settings in `chrome.storage.sync`; a legacy sync `prompts` value migrates once and is removed from sync.
11. `npm run build` produces `dist/` (console-free minified), `build/Chains.zip`, `build/Chains.crx`, and a git-ignored `key.pem`; nothing in `dist/`/`build/` is committed.
12. No network calls beyond the page itself; no secrets in the repo; PRIVACY.md statements hold (all data local).
