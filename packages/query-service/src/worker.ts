/**
 * worker.ts — query-service Cloudflare Workers 진입점.
 * D1SqlDriver → SqlPolicyRuleStore + InMemoryPrefixRegistry → createApp.
 */
import { D1SqlDriver, InMemoryPrefixRegistry, MetaRegistry } from "index-meta";
import { createApp } from "./app.js";
import { SqlPolicyRuleStore } from "./stores/sql-policy-rule-store.js";

interface Env {
  DB: any;
  GATE_SERVICE_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);
    const policyRuleStore = new SqlPolicyRuleStore<unknown>(driver);
    const prefixRegistry = new InMemoryPrefixRegistry();
    const metaRegistry = new MetaRegistry({ dims: {}, indices: {} });

    const app = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      defaultStrategy: "most-specific",
      gateFailureMode: "fail-open",
    });

    return app.fetch(request);
  },
};
