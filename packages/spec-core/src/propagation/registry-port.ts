// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Registry 포트 — propagation이 사용하는 registry 인터페이스.
 *
 * spec-core가 registry-service에 직접 의존하지 않도록
 * 포트로 추상화한다. 실제 연결은 소비자가 제공.
 */

export interface RegistryPort {
  /** prefix 등록 (최초) */
  registerPrefix(input: {
    prefix: string;
    owner: string;
    kind: "leaf" | "composite";
    numberType: "number" | "bigint";
  }): Promise<void>;

  /** draft 생성 */
  createDraft(input: {
    prefix: string;
    versionId: string;
    baseVersionId: string | null;
    capacity: number;
    refs?: Array<{ prefix: string; versionId: string }>;
  }): Promise<void>;

  /** 현재 active version 조회 */
  getActiveVersion(prefix: string): Promise<string | null>;

  /** prefix 존재 여부 */
  hasPrefix(prefix: string): Promise<boolean>;

  /** version 상태 조회 */
  getVersionStatus(prefix: string, versionId: string): Promise<string | null>;

  /** lock */
  lockDraft(prefix: string, versionId: string): Promise<void>;

  /** release (seal) */
  release(prefix: string, versionId: string): Promise<void>;

  /** activate */
  activate(prefix: string, versionId: string): Promise<void>;

  /** deprecate */
  deprecate(prefix: string, versionId: string): Promise<void>;
}

/**
 * In-memory registry — 테스트/시나리오용.
 */
export class InMemoryRegistry implements RegistryPort {
  private prefixes = new Map<string, { owner: string; kind: string; numberType: string }>();
  private versions = new Map<string, {
    prefix: string;
    versionId: string;
    status: string;
    baseVersionId: string | null;
    capacity: number;
    refs?: Array<{ prefix: string; versionId: string }>;
  }>();

  async registerPrefix(input: {
    prefix: string; owner: string; kind: "leaf" | "composite"; numberType: "number" | "bigint";
  }): Promise<void> {
    this.prefixes.set(input.prefix, input);
  }

  async createDraft(input: {
    prefix: string; versionId: string; baseVersionId: string | null;
    capacity: number; refs?: Array<{ prefix: string; versionId: string }>;
  }): Promise<void> {
    this.versions.set(`${input.prefix}:${input.versionId}`, {
      ...input, status: "draft",
    });
  }

  async getActiveVersion(prefix: string): Promise<string | null> {
    for (const v of this.versions.values()) {
      if (v.prefix === prefix && v.status === "active") return v.versionId;
    }
    return null;
  }

  async hasPrefix(prefix: string): Promise<boolean> {
    return this.prefixes.has(prefix);
  }

  async getVersionStatus(prefix: string, versionId: string): Promise<string | null> {
    return this.versions.get(`${prefix}:${versionId}`)?.status ?? null;
  }

  async lockDraft(prefix: string, versionId: string): Promise<void> {
    const v = this.versions.get(`${prefix}:${versionId}`);
    if (v) v.status = "locked";
  }

  async release(prefix: string, versionId: string): Promise<void> {
    const v = this.versions.get(`${prefix}:${versionId}`);
    if (v) v.status = "released";
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    // 이전 active를 deprecated로
    for (const v of this.versions.values()) {
      if (v.prefix === prefix && v.status === "active") v.status = "deprecated";
    }
    const v = this.versions.get(`${prefix}:${versionId}`);
    if (v) v.status = "active";
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    const v = this.versions.get(`${prefix}:${versionId}`);
    if (v) v.status = "deprecated";
  }

  /** 테스트용: 전체 상태 조회 */
  getAll(): Array<{ prefix: string; versionId: string; status: string; capacity: number }> {
    return [...this.versions.values()].map(v => ({
      prefix: v.prefix, versionId: v.versionId, status: v.status, capacity: v.capacity,
    }));
  }
}
