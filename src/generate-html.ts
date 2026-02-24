import { allNodeNames, nodeSubgraph, type MermaidGraph, type Edge } from "./models.js";

function findSimpleCycles(edges: Edge[]): string[][] {
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();
  for (const e of edges) {
    allNodes.add(e.source);
    allNodes.add(e.target);
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // Tarjan's SCC
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccId = new Map<string, number>();
  const sccNodes = new Map<number, string[]>();
  let counter = 0;
  let sccCount = 0;

  function strongconnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter++);
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const id = sccCount++;
      const members: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); sccId.set(w, id); members.push(w); } while (w !== v);
      sccNodes.set(id, members);
    }
  }

  for (const node of allNodes) {
    if (!index.has(node)) strongconnect(node);
  }

  const seen = new Set<string>();
  const cycles: string[][] = [];

  // Self-loops
  for (const e of edges) {
    if (e.source === e.target) {
      const key = JSON.stringify([e.source]);
      if (!seen.has(key)) { seen.add(key); cycles.push([e.source]); }
    }
  }

  // Multi-node cycles via DFS within each SCC
  for (const [, members] of sccNodes) {
    if (members.length <= 1) continue;
    const sccSet = new Set(members);
    const sccAdj = new Map<string, string[]>();
    for (const node of members) {
      sccAdj.set(node, (adj.get(node) ?? []).filter((n) => sccSet.has(n)));
    }

    for (const start of members) {
      const path: string[] = [start];
      const visited = new Set<string>([start]);

      function dfs(current: string): void {
        for (const neighbor of sccAdj.get(current) ?? []) {
          if (neighbor === start && path.length > 1) {
            // Canonicalize: rotate so lexicographically smallest node is first
            let minIdx = 0;
            for (let i = 1; i < path.length; i++) {
              if (path[i] < path[minIdx]) minIdx = i;
            }
            const canonical = [...path.slice(minIdx), ...path.slice(0, minIdx)];
            const key = JSON.stringify(canonical);
            if (!seen.has(key)) { seen.add(key); cycles.push(canonical); }
          } else if (!visited.has(neighbor)) {
            visited.add(neighbor);
            path.push(neighbor);
            dfs(neighbor);
            path.pop();
            visited.delete(neighbor);
          }
        }
      }

      dfs(start);
    }
  }

  cycles.sort((a, b) => a.length !== b.length ? a.length - b.length : a.join(",") < b.join(",") ? -1 : 1);
  return cycles;
}

const PALETTE = [
  { bg: "#7c2d12", border: "#f97316" }, // orange
  { bg: "#1e3a5f", border: "#60a5fa" }, // blue
  { bg: "#14532d", border: "#4ade80" }, // green
  { bg: "#4c1d95", border: "#c084fc" }, // purple
  { bg: "#831843", border: "#f472b6" }, // pink
  { bg: "#713f12", border: "#fbbf24" }, // yellow
];
const UNASSIGNED = { bg: "#1f2937", border: "#6b7280" };

export function generateHtml(
  graph: MermaidGraph,
  title = "fishtail",
  options: { liveReload?: boolean; viewerUrl?: string; viewerBundle?: string } = {},
): string {
  const subgraphColors = new Map(
    graph.subgraphs.map((sg, i) => [sg.name, PALETTE[i % PALETTE.length]]),
  );

  const nodes = allNodeNames(graph).map((name) => {
    const sgName = nodeSubgraph(graph, name);
    const colors = sgName ? (subgraphColors.get(sgName) ?? UNASSIGNED) : UNASSIGNED;
    return {
      data: {
        id: name,
        label: name,
        subgraph: sgName,
        bgColor: colors.bg,
        borderColor: colors.border,
        dotColor: colors.border,
      },
    };
  });

  const edges = graph.edges.map((e) => {
    const id = `${e.source}__${e.target}`;
    return { data: { id, source: e.source, target: e.target } };
  });

  const legend = graph.subgraphs.map((sg, i) => ({
    name: sg.name,
    color: PALETTE[i % PALETTE.length].border,
  }));

  const cycles = findSimpleCycles(graph.edges);
  const dataJson = JSON.stringify({ nodes, edges, legend, cycles });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  display: flex;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;
  background: #0d1117;
  color: #e2e8f0;
  overflow: hidden;
}

#sidebar {
  width: 220px;
  min-width: 220px;
  background: #161b22;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  overflow: hidden;
}

#sidebar h1 {
  font-size: 13px;
  font-weight: 600;
  color: #8b949e;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding-bottom: 8px;
  border-bottom: 1px solid #30363d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#search {
  width: 100%;
  padding: 6px 8px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 12px;
  outline: none;
}
#search:focus { border-color: #58a6ff; }
#search::placeholder { color: #484f58; }

