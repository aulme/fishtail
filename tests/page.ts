/**
 * Playwright page object for the fishtail interactive HTML viewer.
 */
import type { Page } from "@playwright/test";
import { generateHtml } from "../src/generate-html.js";
import type { MermaidGraph } from "../src/models.js";

export class FishtailPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async load(graph: MermaidGraph): Promise<void> {
    await this.page.setContent(generateHtml(graph));
    await this.page.waitForFunction(
      "window.cy !== undefined && window.cy.nodes().length > 0",
    );
  }

  // ── Graph state (via window.cy) ──────────────────────────────────────────────

  nodeCount(): Promise<number> {
    return this.page.evaluate(() => window.cy.nodes().length);
  }

  edgeCount(): Promise<number> {
    return this.page.evaluate(() => window.cy.edges().length);
  }

  nodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.cy
        .nodes()
        .map((n) => n.id())
        .sort(),
    );
  }

  nodeSubgraph(nodeId: string): Promise<string | null> {
    return this.page.evaluate(
      (id) => (window.cy.getElementById(id).data("subgraph") as string | undefined) ?? null,
      nodeId,
    );
  }

  highlightedNodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.cy
        .nodes(".highlighted")
        .map((n) => n.id())
        .sort(),
    );
  }

  dimmedNodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.cy
        .nodes(".dimmed")
        .map((n) => n.id())
        .sort(),
    );
  }

  hiddenNodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.cy
        .nodes()
        .filter((n) => n.hidden())
        .map((n) => n.id())
        .sort(),
    );
  }

  selectedNodeIds(): Promise<string[]> {
    return this.page.evaluate(() =>
      window.cy.nodes(".selected-node").map((n) => n.id()),
    );
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  nodeItemCount(): Promise<number> {
    return this.page.locator(".node-item").count();
  }

  nodeNames(): Promise<string[]> {
    return this.page.locator(".node-name").allTextContents();
  }

  visibleNodeNames(): Promise<string[]> {
    return this.page.locator(".node-item:not(.hidden) .node-name").allTextContents();
  }

  async isNodeActive(nodeId: string): Promise<boolean> {
    return (await this.page.locator(`.node-item[data-id='${nodeId}'].active`).count()) === 1;
  }

  activeNodeCount(): Promise<number> {
    return this.page.locator(".node-item.active").count();
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.page.locator(`.node-item[data-id='${nodeId}']`).click();
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  async search(query: string): Promise<void> {
    await this.page.locator("#search").fill(query);
  }

  // ── Buttons ──────────────────────────────────────────────────────────────────

  async clickFit(): Promise<void> {
    await this.page.locator("#fit-btn").click();
  }
}
