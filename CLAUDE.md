# CLAUDE.md

## Project overview

fishtail is a CLI tool that converts a Mermaid `graph`/`flowchart` diagram into a self-contained interactive HTML page. The page uses Cytoscape.js + dagre for layout, with transitive node highlighting, focus mode, sidebar search, and a subgraph legend.

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

All code must pass `bun run lint`, `bun run test:unit`, and `bun run test:browser` before committing.

## Project structure

```
src/
  models.ts            Types: SubGraph, Edge, MermaidGraph; allNodeNames(), nodeSubgraph()
  mermaid-parser.ts    Regex-based Mermaid parser; parse() + UnsupportedDiagramError
  generate-html.ts     generateHtml(graph, title) — builds the full HTML string
  viewer/
    index.ts           Browser-side TypeScript: Cytoscape init + all UI logic
    inline.ts          AUTO-GENERATED — viewer bundle inlined as a string; committed to git
  cli.ts               CLI entry point using commander; renderCommand() is also exported
scripts/
  inline-viewer.ts     Reads dist/viewer.bundle.js → writes src/viewer/inline.ts
tests/
  mermaid-parser.test.ts   Unit tests for parse() (bun:test)
  cli.test.ts              Unit tests for generateHtml() (bun:test)
  page.ts                  FishtailPage — Playwright page object
  browser.test.ts          Browser tests via Playwright
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
     Bundles the CLI and all its imports — including the `viewerBundle` string from `src/viewer/inline.ts` — into a single ~630 KB self-contained Node.js file. No runtime file reads needed.

### `src/viewer/inline.ts` — generated, gitignored

`inline.ts` is a generated build artefact that lives in `src/viewer/` but is listed in `.gitignore`. It must be present for tests and the CLI build to work, but it is never committed.

Generate or regenerate it with:

```bash
bun run build:viewer
```

This must be run once after `bun install`, and again whenever `src/viewer/index.ts` changes. The file has an `AUTO-GENERATED` comment at the top and must never be edited by hand.

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
- **`cli.test.ts`** — 6 tests covering `generateHtml` output and file writing.

### Browser tests (Playwright)

- **`tests/page.ts`** — `FishtailPage` page object. All Playwright locators and `page.evaluate()` calls live here; tests contain no raw selectors.
- **`tests/browser.test.ts`** — 24 tests: graph structure, sidebar, transitive highlighting (root / middle / leaf / isolated), focus mode, reset, and search.
- Tests use `page.setContent(generateHtml(graph))` — no HTTP server needed.

## Code conventions

- TypeScript strict mode throughout.
- `src/viewer/index.ts` is the only file with `/// <reference lib="dom" />` — browser globals don't leak into the rest of the codebase.
- `cytoscape-dagre` has no bundled TypeScript declarations; it is imported with `require()` and `// @ts-ignore` suppressed with the eslint comment in the viewer file.
- No abbreviations: `subgraph` not `sg`, `nodeId` not `id`, `graph` not `g`.

## npm publishing

```bash
bun run build          # ensure dist/ is up to date
npm publish
```

The `files` field in `package.json` includes only `dist/`. The published package contains a single executable `dist/cli.js`.

## What is NOT supported

- Mermaid diagram types other than `graph` / `flowchart` (error is raised at parse time).
- Bidirectional edges (`<-->`) — parsed as two separate edges sharing the same line is not guaranteed.
- Node labels with spaces (e.g. `A["long label"]`) — labels render as the node ID, not the bracketed text.
- Exporting to SVG/PNG.
- Any server-side or dynamic functionality — output is always a static HTML file.
