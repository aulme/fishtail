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

const SUBGRAPH_START = /^\s*subgraph\s+(?:"([^"]*)"|([\w-]+))/;
const SUBGRAPH_END = /^\s*end\s*$/;
const COMMENT = /^\s*%%/;
const DIRECTION = /^\s*direction\s+/;

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
  "linkStyle",
]);

// Shape patterns ordered longest-first to avoid partial matches.
// Each returns the label text and the length consumed.
const SHAPE_PATTERNS: Array<{ regex: RegExp }> = [
  { regex: /^\[\("([^"]*)"\)\]/ },     // [("quoted")] cylinder
  { regex: /^\[\(([^)]*)\)\]/ },        // [(text)] cylinder
  { regex: /^\(\("([^"]*)"\)\)/ },      // (("quoted")) circle
  { regex: /^\(\(([^)]*)\)\)/ },        // ((text)) circle
  { regex: /^\[\["([^"]*)"\]\]/ },      // [["quoted"]] subroutine
  { regex: /^\[\[([^\]]*)\]\]/ },       // [[text]] subroutine
  { regex: /^\{\{"([^"]*)"\}\}/ },      // {{"quoted"}} hexagon
  { regex: /^\{\{([^}]*)\}\}/ },        // {{text}} hexagon
  { regex: /^\[\/([^/]*)\/\]/ },        // [/text/] parallelogram
  { regex: /^\[\\([^\\]*)\\]/ },        // [\text\] alt parallelogram
  { regex: /^\["([^"]*)"\]/ },          // ["quoted"] rectangle
  { regex: /^\[([^\]]*)\]/ },           // [text] rectangle
  { regex: /^\("([^"]*)"\)/ },          // ("quoted") rounded
  { regex: /^\(([^)]*)\)/ },            // (text) rounded
  { regex: /^\{"([^"]*)"\}/ },          // {"quoted"} diamond
  { regex: /^\{([^}]*)\}/ },            // {text} diamond
  { regex: /^>"([^"]*)"\]/ },           // >"quoted"] asymmetric
  { regex: /^>([^\]]*)\]/ },            // >text] asymmetric
];

// Arrow patterns. Ordered longest-first.
const ARROWS = [
  "-.->",
  "-..->",
  "==>",
  "-->",
  "---",
  "--",
  "-..-",
  "-.-",
];

interface NodeToken {
  id: string;
  label?: string;
  consumed: number;
}

/** Parse a node token (id + optional shape) from the given string position. */
function parseNodeToken(text: string): NodeToken | null {
  const idMatch = /^(\w+)/.exec(text);
  if (!idMatch) return null;
  const id = idMatch[1];
  const afterId = text.slice(id.length);

  for (const { regex } of SHAPE_PATTERNS) {
    const match = regex.exec(afterId);
    if (match) {
      const rawLabel = match[1];
      // Strip wrapping quotes if present
      const label = rawLabel.replace(/^"|"$/g, "");
      return { id, label, consumed: id.length + match[0].length };
    }
  }

  return { id, consumed: id.length };
}

/** Try to match an arrow at the current position. Returns arrow length + optional edge label. */
function parseArrow(text: string): { consumed: number; label?: string } | null {
  const trimmed = text.replace(/^[ \t]+/, "");
  const leadingSpaces = text.length - trimmed.length;

  for (const arrow of ARROWS) {
    if (trimmed.startsWith(arrow)) {
      let pos = arrow.length;
      let label: string | undefined;

      // Check for edge label: |text| immediately after arrow
      const afterArrow = trimmed.slice(pos);
      const labelMatch = /^[ \t]*\|([^|]*)\|/.exec(afterArrow);
      if (labelMatch) {
        label = labelMatch[1].trim();
        pos += labelMatch[0].length;
      }

      // Require trailing whitespace or end of string after arrow+label
      const rest = trimmed.slice(pos);
      if (rest.length > 0 && !/^[ \t]/.test(rest)) continue;

      return { consumed: leadingSpaces + pos, label };
    }
  }

  return null;
}

/** Parse all edges from a single line, handling chained edges like A --> B --> C. */
function parseEdgeLine(
  line: string,
  labels: Record<string, string>,
): Edge[] {
  const trimmed = line.trim();
  const edges: Edge[] = [];

  const firstNode = parseNodeToken(trimmed);
  if (!firstNode) return edges;

  if (firstNode.label !== undefined) {
    labels[firstNode.id] = firstNode.label;
  }

  let pos = firstNode.consumed;
  let sourceId = firstNode.id;

  while (pos < trimmed.length) {
    const arrow = parseArrow(trimmed.slice(pos));
    if (!arrow) break;

    pos += arrow.consumed;
    // Skip whitespace before target node
    while (pos < trimmed.length && /[ \t]/.test(trimmed[pos])) pos++;

    const targetNode = parseNodeToken(trimmed.slice(pos));
    if (!targetNode) break;

    if (targetNode.label !== undefined) {
      labels[targetNode.id] = targetNode.label;
    }

    const edge: Edge = { source: sourceId, target: targetNode.id };
    if (arrow.label) edge.label = arrow.label;
    edges.push(edge);

    sourceId = targetNode.id;
    pos += targetNode.consumed;
  }

  return edges;
}

/** Parse a standalone node declaration (inside a subgraph). */
function parseNodeDeclaration(
  line: string,
  labels: Record<string, string>,
): string | null {
  const trimmed = line.trim();
  const node = parseNodeToken(trimmed);
  if (!node) return null;

  // The entire line (after trimming) should be consumed by the node token
  if (node.consumed !== trimmed.length) return null;

  if (MERMAID_KEYWORDS.has(node.id)) return null;

  if (node.label !== undefined) {
    labels[node.id] = node.label;
  }

  return node.id;
}

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
  const labels: Record<string, string> = {};
  let currentSubgraph: SubGraph | null = null;

  for (const line of lines.slice(1)) {
    if (COMMENT.test(line)) continue;
    if (DIRECTION.test(line)) continue;

    const sgMatch = SUBGRAPH_START.exec(line);
    if (sgMatch) {
      const name = sgMatch[1] ?? sgMatch[2];
      currentSubgraph = { name, nodes: [] };
      subgraphs.push(currentSubgraph);
      continue;
    }

    if (SUBGRAPH_END.test(line)) {
      currentSubgraph = null;
      continue;
    }

    // Try edge parsing first (works for chained edges too)
    const lineEdges = parseEdgeLine(line, labels);
    if (lineEdges.length > 0) {
      edges.push(...lineEdges);
      // If we're inside a subgraph, add any new node IDs as members
      if (currentSubgraph !== null) {
        for (const edge of lineEdges) {
          if (!currentSubgraph.nodes.includes(edge.source)) {
            currentSubgraph.nodes.push(edge.source);
          }
          if (!currentSubgraph.nodes.includes(edge.target)) {
            currentSubgraph.nodes.push(edge.target);
          }
        }
      }
      continue;
    }

    // Try standalone node declaration (inside subgraphs)
    if (currentSubgraph !== null) {
      const nodeId = parseNodeDeclaration(line, labels);
      if (nodeId !== null) {
        currentSubgraph.nodes.push(nodeId);
      }
    }
  }

  return { direction, subgraphs, edges, labels };
}
