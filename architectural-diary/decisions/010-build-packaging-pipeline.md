# ADR 010 — Terser + CRX packaging pipeline

- Date: 2025-06-05
- Status: Accepted
- Commits: b8b58d6 (terser pipeline), 71287cc (CRX + keygen), 8f960e2 (root output, binary committed), a3f8a18 (dist wipe, manifest enrichment), 1e02c8f (build/ dir, cleanup), 93ebdfe (minify settings), 983cfaa (CI removal)

## Context

Loading raw source as an unpacked extension is fine for development, but distribution wants a minified, store-ready artifact set (directory + ZIP + signed CRX) and a reproducible one-command build.

## Decision

`build.js` (run via `npm run build`):

1. Wipes and recreates `dist/` (stale files must never survive a build — a3f8a18).
2. Minifies the five extension JS files with **terser** (`compress: { drop_console: true, passes: 2 }`, mangle, no comments — 93ebdfe) and copies manifest/HTML/image assets.
3. Generates `key.pem` once via `npx crx keygen` if missing; the key is git-ignored and never committed (983cfaa also removed CI and VS Code tasks to protect this).
4. Zips `dist/` to `build/Chains.zip` and packs the signed CRX to `build/Chains.crx` (dedicated `build/` directory, also git-ignored — 1e02c8f).

The manifest was enriched alongside (a3f8a18): host_permissions, web_accessible_resources, multi-size icons, `minimum_chrome_version` 114, and a CSP block.

## Consequences

- One command produces loadable `dist/` plus store-submittable ZIP and CRX.
- **Incident:** when the CRX briefly output to the project root, the 4.9 MB binary was accidentally committed (8f960e2); the dedicated git-ignored `build/` directory and its removal in 1e02c8f prevent recurrence.
- CI was dropped with the workflow removal — `npm test`/`npm run lint` are the quality gate run manually (or by future CI if re-added).
- Console stripping means dist builds are harder to debug — debug with the unpacked source.
