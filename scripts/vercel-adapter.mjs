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

// 2. Edge function that wraps the Worker-style fetch handler.
const funcDir = resolve(out, "functions/_ssr.func");
mkdirSync(funcDir, { recursive: true });
cpSync(resolve(dist, "server"), funcDir, { recursive: true });

writeFileSync(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "edge",
      entrypoint: "index.js",
    },
    null,
    2,
  ),
);

// Edge entry: re-export the Worker fetch as a (Request) => Response handler.
writeFileSync(
  resolve(funcDir, "index.js"),
  `import server from "./server.js";
export default async function handler(request) {
  return server.fetch(request, globalThis.process?.env ?? {}, {});
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