#node-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
#node-list::-webkit-scrollbar { width: 4px; }
#node-list::-webkit-scrollbar-track { background: transparent; }
#node-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

.node-item {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
}
.node-item:hover { background: #21262d; }
.node-item.active { background: #1f2d3d; outline: 1px solid #58a6ff; }
.node-item.hidden { display: none; }

.node-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

#legend {
  border-top: 1px solid #30363d;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #8b949e;
}

#tab-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

#tab-bar {
  display: flex;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.tab {
  padding: 5px 10px;
  font-size: 11px;
  color: #6e7681;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.tab:hover { color: #e2e8f0; }
.tab.active { color: #e2e8f0; border-bottom-color: #58a6ff; }

.tab-badge {
  font-size: 10px;
  background: #1d3a6e;
  color: #93c5fd;
  border-radius: 8px;
  padding: 1px 5px;
  line-height: 1.4;
}

#panel-nodes {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  gap: 8px;
}

#panel-cycles {
  flex: 1;
  overflow-y: auto;
  flex-direction: column;
  gap: 2px;
}
#panel-cycles::-webkit-scrollbar { width: 4px; }
#panel-cycles::-webkit-scrollbar-track { background: transparent; }
#panel-cycles::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

.cycle-empty {
  font-size: 12px;
  color: #484f58;
  padding: 16px 8px;
  text-align: center;
}

.cycle-item {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  padding: 4px 8px;
  gap: 6px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  color: #8b949e;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.cycle-item span {
  white-space: normal;
  word-break: break-word;
  min-width: 0;
}
.cycle-item:hover { background: #21262d; color: #e2e8f0; }
.cycle-item.active { background: #1f2d3d; outline: 1px solid #1d4ed8; color: #60a5fa; }
.cycle-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #60a5fa;
  flex-shrink: 0;
}

#controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #30363d;
  padding-top: 8px;
}

button {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #30363d;
  background: #21262d;
  color: #e2e8f0;
  transition: background 0.1s, border-color 0.1s;
  width: 100%;
}
button:hover { background: #30363d; }
button:disabled { opacity: 0.4; cursor: default; }


#tooltip {
  position: fixed;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  display: none;
  max-width: 220px;
}
#tooltip .tt-name { font-weight: 600; color: #e2e8f0; }
#tooltip .tt-type { color: #8b949e; font-size: 11px; }
#tooltip .tt-stat { color: #8b949e; font-size: 11px; margin-top: 2px; }

#cy {
  flex: 1;
  background: #0d1117;
}

#status {
  position: fixed;
  bottom: 12px;
  right: 16px;
  font-size: 11px;
  color: #484f58;
}

#edge-legend {
  position: fixed;
  bottom: 36px;
  left: 240px;
  background: rgba(22, 27, 34, 0.92);
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 7px 10px;
  display: none;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  color: #8b949e;
  pointer-events: none;
  backdrop-filter: blur(4px);
}
.edge-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.edge-legend-swatch {
  width: 18px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
}
</style>
</head>
<body>

<div id="sidebar">
  <h1>${title}</h1>
  <div id="tab-container">
    <div id="tab-bar">
      <div class="tab active" data-panel="panel-nodes">Nodes</div>
      <div class="tab" data-panel="panel-cycles">Cycles${cycles.length > 0 ? `<span class="tab-badge">${cycles.length}</span>` : ""}</div>
    </div>
    <div id="panel-nodes">
      <input id="search" type="text" placeholder="Search nodes\u2026" autocomplete="off" spellcheck="false">
      <div id="node-list"></div>
      <div id="legend"></div>
    </div>
    <div id="panel-cycles" style="display:none"></div>
  </div>
  <div id="controls">
    <button id="fit-btn">Fit all</button>
  </div>
</div>

<div id="cy"></div>
<div id="edge-legend">
  <div class="edge-legend-row"><span class="edge-legend-swatch" style="background:#4ade80"></span>upstream</div>
  <div class="edge-legend-row"><span class="edge-legend-swatch" style="background:#60a5fa"></span>downstream</div>
  <div class="edge-legend-row"><span class="edge-legend-swatch" style="background:#f87171"></span>circular</div>
</div>
<div id="tooltip"></div>
<div id="status"></div>

<script>window.__FISHTAIL_DATA__ = ${dataJson};</script>
${options.viewerUrl ? `<script src="${options.viewerUrl}"></script>` : `<script>${options.viewerBundle ?? ""}</script>`}
${options.liveReload ? `<script>(function(){var c=false;var es=new EventSource('/events');es.addEventListener('reload',function(){location.reload();});es.addEventListener('open',function(){if(c)location.reload();c=true;});}());</script>` : ""}
</body>
</html>
`;
}
