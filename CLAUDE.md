# CLAUDE.md

## Project overview

fishtail is a CLI tool for viewing Mermaid `graph`/`flowchart` diagrams. It has three modes:

- **Interactive (default)**: starts a local HTTP dev server, opens the browser, and live-reloads via SSE whenever the source file changes.
- **Save (`--save` / `-o`)**: converts the file to a self-contained HTML page and writes it to disk.
- **Stdin pipe**: reads from stdin and writes HTML to stdout.

The HTML page uses Cytoscape.js + dagre for layout, with transitive node highlighting, focus mode, sidebar search, and a subgraph legend.

## Setup

```bash
bun install
bunx playwright install chromium
bun run build:viewer   # generates src/viewer/inline.ts — required before running tests
```

## Commands

```bash
bun run build:viewer        # Bundle browser code → dist/viewer.bundle.js + src/viewer/inline.ts
bun run build:cli           # Bundle CLI → dist/cli.js (single self-contained binary)
bun run build               # Both of the above

bun run test:unit           # Run unit tests (bun:test)
bun run test:browser        # Run browser tests (Playwright)
bun run lint                # TypeScript type check (tsc --noEmit)
```

## Before committing

Run all three checks locally before every commit — in this order (lint is fastest, browser tests are slowest):

```bash
bun run lint
bun run test:unit
bun run test:browser
```

All three must pass. Do not commit if any of them fail.

`test:browser` is only strictly required when `src/viewer/**`, `src/generate-html.ts`, `tests/browser.test.ts`, or `tests/page.ts` have changed — CI skips it automatically on other commits. When in doubt, run it anyway.

## After pushing

After every push, verify CI passes:

```bash
gh run watch --repo aulme/fishtail
```

Wait for all three jobs (Lint, Unit tests, Browser tests) to show ✓. If any job fails, fix it and push again before moving on.

## Project structure

```
src/
  models.ts            Types: SubGraph, Edge, MermaidGraph; allNodeNames(), nodeSubgraph()
  mermaid-parser.ts    Regex-based Mermaid parser; parse() + UnsupportedDiagramError
  generate-html.ts     generateHtml(graph, title, options) — builds the full HTML string
                         options.liveReload: inject SSE script for dev server mode
  server.ts            startServer(filePath, port, autoOpen) — HTTP + SSE dev server
                         Uses node:http, node:fs (watch, readFileSync), node:child_process
                         GET /  → re-parses and serves HTML on every request
                         GET /events → SSE; broadcasts reload event on file change
  viewer/
    index.ts           Browser-side TypeScript: Cytoscape init + all UI logic
    inline.ts          AUTO-GENERATED — viewer bundle inlined as a string; committed to git
  cli.ts               CLI entry point (commander); top-level [file] argument
scripts/
  inline-viewer.ts     Reads dist/viewer.bundle.js → writes src/viewer/inline.ts
tests/
  mermaid-parser.test.ts   Unit tests for parse() (bun:test)
  cli.test.ts              Unit tests for generateHtml() (bun:test)
  page.ts                  FishtailPage — Playwright page object
  browser.test.ts          Browser tests via Playwright
test-charts/               20 fixture .mermaid files covering all major Mermaid diagram types
playwright.config.ts
```

## Key architectural decisions

### Two-stage build pipeline

The viewer (`src/viewer/index.ts`) is TypeScript that runs in the browser. It imports `cytoscape` and `cytoscape-dagre` as proper npm devDependencies — there are no vendored JS files. The build pipeline compiles those imports into a browser bundle:

1. **`bun run build:viewer`**:
   - `bun build src/viewer/index.ts --target browser --minify --outfile dist/viewer.bundle.js`
     Produces a ~550 KB minified browser bundle (cytoscape + dagre + app code).
   - `bun scripts/inline-viewer.ts`
     Reads `dist/viewer.bundle.js` and writes `src/viewer/inline.ts`, which is a single TypeScript file that exports the bundle as a string literal: `export const viewerBundle = "..."`.

2. **`bun run build:cli`**:
   - `bun build src/cli.ts --target node --outfile dist/cli.js`
     Bundles the CLI and all its imports — including the `viewerBundle` string from `src/viewer/inline.ts` — into a single ~650 KB self-contained Node.js file. No runtime file reads needed.

### `src/viewer/inline.ts` — generated, gitignored

`inline.ts` is a generated build artefact that lives in `src/viewer/` but is listed in `.gitignore`. It must be present for tests and the CLI build to work, but it is never committed.

Generate or regenerate it with:

