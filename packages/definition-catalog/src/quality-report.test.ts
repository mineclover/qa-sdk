// @def.doc definition-catalog-spec

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { collectQualityStats, formatQualityReport } from '../scripts/quality-report.mjs';

const ROOT = join(import.meta.dirname, '../../..');

describe('definition catalog quality report', () => {
  it('produces the requested baseline sections for approved docs', () => {
    const stats = collectQualityStats(ROOT);
    const output = formatQualityReport(stats);

    expect(stats.totals.approved).toBeGreaterThan(0);
    expect(stats.purposeCoverage.total).toBe(stats.totals.approved);
    expect(stats.totals.groups + stats.totals.leaf).toBe(stats.totals.approved);

    expect(output).toContain('^purpose 커버리지:');
    expect(output).toContain('links 없는 리프 문서 수:');
    expect(output).toContain('purpose 30자 미만 문서 목록');
    expect(output).toContain('^overview 없는 그룹 문서 목록');
    expect(output).toContain('tags 없는 문서 수:');
  });

  it('treats group docs as overview docs that declare contains links', () => {
    const stats = collectQualityStats(ROOT);
    const gateSystem = stats.documents.find((doc) => doc.id === 'gate-system');
    const gateApi = stats.documents.find((doc) => doc.id === 'gate-api');

    expect(gateSystem?.isGroup).toBe(true);
    expect(gateApi?.isGroup).toBe(false);
  });
});
