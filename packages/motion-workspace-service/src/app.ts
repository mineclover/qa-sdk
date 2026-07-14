// @def.boundary motion-workspace-service-spec
import { createNodeWebSocket } from '@hono/node-ws';
import type { Server } from 'node:http';
import type { Http2SecureServer, Http2Server } from 'node:http2';
import { Hono } from 'hono';
import {
  createMotionWorkspaceController,
  type MotionWorkspaceControllerDeps,
} from './controller.js';
import { createErrorHandler, type MotionWorkspaceServiceLogger } from './error-handler.js';
import type { MotionWorkspaceRepository } from './repository.js';
import { createMotionWorkspaceRepository } from './sqlite-repository.js';
import { createHealthRoutes } from './routes/health.js';
import { createWorkspaceRoutes } from './routes/workspaces.js';
import { createWorkspaceWsHub, type WorkspaceWsHub } from './ws-hub.js';

export interface MotionWorkspaceAppDeps extends Omit<MotionWorkspaceControllerDeps, 'repository'> {
  readonly repository?: MotionWorkspaceRepository;
  readonly logger?: MotionWorkspaceServiceLogger;
  readonly wsHub?: WorkspaceWsHub;
}

export type MotionWorkspaceApp = Hono & {
  readonly wsHub: WorkspaceWsHub;
  injectWebSocket(server: Server | Http2Server | Http2SecureServer): void;
};

export function createApp(deps: MotionWorkspaceAppDeps = {}): MotionWorkspaceApp {
  const app = new Hono();
  const websocket = createNodeWebSocket({ app });
  const wsHub = deps.wsHub ?? createWorkspaceWsHub();
  const controller = createMotionWorkspaceController({
    repository: deps.repository ?? createMotionWorkspaceRepository(),
    getUptimeSeconds: deps.getUptimeSeconds,
    getNow: deps.getNow,
    version: deps.version,
  });

  app.route('/', createHealthRoutes({ controller }));
  app.route(
    '/',
    createWorkspaceRoutes({
      controller,
      upgradeWebSocket: websocket.upgradeWebSocket,
      wsHub,
    }),
  );
  app.onError(createErrorHandler(deps.logger ?? console));

  return Object.assign(app, {
    injectWebSocket: websocket.injectWebSocket,
    wsHub,
  });
}
