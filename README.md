# fishtail

Interactive Mermaid diagram viewer. Give it a `.mermaid` file and fishtail spins up a local dev server, opens your browser, and live-reloads whenever you save the file.

Click a node to highlight its full upstream and downstream transitive closure. Use focus mode to hide everything else.

## Install

**npm**
```bash
npm install -g fishtail
```

**Bun**
```bash
bun add -g fishtail
```

**Run without installing**
```bash
npx fishtail diagram.mermaid
bunx fishtail diagram.mermaid
```

## Usage

```
fishtail [file] [options]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `file`   | Path to a `.mermaid` file. Omit to read from stdin. |

**Options**

| Option | Description |
|--------|-------------|
| `--save` | Write HTML to a file instead of opening the browser. |
| `-o, --output <file>` | Output path for `--save` (default: `<file>.html`). |
| `-p, --port <number>` | Dev server port (default: 5000). |
| `--no-open` | Do not open the browser automatically. |

**Behaviour matrix**

| Invocation | Behaviour |
|------------|-----------|
| `fishtail ./diagram.mermaid` | Start dev server, open browser, watch for changes |
| `fishtail ./diagram.mermaid --save` | Write `./diagram.html` and exit |
| `fishtail ./diagram.mermaid -o out.html` | Write `out.html` and exit |
| `fishtail` (stdin) | Read stdin, print HTML to stdout |

**Examples**

```bash
# Open in browser with live reload
fishtail deps.mermaid

# Save to file
fishtail deps.mermaid --save
fishtail deps.mermaid -o deps.html

# Pipe from another tool
polydep graph --root . | fishtail > deps.html

# Use a different port
fishtail deps.mermaid -p 8080
```

## Live reload

When running in dev server mode, fishtail watches the source file for changes. The browser reloads automatically whenever you save — no manual refresh needed. Parse errors are displayed as a styled error page in the browser; when the file is fixed the browser reloads to the working diagram.

## Supported diagram types

Only `graph` and `flowchart` diagrams are supported. Passing any other Mermaid diagram type (e.g. `sequenceDiagram`, `classDiagram`, `gantt`) will print an error and exit with code 1.

```
graph LR
  subgraph bases
    api
  end
  subgraph components
    service
    log
    db
  end
  api --> service
  service --> log
  log --> db
```

## What the viewer does

The generated HTML page is fully self-contained — all JavaScript is embedded inline.

**Sidebar** lists every node alphabetically with a colour dot indicating its subgraph. A search box filters the list in real time and pans the graph to matching nodes.

**Click a node** to highlight its transitive closure — all ancestors and descendants recursively — and dim everything else. The node appears selected in the sidebar.

**Focus selected** hides all nodes outside the transitive closure so you can focus on a single neighbourhood without the clutter of the rest of the graph.

**Fit all / Reset** restore the full graph.

**Tooltip** on hover shows the node name, its subgraph, and its in/out-degree.

## Embedding the viewer

`dist/viewer.bundle.js` is included in the npm package and can be embedded in other tools to render fishtail's interactive graph UI without the CLI or dev server.

```js
import { readFileSync } from "node:fs";
const bundle = readFileSync("node_modules/fishtail/dist/viewer.bundle.js", "utf-8");
```

Inject the bundle into a self-contained HTML page alongside `window.__FISHTAIL_DATA__` — see [polydep](https://github.com/aulme/polydep) for a worked example in Python.

## Development

```bash
git clone https://github.com/aulme/fishtail
cd fishtail
bun install
bunx playwright install chromium
bun run build:viewer   # required once after install, and after editing src/viewer/index.ts
```

```bash
bun run build          # build viewer bundle + CLI
bun run test:unit      # unit tests (bun:test)
bun run test:browser   # browser tests (Playwright)
bun run lint           # TypeScript type check
```

## License

MIT
