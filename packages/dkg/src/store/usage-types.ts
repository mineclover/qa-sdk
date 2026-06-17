/** @qa-sdk/convergence UsageData 계열과 구조 호환 — store tier 격리용 */

export interface EntryUsage {
  readonly prefixId: string;
  readonly entryId: string;
  readonly count: number;
}

export interface AddressUsage {
  readonly prefixId: string;
  readonly version: string;
  readonly address: number;
  readonly count: number;
}

export interface CoOccurrence {
  readonly sourcePrefix: string;
  readonly sourceEntry: string;
  readonly targetPrefix: string;
  readonly targetEntry: string;
  readonly count: number;
  readonly totalSourceCount: number;
}

export interface VersionUsage {
  readonly prefix: string;
  readonly version: string;
  readonly count: number;
  readonly lastSeen: string;
  readonly sessions: readonly string[];
}

export interface UsageData {
  readonly entryUsages: readonly EntryUsage[];
  readonly addressUsages: readonly AddressUsage[];
  readonly coOccurrences: readonly CoOccurrence[];
  readonly collectionPeriod: { readonly from: string; readonly to: string };
  readonly versionUsages: readonly VersionUsage[];
  readonly sourceStats?: {
    readonly totalRecords: number;
    readonly uniqueTraces: number;
    readonly uniqueSessions: number;
    readonly uniqueEventKeys: number;
    readonly traceIds: readonly string[];
    readonly sessionIds: readonly string[];
    readonly eventKeys: readonly string[];
    readonly byExecutionMode: Record<string, number>;
    readonly byExecutionId: Record<string, number>;
  };
}

export interface MetricValue {
  readonly id: string;
  readonly value: number;
  readonly status: "ok" | "warning" | "critical";
  readonly unit?: string;
  readonly observedAt?: string;
}
