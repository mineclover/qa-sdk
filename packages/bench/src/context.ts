import { createQaContext, type QaContext } from "@qa-sdk/context";
import type { Catalog, PrefixIds, ServiceBootConfig } from "@qa-sdk/core";

export interface BenchmarkQaContext<C extends Catalog = Catalog> {
  readonly qa: QaContext<PrefixIds<C>>;
  infraContext(): Record<string, string>;
  track(
    prefixes: Partial<Record<PrefixIds<C>, Record<string, string | number>>>,
  ): Record<string, string>;
}

export interface BenchmarkQaContextConfig<C extends Catalog = Catalog> {
  catalog: C;
  serviceConfig: ServiceBootConfig;
}

export function createBenchmarkQaContext<C extends Catalog = Catalog>(
  config: BenchmarkQaContextConfig<C>,
): BenchmarkQaContext<C> {
  const qa = createQaContext({
    catalog: config.catalog,
    serviceConfig: config.serviceConfig,
  });

  return {
    qa,

    infraContext(): Record<string, string> {
      return qa.infraContext();
    },

    track(
      prefixes: Partial<Record<PrefixIds<C>, Record<string, string | number>>>,
    ): Record<string, string> {
      return qa.track(prefixes).address_context;
    },
  };
}

export function mergeAddressContexts(
  ...contexts: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged = Object.assign({}, ...contexts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}
