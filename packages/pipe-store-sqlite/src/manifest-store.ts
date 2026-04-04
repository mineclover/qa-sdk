/**
 * SqliteManifestRegistry — ManifestRegistry의 SQLite 영속 구현
 *
 * definition-catalog의 ManifestRegistry와 동일한 public API.
 * 인메모리 Map 대신 SQLite에 저장.
 * 상태 머신 가드 로직은 ManifestRegistry 원본을 재사용.
 *
 * @def.doc pipe-store-sqlite
 */

// 타입은 definition-catalog와 호환 (직접 정의하여 패키지 의존 제거)
export type PrefixLifecycleState = "draft" | "released" | "active" | "deprecated" | "archived";
export type ManifestLifecycleState = "draft" | "published" | "active" | "superseded" | "archived";

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

export interface ServiceVersionManifest {
  readonly serviceId: string;
  readonly manifestVersion: string;
  readonly state: ManifestLifecycleState;
  readonly runtimeAddressVersion?: string;
  readonly serviceUnitVersion?: string;
  readonly ownershipVersion?: string;
  readonly exposureVersion?: string;
  readonly deploymentVersion?: string;
  readonly runtimeAddress?: RuntimeAddressSnapshot;
  readonly prefixes: Record<string, string>;
  readonly createdAt: string;
  readonly publishedAt?: string;
  readonly activatedAt?: string;
  readonly supersededAt?: string;
  readonly archivedAt?: string;
  readonly changelog?: string;
}

export interface RuntimeAddressSnapshot {
  readonly serviceId: string;
  readonly namespace: string;
  readonly name: string;
  readonly env: string;
  readonly region: string;
}

export interface ServiceManifestOptions {
  readonly runtimeAddressVersion?: string;
  readonly serviceUnitVersion?: string;
  readonly ownershipVersion?: string;
  readonly exposureVersion?: string;
  readonly deploymentVersion?: string;
  readonly runtimeAddress?: RuntimeAddressSnapshot;
}

export interface GuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}
import { eq, and, desc } from "drizzle-orm";

import { createDb, type DrizzleDb } from "./db/connection.js";
import { prefixVersions, serviceManifests } from "./db/schema.js";

// ── 전이 규칙 (definition-catalog 비의존, 직접 정의) ──

const PREFIX_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["released"],
  released: ["active"],
  active: ["deprecated"],
  deprecated: ["archived"],
  archived: [],
};

const MANIFEST_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["published"],
  published: ["active"],
  active: ["superseded"],
  superseded: ["archived"],
  archived: [],
};

export class SqliteManifestRegistry {
  private db: DrizzleDb;

  constructor(path: string) {
    const { db } = createDb(path);
    this.db = db;
  }

  /** 기존 DrizzleDb 인스턴스로 생성 (createStores에서 사용) */
  static fromDb(db: DrizzleDb): SqliteManifestRegistry {
    const instance = Object.create(SqliteManifestRegistry.prototype) as SqliteManifestRegistry;
    instance.db = db;
    return instance;
  }

  // ── Prefix 관리 ────────────────────────────────────

