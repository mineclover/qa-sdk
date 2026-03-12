import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { createDb, closeClient } from "./db/client.js";
import { createApp } from "./app.js";

const db = createDb(env.DATABASE_URL);
const app = createApp(db);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Registry server listening on http://localhost:${info.port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    closeClient(env.DATABASE_URL)
      .then(() => {
        console.log("Shutdown complete");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error during shutdown:", err);
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
