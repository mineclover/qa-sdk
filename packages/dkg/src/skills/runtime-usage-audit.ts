// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * 정적 impact cascade에 현재 runtime consumer 근거를 보강한다.
 *
 * 저장소 구현은 받지 않고, snapshot/evidence/audit read model만 입력으로 받는다.
 * 따라서 DKG 분석 계층은 SQLite나 CLI 상태에 직접 의존하지 않는다.
 */

export interface RuntimeUsageSnapshotInput {
  readonly data: string;
  readonly createdAt?: string;
}

export interface RuntimeFlowEvidenceInput {
  readonly addressContext: Readonly<Record<string, string>>;
}

export interface RuntimeCliAuditInput {
  readonly record?: {
    readonly address_context?: Readonly<Record<string, string>>;
  };
}

export interface RuntimePrefixUsage {
  readonly prefixId: string;
  /** usage snapshot의 addressUsages.count 합계 */
  readonly usageSnapshotRecords: number;
  /** 해당 prefix를 포함한 snapshot 수 */
  readonly usageSnapshotBatches: number;
  /** 해당 prefix가 관측된 snapshot 시간 범위 */
  readonly oldestUsageSnapshotAt?: string;
  readonly latestUsageSnapshotAt?: string;
  /** raw flow evidence에서 해당 prefix를 포함한 record 수 */
  readonly flowEvidenceRecords: number;
  /** CLI audit event에서 해당 prefix를 포함한 event 수 */
  readonly cliAuditEvents: number;
}

export interface RuntimeUsageAuditResult {
  readonly prefixes: readonly RuntimePrefixUsage[];
  /** 과거 snapshot을 포함해 persisted evidence가 한 번이라도 있는 target */
  readonly observedPrefixIds: readonly string[];
  readonly totalObservedRecords: number;
}

/**
 * affected prefix별 실제 runtime 사용량을 집계한다.
 * malformed snapshot은 전체 impact 분석을 실패시키지 않고 무시한다.
 */
export function auditRuntimePrefixUsage(input: {
  readonly prefixIds: readonly string[];
  readonly usageSnapshots?: readonly RuntimeUsageSnapshotInput[];
  readonly flowEvidence?: readonly RuntimeFlowEvidenceInput[];
  readonly cliAuditEvents?: readonly RuntimeCliAuditInput[];
}): RuntimeUsageAuditResult {
  const prefixIds = [...new Set(input.prefixIds)];
  const usage = new Map<
    string,
    { records: number; batches: number; oldest?: string; latest?: string }
  >();
  const flow = new Map<string, number>();
  const audit = new Map<string, number>();

  for (const prefixId of prefixIds) {
    usage.set(prefixId, { records: 0, batches: 0 });
    flow.set(prefixId, 0);
    audit.set(prefixId, 0);
  }

  for (const snapshot of input.usageSnapshots ?? []) {
    try {
      const parsed = JSON.parse(snapshot.data) as {
        addressUsages?: readonly {
          prefix?: string;
          prefixId?: string;
          count?: number;
        }[];
      };
      const seen = new Set<string>();
      for (const address of parsed.addressUsages ?? []) {
        const prefixId = address.prefix ?? address.prefixId;
        if (!prefixId) continue;
        const target = usage.get(prefixId);
        if (!target) continue;
        target.records += typeof address.count === 'number' ? address.count : 0;
        seen.add(prefixId);
      }
      for (const prefixId of seen) {
        const target = usage.get(prefixId);
        if (target) {
          target.batches++;
          if (snapshot.createdAt) {
            target.oldest =
              !target.oldest || snapshot.createdAt < target.oldest
                ? snapshot.createdAt
                : target.oldest;
            target.latest =
              !target.latest || snapshot.createdAt > target.latest
                ? snapshot.createdAt
                : target.latest;
          }
        }
      }
    } catch {
      // snapshot 하나의 손상이 다른 target의 runtime evidence를 가리지 않게 한다.
    }
  }

  for (const record of input.flowEvidence ?? []) {
    for (const prefixId of prefixIds) {
      if (Object.hasOwn(record.addressContext, prefixId)) {
        flow.set(prefixId, (flow.get(prefixId) ?? 0) + 1);
      }
    }
  }

  for (const event of input.cliAuditEvents ?? []) {
    const addressContext = event.record?.address_context;
    if (!addressContext) continue;
    for (const prefixId of prefixIds) {
      if (Object.hasOwn(addressContext, prefixId)) {
        audit.set(prefixId, (audit.get(prefixId) ?? 0) + 1);
      }
    }
  }

  const prefixes = prefixIds.map((prefixId) => {
    const snapshotUsage = usage.get(prefixId);
    return {
      prefixId,
      usageSnapshotRecords: snapshotUsage?.records ?? 0,
      usageSnapshotBatches: snapshotUsage?.batches ?? 0,
      ...(snapshotUsage?.oldest ? { oldestUsageSnapshotAt: snapshotUsage.oldest } : {}),
      ...(snapshotUsage?.latest ? { latestUsageSnapshotAt: snapshotUsage.latest } : {}),
      flowEvidenceRecords: flow.get(prefixId) ?? 0,
      cliAuditEvents: audit.get(prefixId) ?? 0,
    };
  });
  const active = prefixes.filter(
    (item) =>
      item.usageSnapshotRecords > 0 || item.flowEvidenceRecords > 0 || item.cliAuditEvents > 0,
  );

  return {
    prefixes,
    observedPrefixIds: active.map((item) => item.prefixId),
    totalObservedRecords: active.reduce(
      (sum, item) =>
        sum + item.usageSnapshotRecords + item.flowEvidenceRecords + item.cliAuditEvents,
      0,
    ),
  };
}