  registerPrefix(prefixId: string, version: string): PrefixVersionRecord {
    const existing = this.getPrefixRecordOrNull(prefixId, version);
    if (existing) {
      throw new Error(`prefix "${prefixId}" 버전 "${version}" 이미 존재`);
    }

    const record: PrefixVersionRecord = {
      prefixId,
      version,
      state: "draft",
      createdAt: new Date().toISOString(),
    };

    this.savePrefixRecord(record);
    return record;
  }

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
      ...(targetState === "released" ? { releasedAt: now } : {}),
      ...(targetState === "active" ? { activatedAt: now } : {}),
      ...(targetState === "deprecated" ? { deprecatedAt: now } : {}),
      ...(targetState === "archived" ? { archivedAt: now } : {}),
    };

    this.savePrefixRecord(updated);
    return updated;
  }

  checkPrefixTransition(record: PrefixVersionRecord, targetState: PrefixLifecycleState): GuardResult {
    const allowed = PREFIX_TRANSITIONS[record.state];
    if (!allowed?.includes(targetState)) {
      return { allowed: false, reason: `${record.state}→${targetState} 허용되지 않음` };
    }
    return { allowed: true };
  }

  getPrefixRecord(prefixId: string, version: string): PrefixVersionRecord {
    const record = this.getPrefixRecordOrNull(prefixId, version);
    if (!record) throw new Error(`prefix "${prefixId}:${version}" 미등록`);
    return record;
  }

  getActivePrefixVersion(prefixId: string): PrefixVersionRecord | null {
    const row = this.db
      .select()
      .from(prefixVersions)
      .where(and(eq(prefixVersions.prefixId, prefixId), eq(prefixVersions.state, "active")))
      .orderBy(desc(prefixVersions.version))
      .get();
    return row ? rowToPrefixRecord(row) : null;
  }

  // ── Manifest 관리 ──────────────────────────────────

  createManifest(
    serviceId: string,
    manifestVersion: string,
    prefixes: Record<string, string>,
    changelog?: string,
    options?: ServiceManifestOptions,
  ): ServiceVersionManifest {
    if (options?.runtimeAddress && options.runtimeAddress.serviceId !== serviceId) {
      throw new Error(`runtimeAddress.serviceId "${options.runtimeAddress.serviceId}" != manifest serviceId "${serviceId}"`);
    }
    const manifest: ServiceVersionManifest = {
      serviceId,
      manifestVersion,
      state: "draft",
      ...(options?.runtimeAddressVersion ? { runtimeAddressVersion: options.runtimeAddressVersion } : {}),
      ...(options?.serviceUnitVersion ? { serviceUnitVersion: options.serviceUnitVersion } : {}),
      ...(options?.ownershipVersion ? { ownershipVersion: options.ownershipVersion } : {}),
      ...(options?.exposureVersion ? { exposureVersion: options.exposureVersion } : {}),
      ...(options?.deploymentVersion ? { deploymentVersion: options.deploymentVersion } : {}),
      ...(options?.runtimeAddress ? { runtimeAddress: options.runtimeAddress } : {}),
      prefixes,
      createdAt: new Date().toISOString(),
      changelog,
    };

    this.saveManifest(manifest);
    return manifest;
  }

  transitionManifest(
    serviceId: string,
    manifestVersion: string,
    targetState: ManifestLifecycleState,
  ): ServiceVersionManifest {
    const manifest = this.getManifest(serviceId, manifestVersion);
    const guard = this.checkManifestTransition(manifest, targetState);
    if (!guard.allowed) {
      throw new Error(
        `manifest "${serviceId}:${manifestVersion}" ${manifest.state}→${targetState} 전이 불가: ${guard.reason}`,
      );
    }

    const now = new Date().toISOString();
    let updated: ServiceVersionManifest = {
      ...manifest,
      state: targetState,
      ...(targetState === "published" ? { publishedAt: now } : {}),
      ...(targetState === "active" ? { activatedAt: now } : {}),
      ...(targetState === "superseded" ? { supersededAt: now } : {}),
      ...(targetState === "archived" ? { archivedAt: now } : {}),
    };

    // active 전이 시: 이전 active 매니페스트 supersede + prefix auto-active
    if (targetState === "active") {
      const prevActive = this.getActiveManifest(serviceId);
      if (prevActive) {
        this.saveManifest({ ...prevActive, state: "superseded", supersededAt: now });
      }
      // 매니페스트 내 prefix를 active로 전이
      for (const [prefixId, version] of Object.entries(manifest.prefixes)) {
        const prefixRecord = this.getPrefixRecordOrNull(prefixId, version);
        if (prefixRecord && prefixRecord.state === "released") {
          this.savePrefixRecord({ ...prefixRecord, state: "active", activatedAt: now });
        }
      }
    }

    this.saveManifest(updated);
    return updated;
  }

  checkManifestTransition(manifest: ServiceVersionManifest, targetState: ManifestLifecycleState): GuardResult {
    const allowed = MANIFEST_TRANSITIONS[manifest.state];
    if (!allowed?.includes(targetState)) {
      return { allowed: false, reason: `${manifest.state}→${targetState} 허용되지 않음` };
    }
    // published 전이: 모든 prefix가 released 이상인지 검증
    if (targetState === "published") {
      for (const [prefixId, version] of Object.entries(manifest.prefixes)) {
        const record = this.getPrefixRecordOrNull(prefixId, version);
        if (!record || record.state === "draft") {
          return {
            allowed: false,
            reason: `prefix "${prefixId}:${version}" 가 draft 상태 — released 이상 필요`,
          };
        }
      }
    }
    return { allowed: true };
  }

  getManifest(serviceId: string, manifestVersion: string): ServiceVersionManifest {
    const id = `${serviceId}:${manifestVersion}`;
    const row = this.db.select().from(serviceManifests).where(eq(serviceManifests.id, id)).get();
    if (!row) throw new Error(`manifest "${serviceId}:${manifestVersion}" 미등록`);
    return rowToManifest(row);
  }

  getActiveManifest(serviceId: string): ServiceVersionManifest | null {
    const row = this.db
      .select()
      .from(serviceManifests)
      .where(and(eq(serviceManifests.serviceId, serviceId), eq(serviceManifests.state, "active")))
      .get();
    return row ? rowToManifest(row) : null;
  }

  listManifests(serviceId: string): readonly ServiceVersionManifest[] {
    return this.db
      .select()
      .from(serviceManifests)
      .where(eq(serviceManifests.serviceId, serviceId))
      .orderBy(serviceManifests.manifestVersion)
      .all()
      .map(rowToManifest);
  }

  getPrefixVersionFromManifest(serviceId: string, manifestVersion: string, prefixId: string): string {
    const manifest = this.getManifest(serviceId, manifestVersion);
    const version = manifest.prefixes[prefixId];
    if (!version) throw new Error(`manifest "${serviceId}:${manifestVersion}"에 prefix "${prefixId}" 없음`);
    return version;
  }

  // close는 createStores()의 close 함수로 일괄 처리

  // ── 내부 헬퍼 ──────────────────────────────────────

  private getPrefixRecordOrNull(prefixId: string, version: string): PrefixVersionRecord | null {
    const id = `${prefixId}:${version}`;
    const row = this.db.select().from(prefixVersions).where(eq(prefixVersions.id, id)).get();
    return row ? rowToPrefixRecord(row) : null;
  }

  private savePrefixRecord(record: PrefixVersionRecord): void {
    const id = `${record.prefixId}:${record.version}`;
    this.db
      .insert(prefixVersions)
      .values({
        id,
        prefixId: record.prefixId,
        version: record.version,
        state: record.state,
        createdAt: record.createdAt,
        releasedAt: record.releasedAt ?? null,
        activatedAt: record.activatedAt ?? null,
        deprecatedAt: record.deprecatedAt ?? null,
        archivedAt: record.archivedAt ?? null,
      })
      .onConflictDoUpdate({
        target: prefixVersions.id,
        set: {
          state: record.state,
          releasedAt: record.releasedAt ?? null,
          activatedAt: record.activatedAt ?? null,
          deprecatedAt: record.deprecatedAt ?? null,
          archivedAt: record.archivedAt ?? null,
        },
      })
      .run();
  }

  private saveManifest(manifest: ServiceVersionManifest): void {
    const id = `${manifest.serviceId}:${manifest.manifestVersion}`;
    this.db
      .insert(serviceManifests)
      .values({
        id,
        serviceId: manifest.serviceId,
        manifestVersion: manifest.manifestVersion,
        state: manifest.state,
        runtimeAddressVersion: manifest.runtimeAddressVersion ?? null,
        serviceUnitVersion: manifest.serviceUnitVersion ?? null,
        ownershipVersion: manifest.ownershipVersion ?? null,
        exposureVersion: manifest.exposureVersion ?? null,
        deploymentVersion: manifest.deploymentVersion ?? null,
        runtimeAddress: manifest.runtimeAddress ? JSON.stringify(manifest.runtimeAddress) : null,
        prefixes: JSON.stringify(manifest.prefixes),
        createdAt: manifest.createdAt,
        publishedAt: manifest.publishedAt ?? null,
        activatedAt: manifest.activatedAt ?? null,
        supersededAt: manifest.supersededAt ?? null,
        archivedAt: manifest.archivedAt ?? null,
        changelog: manifest.changelog ?? null,
      })
      .onConflictDoUpdate({
        target: serviceManifests.id,
        set: {
          state: manifest.state,
          runtimeAddressVersion: manifest.runtimeAddressVersion ?? null,
          serviceUnitVersion: manifest.serviceUnitVersion ?? null,
          ownershipVersion: manifest.ownershipVersion ?? null,
          exposureVersion: manifest.exposureVersion ?? null,
          deploymentVersion: manifest.deploymentVersion ?? null,
          runtimeAddress: manifest.runtimeAddress ? JSON.stringify(manifest.runtimeAddress) : null,
          prefixes: JSON.stringify(manifest.prefixes),
          publishedAt: manifest.publishedAt ?? null,
          activatedAt: manifest.activatedAt ?? null,
          supersededAt: manifest.supersededAt ?? null,
          archivedAt: manifest.archivedAt ?? null,
          changelog: manifest.changelog ?? null,
        },
      })
      .run();
  }
}

