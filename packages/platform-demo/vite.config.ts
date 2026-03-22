import { defineConfig } from "vite";
import obfuscatorPlugin from "rollup-plugin-obfuscator";

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
  server: {
    port: 5176,
    proxy: {
      "/api/diagrams": "http://localhost:3300",
      "/api": "http://localhost:8787",
    },
  },
});
