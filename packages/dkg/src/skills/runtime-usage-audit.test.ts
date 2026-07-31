// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import { auditRuntimePrefixUsage } from './runtime-usage-audit.js';

describe('auditRuntimePrefixUsage', () => {
  it('snapshot, flow evidence, CLI audit의 target 사용량을 합산한다', () => {
    const result = auditRuntimePrefixUsage({
      prefixIds: ['ir_pipe', 'ir_data'],
      usageSnapshots: [
        {
          createdAt: '2026-07-31 02:04:48',
          data: JSON.stringify({
            addressUsages: [
              { prefixId: 'ir_pipe', address: 3, count: 4 },
              { prefix: 'ir_data', address: 7, count: 2 },
            ],
          }),
        },
      ],
      flowEvidence: [{ addressContext: { ir_pipe: 'ir_pipe:v1:3' } }],
      cliAuditEvents: [{ record: { address_context: { ir_data: 'ir_data:v1:7' } } }],
    });

    expect(result.prefixes).toEqual([
      {
        prefixId: 'ir_pipe',
        usageSnapshotRecords: 4,
        usageSnapshotBatches: 1,
        oldestUsageSnapshotAt: '2026-07-31 02:04:48',
        latestUsageSnapshotAt: '2026-07-31 02:04:48',
        flowEvidenceRecords: 1,
        cliAuditEvents: 0,
      },
      {
        prefixId: 'ir_data',
        usageSnapshotRecords: 2,
        usageSnapshotBatches: 1,
        oldestUsageSnapshotAt: '2026-07-31 02:04:48',
        latestUsageSnapshotAt: '2026-07-31 02:04:48',
        flowEvidenceRecords: 0,
        cliAuditEvents: 1,
      },
    ]);
    expect(result.observedPrefixIds).toEqual(['ir_pipe', 'ir_data']);
    expect(result.totalObservedRecords).toBe(8);
  });

  it('malformed snapshot과 미사용 target은 영향 분석을 막지 않는다', () => {
    const result = auditRuntimePrefixUsage({
      prefixIds: ['ir_pipe', 'ir_data'],
      usageSnapshots: [{ data: '{not-json' }],
    });

    expect(result.observedPrefixIds).toEqual([]);
    expect(result.totalObservedRecords).toBe(0);
    expect(result.prefixes.every((item) => item.usageSnapshotRecords === 0)).toBe(true);
  });
});
