/**
 * worker.ts — gate-service Cloudflare Workers 진입점.
 * D1SqlDriver → SqlAddressStateStore → createApp.
 */
import { D1SqlDriver, SqlAddressStateStore } from "index-meta";
import { createApp } from "./app.js";

interface Env {
  DB: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);
    const addressStateStore = new SqlAddressStateStore(driver);

    const app = createApp({ addressStateStore });
    return app.fetch(request);
  },
};
