import { describe, test, expect } from "bun:test";
import { parse, UnsupportedDiagramError } from "../src/mermaid-parser.js";
import { allNodeNames, nodeSubgraph } from "../src/models.js";

describe("parse - basic graphs", () => {
  test("simple graph LR", () => {
    const graph = parse("graph LR\n  a --> b");
    expect(graph.direction).toBe("LR");
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "a", target: "b" });
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

  test("quoted subgraph names", () => {
    const text = `
flowchart LR
  subgraph "Source Control"
    GH
  end
  subgraph "CI Pipeline"
    Lint
  end
  GH --> Lint
`;
    const graph = parse(text);
    expect(graph.subgraphs).toHaveLength(2);
    expect(graph.subgraphs[0].name).toBe("Source Control");
    expect(graph.subgraphs[1].name).toBe("CI Pipeline");
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

describe("parse - node labels", () => {
  test("rectangle label A[text]", () => {
    const graph = parse("graph LR\n  A[Client] --> B[Server]");
    expect(graph.labels).toMatchObject({ A: "Client", B: "Server" });
  });

  test("rounded label A(text)", () => {
    const graph = parse("graph LR\n  A(Start) --> B(End)");
    expect(graph.labels).toMatchObject({ A: "Start", B: "End" });
  });

  test("diamond label A{text}", () => {
    const graph = parse("graph LR\n  A{Decision} --> B[Yes]");
    expect(graph.labels).toMatchObject({ A: "Decision", B: "Yes" });
  });

  test("quoted label A[\"text with spaces\"]", () => {
    const graph = parse('graph LR\n  A["Long Label"] --> B["Another Label"]');
    expect(graph.labels).toMatchObject({ A: "Long Label", B: "Another Label" });
  });

  test("cylinder label A[(Database)]", () => {
    const graph = parse("graph LR\n  A --> DB[(User DB)]");
    expect(graph.labels).toMatchObject({ DB: "User DB" });
  });

  test("circle label A((text))", () => {
    const graph = parse("graph LR\n  A((Hub)) --> B");
    expect(graph.labels).toMatchObject({ A: "Hub" });
  });

  test("nodes without labels get no entry in labels map", () => {
    const graph = parse("graph LR\n  a --> b");
    expect(graph.labels).toEqual({});
  });

  test("standalone node declarations with labels", () => {
    const text = `
graph LR
  subgraph svc
    A[Client]
    B[Server]
  end
  A --> B
`;
    const graph = parse(text);
    expect(graph.labels).toMatchObject({ A: "Client", B: "Server" });
  });
});

describe("parse - edge labels", () => {
  test("edge label with |text|", () => {
    const graph = parse("graph LR\n  A -->|Yes| B");
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "A", target: "B", label: "Yes" });
  });

  test("edge label with spaces", () => {
    const graph = parse("graph LR\n  A -->|Some Label| B");
    expect(graph.edges[0].label).toBe("Some Label");
  });

  test("edges without labels have no label property", () => {
    const graph = parse("graph LR\n  A --> B");
    expect(graph.edges[0].label).toBeUndefined();
  });
});

describe("parse - chained edges", () => {
  test("A --> B --> C produces two edges", () => {
    const graph = parse("graph LR\n  A --> B --> C");
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]).toMatchObject({ source: "A", target: "B" });
    expect(graph.edges[1]).toMatchObject({ source: "B", target: "C" });
  });

  test("four-node chain", () => {
    const graph = parse("graph LR\n  Lint --> Test --> Build --> Scan");
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges[0]).toMatchObject({ source: "Lint", target: "Test" });
    expect(graph.edges[1]).toMatchObject({ source: "Test", target: "Build" });
    expect(graph.edges[2]).toMatchObject({ source: "Build", target: "Scan" });
  });

  test("chained edges with labels on nodes", () => {
    const graph = parse("graph LR\n  A[Start] --> B[Mid] --> C[End]");
    expect(graph.edges).toHaveLength(2);
    expect(graph.labels).toMatchObject({ A: "Start", B: "Mid", C: "End" });
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

describe("parse - direction keyword inside subgraphs", () => {
  test("ignores direction keyword", () => {
    const text = `
flowchart LR
  subgraph pipeline
    direction TB
    A
    B
  end
`;
    const graph = parse(text);
    expect(graph.subgraphs[0].nodes).toEqual(["A", "B"]);
  });
});

describe("parse - complex flowchart", () => {
  test("parses complex CI/CD flowchart with all features", () => {
    const text = `flowchart LR
  subgraph "Source Control"
    GH[GitHub Push]
  end

  subgraph "CI Pipeline"
    direction TB
    Lint[Lint & Format]
    Test[Unit Tests]
    Build[Build]
    Scan[Security Scan]
    Lint --> Test --> Build --> Scan
  end

  GH --> Lint
  Scan -->|Pass| SD
  Scan -->|Fail| FailCI[Fail & Notify]
`;
    const graph = parse(text);
    expect(graph.subgraphs[0].name).toBe("Source Control");
    expect(graph.labels["GH"]).toBe("GitHub Push");
    expect(graph.labels["Lint"]).toBe("Lint & Format");
    expect(graph.labels["FailCI"]).toBe("Fail & Notify");

    // Chained edges inside subgraph
    const chainEdges = graph.edges.filter(
      (e) =>
        (e.source === "Lint" && e.target === "Test") ||
        (e.source === "Test" && e.target === "Build") ||
        (e.source === "Build" && e.target === "Scan"),
    );
    expect(chainEdges).toHaveLength(3);

    // Edge labels
    const passEdge = graph.edges.find((e) => e.source === "Scan" && e.target === "SD");
    expect(passEdge?.label).toBe("Pass");
    const failEdge = graph.edges.find((e) => e.source === "Scan" && e.target === "FailCI");
    expect(failEdge?.label).toBe("Fail");
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
