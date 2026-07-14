// @def.doc definition-catalog-spec

/**
 * 서비스 버전 매니페스트 — prefix 관리 및 공급 라이프사이클
 *
 * Prefix lifecycle:  draft → released → active → deprecated → archived
 * Manifest lifecycle: draft → published → active → superseded → archived
 *
 * 공급 체인:
 *   ① prefix 정의(draft) → ② 릴리스(released)
 *   → ③ 매니페스트 구성(draft) → ④ 발행(published) → ⑤ 활성화(active)
 *   → ⑥ 이벤트 발행 → ⑦ 이벤트 수신/디코딩
 */

// ─── Prefix 라이프사이클 ─────────────────────────────────

export type PrefixLifecycleState =
  | 'draft' // 개발 중, 자유 변경
  | 'released' // 축/capacity 고정, 매니페스트 포함 가능
  | 'active' // 이벤트 발행/수신 가능
  | 'deprecated' // 수신만 가능 (하위 호환)
  | 'archived'; // 종료

/** prefix 라이프사이클 전이 규칙 */
const PREFIX_TRANSITIONS: Record<PrefixLifecycleState, readonly PrefixLifecycleState[]> = {
  draft: ['released'],
  released: ['active'],
  active: ['deprecated'],
  deprecated: ['archived'],
  archived: [],
};

export interface PrefixVersionRecord {
  readonly prefixId: string;
  readonly version: string;
  readonly state: PrefixLifecycleState;
  readonly createdAt: string;
  readonly releasedAt?: string;
  readonly activatedAt?: string;
  readonly deprecatedAt?: string;
  readonly archivedAt?: string;
}

// ─── Manifest 라이프사이클 ───────────────────────────────

export type ManifestLifecycleState =
  | 'draft' // prefix 조합 구성 중
  | 'published' // 모든 prefix released 이상 검증 완료
  | 'active' // 서비스가 이 매니페스트로 이벤트 발행 중
  | 'superseded' // 과거 이벤트 디코딩용 유지
  | 'archived'; // 종료

const MANIFEST_TRANSITIONS: Record<ManifestLifecycleState, readonly ManifestLifecycleState[]> = {
  draft: ['published'],
  published: ['active'],
  active: ['superseded'],
  superseded: ['archived'],
  archived: [],
};

export interface ServiceVersionManifest {
  readonly serviceId: string;
  readonly manifestVersion: string;
  readonly state: ManifestLifecycleState;
  readonly prefixes: Record<string, string>; // prefixId → version
  readonly createdAt: string;
  readonly publishedAt?: string;
  readonly activatedAt?: string;
  readonly supersededAt?: string;
  readonly archivedAt?: string;
  readonly changelog?: string;
}

// ─── 가드 타입 ───────────────────────────────────────────

export interface GuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

// ─── ManifestRegistry ────────────────────────────────────

export class ManifestRegistry {
  private readonly prefixes: Map<string, PrefixVersionRecord[]> = new Map();
  private readonly manifests: Map<string, ServiceVersionManifest[]> = new Map();

  // ─── Prefix 관리 ────────────────────────────────────

  /** prefix 버전 등록 (draft 상태로 시작) */
  registerPrefix(prefixId: string, version: string): PrefixVersionRecord {
    const record: PrefixVersionRecord = {
      prefixId,
      version,
      state: 'draft',
      createdAt: new Date().toISOString(),
    };

    const versions = this.prefixes.get(prefixId) ?? [];
    if (versions.some((v) => v.version === version)) {
      throw new Error(`prefix "${prefixId}" 버전 "${version}" 이미 존재`);
    }
    versions.push(record);
    this.prefixes.set(prefixId, versions);
    return record;
  }

