// @def.boundary docs-control-plane
// @def.doc docs-control-plane

export interface ViteSdkTemplateInput {
  readonly serviceName: string;
  readonly ownerId: string;
  readonly buildEnv: string;
}

export function generateViteBrowserCatalogTs(input: ViteSdkTemplateInput): string {
  return `import {
  BROWSER_CATALOG,
  withServiceOverlay,
  type BrowserCatalog,
  type BrowserServiceDims,
} from "@qa-sdk/browser-codec";

export const LOCAL_SERVICE_DIMS: BrowserServiceDims = {
  env: "${escapeTemplateLiteral(input.buildEnv)}",
  region: "asia",
  svc_name: "${escapeTemplateLiteral(input.serviceName)}",
  namespace: "shop",
};

export const LOCAL_BROWSER_CATALOG: BrowserCatalog = withServiceOverlay(
  BROWSER_CATALOG,
  LOCAL_SERVICE_DIMS,
);
`;
}

export function generateViteQaBridgeTs(input: ViteSdkTemplateInput): string {
  return `import { track as browserTrack, withServiceOverlay, type BrowserCatalog } from "@qa-sdk/browser-codec";
import { getCoreEvent } from "@qa-sdk/event-catalog";
import {
  HttpTransport,
  NoopTransport,
  QaLogger,
  newQaSessionId,
  toServiceDims,
  toTransmissionBuild,
  toTransmissionSource,
  type MetricType,
  type ServiceBootConfig,
  type TransmissionEnvelope,
  type Transport,
} from "@qa-sdk/sdk";
import { LOCAL_BROWSER_CATALOG } from "./browser-catalog.js";

export interface QaBridgeConfig {
  ingestUrl?: string;
  transport?: Transport;
  buildEnv?: string;
  serviceConfig?: ServiceBootConfig;
  infraContext?: Record<string, string>;
  flushIntervalMs?: number;
  onError?: (err: Error, context: string) => void;
}

export interface QaBridge {
  readonly transportMode: "noop" | "http" | "custom";
  startSession(scenarioId?: string, existingSessionId?: string): { traceId: string; sessionId: string };
  emitEvent(
    eventKey: string,
    payload?: Record<string, unknown>,
    options?: { eventVersion?: string; address_context?: Record<string, string> },
  ): void;
  emitMetric(
    name: string,
    value: number,
    options?: {
      type?: MetricType;
      unit?: string;
      labels?: Record<string, string>;
      address_context?: Record<string, string>;
    },
  ): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
  getDebugEnvelopes(): readonly TransmissionEnvelope[];
}

export function createQaBridge(config: QaBridgeConfig = {}): QaBridge {
  const resolvedTransport = resolveTransport(config);
  const source = config.serviceConfig
    ? toTransmissionSource(config.serviceConfig, "@qa-sdk/sdk", "0.1.0")
    : {
        service_name: "${escapeTemplateLiteral(input.serviceName)}",
        sdk_name: "@qa-sdk/sdk",
        sdk_version: "0.1.0",
      };
  const build = config.serviceConfig
    ? toTransmissionBuild(config.serviceConfig)
    : { env: config.buildEnv ?? "${escapeTemplateLiteral(input.buildEnv)}" };
  const browserCatalog = resolveBrowserCatalog(config);
  const infraContext = resolveInfraContext(config, browserCatalog);

  const logger = new QaLogger({
    transport: resolvedTransport.transport,
    owner: { owner_type: "workspace", owner_id: "${escapeTemplateLiteral(input.ownerId)}" },
    source,
    runtime: {
      platform: "browser",
      os_version:
        typeof navigator === "undefined" ? "non-browser-test" : navigator.userAgent,
    },
    build,
    flushIntervalMs: config.flushIntervalMs ?? 3_000,
    onError: config.onError,
    ...(infraContext ? { infraContext } : {}),
  });

  return {
    transportMode: resolvedTransport.mode,

    startSession(
      scenarioId?: string,
      existingSessionId?: string,
    ): { traceId: string; sessionId: string } {
      const sessionId = existingSessionId ?? newQaSessionId();
      const trace = logger.startTrace({ qa_session_id: sessionId });

      if (scenarioId) {
        logger.log({
          event_key: "session_start",
          event_version: resolveEventVersion("session_start"),
          payload: { scenario_id: scenarioId },
        });
      }

      return { traceId: trace.trace_id, sessionId };
    },

    emitEvent(
      eventKey: string,
      payload?: Record<string, unknown>,
      options?: { eventVersion?: string; address_context?: Record<string, string> },
    ): void {
      logger.log({
        event_key: eventKey,
        event_version: resolveEventVersion(eventKey, options?.eventVersion),
        payload,
        ...(options?.address_context ? { address_context: options.address_context } : {}),
      });
    },

    emitMetric(
      name: string,
      value: number,
      options?: {
        type?: MetricType;
        unit?: string;
        labels?: Record<string, string>;
        address_context?: Record<string, string>;
      },
    ): void {
      logger.metric(name, value, {
        type: options?.type,
        unit: options?.unit,
        labels: options?.labels,
        ...(options?.address_context ? { address_context: options.address_context } : {}),
      });
    },

    async flush(): Promise<void> {
      await logger.flush();
    },

    async shutdown(): Promise<void> {
      await logger.shutdown();
    },

    getDebugEnvelopes(): readonly TransmissionEnvelope[] {
      if (resolvedTransport.transport instanceof NoopTransport) {
        return resolvedTransport.transport.sent;
      }
      return [];
    },
  };
}

function resolveTransport(config: QaBridgeConfig): {
  transport: Transport;
  mode: "noop" | "http" | "custom";
} {
  if (config.transport) {
    if (config.transport instanceof NoopTransport) {
      return { transport: config.transport, mode: "noop" };
    }
    if (config.transport instanceof HttpTransport) {
      return { transport: config.transport, mode: "http" };
    }
    return { transport: config.transport, mode: "custom" };
  }

  if (config.ingestUrl) {
    return {
      transport: new HttpTransport({ endpoint: resolveIngestEndpoint(config.ingestUrl) }),
      mode: "http",
    };
  }

  return {
    transport: new NoopTransport(),
    mode: "noop",
  };
}

function resolveIngestEndpoint(ingestUrl: string): string {
  const normalized = ingestUrl.replace(/\\/+$/, "");
  return normalized.endsWith("/v1/ingest") ? normalized : \`\${normalized}/v1/ingest\`;
}

function resolveBrowserCatalog(config: QaBridgeConfig): BrowserCatalog {
  if (config.browserCatalog) {
    return config.browserCatalog;
  }

  if (!config.serviceConfig) {
    return LOCAL_BROWSER_CATALOG;
  }

  return withServiceOverlay(LOCAL_BROWSER_CATALOG, toServiceDims(config.serviceConfig));
}

// @prefix service:v1 — dims: [env:0, region:1, svc_name:2, namespace:3]
function resolveInfraContext(
  config: QaBridgeConfig,
  browserCatalog: BrowserCatalog,
): Record<string, string> | undefined {
  if (config.infraContext) {
    return config.infraContext;
  }

  if (!config.serviceConfig) {
    return undefined;
  }

  try {
    const context = browserTrack(browserCatalog, {
      service: toServiceDims(config.serviceConfig),
    });
    if (context.service) {
      return context;
    }
    config.onError?.(
      new Error("service prefix encode failed: service dims are not present in browser catalog"),
      "infra-context",
    );
    return undefined;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    config.onError?.(err, "infra-context");
    return undefined;
  }
}

function resolveEventVersion(eventKey: string, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion.padStart(3, "0");
  }

  const def = getCoreEvent(eventKey);
  return (def?.event_version ?? "1").padStart(3, "0");
}
`;
}

