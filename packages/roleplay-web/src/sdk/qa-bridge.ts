import {
  track as browserTrack,
  withServiceOverlay,
  type BrowserCatalog,
} from '@qa-sdk/browser-codec';
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
} from '@qa-sdk/sdk';
import { getCoreEvent } from '@qa-sdk/event-catalog';
import { INGEST_SERVER_URL } from '../config.js';
import { LOCAL_BROWSER_CATALOG } from './browser-catalog.js';

export interface QaBridgeConfig {
  ingestUrl?: string;
  transport?: Transport;
  buildEnv?: string;
  browserCatalog?: BrowserCatalog;
  serviceConfig?: ServiceBootConfig;
  infraContext?: Record<string, string>;
  flushIntervalMs?: number;
  onError?: (err: Error, context: string) => void;
}

export interface QaBridge {
  readonly transportMode: 'noop' | 'http' | 'custom';
  startSession(
    scenarioId?: string,
    existingSessionId?: string,
  ): { traceId: string; sessionId: string };
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
    ? toTransmissionSource(config.serviceConfig, '@qa-sdk/sdk', '0.1.0')
    : {
        service_name: 'roleplay-web',
        sdk_name: '@qa-sdk/sdk',
        sdk_version: '0.1.0',
      };
  const build = config.serviceConfig
    ? toTransmissionBuild(config.serviceConfig)
    : { env: config.buildEnv ?? 'local' };
  const browserCatalog = resolveBrowserCatalog(config);
  const infraContext = resolveInfraContext(config, browserCatalog);

  const logger = new QaLogger({
    transport: resolvedTransport.transport,
    owner: { owner_type: 'tenant', owner_id: 'qa-roleplay' },
    source,
    runtime: {
      platform: 'browser',
      os_version: navigator.userAgent,
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
      const ctx = logger.startTrace({ qa_session_id: sessionId });

      if (scenarioId) {
        logger.log({
          event_key: 'session_start',
          event_version: resolveVersion('session_start'),
          payload: { scenario_id: scenarioId },
        });
      }

      return { traceId: ctx.trace_id, sessionId };
    },

    emitEvent(
      eventKey: string,
      payload?: Record<string, unknown>,
      options?: { eventVersion?: string; address_context?: Record<string, string> },
    ): void {
      logger.log({
        event_key: eventKey,
        event_version: resolveVersion(eventKey, options?.eventVersion),
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
      new Error('service prefix encode failed: service dims are not present in browser catalog'),
      'infra-context',
    );
    return undefined;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    config.onError?.(err, 'infra-context');
    return undefined;
  }
}

function resolveTransport(config: QaBridgeConfig): {
  transport: Transport;
  mode: 'noop' | 'http' | 'custom';
} {
  if (config.transport) {
    if (config.transport instanceof NoopTransport) {
      return { transport: config.transport, mode: 'noop' };
    }
    if (config.transport instanceof HttpTransport) {
      return { transport: config.transport, mode: 'http' };
    }
    return { transport: config.transport, mode: 'custom' };
  }

  return {
    transport: new HttpTransport({
      endpoint: resolveIngestEndpoint(config.ingestUrl ?? INGEST_SERVER_URL),
    }),
    mode: 'http',
  };
}

function resolveIngestEndpoint(ingestUrl: string): string {
  const normalized = ingestUrl.replace(/\/+$/, '');
  return normalized.endsWith('/v1/ingest') ? normalized : `${normalized}/v1/ingest`;
}

function resolveVersion(eventKey: string, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion.padStart(3, '0');
  }

  const def = getCoreEvent(eventKey);
  const raw = def?.event_version ?? '1';
  // Ingest schema requires exactly 3 digits (e.g. "001")
  return raw.padStart(3, '0');
}
