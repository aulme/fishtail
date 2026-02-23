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
}

interface LegendEntry {
  name: string;
  color: string;
}

interface FishtailData {
  nodes: Array<{ data: NodeData }>;
  edges: Array<{ data: EdgeData }>;
  legend: LegendEntry[];
}

declare global {
  interface Window {
    cy: cytoscape.Core;
    __FISHTAIL_DATA__: FishtailData;
  }
}

const { nodes, edges, legend } = window.__FISHTAIL_DATA__;

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
    name.textContent = node.id();

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
    el.classList.toggle("hidden", q !== "" && !(el.dataset.id ?? "").includes(q));
  });
  if (q === "") return;
  const matches = cy.nodes().filter((n) => n.id().includes(q));
  if (matches.length > 0) cy.animate({ fit: { eles: matches, padding: 60 }, duration: 300 });
});

// ── State ──────────────────────────────────────────────────────────────────────
let selectedNode: cytoscape.NodeSingular | null = null;
let focusMode = false;

function reachable(node: cytoscape.NodeSingular): cytoscape.Collection {
  const reachableNodes = node
    .successors("node")
    .union(node.predecessors("node"))
    .union(node as unknown as cytoscape.Collection);
  return reachableNodes.union(reachableNodes.edgesWith(reachableNodes));
}

function applyHighlight(node: cytoscape.NodeSingular): void {
  const connected = reachable(node);
  cy.elements().removeClass("highlighted selected-node dimmed");
  cy.elements().not(connected).addClass("dimmed");
  connected.addClass("highlighted");
  node.addClass("selected-node");
}

function resetHighlight(): void {
  cy.elements().removeClass("highlighted selected-node dimmed");
  selectedNode = null;
  setSidebarActive(null);
  (document.getElementById("focus-btn") as HTMLButtonElement).disabled = true;
}

function selectNode(node: cytoscape.NodeSingular): void {
  if (focusMode) exitFocusMode();
  selectedNode = node;
  applyHighlight(node);
  setSidebarActive(node.id());
  (document.getElementById("focus-btn") as HTMLButtonElement).disabled = false;
  cy.animate({ center: { eles: node as unknown as cytoscape.Collection }, duration: 200 });
}

function enterFocusMode(): void {
  if (!selectedNode) return;
  focusMode = true;
  const connected = reachable(selectedNode);
  cy.elements().not(connected).style("display", "none");
  connected.style("display", "element");
  cy.animate({ fit: { eles: connected, padding: 60 }, duration: 300 });
  const btn = document.getElementById("focus-btn") as HTMLButtonElement;
  btn.textContent = "Exit focus";
  btn.style.color = "#fbbf24";
  btn.style.borderColor = "#fbbf24";
  const count = connected.nodes().length - 1;
  setStatus(`Focus: ${selectedNode.id()} — ${count} related nodes`);
}

function exitFocusMode(): void {
  focusMode = false;
  cy.elements().style("display", "element");
  const btn = document.getElementById("focus-btn") as HTMLButtonElement;
  btn.textContent = "Focus selected";
  btn.style.color = "";
  btn.style.borderColor = "";
  setStatus("");
  if (selectedNode) applyHighlight(selectedNode);
}

// ── Cytoscape events ───────────────────────────────────────────────────────────
cy.on("tap", "node", (evt) => selectNode(evt.target as cytoscape.NodeSingular));

cy.on("tap", (evt) => {
  if (evt.target === cy) {
    if (focusMode) exitFocusMode();
    resetHighlight();
  }
});

// ── Tooltip ────────────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip")!;

cy.on("mouseover", "node", (evt) => {
  const node = evt.target as cytoscape.NodeSingular;
  tooltip.innerHTML =
    `<div class="tt-name">${node.id()}</div>` +
    `<div class="tt-type">${(node.data("subgraph") as string | undefined) ?? "unassigned"}</div>` +
    `<div class="tt-stat">depends on: ${node.outdegree(false)} &nbsp; used by: ${node.indegree(false)}</div>`;
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
document.getElementById("focus-btn")!.addEventListener("click", () => {
  if (focusMode) exitFocusMode();
  else enterFocusMode();
});

document.getElementById("fit-btn")!.addEventListener("click", () => {
  if (focusMode) exitFocusMode();
  resetHighlight();
  cy.animate({ fit: { eles: cy.elements(), padding: 30 }, duration: 300 });
});

document.getElementById("reset-btn")!.addEventListener("click", () => {
  if (focusMode) exitFocusMode();
  resetHighlight();
});

// ── Status ─────────────────────────────────────────────────────────────────────
function setStatus(msg: string): void {
  document.getElementById("status")!.textContent = msg;
}

setStatus(`${cy.nodes().length} nodes · ${cy.edges().length} edges`);
