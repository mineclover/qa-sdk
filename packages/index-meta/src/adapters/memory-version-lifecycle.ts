import type {
  VersionLifecycleStore,
  VersionRecord,
  VersionStatus,
  DeactivationMode,
} from "../version-lifecycle.js";

export class InMemoryVersionLifecycleStore implements VersionLifecycleStore {
  private readonly _records = new Map<string, VersionRecord>();

  private key(prefix: string, versionId: string): string {
    return `${prefix}\0${versionId}`;
  }

  async createDraft(
    prefix: string,
    versionId: string,
    baseVersionId: string | null,
    capacity: number,
    deactivationMode?: DeactivationMode,
  ): Promise<VersionRecord> {
    const k = this.key(prefix, versionId);
    if (this._records.has(k)) {
      throw new Error(`Version ${versionId} already exists for prefix "${prefix}"`);
    }

    // 모드 결정: 명시 지정 > 기반 버전 상속 > 기본값 strict
    let mode: DeactivationMode;
    if (deactivationMode) {
      mode = deactivationMode;
    } else if (baseVersionId) {
      const base = this._records.get(this.key(prefix, baseVersionId));
      mode = base?.deactivationMode ?? "strict";
    } else {
      mode = "strict";
    }

    const record: VersionRecord = {
      prefix,
      versionId,
      status: "draft",
      baseVersionId,
      capacity,
      deactivationMode: mode,
      createdAt: new Date().toISOString(),
      releasedAt: null,
    };
    this._records.set(k, record);
    return record;
  }

  async release(prefix: string, versionId: string): Promise<void> {
    const r = this.mustGet(prefix, versionId);
    if (r.status !== "draft") {
      throw new Error(`Cannot release: version ${versionId} is "${r.status}", expected "draft"`);
    }
    this._records.set(this.key(prefix, versionId), {
      ...r,
      status: "released",
      releasedAt: new Date().toISOString(),
    });
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    const r = this.mustGet(prefix, versionId);
    if (r.status !== "released") {
      throw new Error(`Cannot activate: version ${versionId} is "${r.status}", expected "released"`);
    }
    // 기존 active → released
    for (const rec of this._records.values()) {
      if (rec.prefix === prefix && rec.status === "active") {
        this._records.set(this.key(prefix, rec.versionId), {
          ...rec,
          status: "released",
        });
      }
    }
    this._records.set(this.key(prefix, versionId), { ...r, status: "active" });
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    const r = this.mustGet(prefix, versionId);
    if (r.status === "draft") {
      throw new Error(`Cannot deprecate a draft version`);
    }
    this._records.set(this.key(prefix, versionId), { ...r, status: "deprecated" });
  }

  async getActive(prefix: string): Promise<VersionRecord | null> {
    for (const rec of this._records.values()) {
      if (rec.prefix === prefix && rec.status === "active") return rec;
    }
    return null;
  }

  async getVersion(prefix: string, versionId: string): Promise<VersionRecord | null> {
    return this._records.get(this.key(prefix, versionId)) ?? null;
  }

  async getVersions(prefix: string, status?: VersionStatus): Promise<VersionRecord[]> {
    const result: VersionRecord[] = [];
    for (const rec of this._records.values()) {
      if (rec.prefix !== prefix) continue;
      if (status && rec.status !== status) continue;
      result.push(rec);
    }
    return result.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private mustGet(prefix: string, versionId: string): VersionRecord {
    const r = this._records.get(this.key(prefix, versionId));
    if (!r) throw new Error(`Version ${versionId} not found for prefix "${prefix}"`);
    return r;
  }
}
