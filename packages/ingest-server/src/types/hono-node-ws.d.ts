// @def.boundary ingest-system
// @def.doc ingest-system

declare module "@hono/node-ws" {
  import type { UpgradeWebSocket } from "hono/ws";
  import type { Server } from "node:http";
  import type { Http2SecureServer, Http2Server } from "node:http2";

  export interface NodeWebSocketBindings {
    injectWebSocket(server: Server | Http2Server | Http2SecureServer): void;
    upgradeWebSocket: UpgradeWebSocket;
  }

  export function createNodeWebSocket(options: {
    app: unknown;
  }): NodeWebSocketBindings;
}