// ── 변환 헬퍼 ───────────────────────────────────────

type PrefixRow = typeof prefixVersions.$inferSelect;
type ManifestRow = typeof serviceManifests.$inferSelect;

function rowToPrefixRecord(row: PrefixRow): PrefixVersionRecord {
  return {
    prefixId: row.prefixId,
    version: row.version,
    state: row.state as PrefixLifecycleState,
    createdAt: row.createdAt,
    ...(row.releasedAt ? { releasedAt: row.releasedAt } : {}),
    ...(row.activatedAt ? { activatedAt: row.activatedAt } : {}),
    ...(row.deprecatedAt ? { deprecatedAt: row.deprecatedAt } : {}),
    ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
  };
}

function rowToManifest(row: ManifestRow): ServiceVersionManifest {
  return {
    serviceId: row.serviceId,
    manifestVersion: row.manifestVersion,
    state: row.state as ManifestLifecycleState,
    ...(row.runtimeAddressVersion ? { runtimeAddressVersion: row.runtimeAddressVersion } : {}),
    ...(row.serviceUnitVersion ? { serviceUnitVersion: row.serviceUnitVersion } : {}),
    ...(row.ownershipVersion ? { ownershipVersion: row.ownershipVersion } : {}),
    ...(row.exposureVersion ? { exposureVersion: row.exposureVersion } : {}),
    ...(row.deploymentVersion ? { deploymentVersion: row.deploymentVersion } : {}),
    ...(row.runtimeAddress
      ? { runtimeAddress: JSON.parse(row.runtimeAddress) as RuntimeAddressSnapshot }
      : {}),
    prefixes: JSON.parse(row.prefixes) as Record<string, string>,
    createdAt: row.createdAt,
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    ...(row.activatedAt ? { activatedAt: row.activatedAt } : {}),
    ...(row.supersededAt ? { supersededAt: row.supersededAt } : {}),
    ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
    ...(row.changelog ? { changelog: row.changelog } : {}),
  };
}
