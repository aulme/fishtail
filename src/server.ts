import { createServer, type ServerResponse } from "node:http";
import { readFileSync, existsSync, watch } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, extname, basename, dirname } from "node:path";
import { generateHtml } from "./generate-html.js";
import { parse, UnsupportedDiagramError } from "./mermaid-parser.js";

const BUNDLE_PATH = (() => {
  const sibling = resolve(import.meta.dirname, "viewer.bundle.js");
  const inDist = resolve(import.meta.dirname, "../dist/viewer.bundle.js");
  return existsSync(sibling) ? sibling : inDist;
})();

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else if (platform === "win32") {
    spawn("start", [url], { detached: true, stdio: "ignore", shell: true }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function serveHtml(filePath: string): string {
  const title = basename(filePath, extname(filePath));
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    return errorPage(`Could not read file: ${filePath}`);
  }

  try {
    const graph = parse(text);
    return generateHtml(graph, title, { liveReload: true, viewerUrl: "/viewer.js" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorPage(message);
  }
}

function errorPage(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>fishtail — parse error</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e2e8f0; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; }
.box { background: #161b22; border: 1px solid #f97316; border-radius: 8px; padding: 24px 32px; max-width: 600px; }
h1 { color: #f97316; font-size: 16px; margin-bottom: 12px; }
pre { font-size: 13px; white-space: pre-wrap; color: #fca5a5; }
</style>
</head>
<body>
<div class="box">
  <h1>Parse error</h1>
  <pre>${escaped}</pre>
</div>
<script>(function(){var es=new EventSource('/events');es.addEventListener('reload',function(){location.reload();});}());</script>
</body>
</html>`;
}

export function startServer(filePath: string, port: number, autoOpen: boolean): void {
  const sseClients = new Set<ServerResponse>();

  function broadcast(): void {
    for (const client of sseClients) {
      client.write("event: reload\ndata: {}\n\n");
    }
  }

  const server = createServer((req, res) => {
    if (req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(":\n\n"); // comment to establish connection
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    if (req.url === "/viewer.js") {
      try {
        const bundle = readFileSync(BUNDLE_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        res.end(bundle);
      } catch {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("Viewer bundle not found — run: bun run build:viewer");
      }
      return;
    }

    const html = serveHtml(filePath);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: port ${port} is already in use.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`fishtail dev server running at ${url}`);
    console.log(`Watching ${filePath} for changes…`);
    if (autoOpen) {
      openBrowser(url);
    }
  });

  // Watch the parent directory rather than the file itself.
  // On Windows, editors that do atomic saves (write-then-rename) emit a
  // 'rename' event on the file, after which fs.watch stops firing entirely.
  // Watching the directory avoids this. We filter to only the target file;
  // changedFile can be null on some platforms so we broadcast in that case too.
  // Debounce 50 ms to coalesce the multiple rapid events Windows emits per save.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function debouncedBroadcast(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; broadcast(); }, 50);
  }

  const targetName = basename(filePath);
  const mermaidWatcher = watch(dirname(filePath), (_, changedFile) => {
    if (changedFile !== null && changedFile !== targetName) return;
    debouncedBroadcast();
  });

  const bundleName = basename(BUNDLE_PATH);
  const bundleWatcher = watch(dirname(BUNDLE_PATH), (_, changedFile) => {
    if (changedFile !== null && changedFile !== bundleName) return;
    debouncedBroadcast();
  });

  process.on("SIGINT", () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    for (const client of sseClients) {
      client.end();
    }
    sseClients.clear();
    mermaidWatcher.close();
    bundleWatcher.close();
    server.close(() => {
      process.exit(0);
    });
  });
}
