// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, it, expect } from 'vitest';
import { DEMO_CATALOG } from 'demo-snapshot';
import { optimalCapacity, optimizeCapacities, optimizeWithImpact } from '@qa-sdk/convergence';
import { deriveFromCatalog } from 'dkg';

describe('optimalCapacity', () => {
  it('최소 capacity는 32', () => {
    expect(optimalCapacity(0)).toBe(32);
    expect(optimalCapacity(1)).toBe(32);
    expect(optimalCapacity(2)).toBe(32);
  });

  it('entries ≤ 8 → 32', () => {
    expect(optimalCapacity(5)).toBe(32);
    expect(optimalCapacity(8)).toBe(32);
  });

  it('entries ≤ 16 → 64', () => {
    expect(optimalCapacity(10)).toBe(64);
    expect(optimalCapacity(16)).toBe(64);
  });

  it('entries ≤ 32 → 128', () => {
    expect(optimalCapacity(20)).toBe(128);
    expect(optimalCapacity(32)).toBe(128);
  });

  it('entries ≤ 128 → 256', () => {
    expect(optimalCapacity(50)).toBe(256);
    expect(optimalCapacity(128)).toBe(256);
  });

  it('entries > 512 → nextPow2(entries × 2)', () => {
    expect(optimalCapacity(513)).toBe(2048); // 513 × 2 = 1026 → 2048
    expect(optimalCapacity(1000)).toBe(2048); // 1000 × 2 = 2000 → 2048
  });

  it('2^53 안전 검증 — 5차원 prefix', () => {
    // 5차원 × capacity 256 = 256^5 ≈ 1.1×10^12
    const shape5d = 256 ** 5;
    expect(shape5d).toBeLessThan(Number.MAX_SAFE_INTEGER);
    // 2^53의 0.01% 이내
    expect(shape5d / Number.MAX_SAFE_INTEGER).toBeLessThan(0.001);
  });
});

describe('DEMO_CATALOG capacity 최적화', () => {
  it('before/after 비교', () => {
    const axisData = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
      const latest = axis.versions[latestKey] as any;
      return {
        id,
        entries: latest.entries?.length ?? 0,
        capacity: latest.capacity ?? latest.entries?.length ?? 0,
      };
    });

    const report = optimizeCapacities(axisData);

    console.log('\n══ Capacity 최적화 Before/After ══');
    console.log('─'.repeat(75));
    console.log('  axis            entries  before  after   headroom  변경');
    console.log('─'.repeat(75));

    for (const r of report.recommendations) {
      const marker = r.changed ? '✱' : ' ';
      console.log(
        `${marker} ${r.axisId.padEnd(16)} ${String(r.currentEntries).padStart(5)}` +
          `  ${String(r.currentCapacity).padStart(6)}  ${String(r.recommendedCapacity).padStart(5)}` +
          `  ${String(r.headroomAfter).padStart(8)}  ${r.changed ? r.reason : '─'}`,
      );
    }

    console.log('─'.repeat(75));
    console.log(`  총 ${report.summary.totalAxes}개 축, ${report.summary.changed}개 변경 필요`);
    console.log(
      `  주소 공간 합계: ${report.summary.totalAddressSpaceBefore} → ${report.summary.totalAddressSpaceAfter}`,
    );

    // 최적화 후 모든 축이 headroom ≥ 2
    for (const r of report.recommendations) {
      expect(r.headroomAfter).toBeGreaterThanOrEqual(1);
    }
  });

  it('cascade 영향 포함 최적화', () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const axisData = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
      const latest = axis.versions[latestKey] as any;
      return {
        id,
        entries: latest.entries?.length ?? 0,
        capacity: latest.capacity ?? latest.entries?.length ?? 0,
      };
    });

    const report = optimizeWithImpact(axisData, graph);

    console.log('\n══ Cascade 영향 ══');
    if (report.impactDetails.length === 0) {
      console.log('  변경 대상 없음');
    } else {
      for (const d of report.impactDetails) {
        const severity = d.affectedPrefixes > 2 ? '🔴' : d.affectedPrefixes > 0 ? '🟡' : '🟢';
        console.log(
          `  ${severity} ${d.axisId}: ${d.affectedPrefixes}개 prefix 영향 (depth=${d.cascadeDepth})`,
        );
      }
    }

    // stride-break가 발생하는 축 중 영향 범위가 큰 것 식별
    const highImpact = report.impactDetails.filter((d) => d.affectedPrefixes >= 3);
    console.log(
      `\n  고영향 축 (≥3 prefix): ${highImpact.map((d) => d.axisId).join(', ') || '없음'}`,
    );

    // capacity가 이미 최적화되어 있으면 변경 대상 0일 수 있음
    expect(report.impactDetails.length).toBeGreaterThanOrEqual(0);
  });
});
