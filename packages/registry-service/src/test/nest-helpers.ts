// @def.boundary registry-system
// @def.doc registry-system

import "reflect-metadata";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { Test } from "@nestjs/testing";
import type { ModuleMetadata } from "@nestjs/common";

export interface CompatResponse {
  readonly status: number;
  readonly headers: Headers;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}

export interface CompatApp {
  request(
    url: string,
    init?: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<CompatResponse>;
}

export async function createNestTestApp(metadata: ModuleMetadata): Promise<NestFastifyApplication> {
  const testingModule = await Test.createTestingModule(metadata).compile();
  const app = await testingModule.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function request(
  app: NestFastifyApplication,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
) {
  const server = app.getHttpAdapter().getInstance() as {
    inject(options: {
      method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      url: string;
      headers?: Record<string, string>;
      payload?: string;
    }): Promise<{
      statusCode: number;
      payload: string;
      headers: Record<string, string | string[]>;
    }>;
  };

  return server.inject({
    method,
    url,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          payload: typeof body === "string" ? body : JSON.stringify(body),
        }),
  });
}

export function json<T>(response: { payload: string }) {
  return JSON.parse(response.payload) as T;
}

export function wrapNestApp(app: NestFastifyApplication): CompatApp {
  return {
    async request(url, init = {}) {
      const response = await request(
        app,
        init.method ?? "GET",
        url,
        init.body === undefined ? undefined : init.body,
      );

      const headers = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            headers.append(key, item);
          }
        } else if (value !== undefined) {
          headers.set(key, value);
        }
      }

      return {
        status: response.statusCode,
        headers,
        async json<T = unknown>() {
          return JSON.parse(response.payload) as T;
        },
        async text() {
          return response.payload;
        },
      };
    },
  };
}