  /** prefix 상태 전이 */
  transitionPrefix(
    prefixId: string,
    version: string,
    targetState: PrefixLifecycleState,
  ): PrefixVersionRecord {
    const record = this.getPrefixRecord(prefixId, version);
    const guard = this.checkPrefixTransition(record, targetState);
    if (!guard.allowed) {
      throw new Error(
        `prefix "${prefixId}:${version}" ${record.state}→${targetState} 전이 불가: ${guard.reason}`,
      );
    }

    const now = new Date().toISOString();
    const updated: PrefixVersionRecord = {
      ...record,
      state: targetState,
      ...(targetState === 'released' && { releasedAt: now }),
      ...(targetState === 'active' && { activatedAt: now }),
      ...(targetState === 'deprecated' && { deprecatedAt: now }),
      ...(targetState === 'archived' && { archivedAt: now }),
    };

    this.updatePrefixRecord(prefixId, version, updated);
    return updated;
  }

  /** prefix 전이 가드 검증 */
  checkPrefixTransition(
    record: PrefixVersionRecord,
    targetState: PrefixLifecycleState,
  ): GuardResult {
    const allowed = PREFIX_TRANSITIONS[record.state];
    if (!allowed.includes(targetState)) {
      return {
        allowed: false,
        reason: `${record.state}에서 ${targetState}로 전이 불가. 허용: [${allowed.join(', ')}]`,
      };
    }

    // draft → released: 추가 가드 (호출자가 축/capacity 확정 검증)
    // active → deprecated: 대체 버전이 active인지 검증
    if (record.state === 'active' && targetState === 'deprecated') {
      const versions = this.prefixes.get(record.prefixId) ?? [];
      const hasActiveReplacement = versions.some(
        (v) => v.version !== record.version && v.state === 'active',
      );
      if (!hasActiveReplacement) {
        return {
          allowed: false,
          reason: '대체 prefix 버전이 active 상태가 아님',
        };
      }
    }

    return { allowed: true };
  }

  /** prefix 버전 조회 */
  getPrefixRecord(prefixId: string, version: string): PrefixVersionRecord {
    const versions = this.prefixes.get(prefixId);
    if (!versions) throw new Error(`prefix "${prefixId}" 미등록`);
    const record = versions.find((v) => v.version === version);
    if (!record) throw new Error(`prefix "${prefixId}" 버전 "${version}" 없음`);
    return record;
  }

  /** prefix 최신 active 버전 조회 */
  getActivePrefixVersion(prefixId: string): PrefixVersionRecord | null {
    const versions = this.prefixes.get(prefixId) ?? [];
    return versions.find((v) => v.state === 'active') ?? null;
  }

  // ─── Manifest 관리 ──────────────────────────────────

  /** 매니페스트 생성 (draft 상태) */
  createManifest(
    serviceId: string,
    manifestVersion: string,
    prefixes: Record<string, string>,
    changelog?: string,
  ): ServiceVersionManifest {
    const manifest: ServiceVersionManifest = {
      serviceId,
      manifestVersion,
      state: 'draft',
      prefixes,
      createdAt: new Date().toISOString(),
      changelog,
    };

    const key = serviceId;
    const manifests = this.manifests.get(key) ?? [];
    if (manifests.some((m) => m.manifestVersion === manifestVersion)) {
      throw new Error(`서비스 "${serviceId}" 매니페스트 "${manifestVersion}" 이미 존재`);
    }
    manifests.push(manifest);
    this.manifests.set(key, manifests);
    return manifest;
  }

  /** 매니페스트 상태 전이 */
  transitionManifest(
    serviceId: string,
    manifestVersion: string,
    targetState: ManifestLifecycleState,
  ): ServiceVersionManifest {
    const manifest = this.getManifest(serviceId, manifestVersion);
    const guard = this.checkManifestTransition(manifest, targetState);
    if (!guard.allowed) {
      throw new Error(
        `매니페스트 "${serviceId}:${manifestVersion}" ${manifest.state}→${targetState} 전이 불가: ${guard.reason}`,
      );
    }

    const now = new Date().toISOString();
    const updated: ServiceVersionManifest = {
      ...manifest,
      state: targetState,
      ...(targetState === 'published' && { publishedAt: now }),
      ...(targetState === 'active' && { activatedAt: now }),
      ...(targetState === 'superseded' && { supersededAt: now }),
      ...(targetState === 'archived' && { archivedAt: now }),
    };

    // active 전이 시: 이전 active 매니페스트를 superseded로
    if (targetState === 'active') {
      this.supersedePreviousActive(serviceId, manifestVersion);
      // 포함된 prefix도 active로 전이
      this.activateManifestPrefixes(updated);
    }

    this.updateManifestRecord(serviceId, manifestVersion, updated);
    return updated;
  }

