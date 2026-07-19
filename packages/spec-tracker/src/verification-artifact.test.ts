import { describe, expect, it } from 'vitest';
import type { ContractReport, VerificationSummary } from './types.js';
import {
  createVerificationArtifact,
  validateVerificationArtifact,
  type VerificationArtifact,
  type VerificationDefinitionBinding,
} from './verification-artifact.js';

const REPORT: ContractReport = {
  specId: 'spec-a',
  evidences: 2,
  passed: 1,
  failed: 1,
  skipped: 0,
  markers: {},
  coverage: 0.5,
  lastVerified: '2026-01-01T00:01:00.000Z',
};

const SUMMARY: VerificationSummary = {
  reports: [REPORT],
  totalSpecs: 1,
  verifiedSpecs: 1,
  fullyPassed: 0,
  generatedAt: '2026-01-01T00:01:00.000Z',
};

const BINDING: VerificationDefinitionBinding = {
  specId: 'spec-a',
  definitionAddress: 'def_document:v2:123',
  docIdAtRun: 'spec-a',
  docVersion: 'v1',
  revision: 3,
  bodyHash: 'sha256:abc',
  capturedAt: '2026-01-01T00:00:00.000Z',
};

function validArtifact(): VerificationArtifact {
  return createVerificationArtifact({
    runStartedAt: '2026-01-01T00:00:01.000Z',
    runCompletedAt: '2026-01-01T00:02:00.000Z',
    summary: SUMMARY,
    bindings: new Map([[BINDING.specId, BINDING]]),
  });
}

describe('VerificationArtifact', () => {
  it('summary와 run-start binding을 transport artifact로 만든다', () => {
    const artifact = validArtifact();

    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.reports).toHaveLength(1);
    expect(artifact.reports[0]?.report).toEqual(REPORT);
    expect(artifact.reports[0]?.binding).toEqual(BINDING);
    expect(validateVerificationArtifact(artifact)).toEqual({ valid: true, diagnostics: [] });
  });

  it('binding이 없는 report는 artifact 구조상 유효하며 상위 adapter가 unversioned로 판정한다', () => {
    const artifact = createVerificationArtifact({
      runStartedAt: '2026-01-01T00:00:01.000Z',
      runCompletedAt: '2026-01-01T00:02:00.000Z',
      summary: SUMMARY,
    });

    expect(validateVerificationArtifact(artifact).valid).toBe(true);
    expect(artifact.reports[0]?.binding).toBeUndefined();
  });

  it('report의 count/coverage 불변조건을 검증한다', () => {
    const artifact = validArtifact();
    const invalid = {
      ...artifact,
      reports: [
        {
          ...artifact.reports[0],
          report: { ...REPORT, coverage: 1.2, evidences: 3 },
        },
      ],
    };

    const result = validateVerificationArtifact(invalid);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['invalid-report-counts', 'invalid-report-coverage']),
    );

    const invalidBasis = validateVerificationArtifact({
      ...artifact,
      reports: [{ ...artifact.reports[0], report: { ...REPORT, coverageBasis: 'unknown' } }],
    });
    expect(invalidBasis.valid).toBe(false);
    expect(invalidBasis.diagnostics.map((item) => item.code)).toContain(
      'invalid-report-coverage-basis',
    );
  });

  it('중복 specId, binding 불일치, run 이후 capturedAt을 거부한다', () => {
    const artifact = validArtifact();
    const duplicate = {
      ...artifact,
      reports: [
        artifact.reports[0],
        {
          report: { ...REPORT },
          binding: {
            ...BINDING,
            specId: 'other-spec',
            capturedAt: '2026-01-01T00:00:02.000Z',
          },
        },
      ],
    };

    const result = validateVerificationArtifact(duplicate);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'duplicate-spec-id',
        'binding-spec-mismatch',
        'binding-before-run-invalid',
      ]),
    );
  });

  it('생성 입력이 invalid이면 예외를 던진다', () => {
    expect(() =>
      createVerificationArtifact({
        runStartedAt: '2026-01-01T00:02:00.000Z',
        runCompletedAt: '2026-01-01T00:01:00.000Z',
        summary: SUMMARY,
      }),
    ).toThrow(/Invalid verification artifact/);
  });
});
