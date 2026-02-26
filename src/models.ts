export interface SubGraph {
  name: string;
  nodes: string[];
}

export interface Edge {
  source: string;
  target: string;
  label?: string;
}

export interface MermaidGraph {
  direction: string;
  subgraphs: SubGraph[];
  edges: Edge[];
  labels: Record<string, string>;
}

export function allNodeNames(graph: MermaidGraph): string[] {
  const names = new Set<string>();
  for (const sg of graph.subgraphs) {
    for (const n of sg.nodes) names.add(n);
  }
  for (const e of graph.edges) {
    names.add(e.source);
    names.add(e.target);
  }
  return [...names].sort();
}

export function nodeSubgraph(graph: MermaidGraph, name: string): string | undefined {
  for (const sg of graph.subgraphs) {
    if (sg.nodes.includes(name)) return sg.name;
  }
  return undefined;
}
