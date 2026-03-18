declare module "@hono/node-ws" {
  export interface NodeWebSocketBindings {
    injectWebSocket(server: unknown): void;
    upgradeWebSocket(handler: (...args: any[]) => any): any;
  }

  export function createNodeWebSocket(options: {
    app: unknown;
  }): NodeWebSocketBindings;
}
