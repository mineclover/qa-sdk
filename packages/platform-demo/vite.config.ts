import { defineConfig } from "vite";
import obfuscatorPlugin from "rollup-plugin-obfuscator";
import { vitePfPlugin } from "../../packages/infra-engine/src/lib/vite-pf-plugin.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  root: ".",
  appType: "mpa",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "infra-control": resolve(__dirname, "infra-control.html"),
      },
      plugins: [
        obfuscatorPlugin({
          options: {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.5,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.3,
            stringArray: true,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 0.75,
            renameGlobals: false,
            selfDefending: false,
            identifierNamesGenerator: "hexadecimal",
          },
        }),
      ],
    },
  },
  plugins: [vitePfPlugin({
    service: "platform-demo",
    note: "Vite dev — RLSC Inspector + platform demo",
  })],
  server: {
    port: 5176,
    proxy: {
      "/api/diagrams": "http://localhost:3300",
      "/api/event-catalog": "http://localhost:3300",
      "/api/services": "http://localhost:3300",
      "/api/endpoints": "http://localhost:3300",
      "/v1": "http://localhost:3200",
      "/api": "http://localhost:8787",
    },
  },
});
