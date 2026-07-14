import { describe, it, expect } from 'vitest';
import { TaxonomyDocSchema } from '../../src/schema/zod.js';

describe('TaxonomyDocSchema', () => {
  it('유효한 최소 yaml 객체를 파싱한다', () => {
    const doc = {
      taxonomy: 'test',
      version: 1,
      axes: { scope: { entries: ['apm', 'ingest'] } },
    };
    const result = TaxonomyDocSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('axes 누락 시 실패한다', () => {
    const result = TaxonomyDocSchema.safeParse({ taxonomy: 't', version: 1 });
    expect(result.success).toBe(false);
  });

  it('entries가 비어있으면 실패한다', () => {
    const result = TaxonomyDocSchema.safeParse({
      taxonomy: 't',
      version: 1,
      axes: { scope: { entries: [] } },
    });
    expect(result.success).toBe(false);
  });
});
