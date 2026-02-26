/// <reference lib="dom" />
import cytoscape from "cytoscape";
// cytoscape-dagre has no bundled TypeScript declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cyDagre = require("cytoscape-dagre");
cytoscape.use(cyDagre);

interface NodeData {
  id: string;
  label: string;
  subgraph?: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface LegendEntry {
  name: string;
  color: string;
}

interface FishtailData {
  nodes: Array<{ data: NodeData }>;
  edges: Array<{ data: EdgeData }>;
  legend: LegendEntry[];
  cycles: string[][];
  groups: string[][];
}

declare global {
  interface Window {
    cy: cytoscape.Core;
    __FISHTAIL_DATA__: FishtailData;
  }
}

const { nodes, edges, legend, cycles, groups } = window.__FISHTAIL_DATA__;

const cy = (window.cy = cytoscape({
  container: document.getElementById("cy"),
  elements: { nodes, edges } as cytoscape.ElementsDefinition,
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "font-size": "11px",
        "font-family": "ui-monospace, SFMono-Regular, monospace",
        "text-valign": "center",
        "text-halign": "center",
        color: "#e2e8f0",
        width: "label",
        height: "label",
        padding: "8px",
        "background-color": "data(bgColor)",
        "border-width": 1,
        "border-color": "data(borderColor)",
        shape: "round-rectangle",
        "transition-property": "opacity, border-color, border-width",
        "transition-duration": 150,
      } as cytoscape.Css.Node,
    },
    {
      selector: "node.highlighted",
      style: {
        "border-width": 2,
        "border-color": "#ffffff",
        "z-index": 10,
      } as cytoscape.Css.Node,
    },
    {
      selector: "node.selected-node",
      style: {
        "border-width": 3,
        "border-color": "#fbbf24",
        "z-index": 20,
      } as cytoscape.Css.Node,
    },
    {
      selector: "node.dimmed",
      style: { opacity: 0.12 } as cytoscape.Css.Node,
    },
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": "#374151",
        "target-arrow-color": "#374151",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.8,
        "curve-style": "bezier",
        label: "data(label)",
        "font-size": "9px",
        "font-family": "ui-monospace, SFMono-Regular, monospace",
        color: "#8b949e",
        "text-rotation": "autorotate",
        "text-margin-y": -8,
        "text-background-color": "#0d1117",
        "text-background-opacity": 0.8,
        "text-background-padding": "2px",
        "transition-property": "opacity, line-color, target-arrow-color",
        "transition-duration": 150,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.highlighted",
      style: {
        width: 2,
        "line-color": "#fbbf24",
        "target-arrow-color": "#fbbf24",
        "z-index": 10,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.edge-upstream",
      style: {
        width: 2,
        "line-color": "#4ade80",
        "target-arrow-color": "#4ade80",
        "z-index": 10,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.edge-downstream",
      style: {
        width: 2,
        "line-color": "#60a5fa",
        "target-arrow-color": "#60a5fa",
        "z-index": 10,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.edge-circular",
      style: {
        width: 2,
        "line-color": "#f87171",
        "target-arrow-color": "#f87171",
        "z-index": 10,
      } as cytoscape.Css.Edge,
    },
    {
      selector: "edge.dimmed",
      style: { opacity: 0.05 } as cytoscape.Css.Edge,
    },
  ],
  layout: {
    name: "dagre",
    rankDir: "TB",
    nodeSep: 40,
    rankSep: 80,
    padding: 30,
    animate: false,
  } as cytoscape.LayoutOptions,
}));

// ── Legend ─────────────────────────────────────────────────────────────────────
const legendEl = document.getElementById("legend")!;
legend.forEach((sg) => {
  const row = document.createElement("div");
  row.className = "legend-row";
  const dot = document.createElement("div");
  dot.className = "node-dot";
  dot.style.background = sg.color;
  const label = document.createElement("span");
  label.textContent = sg.name;
  row.appendChild(dot);
  row.appendChild(label);
  legendEl.appendChild(row);
});

