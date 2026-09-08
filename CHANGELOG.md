# Changelog

All notable changes to the **Chains - ChatGPT Workflow Automation** Chrome extension, newest first.

> **History note (2026-09-08):** Commit messages in this repository were improved via a messages-only history rewrite (`git filter-branch --msg-filter`). File contents and tree structure are unchanged; commit hashes before 2026-09-08 differ from earlier clones. A pre-rewrite backup branch `backup/pre-docs-20260908` exists locally. 44 commit messages were rewritten to follow the conventional-commit style.

## 2025-06-06 · `565cf12` · Merge pull request #24 from hsingh23/ctcf5i-codex/create-github-page-for-chains-promotion

- Merge of PR #24 (ctcf5i-codex/create-github-page-for-chains-promotion).
- Content no-op: the tree matches first parent because the branch's changes had already landed via PR #25; records the PR closure.

## 2025-06-06 · `d58de24` · Merge branch 'main' into ctcf5i-codex/create-github-page-for-chains-promotion

- Routine sync of main into the GitHub Pages feature branch before its merge.

## 2025-06-05 · `9ddbd63` · Merge pull request #25 from hsingh23/xblxw6-codex/create-github-page-for-chains-promotion

- Lands the GitHub Pages layout rework and inline privacy policy from the xblxw6 feature branch.

## 2025-06-05 · `405c7f1` · Merge branch 'main' into xblxw6-codex/create-github-page-for-chains-promotion

- Routine sync of main into the GitHub Pages feature branch before its merge.

## 2025-06-05 · `daa647b` · Improve GitHub Pages layout and inline privacy policy

- Restructures docs/index.html into semantic sections with condensed feature/use-case/FAQ copy and responsive styles.
- Adds footer link plus a full inline Privacy Policy section (effective June 4, 2025) covering local-only data storage and permissions.

## 2025-06-05 · `5cde4f2` · Improve GitHub Pages layout and inline privacy policy

- Restructures docs/index.html into semantic sections with condensed copy and responsive styles.
- Adds footer link plus inline Privacy Policy section; sibling of daa647b landing via PR #25.

## 2025-06-05 · `d3545f5` · Merge pull request #23 from hsingh23/codex/create-github-page-for-chains-promotion

