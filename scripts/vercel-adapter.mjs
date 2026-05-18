// Post-build: convert TanStack Start output to Vercel Build Output API v3.
// Runs after `vite build --config vite.vercel.config.ts`.
// Vercel auto-detects .vercel/output/ and skips framework detection.
import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const out = resolve(root, ".vercel/output");

if (!existsSync(resolve(dist, "client")) || !existsSync(resolve(dist, "server/server.js"))) {
  console.error("[vercel-adapter] Expected dist/client and dist/server/server.js. Did vite build run?");
  process.exit(1);
}

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Static assets — everything in dist/client/ served from root.
mkdirSync(resolve(out, "static"), { recursive: true });
cpSync(resolve(dist, "client"), resolve(out, "static"), { recursive: true });

// 2. Node.js serverless function that wraps the Worker-style fetch handler.
const funcDir = resolve(out, "functions/_ssr.func");
mkdirSync(funcDir, { recursive: true });
cpSync(resolve(dist, "server"), funcDir, { recursive: true });

writeFileSync(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

// Node entry: convert IncomingMessage/ServerResponse <-> Web Fetch Request/Response,
// then delegate to the Worker-style fetch handler exported by server.js.
writeFileSync(
  resolve(funcDir, "package.json"),
  JSON.stringify({ type: "module" }, null, 2),
);

writeFileSync(
  resolve(funcDir, "index.mjs"),
  `import server from "./server.js";

function buildRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = new URL(req.url, \`\${proto}://\${host}\`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else if (v != null) headers.set(k, String(v));
  }
  const method = (req.method || "GET").toUpperCase();
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }
  return new Request(url.toString(), init);
}

async function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export default async function handler(req, res) {
  try {
    const request = buildRequest(req);
    const response = await server.fetch(request, process.env, {});
    await writeResponse(res, response);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}
`,
);

// 3. Routing config — static files win, everything else falls through to SSR.
writeFileSync(
  resolve(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/.*", dest: "/_ssr" },
      ],
    },
    null,
    2,
  ),
);

console.log("[vercel-adapter] .vercel/output/ ready.");
