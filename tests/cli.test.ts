import { describe, test, expect } from "bun:test";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateHtml } from "../src/generate-html.js";
import { parse } from "../src/mermaid-parser.js";

const SIMPLE_MERMAID = "graph LR\n  a --> b\n";
const UNSUPPORTED_MERMAID = "sequenceDiagram\n  Alice ->> Bob: Hello\n";

function tmpFile(name: string, content: string): string {
  const path = join(tmpdir(), name);
  writeFileSync(path, content, "utf-8");
  return path;
}

describe("generateHtml", () => {
  test("produces a valid HTML document", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("embeds the title", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph, "hawk_deps");
    expect(html).toContain("hawk_deps");
  });

  test("embeds node data as JSON", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph);
    expect(html).toContain('"id":"a"');
    expect(html).toContain('"id":"b"');
  });

  test("embeds viewer bundle script", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph);
    // The viewer bundle is embedded inline (no external script src)
    expect(html).not.toContain('src="http');
    expect(html).not.toContain("src='http");
  });

  test("unsupported diagram throws before HTML generation", () => {
    expect(() => parse(UNSUPPORTED_MERMAID)).toThrow();
  });

  test("liveReload option injects SSE script", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph, "fishtail", { liveReload: true });
    expect(html).toContain("EventSource('/events')");
    expect(html).toContain("location.reload()");
  });

  test("liveReload defaults to false and omits SSE script", () => {
    const graph = parse(SIMPLE_MERMAID);
    const html = generateHtml(graph);
    expect(html).not.toContain("EventSource");
  });

  test("cyclic edges get the cyclic class", () => {
    const graph = parse("graph LR\n  A --> B\n  B --> A\n");
    const html = generateHtml(graph);
    expect(html).toContain('"A__B"');
    expect(html).toContain('"B__A"');
    // Both edges are in a cycle — both should carry the cyclic class
    const edgeA = html.match(/\{"data":\{"id":"A__B"[^}]*\}[^}]*\}/)?.[0] ?? "";
    const edgeB = html.match(/\{"data":\{"id":"B__A"[^}]*\}[^}]*\}/)?.[0] ?? "";
    expect(edgeA).toContain('"cyclic"');
    expect(edgeB).toContain('"cyclic"');
  });

  test("non-cyclic edges do not get the cyclic class", () => {
    const graph = parse(SIMPLE_MERMAID); // a --> b, no cycle
    const html = generateHtml(graph);
    expect(html).not.toContain('"cyclic"');
  });
});

describe("file-based render", () => {
  test("can write HTML to output file", () => {
    const src = tmpFile("test.mermaid", SIMPLE_MERMAID);
    const out = join(tmpdir(), "out.html");
    const graph = parse(readFileSync(src, "utf-8"));
    const html = generateHtml(graph, "test");
    writeFileSync(out, html, "utf-8");
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, "utf-8")).toContain("<!DOCTYPE html>");
  });
});
