import { allNodeNames, nodeSubgraph, type MermaidGraph } from "./models.js";
import { viewerBundle } from "./viewer/inline.js";

const PALETTE = [
  { bg: "#7c2d12", border: "#f97316" }, // orange
  { bg: "#1e3a5f", border: "#60a5fa" }, // blue
  { bg: "#14532d", border: "#4ade80" }, // green
  { bg: "#4c1d95", border: "#c084fc" }, // purple
  { bg: "#831843", border: "#f472b6" }, // pink
  { bg: "#713f12", border: "#fbbf24" }, // yellow
];
const UNASSIGNED = { bg: "#1f2937", border: "#6b7280" };

export function generateHtml(graph: MermaidGraph, title = "fishtail"): string {
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

  const edges = graph.edges.map((e) => ({
    data: { id: `${e.source}__${e.target}`, source: e.source, target: e.target },
  }));

  const legend = graph.subgraphs.map((sg, i) => ({
    name: sg.name,
    color: PALETTE[i % PALETTE.length].border,
  }));

  const dataJson = JSON.stringify({ nodes, edges, legend });

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

#focus-btn {
  border-color: #f97316;
  color: #f97316;
}
#focus-btn:hover { background: #1a1006; }
#focus-btn:disabled { border-color: #30363d; color: #484f58; }

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
</style>
</head>
<body>

<div id="sidebar">
  <h1>${title}</h1>
  <input id="search" type="text" placeholder="Search nodes\u2026" autocomplete="off" spellcheck="false">
  <div id="node-list"></div>
  <div id="legend"></div>
  <div id="controls">
    <button id="focus-btn" disabled>Focus selected</button>
    <button id="fit-btn">Fit all</button>
    <button id="reset-btn">Reset</button>
  </div>
</div>

<div id="cy"></div>
<div id="tooltip"></div>
<div id="status"></div>

<script>window.__FISHTAIL_DATA__ = ${dataJson};</script>
<script>${viewerBundle}</script>
</body>
</html>
`;
}