// ── Cycles panel ───────────────────────────────────────────────────────────────
const cyclesEl = document.getElementById("panel-cycles")!;
if (cycles.length === 0) {
  const empty = document.createElement("div");
  empty.className = "cycle-empty";
  empty.textContent = "No cycles";
  cyclesEl.appendChild(empty);
} else {
  cycles.forEach((cycle) => {
    const item = document.createElement("div");
    item.className = "cycle-item";
    const dot = document.createElement("div");
    dot.className = "cycle-dot";
    const label = document.createElement("span");
    label.textContent = [...cycle, cycle[0]].join(" → ");
    item.appendChild(dot);
    item.appendChild(label);
    item.addEventListener("click", () => selectCycle(cycle, item));
    cyclesEl.appendChild(item);
  });
}

// ── Groups panel ───────────────────────────────────────────────────────────────
const groupsEl = document.getElementById("panel-groups")!;
groups.forEach((group, i) => {
  const item = document.createElement("div");
  item.className = "group-item";
  const dot = document.createElement("div");
  dot.className = "group-dot";
  const label = document.createElement("span");
  label.textContent = `Group ${i + 1} (${group.length}): ${group.join(", ")}`;
  item.appendChild(dot);
  item.appendChild(label);
  item.addEventListener("click", () => selectGroup(group, item));
  groupsEl.appendChild(item);
});

// ── Tabs ───────────────────────────────────────────────────────────────────────
const panelNodes = document.getElementById("panel-nodes")!;
const panelCycles = document.getElementById("panel-cycles")!;
const panelGroups = document.getElementById("panel-groups")!;

document.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll<HTMLElement>(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const panelId = tab.dataset.panel!;
    panelNodes.style.display = panelId === "panel-nodes" ? "flex" : "none";
    panelCycles.style.display = panelId === "panel-cycles" ? "flex" : "none";
    panelGroups.style.display = panelId === "panel-groups" ? "flex" : "none";
  });
});

// ── Sidebar node list ──────────────────────────────────────────────────────────
const nodeList = document.getElementById("node-list")!;
cy.nodes()
  .sort((a, b) => (a.id() < b.id() ? -1 : 1))
  .forEach((node) => {
    const item = document.createElement("div");
    item.className = "node-item";
    item.dataset.id = node.id();
    item.dataset.subgraph = node.data("subgraph") || "";

    const dot = document.createElement("div");
    dot.className = "node-dot";
    dot.style.background = node.data("dotColor") as string;

    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = (node.data("label") as string) || node.id();

    item.appendChild(dot);
    item.appendChild(name);
    item.addEventListener("click", () => selectNode(node));
    nodeList.appendChild(item);
  });

function setSidebarActive(nodeId: string | null): void {
  document.querySelectorAll<HTMLElement>(".node-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === nodeId);
  });
}

// ── Search ─────────────────────────────────────────────────────────────────────
document.getElementById("search")!.addEventListener("input", function (this: HTMLInputElement) {
  const q = this.value.trim().toLowerCase();
  document.querySelectorAll<HTMLElement>(".node-item").forEach((el) => {
    const id = (el.dataset.id ?? "").toLowerCase();
    const label = (el.querySelector(".node-name")?.textContent ?? "").toLowerCase();
    el.classList.toggle("hidden", q !== "" && !id.includes(q) && !label.includes(q));
  });
  if (q === "") return;
  const matches = cy.nodes().filter((n) => {
    const label = ((n.data("label") as string) || "").toLowerCase();
    return n.id().toLowerCase().includes(q) || label.includes(q);
  });
  if (matches.length === 1) cy.animate({ center: { eles: matches }, duration: 300 });
  else if (matches.length > 1) cy.animate({ fit: { eles: matches, padding: 60 }, duration: 300 });
});

// ── State ──────────────────────────────────────────────────────────────────────
let selectedNode: cytoscape.NodeSingular | null = null;

function reachable(node: cytoscape.NodeSingular): cytoscape.Collection {
  const reachableNodes = node
    .successors("node")
    .union(node.predecessors("node"))
    .union(node as unknown as cytoscape.Collection);
  return reachableNodes.union(reachableNodes.edgesWith(reachableNodes));
}

function applyHighlight(node: cytoscape.NodeSingular): void {
  const connected = reachable(node);
  cy.elements().removeClass("highlighted selected-node dimmed edge-upstream edge-downstream edge-circular");
  cy.elements().not(connected).addClass("dimmed");
  connected.nodes().addClass("highlighted");
  node.addClass("selected-node");

  const upstreamEdges = node.predecessors("edge");
  const downstreamEdges = node.successors("edge");
  const circularEdges = upstreamEdges.intersection(downstreamEdges);
  upstreamEdges.difference(circularEdges).addClass("edge-upstream");
  downstreamEdges.difference(circularEdges).addClass("edge-downstream");
  circularEdges.addClass("edge-circular");
  (document.getElementById("edge-legend") as HTMLElement).style.display = "flex";
}