export function generateViteQaBridgeTestTs(input: ViteSdkTemplateInput): string {
  return `import { BROWSER_CATALOG, decode } from "@qa-sdk/browser-codec";
import { describe, expect, it } from "vitest";
import { NoopTransport } from "@qa-sdk/sdk";
import { LOCAL_BROWSER_CATALOG } from "./browser-catalog.js";
import { createQaBridge } from "./qa-bridge.js";

describe("qa-bridge template", () => {
  it("NoopTransport로 smoke 이벤트를 남긴다", async () => {
    const bridge = createQaBridge({
      transport: new NoopTransport(),
      buildEnv: "test",
      flushIntervalMs: 0,
    });

    const { sessionId, traceId } = bridge.startSession("smoke");
    bridge.emitEvent("sdk_smoke_loaded", {
      service_name: "${escapeTemplateLiteral(input.serviceName)}",
      owner_id: "${escapeTemplateLiteral(input.ownerId)}",
    });
    bridge.emitMetric("sdk_smoke_records", 1, { type: "counter" });
    await bridge.shutdown();

    const envelope = bridge.getDebugEnvelopes()[0];
    expect(bridge.transportMode).toBe("noop");
    expect(sessionId).toMatch(/^qas_/);
    expect(traceId).toMatch(/^trc_/);
    expect(envelope?.records[0]?.event_key).toBe("session_start");
    expect(envelope?.records[1]?.event_key).toBe("sdk_smoke_loaded");
    expect(envelope?.records[2]?.metric_name).toBe("sdk_smoke_records");
  });

  it("serviceConfig가 있으면 infra_context.service를 decode할 수 있다", async () => {
    const bridge = createQaBridge({
      transport: new NoopTransport(),
      buildEnv: "test",
      flushIntervalMs: 0,
      serviceConfig: {
        namespace: "shop",
        name: "platform-demo",
        env: "local",
        region: "asia",
      },
    });

    bridge.startSession("smoke");
    bridge.emitEvent("sdk_smoke_loaded");
    await bridge.shutdown();

    const serialized = bridge.getDebugEnvelopes()[0]?.infra_context?.service;
    expect(serialized).toMatch(/^service:v\\d+:\\d+$/);

    const canonicalDecoded = serialized ? decode(BROWSER_CATALOG, serialized) : null;
    expect(canonicalDecoded?.values.svc_name).not.toBe("platform-demo");

    const decoded = serialized ? decode(LOCAL_BROWSER_CATALOG, serialized) : null;
    expect(decoded?.values).toMatchObject({
      env: "local",
      region: "asia",
      svc_name: "platform-demo",
      namespace: "shop",
    });
  });
});
`;
}

function escapeTemplateLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
