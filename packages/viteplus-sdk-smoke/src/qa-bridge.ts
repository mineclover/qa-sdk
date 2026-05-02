import {
  track as browserTrack,
  withServiceOverlay,
  type BrowserCatalog,
} from '@qa-sdk/browser-codec';
import { getCoreEvent } from '@qa-sdk/event-catalog';
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
import { LOCAL_BROWSER_CATALOG } from './browser-catalog.js';

export interface QaBridgeConfig {
  serviceName: string;
  owner: {
    owner_type: 'tenant' | 'workspace' | 'user' | 'agent';
    owner_id: string;
  };
  buildEnv: string;
  ingestUrl?: string;
  transport?: Transport;
  sdkName?: string;
  sdkVersion?: string;
  browserCatalog?: BrowserCatalog;
  serviceConfig?: ServiceBootConfig;
  infraContext?: Record<string, string>;
  flushIntervalMs?: number;
  onError?: (err: Error, context: string) => void;
  runtime?: {
    platform?: string;
    os_version?: string;
    app_version?: string;
    device_ref?: string;
  };
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

export function createQaBridge(config: QaBridgeConfig): QaBridge {
  const resolvedTransport = resolveTransport(config);
  const source = config.serviceConfig
    ? toTransmissionSource(
        config.serviceConfig,
        config.sdkName ?? '@qa-sdk/sdk',
        config.sdkVersion ?? '0.1.0',
      )
    : {
        service_name: config.serviceName,
        sdk_name: config.sdkName ?? '@qa-sdk/sdk',
        sdk_version: config.sdkVersion ?? '0.1.0',
      };
  const build = config.serviceConfig
    ? toTransmissionBuild(config.serviceConfig)
    : { env: config.buildEnv };
  const browserCatalog = resolveBrowserCatalog(config);
  const infraContext = resolveInfraContext(config, browserCatalog);

  const logger = new QaLogger({
    transport: resolvedTransport.transport,
    owner: config.owner,
    source,
    runtime: {
      platform: config.runtime?.platform ?? 'browser',
      ...(config.runtime?.device_ref ? { device_ref: config.runtime.device_ref } : {}),
      ...(config.runtime?.app_version ? { app_version: config.runtime.app_version } : {}),
      os_version:
        config.runtime?.os_version ??
        (typeof navigator === 'undefined' ? 'non-browser-test' : navigator.userAgent),
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
          event_key: 'session_start',
          event_version: resolveEventVersion('session_start'),
          payload: { scenario_id: scenarioId },
        });
      }

      return {
        traceId: trace.trace_id,
        sessionId,
      };
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

  if (config.ingestUrl) {
    return {
      transport: new HttpTransport({ endpoint: resolveIngestEndpoint(config.ingestUrl) }),
      mode: 'http',
    };
  }

  return {
    transport: new NoopTransport(),
    mode: 'noop',
  };
}

function resolveIngestEndpoint(ingestUrl: string): string {
  const normalized = ingestUrl.replace(/\/+$/, '');
  return normalized.endsWith('/v1/ingest') ? normalized : `${normalized}/v1/ingest`;
}

function resolveEventVersion(eventKey: string, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion.padStart(3, '0');
  }

  const def = getCoreEvent(eventKey);
  return (def?.event_version ?? '1').padStart(3, '0');
}
