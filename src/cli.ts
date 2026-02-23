import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, basename } from "node:path";
import { generateHtml } from "./generate-html.js";
import { parse, UnsupportedDiagramError } from "./mermaid-parser.js";
import { startServer } from "./server.js";

const program = new Command();

program
  .name("fishtail")
  .description("Interactive Mermaid diagram viewer")
  .argument("[file]", "Mermaid file to open")
  .option("--save", "Save HTML to file instead of opening the browser")
  .option("-o, --output <file>", "Output path for --save (default: <file>.html)")
  .option("-p, --port <number>", "Dev server port", "5000")
  .option("--no-open", "Do not open the browser automatically")
  .action(
    (
      file: string | undefined,
      options: { save: boolean; output?: string; port: string; open: boolean },
    ) => {
      // stdin → stdout
      if (file === undefined) {
        const text = readFileSync(0, "utf-8");
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
        process.stdout.write(generateHtml(graph));
        return;
      }

      if (!existsSync(file)) {
        console.error(`Error: file not found: ${file}`);
        process.exit(1);
      }

      const save = options.save || options.output !== undefined;

      if (save) {
        const outputPath = options.output ?? basename(file, extname(file)) + ".html";
        const text = readFileSync(file, "utf-8");
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
        const title = basename(file, extname(file));
        writeFileSync(outputPath, generateHtml(graph, title), "utf-8");
        console.log(`Saved to ${outputPath}`);
        return;
      }

      const port = parseInt(options.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Error: invalid port: ${options.port}`);
        process.exit(1);
      }

      startServer(file, port, options.open);
    },
  );

program.parse();
