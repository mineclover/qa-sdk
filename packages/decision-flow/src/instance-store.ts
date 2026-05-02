import type { FlowInstance } from "./types.js";

export interface InstanceContextQuery {
  readonly schemaId?: string;
  readonly key: string;
  readonly value?: unknown;
}

export interface InstanceTimeRangeQuery {
  readonly schemaId?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface InstanceStore {
  save(instance: FlowInstance): void;
  findBySchema(schemaId: string): FlowInstance[];
  findByContext(query: InstanceContextQuery): FlowInstance[];
  findByTimeRange(query: InstanceTimeRangeQuery): FlowInstance[];
}

export class MemoryInstanceStore implements InstanceStore {
  private readonly instances = new Map<string, FlowInstance>();

  save(instance: FlowInstance): void {
    this.instances.set(instance.id, cloneInstance(instance));
  }

  findBySchema(schemaId: string): FlowInstance[] {
    return this.filterInstances((instance) => instance.schemaId === schemaId);
  }

  findByContext(query: InstanceContextQuery): FlowInstance[] {
    return this.filterInstances((instance) => {
      if (query.schemaId && instance.schemaId !== query.schemaId) {
        return false;
      }

      const value = resolveContextValue(instance.context, query.key);
      if (value === undefined) {
        return false;
      }

      if (!Object.prototype.hasOwnProperty.call(query, "value")) {
        return true;
      }

      return Object.is(value, query.value);
    });
  }

  findByTimeRange(query: InstanceTimeRangeQuery): FlowInstance[] {
    return this.filterInstances((instance) => {
      if (query.schemaId && instance.schemaId !== query.schemaId) {
        return false;
      }

      if (query.from && compareTimestamps(instance.startedAt, query.from) < 0) {
        return false;
      }

      if (query.to && compareTimestamps(instance.startedAt, query.to) > 0) {
        return false;
      }

      return true;
    });
  }

  private filterInstances(predicate: (instance: FlowInstance) => boolean): FlowInstance[] {
    return [...this.instances.values()]
      .filter(predicate)
      .toSorted((a, b) => compareTimestamps(a.startedAt, b.startedAt))
      .map(cloneInstance);
  }
}

function resolveContextValue(
  context: Record<string, unknown>,
  key: string,
): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, context);
}

function cloneInstance(instance: FlowInstance): FlowInstance {
  return {
    ...instance,
    context: deepClone(instance.context),
    selections: instance.selections.map((selection) => ({
      ...selection,
      evidence: selection.evidence.map((entry) => ({
        ...entry,
        metadata: entry.metadata ? deepClone(entry.metadata) : undefined,
      })),
      causedBy: selection.causedBy ? [...selection.causedBy] : undefined,
    })),
  };
}

function compareTimestamps(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deepClone(entry)]),
    ) as T;
  }
  return value;
}
