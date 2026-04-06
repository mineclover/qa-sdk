import { defineConfig } from "vite";
import type { Plugin } from "vite";
import obfuscatorPlugin from "rollup-plugin-obfuscator";
import { registerPfEntry, removePfEntry } from "../../packages/infra-engine/src/lib/pf-registry.js";

const PF_KEY = "platform-demo-dev";

/** Vite 시작/종료 시 infra pf-registry에 자동 등록/해제 */
function pfRegistryPlugin(): Plugin {
  return {
    name: "pf-registry",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        if (!addr || typeof addr === "string") return;
        const port = addr.port;
        registerPfEntry(PF_KEY, {
          pid: process.pid,
          localPort: port,
          service: "platform-demo",
          namespace: "local",
          kind: "dev-server",
          note: "Vite dev — RLSC Inspector + platform demo",
        }).catch(() => {});
        console.log(`[pf-registry] registered ${PF_KEY} → :${port}`);
      });
      const cleanup = () => {
        removePfEntry(PF_KEY).catch(() => {});
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
      process.on("exit", cleanup);
    },
  };
}

export default defineConfig({
  root: ".",
  appType: "spa",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
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
  plugins: [pfRegistryPlugin()],
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
