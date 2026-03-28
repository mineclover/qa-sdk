import { DashboardService } from "./dashboard.service.js";

export interface DevDashboardSocketClient {
  send(data: string): void;
}

export class DevDashboardSocketHub {
  private readonly clients = new Set<DevDashboardSocketClient>();
  private pushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dashboard: DashboardService,
    private readonly intervalMs = 10_000,
  ) {}

  connect(client: DevDashboardSocketClient) {
    this.clients.add(client);
    this.startPush();
  }

  disconnect(client: DevDashboardSocketClient) {
    this.clients.delete(client);
    if (this.clients.size === 0 && this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
  }

  handleMessage(client: DevDashboardSocketClient, data: unknown) {
    try {
      const message = JSON.parse(String(data)) as { type?: string };
      if (message.type === "refresh") {
        this.dashboard.refresh();
        client.send(JSON.stringify({ type: "refreshed" }));
      }
    } catch {
      // 잘못된 메시지는 무시한다.
    }
  }

  close() {
    if (this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
    this.clients.clear();
  }

  get clientCount() {
    return this.clients.size;
  }

  private startPush() {
    if (this.pushTimer) return;
    this.pushTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      try {
        const payload = JSON.stringify(this.dashboard.getRealtimeUpdate());
        for (const client of this.clients) {
          try {
            client.send(payload);
          } catch {
            this.clients.delete(client);
          }
        }
      } catch {
        // DKG/metrics 실패는 실시간 push를 멈추지 않는다.
      }
    }, this.intervalMs);

    if ("unref" in this.pushTimer && typeof this.pushTimer.unref === "function") {
      this.pushTimer.unref();
    }
  }
}
