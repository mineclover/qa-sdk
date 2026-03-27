import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { DashboardService } from "./dashboard.service.js";
import { DevDashboardGateway } from "./dev-dashboard.gateway.js";

class FakeWebSocket extends EventEmitter {
  sent: string[] = [];
  closed = false;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }
}

describe("DevDashboardGateway", () => {
  it("pushes refresh acknowledgements and tracks connected clients", () => {
    let refreshCount = 0;
    const dashboard = DashboardService.fromDeps({
      provider: {
        getGraph: () => ({
          edgeCount: 1,
          getAllNodes: () => [{ kind: "observation", id: "obs-1" }],
        } as any),
        getCatalog: () => ({ axes: {}, prefixes: {} } as any),
        getStore: () => undefined,
        collectMetrics: () => [{ id: "metric:test", name: "test", value: 1, status: "ok" }],
        metricsToObservations: () => [],
        refresh: () => {
          refreshCount += 1;
        },
        close: () => {},
      },
    });
    const gateway = new DevDashboardGateway(dashboard);
    const client = new FakeWebSocket();

    gateway.handleConnection(client as any);
    expect(gateway.clientCount).toBe(1);

    client.emit("message", JSON.stringify({ type: "refresh" }));
    expect(refreshCount).toBe(1);
    expect(client.sent).toContain(JSON.stringify({ type: "refreshed" }));

    gateway.handleDisconnect(client as any);
    expect(gateway.clientCount).toBe(0);
  });

  it("closes the socket immediately when dashboard is disabled", () => {
    const dashboard = DashboardService.fromDeps({});
    const gateway = new DevDashboardGateway(dashboard);
    const client = new FakeWebSocket();

    gateway.handleConnection(client as any);
    expect(client.closed).toBe(true);
    expect(gateway.clientCount).toBe(0);
  });
});
