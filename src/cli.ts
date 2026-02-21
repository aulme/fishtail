import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { generateHtml } from "./generate-html.js";
import { parse, UnsupportedDiagramError } from "./mermaid-parser.js";

export function renderCommand(
  filePath: string | undefined,
  options: { output?: string },
): void {
  let text: string;
  let title = "fishtail";

  if (filePath !== undefined) {
    text = readFileSync(filePath, "utf-8");
    title = basename(filePath, extname(filePath));
  } else {
    // Read from stdin (fd 0)
    text = readFileSync(0, "utf-8");
  }

  let graph;
  try {
    graph = parse(text);
  } catch (err) {
    if (err instanceof UnsupportedDiagramError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const html = generateHtml(graph, title);

  if (options.output !== undefined) {
    writeFileSync(options.output, html, "utf-8");
  } else {
    process.stdout.write(html);
  }
}

const program = new Command();

program.name("fishtail").description("Interactive Mermaid diagram viewer");

program
  .command("render [file]")
  .description("Render a Mermaid diagram as an interactive HTML page")
  .option("-o, --output <file>", "Write output to a file instead of stdout")
  .action(renderCommand);

program.parse();
