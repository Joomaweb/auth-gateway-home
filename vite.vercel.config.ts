// Stand-alone Vite config used ONLY by Vercel.
// Lovable preview + Cloudflare build keep using vite.config.ts.
// Do NOT import @lovable.dev/vite-tanstack-config here — it locks the build to Cloudflare.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({ target: "vercel" }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
