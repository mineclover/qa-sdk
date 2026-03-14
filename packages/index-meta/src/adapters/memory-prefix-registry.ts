import { ValidationError } from "../errors.js";
import type { PrefixRegistry, PrefixRegistryRecord, DimRef } from "../prefix-registry.js";

export class InMemoryPrefixRegistry implements PrefixRegistry {
  /** "prefix:versionId" → PrefixRegistryRecord */
  private readonly _store = new Map<string, PrefixRegistryRecord>();

  async register(record: PrefixRegistryRecord): Promise<void> {
    const key = `${record.prefix}:${record.versionId}`;
    if (this._store.has(key)) {
      throw new ValidationError(
        `PrefixRegistry: "${record.prefix}/${record.versionId}" already registered`
      );
    }
    this._store.set(key, record);
  }

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    return this._store.get(`${prefix}:${versionId}`)?.capacity ?? null;
  }

  async getRecord(prefix: string, versionId: string): Promise<PrefixRegistryRecord | null> {
    return this._store.get(`${prefix}:${versionId}`) ?? null;
  }

  async listVersions(prefix: string): Promise<PrefixRegistryRecord[]> {
    return [...this._store.values()].filter((r) => r.prefix === prefix);
  }

  async listAll(): Promise<PrefixRegistryRecord[]> {
    return [...this._store.values()];
  }

  async getDeps(prefix: string, versionId: string): Promise<readonly DimRef[]> {
    return this._store.get(`${prefix}:${versionId}`)?.refs ?? [];
  }

  async getTransitiveDeps(
    prefix: string,
    versionId: string
  ): Promise<readonly DimRef[]> {
    const result: DimRef[] = [];
    const visited = new Set<string>();

    const visit = async (p: string, v: string): Promise<void> => {
      const key = `${p}:${v}`;
      if (visited.has(key)) return;
      visited.add(key);

      const record = this._store.get(key);
      if (!record?.refs) return;

      for (const ref of record.refs) {
        result.push(ref);
        await visit(ref.prefix, ref.versionId);
      }
    };

    await visit(prefix, versionId);
    return result;
  }

  async getReverseRefs(
    prefix: string,
    versionId: string
  ): Promise<readonly PrefixRegistryRecord[]> {
    return [...this._store.values()].filter(
      (r) => r.refs?.some((ref) => ref.prefix === prefix && ref.versionId === versionId)
    );
  }

  async getShape(prefix: string, versionId: string): Promise<number[] | null> {
    const record = this._store.get(`${prefix}:${versionId}`);
    if (!record) return null;
    return record.refs ? record.refs.map((r) => r.capacity) : [record.capacity];
  }

  async resolveAddress(serialized: string): Promise<import("../prefix-registry.js").ResolvedAddress | null> {
    // "prefix:version:index" — 마지막 두 콜론으로 분리
    const last = serialized.lastIndexOf(":");
    if (last === -1) return null;
    const indexStr = serialized.slice(last + 1);
    const rest = serialized.slice(0, last);

    const second = rest.lastIndexOf(":");
    if (second === -1) return null;
    const prefix = rest.slice(0, second);
    const versionId = rest.slice(second + 1);

    const index = Number(indexStr);
    if (!prefix || !versionId || !Number.isInteger(index) || index < 0) return null;

    const record = this._store.get(`${prefix}:${versionId}`);
    if (!record) return null;

    const shape = record.refs ? record.refs.map((r) => r.capacity) : [record.capacity];

    return {
      prefix,
      versionId,
      index,
      capacity: record.capacity,
      shape,
      refs: record.refs ?? [],
      valid: index < record.capacity,
    };
  }
}
