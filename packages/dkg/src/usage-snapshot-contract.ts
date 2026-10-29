// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import type { UsageData } from './usage-types.js';

/** Usage snapshot 저장 발행 결과. backend별 반환 형식은 이 값으로 정규화한다. */
export type UsageSnapshotPublishResult = 'created' | 'exists';

/** Usage snapshot의 논리 저장 위치와 검증에 필요한 메타데이터. */
export interface UsageSnapshotContract {
  /** 저장소 내부 자동 증가값과 분리된 안정적인 논리 식별자. */
  readonly snapshotId: string;
  /** snapshot이 계산된 Catalog의 논리 식별자. */
  readonly catalogId: string;
  /** payload와 메타데이터의 canonical digest. */
  readonly digest: string;
  /** 재시도·중복 제출을 묶는 호출자 제공 키. */
  readonly idempotencyKey: string;
  /** 집계가 완료된 시각(ISO timestamp 또는 date). */
  readonly collectedAt: string;
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly totalRecords: number;
  readonly data: UsageData;
}

/** Usage snapshot을 보관하는 목적 기반 논리 port. DB 종류와 adapter 구현은 소유하지 않는다. */
export interface UsageSnapshotStore {
  publish(snapshot: UsageSnapshotContract): Promise<UsageSnapshotPublishResult>;
  get(snapshotId: string): Promise<UsageSnapshotContract | undefined>;
  getByIdempotencyKey(idempotencyKey: string): Promise<UsageSnapshotContract | undefined>;
  latest(catalogId: string): Promise<UsageSnapshotContract | undefined>;
}

export interface UsageSnapshotContractIssue {
  readonly path: string;
  readonly message: string;
}

export interface UsageSnapshotContractResult {
  readonly ok: boolean;
  readonly issues: readonly UsageSnapshotContractIssue[];
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/i;

function requiredText(value: unknown, path: string, issues: UsageSnapshotContractIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path, message: '비어 있지 않은 문자열이어야 합니다.' });
  }
}

function validTimestamp(value: unknown, path: string, issues: UsageSnapshotContractIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: 'ISO 날짜 또는 timestamp 문자열이어야 합니다.' });
  }
}

/** Usage snapshot의 목적·식별·기간·digest 불변식을 검증한다. */
export function validateUsageSnapshotContract(
  snapshot: UsageSnapshotContract,
): UsageSnapshotContractResult {
  const issues: UsageSnapshotContractIssue[] = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, issues: [{ path: '$', message: '객체여야 합니다.' }] };
  }

  requiredText(snapshot.snapshotId, 'snapshotId', issues);
  requiredText(snapshot.catalogId, 'catalogId', issues);
  requiredText(snapshot.idempotencyKey, 'idempotencyKey', issues);
  validTimestamp(snapshot.collectedAt, 'collectedAt', issues);

  if (typeof snapshot.digest !== 'string' || !DIGEST_PATTERN.test(snapshot.digest)) {
    issues.push({ path: 'digest', message: 'sha256:<64 hexadecimal> 형식이어야 합니다.' });
  }

  const from = snapshot.period?.from;
  const to = snapshot.period?.to;
  validTimestamp(from, 'period.from', issues);
  validTimestamp(to, 'period.to', issues);
  if (!Number.isNaN(Date.parse(String(from))) && !Number.isNaN(Date.parse(String(to)))) {
    if (Date.parse(String(from)) > Date.parse(String(to))) {
      issues.push({ path: 'period', message: 'period.from은 period.to보다 늦을 수 없습니다.' });
    }
  }

  if (!Number.isSafeInteger(snapshot.totalRecords) || snapshot.totalRecords < 0) {
    issues.push({ path: 'totalRecords', message: '0 이상의 안전한 정수여야 합니다.' });
  }

  const data = snapshot.data;
  if (!data || typeof data !== 'object') {
    issues.push({ path: 'data', message: 'UsageData 객체여야 합니다.' });
    return { ok: issues.length === 0, issues };
  }
  for (const field of ['entryUsages', 'addressUsages', 'coOccurrences', 'versionUsages'] as const) {
    if (!Array.isArray(data[field])) {
      issues.push({ path: `data.${field}`, message: '배열이어야 합니다.' });
    }
  }
  validTimestamp(data.collectionPeriod?.from, 'data.collectionPeriod.from', issues);
  validTimestamp(data.collectionPeriod?.to, 'data.collectionPeriod.to', issues);
  if (data.collectionPeriod) {
    if (data.collectionPeriod.from !== snapshot.period.from) {
      issues.push({
        path: 'data.collectionPeriod.from',
        message: 'period.from과 일치해야 합니다.',
      });
    }
    if (data.collectionPeriod.to !== snapshot.period.to) {
      issues.push({ path: 'data.collectionPeriod.to', message: 'period.to와 일치해야 합니다.' });
    }
  }
  if (data.sourceStats !== undefined) {
    if (
      data.sourceStats === null ||
      typeof data.sourceStats !== 'object' ||
      Array.isArray(data.sourceStats)
    ) {
      issues.push({ path: 'data.sourceStats', message: '객체여야 합니다.' });
    } else if (data.sourceStats.totalRecords !== snapshot.totalRecords) {
      issues.push({
        path: 'data.sourceStats.totalRecords',
        message: 'snapshot.totalRecords와 일치해야 합니다.',
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertUsageSnapshotContract(snapshot: UsageSnapshotContract): void {
  const result = validateUsageSnapshotContract(snapshot);
  if (!result.ok) {
    throw new Error(
      `UsageSnapshot 계약 위반: ${result.issues.map((issue) => issue.path).join(', ')}`,
    );
  }
}
