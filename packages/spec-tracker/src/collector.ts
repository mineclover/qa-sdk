// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 증거 수집기.
 *
 * 인메모리 저장소. 수집된 증거는 불변이며 추가만 가능하다.
 */
import type {
  ContractEvidence,
  ContractMarkerKind,
  EvidenceSource,
  EvidenceStatus,
} from "./types.js";

export interface RecordInput {
  readonly specId: string;
  readonly status: EvidenceStatus;
  readonly marker?: ContractMarkerKind;
  readonly source?: EvidenceSource;
  readonly testFile?: string;
  readonly testName?: string;
  readonly duration?: number;
  readonly error?: string;
}

export class SpecCollector {
  private readonly items: ContractEvidence[] = [];

  record(input: RecordInput): ContractEvidence {
    const evidence: ContractEvidence = {
      specId: input.specId,
      status: input.status,
      marker: input.marker,
      source: input.source ?? "test",
      testFile: input.testFile,
      testName: input.testName,
      duration: input.duration,
      error: input.error,
      timestamp: new Date().toISOString(),
    };
    this.items.push(evidence);
    return evidence;
  }

  all(): readonly ContractEvidence[] {
    return this.items;
  }

  bySpec(specId: string): readonly ContractEvidence[] {
    return this.items.filter((e) => e.specId === specId);
  }

  specIds(): readonly string[] {
    return [...new Set(this.items.map((e) => e.specId))];
  }

  count(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
