// @def.boundary registry-system
// @def.doc registry-system

import { Inject, type OnApplicationShutdown } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { DashboardService } from './dashboard.service.js';
import { DevDashboardSocketHub } from './dev-dashboard.socket-hub.js';

type WebSocketClient = {
  close(): void;
  on(event: 'message', listener: (data: unknown) => void): void;
  on(event: 'error' | 'close', listener: () => void): void;
  send(data: string): void;
};

@WebSocketGateway({
  path: '/dev/ws',
})
export class DevDashboardGateway
  implements
    OnGatewayConnection<WebSocketClient>,
    OnGatewayDisconnect<WebSocketClient>,
    OnApplicationShutdown
{
  private readonly hub: DevDashboardSocketHub;
  private readonly boundClients = new WeakSet<WebSocketClient>();

  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {
    this.hub = new DevDashboardSocketHub(this.dashboard);
  }

  handleConnection(client: WebSocketClient) {
    if (!this.dashboard.isEnabled()) {
      client.close();
      return;
    }
    this.bindClient(client);
    this.hub.connect(client);
  }

  handleDisconnect(client: WebSocketClient) {
    this.hub.disconnect(client);
  }

  onApplicationShutdown() {
    this.hub.close();
    this.dashboard.close();
  }

  get clientCount() {
    return this.hub.clientCount;
  }

  private bindClient(client: WebSocketClient) {
    if (this.boundClients.has(client)) return;
    this.boundClients.add(client);

    client.on('message', (data: unknown) => {
      this.hub.handleMessage(client, normalizeMessage(data));
    });
    client.on('error', () => {
      this.hub.disconnect(client);
    });
    client.on('close', () => {
      this.hub.disconnect(client);
    });
  }
}

function normalizeMessage(data: unknown) {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf-8');
  return Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
}
