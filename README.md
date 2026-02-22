# fishtail

Interactive Mermaid diagram viewer. Give it a `.mermaid` file; get back a self-contained HTML page you can open in any browser — no server, no CDN, no dependencies.

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
npx fishtail render diagram.mermaid   # npm
bunx fishtail render diagram.mermaid  # Bun
```

## Usage

```
fishtail render [file] [options]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `file`   | Path to a `.mermaid` file. Omit to read from stdin. |

**Options**

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Write the HTML to a file instead of stdout. |

**Examples**

```bash
# Print HTML to stdout
fishtail render deps.mermaid

# Save to a file and open it
fishtail render deps.mermaid -o deps.html
open deps.html                          # macOS
xdg-open deps.html                      # Linux
start deps.html                         # Windows

# Pipe from another tool
polydep graph --root . | fishtail render -o deps.html
```

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