function resetHighlight(): void {
  cy.elements().removeClass("highlighted selected-node dimmed edge-upstream edge-downstream edge-circular");
  selectedNode = null;
  setSidebarActive(null);
  document.querySelectorAll<HTMLElement>(".cycle-item, .group-item").forEach((el) => el.classList.remove("active"));
  (document.getElementById("edge-legend") as HTMLElement).style.display = "none";
}

function selectNode(node: cytoscape.NodeSingular): void {
  selectedNode = node;
  applyHighlight(node);
  setSidebarActive(node.id());
  cy.animate({ center: { eles: node as unknown as cytoscape.Collection }, duration: 200 });
}

function selectGroup(group: string[], itemEl: HTMLElement): void {
  cy.elements().removeClass("highlighted selected-node dimmed edge-upstream edge-downstream edge-circular");
  (document.getElementById("edge-legend") as HTMLElement).style.display = "none";
  setSidebarActive(null);
  document.querySelectorAll<HTMLElement>(".cycle-item, .group-item").forEach((el) => el.classList.remove("active"));

  let connected = cy.collection();
  for (const nodeId of group) connected = connected.union(cy.getElementById(nodeId));
  connected = connected.union(connected.edgesWith(connected));
  cy.elements().not(connected).addClass("dimmed");
  connected.addClass("highlighted");
  itemEl.classList.add("active");
  selectedNode = null;
  cy.animate({ fit: { eles: connected, padding: 60 }, duration: 300 });
}

function selectCycle(cycle: string[], itemEl: HTMLElement): void {
  cy.elements().removeClass("highlighted selected-node dimmed edge-upstream edge-downstream edge-circular");
  (document.getElementById("edge-legend") as HTMLElement).style.display = "none";
  setSidebarActive(null);
  document.querySelectorAll<HTMLElement>(".cycle-item, .group-item").forEach((el) => el.classList.remove("active"));

  let connected = cy.collection();
  for (const nodeId of cycle) connected = connected.union(cy.getElementById(nodeId));
  for (let i = 0; i < cycle.length; i++) {
    const src = cycle[i], tgt = cycle[(i + 1) % cycle.length];
    connected = connected.union(cy.edges(`[source = "${src}"][target = "${tgt}"]`));
  }
  cy.elements().not(connected).addClass("dimmed");
  connected.addClass("highlighted");
  itemEl.classList.add("active");
  selectedNode = null;
}

// ── Cytoscape events ───────────────────────────────────────────────────────────
cy.on("tap", "node", (evt) => selectNode(evt.target as cytoscape.NodeSingular));

cy.on("tap", (evt) => {
  if (evt.target === cy) resetHighlight();
});

// ── Tooltip ────────────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip")!;

cy.on("mouseover", "node", (evt) => {
  const node = evt.target as cytoscape.NodeSingular;
  const nodeLabel = (node.data("label") as string) || node.id();
  const nodeId = node.id();
  const idLine = nodeLabel !== nodeId ? `<div class="tt-type">${nodeId}</div>` : "";
  tooltip.innerHTML =
    `<div class="tt-name">${nodeLabel}</div>` +
    idLine +
    `<div class="tt-type">${(node.data("subgraph") as string | undefined) ?? ""}</div>` +
    `<div class="tt-stat">out: ${node.outdegree(false)} &nbsp; in: ${node.indegree(false)}</div>`;
  tooltip.style.display = "block";
});

cy.on("mousemove", "node", (evt) => {
  const e = evt.originalEvent as MouseEvent;
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY - 10}px`;
});

cy.on("mouseout", "node", () => {
  tooltip.style.display = "none";
});

// ── Buttons ────────────────────────────────────────────────────────────────────
document.getElementById("fit-btn")!.addEventListener("click", () => {
  resetHighlight();
  cy.animate({ fit: { eles: cy.elements(), padding: 30 }, duration: 300 });
});

// ── Status ─────────────────────────────────────────────────────────────────────
function setStatus(msg: string): void {
  document.getElementById("status")!.textContent = msg;
}

setStatus(`${cy.nodes().length} nodes · ${cy.edges().length} edges`);