```bash
bun run build:viewer
```

This must be run once after `bun install`, and again whenever `src/viewer/index.ts` changes. The file has an `AUTO-GENERATED` comment at the top and must never be edited by hand.

### Live reload (dev server mode)

`src/server.ts` runs a plain Node `http.Server`. On `GET /events` it holds the response open as an SSE stream and adds it to a `Set<ServerResponse>`. `fs.watch` on the source file calls `broadcast()` which writes `event: reload\ndata: {}\n\n` to all connected clients.

`generateHtml` accepts `options.liveReload`. When true it appends an inline `<script>` before `</body>` that opens `EventSource('/events')` and calls `location.reload()` on each reload event. Parse errors also get this script so the browser auto-recovers when the file is fixed.

`GET /` re-reads and re-parses the file on every request (no caching) so a full-page reload always reflects the latest content.

### Data passing from CLI to browser

`generate-html.ts` serialises graph data as JSON and injects it into the HTML as:

```html
<script>window.__FISHTAIL_DATA__ = { nodes: [...], edges: [...], legend: [...] };</script>
<script>/* viewer bundle */</script>
```

The viewer reads `window.__FISHTAIL_DATA__` on startup. `window.cy` is also exposed globally for Playwright tests.

### Transitive highlighting

When a node is selected, the highlighted set is the transitive closure of both directions:

```typescript
node.successors("node").union(node.predecessors("node")).union(node)
```

`edgesWith()` then adds all edges within that node set so edge highlighting is consistent.

### Subgraph colouring

Six palette entries cycle by subgraph index. Each node carries its colours as Cytoscape data attributes (`bgColor`, `borderColor`, `dotColor`) set in `generate-html.ts`. The viewer reads them via `data(bgColor)` in Cytoscape style selectors — no hardcoded class names per subgraph.

## Testing

### Unit tests (`bun:test`)

- **`mermaid-parser.test.ts`** — 14 tests covering all arrow styles, subgraph parsing, `allNodeNames`, `nodeSubgraph`, all unsupported diagram types.
- **`cli.test.ts`** — 8 tests covering `generateHtml` output, `liveReload` option, and file writing.

### Browser tests (Playwright)

- **`tests/page.ts`** — `FishtailPage` page object. All Playwright locators and `page.evaluate()` calls live here; tests contain no raw selectors.
- **`tests/browser.test.ts`** — 24 tests: graph structure, sidebar, transitive highlighting (root / middle / leaf / isolated), focus mode, reset, and search.
- Tests use `page.setContent(generateHtml(graph))` — no HTTP server needed.

### Test fixtures

`test-charts/` contains 20 `.mermaid` files covering all major Mermaid diagram types. Only `graph`/`flowchart` files pass; the rest exercise the error path. Useful for manual smoke testing and coverage of the unsupported-type error messages.

## Code conventions

- TypeScript strict mode throughout.
- `src/viewer/index.ts` is the only file with `/// <reference lib="dom" />` — browser globals don't leak into the rest of the codebase.
- `cytoscape-dagre` has no bundled TypeScript declarations; it is imported with `require()` and `// @ts-ignore` suppressed with the eslint comment in the viewer file.
- No abbreviations: `subgraph` not `sg`, `nodeId` not `id`, `graph` not `g`.

## Releasing to npm

Publishing is fully automated via GitHub Actions (`.github/workflows/publish.yml`). Pushing a `v*` tag triggers a job that runs the full test suite, builds `dist/cli.js`, then publishes to npm with provenance attestation.

**One-time setup** — add an npm access token as a repository secret:
1. Go to npmjs.com → Access Tokens → Generate New Token (Granular, publish scope for the `fishtail` package)
2. Add it as `NPM_TOKEN` in GitHub → Settings → Secrets → Actions

**To cut a release:**

```bash
# 1. Bump the version in package.json
#    (edit manually or use npm version)
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0

# 2. Push the commit and the tag
git push && git push --tags
```

GitHub Actions will then: lint → unit tests → browser tests → build → `npm publish --provenance`.
The publish step is skipped if any check fails.

The `files` field in `package.json` includes only `dist/`. The published package contains a single executable `dist/cli.js`.

## What is NOT supported

- Mermaid diagram types other than `graph` / `flowchart` (error is raised at parse time).
- Bidirectional edges (`<-->`) — parsed as two separate edges; behaviour not guaranteed.
- Node labels with spaces (e.g. `A["long label"]`) — labels render as the node ID, not the bracketed text.
- Exporting to SVG/PNG.
