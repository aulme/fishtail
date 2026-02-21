import type { Edge, MermaidGraph, SubGraph } from "./models.js";

export class UnsupportedDiagramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDiagramError";
  }
}

const SUPPORTED = /^(?:graph|flowchart)\s+([A-Z]+)/i;

const UNSUPPORTED_TYPES = new Set([
  "sequenceDiagram",
  "gantt",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "pie",
  "erDiagram",
  "journey",
  "gitGraph",
  "mindmap",
  "timeline",
  "quadrantChart",
]);

const EDGE =
  /(\w+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?[ \t]*(?:-->|---|==>|-\.-\.>|-\.-?>|--)(?:[^\S\n]?\|[^|]*\|)?[ \t]*(\w+)/;
const SUBGRAPH_START = /^\s*subgraph\s+(\S+)/;
const SUBGRAPH_END = /^\s*end\s*$/;
const NODE_DECL = /^\s*(\w+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*$/;
const COMMENT = /^\s*%%/;

const MERMAID_KEYWORDS = new Set([
  "end",
  "subgraph",
  "graph",
  "flowchart",
  "style",
  "classDef",
  "class",
  "direction",
  "click",
]);

export function parse(text: string): MermaidGraph {
  const lines = text.trim().split("\n");

  const headerLine = lines.find((line) => line.trim() && !COMMENT.test(line))?.trim() ?? "";

  for (const unsupported of UNSUPPORTED_TYPES) {
    if (headerLine.toLowerCase().startsWith(unsupported.toLowerCase())) {
      throw new UnsupportedDiagramError(
        `Diagram type '${unsupported}' is not supported yet. Only graph/flowchart diagrams are supported.`,
      );
    }
  }

  const match = SUPPORTED.exec(headerLine);
  if (!match) {
    throw new UnsupportedDiagramError(
      `Unsupported diagram type. Only graph/flowchart diagrams are supported. Got: '${headerLine}'`,
    );
  }

  const direction = match[1].toUpperCase();
  const subgraphs: SubGraph[] = [];
  const edges: Edge[] = [];
  let currentSubgraph: SubGraph | null = null;

  for (const line of lines.slice(1)) {
    if (COMMENT.test(line)) continue;

    const sgMatch = SUBGRAPH_START.exec(line);
    if (sgMatch) {
      currentSubgraph = { name: sgMatch[1], nodes: [] };
      subgraphs.push(currentSubgraph);
      continue;
    }

    if (SUBGRAPH_END.test(line)) {
      currentSubgraph = null;
      continue;
    }

    const edgeMatch = EDGE.exec(line);
    if (edgeMatch) {
      edges.push({ source: edgeMatch[1], target: edgeMatch[2] });
      continue;
    }

    if (currentSubgraph !== null) {
      const nodeMatch = NODE_DECL.exec(line);
      if (nodeMatch) {
        const name = nodeMatch[1];
        if (!MERMAID_KEYWORDS.has(name)) {
          currentSubgraph.nodes.push(name);
        }
      }
    }
  }

  return { direction, subgraphs, edges };
}
