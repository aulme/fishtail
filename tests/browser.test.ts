/**
 * Browser-level tests for the fishtail interactive HTML viewer.
 *
 * Graph under test (linear chain + isolated node):
 *   api (bases) --> service --> log --> db   (components)
 *   utils (components)   [isolated — no edges]
 */
import { test, expect, type Page } from "@playwright/test";
import { parse } from "../src/mermaid-parser.js";
import { FishtailPage } from "./page.js";

const MERMAID = `
graph LR
  subgraph bases
    api
  end
  subgraph components
    service
    log
    db
    utils
  end
  api --> service
  service --> log
  log --> db
`;

async function makePage(page: Page): Promise<FishtailPage> {
  const fp = new FishtailPage(page);
  await fp.load(parse(MERMAID));
  return fp;
}

// ── Graph structure ────────────────────────────────────────────────────────────

test("graph has 5 nodes", async ({ page }) => {
  const fp = await makePage(page);
  expect(await fp.nodeCount()).toBe(5);
});

test("graph has 3 edges", async ({ page }) => {
  const fp = await makePage(page);
  expect(await fp.edgeCount()).toBe(3);
});

test("node ids match parsed names", async ({ page }) => {
  const fp = await makePage(page);
  expect(await fp.nodeIds()).toEqual(["api", "db", "log", "service", "utils"]);
});

test("nodes carry correct subgraph", async ({ page }) => {
  const fp = await makePage(page);
  expect(await fp.nodeSubgraph("api")).toBe("bases");
  expect(await fp.nodeSubgraph("service")).toBe("components");
  expect(await fp.nodeSubgraph("utils")).toBe("components");
});

// ── Sidebar ────────────────────────────────────────────────────────────────────

test("sidebar shows all nodes", async ({ page }) => {
  const fp = await makePage(page);
  expect(await fp.nodeItemCount()).toBe(5);
});

test("sidebar nodes sorted alphabetically", async ({ page }) => {
  const fp = await makePage(page);
  const names = await fp.nodeNames();
  expect(names).toEqual([...names].sort());
});

// ── Transitive highlight ───────────────────────────────────────────────────────

test("clicking root highlights all descendants", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("api");
  expect(await fp.highlightedNodeIds()).toEqual(["api", "db", "log", "service"]);
  expect(await fp.dimmedNodeIds()).toEqual(["utils"]);
});

test("clicking middle node highlights upstream and downstream recursively", async ({ page }) => {
  const fp = await makePage(page);
  // service: api is upstream, log + db are downstream
  await fp.clickNode("service");
  expect(await fp.highlightedNodeIds()).toEqual(["api", "db", "log", "service"]);
  expect(await fp.dimmedNodeIds()).toEqual(["utils"]);
});

test("clicking leaf highlights all ancestors", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("db");
  expect(await fp.highlightedNodeIds()).toEqual(["api", "db", "log", "service"]);
  expect(await fp.dimmedNodeIds()).toEqual(["utils"]);
});

test("clicking isolated node dims all others", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("utils");
  expect(await fp.highlightedNodeIds()).toEqual(["utils"]);
  expect(await fp.dimmedNodeIds()).toEqual(["api", "db", "log", "service"]);
});

test("selected node gets selected-node class", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("service");
  expect(await fp.selectedNodeIds()).toEqual(["service"]);
});

test("sidebar item gets active class on selection", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("api");
  expect(await fp.isNodeActive("api")).toBe(true);
  expect(await fp.isNodeActive("log")).toBe(false);
});

// ── Reset (via fit button) ─────────────────────────────────────────────────────

test("fit clears highlighted and dimmed", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("api");
  await fp.clickFit();
  expect(await fp.highlightedNodeIds()).toEqual([]);
  expect(await fp.dimmedNodeIds()).toEqual([]);
});

test("fit clears sidebar active class", async ({ page }) => {
  const fp = await makePage(page);
  await fp.clickNode("api");
  await fp.clickFit();
  expect(await fp.activeNodeCount()).toBe(0);
});

// ── Search ─────────────────────────────────────────────────────────────────────

test("search filters sidebar to matching nodes", async ({ page }) => {
  const fp = await makePage(page);
  await fp.search("log");
  expect(await fp.visibleNodeNames()).toEqual(["log"]);
});

test("search partial match", async ({ page }) => {
  const fp = await makePage(page);
  await fp.search("s"); // matches "service" and "utils"
  expect((await fp.visibleNodeNames()).sort()).toEqual(["service", "utils"]);
});

test("clearing search shows all nodes", async ({ page }) => {
  const fp = await makePage(page);
  await fp.search("log");
  await fp.search("");
  expect(await fp.visibleNodeNames()).toHaveLength(5);
});

test("no-match search hides all nodes", async ({ page }) => {
  const fp = await makePage(page);
  await fp.search("zzz");
  expect(await fp.visibleNodeNames()).toEqual([]);
});
