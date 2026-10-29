// @def.boundary registry-system
// @def.doc registry-system

import { Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { env } from '../../config/env.js';
import {
  createActivationGate,
  type ActivationGateDiagnostic,
  type ActivationGatePort,
} from '../../lib/activation-gate-adapter.js';
import { createLogger } from '../../lib/logger.js';
import type {
  CatalogPort,
  DkgBootstrapPort,
  DkgConfigPort,
  PropagationModulePort,
} from '../../types/spec-core-ports.js';

interface DemoSnapshotModulePort {
  readonly DEMO_CATALOG: CatalogPort;
  readonly DEMO_DKG_CONFIG: DkgConfigPort;
}

export interface BuildActivationGateOptions {
  enabled?: boolean;
  mode?: 'strict' | 'warn';
  logger?: Logger;
  loadPropagationModule?: () => Promise<PropagationModulePort>;
  loadAnalysisModule?: () => Promise<DkgBootstrapPort>;
  loadDemoSnapshot?: () => Promise<DemoSnapshotModulePort>;
}

export async function buildActivationGatePort(
  options: BuildActivationGateOptions = {},
): Promise<ActivationGatePort | undefined> {
  const enabled = options.enabled ?? env.CONSTRAINT_GATE_ENABLED;
  if (!enabled) return undefined;

  const mode = options.mode ?? env.CONSTRAINT_GATE_MODE;

  try {
    const [propagation, analysis, demoSnapshot] = await Promise.all([
      (
        options.loadPropagationModule ??
        (async () => import('@qa-sdk/spec-core/propagation') as unknown as PropagationModulePort)
      )(),
      (
        options.loadAnalysisModule ??
        (async (): Promise<DkgBootstrapPort> => import('dkg-enrichment'))
      )(),
      (
        options.loadDemoSnapshot ??
        (async () => {
          const [catalogMod, configMod] = await Promise.all([
            import('demo-snapshot'),
            import('demo-dkg-config'),
          ]);
          return {
            DEMO_CATALOG: catalogMod.DEMO_CATALOG,
            DEMO_DKG_CONFIG: configMod.DEMO_DKG_CONFIG,
          } as DemoSnapshotModulePort;
        })
      )(),
    ]);

    const graph = analysis.bootstrapDkg({
      catalog: demoSnapshot.DEMO_CATALOG,
      config: demoSnapshot.DEMO_DKG_CONFIG,
    });

    options.logger?.info({ mode }, 'Activation constraint gate enabled');

    return createActivationGate({
      mode,
      graphProvider: () => graph,
      checkFn: (g, prefixId, gateOptions) => {
        const result = propagation.checkActivationReadiness(g, prefixId, gateOptions);
        return {
          allowed: result.allowed,
          diagnostics: result.diagnostics.map<ActivationGateDiagnostic>((diagnostic) => ({
            level: normalizeDiagnosticLevel(diagnostic.level),
            source: diagnostic.source,
            id: diagnostic.id,
            message: diagnostic.message,
          })),
        };
      },
    });
  } catch (error) {
    options.logger?.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to initialize constraint gate — gate disabled',
    );
    return undefined;
  }
}

@Injectable()
export class ActivationGateService {
  private readonly logger = createLogger('registry-service');

  createPort() {
    return buildActivationGatePort({ logger: this.logger });
  }
}

function normalizeDiagnosticLevel(level: string): ActivationGateDiagnostic['level'] {
  if (level === 'error') return 'error';
  if (level === 'info') return 'info';
  return 'warning';
}