- First merge of the GitHub Pages promotion site (PR #23).

## 2025-06-05 · `8d405b4` · docs: add GitHub Pages site

- Adds docs/index.html: MUI-styled landing page with YouTube demo embed, promo images, feature and FAQ sections.

## 2025-06-05 · `4495efe` · Merge pull request #22 from hsingh23/codex/create-private-key-and-update-build-command

- Lands the build-directory rework and shortened manifest description (PR #22).

## 2025-06-05 · `1e02c8f` · build: output ZIP and CRX to build dir, shorten description

- Creates/cleans a dedicated build/ directory; zips dist/ to build/Chains.zip and packs the signed CRX to build/Chains.crx.
- Removes the accidentally committed 4.9 MB Chains.crx binary and ignores build/.
- Shortens the manifest description to a store-friendly one-liner.

## 2025-06-05 · `7af637d` · Merge pull request #21 from hsingh23/codex/create-private-key-and-update-build-command

- Lands the private-key packaging flow (PR #21).

## 2025-06-05 · `8f960e2` · build: output CRX to project root and commit packed Chains.crx

- Moves packed CRX output from dist/ to the project root so it survives the per-build wipe of dist/.
- Also commits the generated 4.9 MB Chains.crx binary (removed again in 1e02c8f).

## 2025-06-05 · `a3f8a18` · build: clean dist, rename CRX, and enrich manifest metadata

- Clears dist/ before each build and renames the packed output to Chains.crx.
- Enriches manifest.json: host_permissions for the three AI sites, web_accessible_resources, multi-size icons, minimum_chrome_version 114, CSP block.
- Renames the package.json package to the store-style name.

## 2025-06-05 · `983cfaa` · chore: drop CI workflow and VSCode tasks, gitignore key.pem

- Deletes .github/workflows/test.yml and .vscode/tasks.json to clear the way for key-based packaging.
- Adds key.pem to .gitignore so the CRX signing key is never committed.

## 2025-06-05 · `71287cc` · build: pack extension into signed CRX during build

- Adds the crx devDependency and extends build.js to generate key.pem on first build via `npx crx keygen`.
- Packs dist/ into a signed CRX; README documents the CRX and key outputs.

## 2025-06-05 · `3cda1e0` · Merge pull request #20 from hsingh23/codex/improve-ui-design-like-mui

- Lands the Material-style UI refresh (PR #20).

## 2025-06-05 · `1518d74` · Merge branch 'main' into codex/improve-ui-design-like-mui

- Routine sync of main into the MUI restyle branch.

## 2025-06-05 · `b9689e9` · feat: keep control panel in viewport on resize and apply MUI styling

- Adds ensureControlPanelInView() clamping the draggable panel into the viewport (20px margin) on resize, persisting the corrected position.
- Applies Material-like restyle across control panel, popup, and side panel: Roboto, #1976d2 palette, elevation shadows, focus rings.

## 2025-06-05 · `df73d29` · Merge pull request #19 from hsingh23/codex/add-minify-build-to-dist-folder

- Lands the build polish for the minify pipeline (PR #19).

## 2025-06-05 · `93ebdfe` · fix: update .gitignore and enhance minification settings in build script

- Updates .gitignore for build outputs and tightens terser minification (drop_console, 2-pass compress, comments stripped).

## 2025-06-05 · `d96cb2f` · Merge pull request #18 from hsingh23/codex/add-minify-build-to-dist-folder

- Lands the new-screenshots build fix (PR #18).

## 2025-06-05 · `9980615` · fix: bundle new screenshots in build asset list

- Adds screenshot.png and screenshot2.png to the repo.
- Replaces padded_scrn.png with screenshot2.png in build.js's copied asset list.

## 2025-06-05 · `db082d3` · Merge branch 'main' into codex/add-minify-build-to-dist-folder

- Routine sync of main into the minify-build branch.

## 2025-06-05 · `7b20614` · chore: update README images and remove obsolete screenshots

- Updates README images and removes obsolete screenshots from the repo.

## 2025-06-05 · `b8b58d6` · build: add terser minified build pipeline to dist/

- Adds build.js: terser-minifies the five extension JS files into dist/ and copies manifest/HTML/images.
- Wires `npm run build`, adds terser devDependency, ignores dist/, updates README install instructions.

## 2025-06-05 · `68b765d` · chore: update chains.png image file

- Refreshes the chains.png icon asset.

## 2025-06-05 · `bd8a237` · Merge pull request #16 from hsingh23/codex/refactor-code-for-additional-websites-support

- Lands the multi-site adapter refactor (PR #16).

## 2025-06-05 · `f0d1468` · Merge branch 'main' into codex/refactor-code-for-additional-websites-support

- Routine sync of main into the multi-site refactor branch.

## 2025-06-05 · `2ed4a5a` · Merge pull request #17 from hsingh23/codex/suggest-improvements-for-project

- Lands project improvements: license, CI, lint (PR #17).

## 2025-06-05 · `ba0f84f` · Add MIT license, CI workflow, and lint setup

- Adds MIT LICENSE, Node.js CI workflow (.github/workflows/test.yml), and .eslintrc.json (eslint:recommended).
- CI was later removed in 983cfaa; the eslint config remains the project standard.

## 2025-06-05 · `a4e2fb5` · refactor: add site adapter layer to support multiple AI websites

- Extracts per-site DOM selectors (textarea, send/retry/speech buttons, user messages) into siteAdapters.js with ChatGPT defaults.
- Replaces hardcoded selectors in content.js with adapter lookups; manifest registers gemini.google.com and claude.ai (placeholder selectors).

## 2025-06-05 · `36a5cf2` · Merge pull request #14 from hsingh23/codex/create-right-click-menu-to-open-side-panel

- Lands the side panel context menu feature (PR #14).

## 2025-06-05 · `5b70e7a` · feat: add Open Side Panel context menu and fix side panel open gesture

- Adds an 'open-side-panel' context menu item calling chrome.sidePanel.setOptions/open for the tab.
- Calls setOptions/open synchronously in 'show-progress' so the user gesture required by chrome.sidePanel.open is preserved.

## 2025-06-05 · `a0df94c` · Merge pull request #13 from hsingh23/codex/fix-uncaught-promise-errors

- Lands the uncaught-promise-errors fix (PR #13).

## 2025-06-05 · `217f312` · fix: handle side panel open and sendMessage errors in context menu

- Replaces promise-chained setOptions().then() with callback form and wraps sidePanel.open in try/catch.
- Guards chrome.tabs.sendMessage calls to ignore tabs without a content script receiver.

## 2025-06-05 · `2fce330` · Merge pull request #12 from hsingh23/codex/remove-existing-test-and-add-unit-tests-for-extension

- Lands mocha unit testing (PR #12).

## 2025-06-05 · `889abc8` · Add unit testing with mocha and refactor parseCommand

- Replaces the ad-hoc test-commands.js with mocha suite test/parseCommand.test.js covering $wait/$sleep/$pause parsing.
- Refactors parseCommand into a shared parseCommand.js module usable by both the content script and Node (CommonJS export).

## 2025-06-05 · `1a125a6` · Merge pull request #11 from hsingh23/codex/add-right-click-menu-for-progress-and-toggle-pip

- Lands the side panel and context menus (PR #11).

## 2025-06-05 · `67408a7` · feat: add side panel, context menu, and stopped-chain state persistence

- Adds background.js service worker with 'Show Chain Progress' and 'Toggle Picture-in-Picture' context menus.
- Adds sidepanel.html and contextMenus/sidePanel permissions (manifest 1.2).
- Preserves chain state in localStorage on stopSequence instead of deleting it; popup surfaces last run info.

## 2025-06-05 · `b43bfa7` · Merge pull request #10 from hsingh23/codex/improve-prompt-submission-resilience

- Lands the prompt submission resilience fix (PR #10).

## 2025-06-05 · `7dd47f2` · Increase prompt submission wait time

- Raises the submitPrompt() attempt budget so slow send-button availability does not abort the chain.

## 2025-06-05 · `e846471` · fix: wait for ChatGPT to finish responding before submitting next prompt

- Detects an in-progress response via isResponseComplete() inside the submit polling loop.
- Waits (with periodic logging) without incrementing the attempt counter, reserving the timeout budget for send-button availability.

## 2025-06-05 · `fb64095` · Merge pull request #9 from hsingh23/codex/fix-incorrect-last-command-detection-on-page-load

- Lands the state-restore timing fix (PR #9).

## 2025-06-05 · `f542358` · Merge branch 'main' into codex/fix-incorrect-last-command-detection-on-page-load

- Routine sync of main into the restore-timing fix branch.

## 2025-06-05 · `8d1894a` · fix: wait for user messages before restoring state on page load

- Replaces the fixed 3500ms restore delay with retry-based attemptRestoreState() polling up to 10 times (1s apart) for user messages in the DOM.
- Fixes incorrect last-command detection when page load is slower than the fixed delay.

## 2025-06-05 · `20bf49c` · Merge pull request #8 from hsingh23/codex/edit-comments-in-content.js

- Lands the comment/formatting cleanup (PR #8).

## 2025-06-05 · `ac02bd6` · style: reformat popup HTML/JS and content.js for readability

- Consistent formatting pass over popup.html, popup.js, and content.js (indentation, quotes, line splits); no behavior changes.

## 2025-06-05 · `a20e7e0` · fix: delay state restore to 3.5s and normalize PiP code formatting

- Increases the initial state-restore timeout from 1s to 3.5s so the conversation finishes loading first.
- Normalizes whitespace in control panel and Picture-in-Picture code.

## 2025-06-05 · `147026a` · style: fix run-together image throttle comment in content.js

- Moves the image-throttling section header comment onto its own line in content.js.

## 2025-06-05 · `d47881b` · Merge pull request #7 from hsingh23/codex/replace-console-log-with-assert-module

- Lands the assert-based test script (PR #7).

## 2025-06-05 · `1457bdc` · test: assert expected parser results in test-commands.js

- Replaces console.log test output with an expected-results table verified via assert.strictEqual for command text, delay, and pause flag.

## 2025-06-05 · `fac87ac` · Merge pull request #6 from hsingh23/codex/remove-duplicate-migration-call-in-popup.js

- Lands the duplicate-migration fix (PR #6).

## 2025-06-05 · `dcc8e7d` · fix: remove duplicate migratePromptsToLocal() call in popup.js

- Drops the redundant migratePromptsToLocal() invocation so prompts migrate once per extension load.

## 2025-06-05 · `8fc5b4a` · Merge pull request #5 from hsingh23/codex/implement-pip-view-with-saved-settings

- Lands the Picture-in-Picture view (PR #5).

## 2025-06-05 · `d7c6209` · fix: make PiP iframe fill window and add panel toggle button

- Styles the PiP documentElement/body to 100% with zero margins and positions the iframe absolutely so it resizes with the window.
- Adds a PiP toggle button to the floating control panel.

## 2025-06-05 · `e291840` · feat: add Picture-in-Picture support with position persistence

- Implements togglePiP() with the Document Picture-in-Picture API showing the chat in an always-on-top iframe window.
- Persists window width/height/position per chat via savePipWindowState() into the chatgpt-chain-states localStorage store.
- Adds a 'Toggle PIP View' button to the popup; saveChatState() now merges prior state so PIP geometry survives.

## 2025-06-05 · `3506c21` · Merge pull request #4 from hsingh23/codex/find-and-fix-a-bug

- Lands the $wait regex fix (PR #4).

## 2025-06-05 · `538ca1b` · fix(popup): allow optional whitespace in $wait/$sleep regexes

- Loosens the $wait and legacy $sleep regexes from \s+ to \s* so no-space variants like $wait30s$ match.
- Mirrors the change in the popup parser and the test parser.

## 2025-06-05 · `de5f52e` · Merge pull request #3 from hsingh23/updates

- Lands the updates branch: state persistence, wait/pause syntax, quick-wait controls, README, privacy policy, Chains rebrand (PR #3).

## 2025-06-05 · `a6451fb` · feat(content): persist chain state per chat and retry failed prompts

- Saves chain progress to localStorage keyed by chat ID from the URL; restores within 24 hours reconciled against submitted prompts.
- Clicks ChatGPT's retry button and resubmits when the send button times out; adds retryLastPrompt() for error recovery.
- Keeps state updated on navigation, pause/resume, and command completion.

## 2025-06-04 · `8a3f55a` · feat(panel): add quick-wait buttons and image throttle skip control

- Adds an 'Insert Wait' row (30s/1m/2m/5m) to the control panel that pauses, sleeps, and auto-resumes.
- Tracks image throttle start/end for a live countdown with a 'Skip Image Wait' button; honors remaining throttle time on resume.
- Refreshes popup pro-tip markup.

## 2025-06-04 · `4dc2123` · feat: add $wait and $pause command syntax with UI badges and tests

- Supports $wait 30s$/$wait 2m$ (legacy $sleep30s$ kept) and $pause$ which optionally runs a prefix prompt then halts for review.
- Parses both in content.js and popup.js; renders pause/wait badges in the control panel, chain previews, and start-step dropdowns.
- Adds test-commands.js coverage for the new parsing.

## 2025-06-04 · `8292799` · docs: add PRIVACY.md privacy policy

- Adds PRIVACY.md covering locally stored chains/settings, data not collected, Chrome storage usage, and permission justifications.

## 2025-06-04 · `311e36b` · docs: add README with features, usage, and install guide

- Adds the first README: features, Chrome developer-mode install, basic and example workflows, sleep-command and separator configuration.

## 2025-06-04 · `0afc9da` · chore: rebrand extension to Chains with new icon and description

- Renames the extension to 'Chains - ChatGPT Workflow Automation - Smart Prompting' in the manifest.
- Replaces the logo with chains.png and rewrites the store description around multi-step workflows.

## 2025-06-03 · `9a2a444` · Merge pull request #2 from hsingh23/updates

- Lands the control-panel visibility tweak (PR #2).

## 2025-06-03 · `f30c647` · style(panel): use light blue control panel background

- Changes the floating control panel background from dark navy rgba(20,20,80,0.85) to translucent light blue for visibility against the ChatGPT UI.

## 2025-06-03 · `72e3d24` · Merge pull request #1 from hsingh23/updates

- Lands the updates branch: draggable control panel, execution tracking, storage migration, UI fixes (PR #1).

## 2025-06-03 · `9b8394a` · feat(panel): add completion progress bar to control panel

- Adds a rounded 6px progress bar to the control panel, driven to the completion percentage and tinted by execution status.

## 2025-06-03 · `7805f53` · feat: add start-position selector and live execution display

- Adds a 'Start from' dropdown per saved chain, honored as startPosition by the content script.
- Shows completed (struck-through), current (status badge), and upcoming commands with a color-coded step/status line.
- Adds page status banner, chatgpt.com URL checks, and ensureContentScript ping/inject fallback (activeTab/scripting permissions).

## 2025-06-03 · `a43af15` · style: reformat main JS and HTML files consistently

- Converts content.js, popup.js, and popup.html to a consistent style (2-space indent, double quotes, trailing commas); no functional changes.

## 2025-06-03 · `6dde210` · style: add horizontal padding to command preview rows in popup

- Changes command preview padding from 10px 0 to 10px so text clears the rounded background and accent border.

## 2025-06-02 · `35e6f09` · feat: track command execution state to prevent duplicate submissions

- Adds isCommandExecuting/isWaitingForResponse flags guarding processNextCommand() against re-entry while a command is in flight.
- Avoids restarting the loop in resumeSequence() when a response is pending; shows Submitting/Waiting status in the panel.

## 2025-06-02 · `1684c51` · feat: store prompt chains in local storage with sync-to-local migration

- Moves prompt CRUD from chrome.storage.sync to chrome.storage.local to avoid sync quota limits.
- Adds migratePromptsToLocal() merging (deduplicating) sync prompts into local then removing them from sync.
- Adds chrome.runtime.lastError handling across config/prompt load/save; fixes the separator-change listener binding.

## 2025-06-02 · `8aad824` · feat: support fractional delays and restyle command previews

- Switches Default Delay (s) and Image Throttle Delay (m) inputs to step 0.1 with one-decimal display, persisted via parseFloat + Math.round.
- Restyles numbered command preview rows and drops the 150px max-height cap.

## 2025-06-02 · `0731f18` · feat: draggable control panel with pause navigation and friendly units

- Makes the control panel draggable with viewport clamping, persisting controlPanelPosition to settings.
- Adds Back/Forward step navigation shown while paused.
- Converts popup settings to seconds/minutes, widens the popup to 450px, renders chains as numbered preview cards, adds a VS Code load task.

## 2025-06-02 · `40de5e6` · fix: match ChatGPT send button with stricter selector and poll faster

- Uses button[aria-label="Send prompt"][data-testid="send-button"] in submitPrompt() so the correct send button is clicked.
- Drops the send-button condition from isResponseComplete() (completion depends on the composer speech button only); reduces polling from 1000ms to 100ms.

## 2025-06-02 · `77d5d62` · fix: set textContent as well as value when injecting prompts

- Also assigns textarea.textContent when injecting prompts so ChatGPT's React composer picks up the programmatic text.

## 2025-06-02 · `30914fa` · feat: pauseable chain engine with control panel, sleep tags, settings

- Rewrites the content script as a configurable chain engine: settings from chrome.storage, floating control panel with Pause/Resume/Stop, pause-aware sleep indicator.
- Supports explicit $sleepNs$/$sleepNm$ delay tags via parseCommand(), image throttling after every N 'create image' commands, and retrying/timeout send-button clicks.
- Redesigns the popup with a persisted settings section and status messages.

## 2025-05-31 · `0fbaf25` · feat: initial import of ChatGPT Chain Prompts extension

- Root commit: Chrome MV3 extension with manifest matched to chatgpt.com, storage permission, and popup.
- content.js splits chains by a separator, submits each prompt to #prompt-textarea, clicks send, and polls for response completion.
- Popup saves/edits/deletes prompt chains in chrome.storage.sync; includes logo and screenshot assets.
