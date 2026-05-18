// Stand-alone Vite config used ONLY by Vercel.
// Lovable preview + Cloudflare build keep using vite.config.ts.
// Do NOT import @lovable.dev/vite-tanstack-config here — it locks the build to Cloudflare.
import { defineConfig, type PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

function forceVercelEdgeSsrBundling(): PluginOption {
  return {
    name: "force-vercel-edge-ssr-bundling",
    configEnvironment(environmentName) {
      if (environmentName !== "ssr") return;

      return {
        resolve: {
          // Vercel Edge has no runtime node_modules resolver; SSR deps must be inlined.
          noExternal: true,
          external: [],
        },
      };
    },
  };
}

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({ target: "vercel" }),
    forceVercelEdgeSsrBundling(),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    noExternal: true,
  },
  environments: {
    ssr: {
      resolve: {
        noExternal: true,
        external: [],
      },
    },
  },
  ssr: {
    // Bundle everything inline; serverless function dir has no node_modules.
    noExternal: true,
    target: "node",
  },
});
