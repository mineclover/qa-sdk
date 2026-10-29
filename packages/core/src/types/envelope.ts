// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { EventRecord } from './record.js';

// ── Owner ──────────────────────────────────────────────

export type OwnerType = 'tenant' | 'workspace' | 'user' | 'agent';

export interface TransmissionOwner {
  owner_type: OwnerType;
  owner_id: string;
}

// ── Source ──────────────────────────────────────────────

export interface TransmissionSource {
  service_name: string;
  sdk_name: string;
  sdk_version: string;
}

// ── Runtime ────────────────────────────────────────────

export interface TransmissionRuntime {
  platform: string;
  device_ref?: string;
  os_version?: string;
  app_version?: string;
}

// ── Build ──────────────────────────────────────────────

/** 배포 환경. 권장값: "local" | "dev" | "staging" | "production" | "test" | "stage" | "prod" */
export type BuildEnv = string;

export interface TransmissionBuild {
  env: BuildEnv;
  build_ref?: string;
  release_version?: string;
}

// ── Catalog Snapshot 문맥 (ADR-010) ─────────────────────

/** 이 batch의 좌표 주소를 만든 CatalogSnapshot 문맥 */
export interface CatalogSnapshotWire {
  catalog_id: string;
  /** registry 발급 순번 — 표시용. 식별은 digest (codegen 시점에는 알 수 없어 선택) */
  snapshot_version?: number;
  /** computeCatalogDigest 결과 (`sha256:<64 hex>`) */
  digest: string;
  /** wire 값 그대로 — 지원 여부는 ingest snapshot gate가 판정한다 */
  codec_version: string;
}

// ── Transmission Envelope ──────────────────────────────

export interface TransmissionEnvelope {
  transmission_id: string;
  sent_at: string;
  owner: TransmissionOwner;
  source: TransmissionSource;
  runtime: TransmissionRuntime;
  build: TransmissionBuild;
  /** 엔벨로프 전체에 적용되는 인프라 주소 컨텍스트. 레코드의 address_context가 override */
  infra_context?: Record<string, string>;
  /**
   * 배포 시점의 entry snapshot ID (envelope 전략 snapshotSupply용).
   * @deprecated catalog_snapshot 사용 (D-2). 기존 SDK 호환을 위해 유지한다.
   */
  entry_snapshot?: string;
  /** 좌표 주소를 만든 CatalogSnapshot 문맥. 구버전 SDK는 보내지 않는다 */
  catalog_snapshot?: CatalogSnapshotWire;
  records: EventRecord[];
}
