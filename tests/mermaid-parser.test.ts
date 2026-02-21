import { describe, test, expect } from "bun:test";
import { parse, UnsupportedDiagramError } from "../src/mermaid-parser.js";
import { allNodeNames, nodeSubgraph } from "../src/models.js";

describe("parse - basic graphs", () => {
  test("simple graph LR", () => {
    const graph = parse("graph LR\n  a --> b");
    expect(graph.direction).toBe("LR");
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({ source: "a", target: "b" });
  });

  test("flowchart TD", () => {
    const graph = parse("flowchart TD\n  a --> b");
    expect(graph.direction).toBe("TD");
  });

  test("direction is uppercased", () => {
    const graph = parse("graph lr\n  a --> b");
    expect(graph.direction).toBe("LR");
  });
});

describe("parse - subgraphs", () => {
  test("subgraph names and member nodes", () => {
    const text = `
graph LR
  subgraph bases
    api
  end
  subgraph components
    service
    log
  end
  api --> service
`;
    const graph = parse(text);
    expect(graph.subgraphs).toHaveLength(2);
    expect(graph.subgraphs[0].name).toBe("bases");
    expect(graph.subgraphs[0].nodes).toEqual(["api"]);
    expect(graph.subgraphs[1].name).toBe("components");
    expect(graph.subgraphs[1].nodes).toEqual(["service", "log"]);
  });

  test("edges outside subgraphs", () => {
    const text = `
graph LR
  subgraph bases
    api
  end
  api --> service
  service --> log
`;
    const graph = parse(text);
    expect(graph.edges).toHaveLength(2);
  });
});

describe("parse - comments", () => {
  test("ignores %% comments", () => {
    const text = `
%% this is a comment
graph LR
%% another comment
  a --> b
`;
    const graph = parse(text);
    expect(graph.edges).toHaveLength(1);
  });
});

describe("allNodeNames", () => {
  test("includes subgraph members and edge endpoints, sorted", () => {
    const text = `
graph LR
  subgraph g
    a
  end
  b --> c
`;
    const graph = parse(text);
    expect(allNodeNames(graph)).toEqual(["a", "b", "c"]);
  });
});

describe("nodeSubgraph", () => {
  test("returns correct subgraph for known nodes", () => {
    const text = `
graph LR
  subgraph bases
    api
  end
  subgraph components
    log
  end
`;
    const graph = parse(text);
    expect(nodeSubgraph(graph, "api")).toBe("bases");
    expect(nodeSubgraph(graph, "log")).toBe("components");
    expect(nodeSubgraph(graph, "unknown")).toBeUndefined();
  });
});

describe("parse - polydep-style output", () => {
  test("parses real polydep diagram", () => {
    const text = `graph LR
  subgraph bases
    hawk
    flock
  end
  subgraph components
    log
    common
  end
  hawk --> log
  hawk --> common
  flock --> log
`;
    const graph = parse(text);
    expect(graph.direction).toBe("LR");
    expect(new Set(graph.subgraphs.map((s) => s.name))).toEqual(
      new Set(["bases", "components"]),
    );
    expect(graph.edges).toHaveLength(3);
  });
});

describe("parse - arrow styles", () => {
  test("supports multiple arrow styles", () => {
    const text = `
graph LR
  a --> b
  c --- d
  e ==> f
`;
    const graph = parse(text);
    expect(new Set(graph.edges.map((e) => e.source))).toEqual(
      new Set(["a", "c", "e"]),
    );
  });
});

describe("parse - unsupported diagram types", () => {
  test("sequenceDiagram throws UnsupportedDiagramError", () => {
    expect(() => parse("sequenceDiagram\n  Alice ->> Bob: Hello")).toThrow(
      UnsupportedDiagramError,
    );
    expect(() => parse("sequenceDiagram\n  Alice ->> Bob: Hello")).toThrow(
      "sequenceDiagram",
    );
  });

  test("gantt throws UnsupportedDiagramError", () => {
    expect(() => parse("gantt\n  title A Gantt Diagram")).toThrow(
      UnsupportedDiagramError,
    );
  });

  test("classDiagram throws UnsupportedDiagramError", () => {
    expect(() => parse("classDiagram\n  Animal <|-- Duck")).toThrow(
      UnsupportedDiagramError,
    );
  });

  test("unrecognised header throws UnsupportedDiagramError", () => {
    expect(() => parse("weirdType\n  a --> b")).toThrow(UnsupportedDiagramError);
  });
});