  /** 매니페스트 전이 가드 검증 */
  checkManifestTransition(
    manifest: ServiceVersionManifest,
    targetState: ManifestLifecycleState,
  ): GuardResult {
    const allowed = MANIFEST_TRANSITIONS[manifest.state];
    if (!allowed.includes(targetState)) {
      return {
        allowed: false,
        reason: `${manifest.state}에서 ${targetState}로 전이 불가. 허용: [${allowed.join(', ')}]`,
      };
    }

    // draft → published: 포함된 모든 prefix가 released 이상
    if (manifest.state === 'draft' && targetState === 'published') {
      for (const [prefixId, version] of Object.entries(manifest.prefixes)) {
        try {
          const record = this.getPrefixRecord(prefixId, version);
          if (record.state === 'draft') {
            return {
              allowed: false,
              reason: `prefix "${prefixId}:${version}"이 아직 draft 상태`,
            };
          }
        } catch {
          return {
            allowed: false,
            reason: `prefix "${prefixId}:${version}" 미등록`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /** 매니페스트 조회 */
  getManifest(serviceId: string, manifestVersion: string): ServiceVersionManifest {
    const manifests = this.manifests.get(serviceId);
    if (!manifests) throw new Error(`서비스 "${serviceId}" 매니페스트 없음`);
    const m = manifests.find((m) => m.manifestVersion === manifestVersion);
    if (!m) throw new Error(`서비스 "${serviceId}" 매니페스트 "${manifestVersion}" 없음`);
    return m;
  }

  /** 최신 active 매니페스트 조회 */
  getActiveManifest(serviceId: string): ServiceVersionManifest | null {
    const manifests = this.manifests.get(serviceId) ?? [];
    return manifests.find((m) => m.state === 'active') ?? null;
  }

  /** 서비스의 전체 매니페스트 이력 */
  listManifests(serviceId: string): readonly ServiceVersionManifest[] {
    return this.manifests.get(serviceId) ?? [];
  }

  /** 특정 매니페스트에서 prefix 버전 조회 */
  getPrefixVersionFromManifest(
    serviceId: string,
    manifestVersion: string,
    prefixId: string,
  ): string {
    const manifest = this.getManifest(serviceId, manifestVersion);
    const version = manifest.prefixes[prefixId];
    if (!version) {
      throw new Error(`매니페스트 "${serviceId}:${manifestVersion}"에 prefix "${prefixId}" 없음`);
    }
    return version;
  }

  // ─── 내부 헬퍼 ─────────────────────────────────────

  private updatePrefixRecord(
    prefixId: string,
    version: string,
    updated: PrefixVersionRecord,
  ): void {
    const versions = this.prefixes.get(prefixId) ?? [];
    const idx = versions.findIndex((v) => v.version === version);
    if (idx >= 0) versions[idx] = updated;
  }

  private updateManifestRecord(
    serviceId: string,
    manifestVersion: string,
    updated: ServiceVersionManifest,
  ): void {
    const manifests = this.manifests.get(serviceId) ?? [];
    const idx = manifests.findIndex((m) => m.manifestVersion === manifestVersion);
    if (idx >= 0) manifests[idx] = updated;
  }

  private supersedePreviousActive(serviceId: string, excludeVersion: string): void {
    const manifests = this.manifests.get(serviceId) ?? [];
    for (let i = 0; i < manifests.length; i++) {
      if (manifests[i].state === 'active' && manifests[i].manifestVersion !== excludeVersion) {
        manifests[i] = {
          ...manifests[i],
          state: 'superseded',
          supersededAt: new Date().toISOString(),
        };
      }
    }
  }

  private activateManifestPrefixes(manifest: ServiceVersionManifest): void {
    for (const [prefixId, version] of Object.entries(manifest.prefixes)) {
      const record = this.getPrefixRecord(prefixId, version);
      if (record.state === 'released') {
        this.transitionPrefix(prefixId, version, 'active');
      }
    }
  }
}
