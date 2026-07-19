import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DefDoc, DefDocBody } from 'definition-catalog';
import type { DriftReport } from 'spec-analyzer';
import type {
  ContractReport,
  VerificationArtifact,
  VerificationDefinitionBinding,
} from 'spec-tracker';
import {
  captureVerificationDefinitionBindings,
  resolveVerificationReadModel,
  writeVerificationBindingsFile,
  writeVerificationArtifactFile,
} from './spec-definition-verification.js';

const REPORT: ContractReport = {
  specId: 'spec-a',
  evidences: 2,
  passed: 2,
  failed: 0,
  skipped: 0,
  markers: {},
  coverage: 1,
  lastVerified: '2026-01-01T00:01:00.000Z',
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

const DOC: DefDoc = {
  docId: 'spec-a',
  lifecycle: 'approved',
  tags: [],
  links: [],
  docVersion: 'v1',
  revision: 3,
  address: 'def_document:v2:123',
  version: 3,
};

const BODY: DefDocBody = {
  docId: 'spec-a',
  body: 'body',
  bodyHash: 'sha256:abc',
  docVersion: 'v1',
  revision: 3,
};

function artifact(overrides: Partial<VerificationArtifact> = {}): VerificationArtifact {
  return {
    schemaVersion: 1,
    runStartedAt: '2026-01-01T00:00:01.000Z',
    runCompletedAt: '2026-01-01T00:02:00.000Z',
    reports: [{ report: REPORT, binding: BINDING }],
    ...overrides,
  };
}

function source(
  doc: DefDoc | null = DOC,
  body: DefDocBody | null = BODY,
): Pick<import('definition-catalog').DefDataSource, 'get' | 'getByAddress' | 'getBody'> {
  return {
    get: async (docId) => (doc?.docId === docId ? doc : null),
    getByAddress: async (address) => (doc?.address === address ? doc : null),
    getBody: async (docId) => (body?.docId === docId ? body : null),
  };
}

describe('resolveVerificationReadModel', () => {
  it('matching address/revision/bodyHash를 resolved + compliant로 파생한다', async () => {
    const result = await resolveVerificationReadModel(source(), artifact(), 'spec-a');

    expect(result.bindingStatus).toBe('resolved');
    expect(result.convention).toBe('compliant');
    expect(result.conventionInput?.coverage).toBe(100);
    expect(result.runtimeEvidence?.coverageRatio).toBe(1);
    expect(result.runtimeEvidence?.coverageBasis).toBe('contract');
  });

  it('suite-level evidence는 binding이 resolved여도 compliant로 승격하지 않는다', async () => {
    const suiteReport: ContractReport = { ...REPORT, coverageBasis: 'suite' };
    const result = await resolveVerificationReadModel(
      source(),
      artifact({ reports: [{ report: suiteReport, binding: BINDING }] }),
      'spec-a',
    );

    expect(result.bindingStatus).toBe('resolved');
    expect(result.convention).toBe('unverified');
    expect(result.conventionInput).toBeUndefined();
    expect(result.runtimeEvidence?.coverageBasis).toBe('suite');
    expect(result.diagnostics.map((item) => item.code)).toContain('suite-level-evidence');
  });

  it('optional DriftReport를 runtime evidence와 별도 필드로 결합한다', async () => {
    const drift: DriftReport = {
      specId: 'spec-a',
      svc: 'svc-a',
      declared: [],
      implemented: [],
      missing: [],
      undocumented: [],
      coverage: 1,
    };
    const driftBefore = structuredClone(drift);
    const result = await resolveVerificationReadModel(source(), artifact(), 'spec-a', drift);

    expect(result.driftReport).toBe(drift);
    expect(drift).toEqual(driftBefore);
    expect(result.convention).toBe('compliant');
    expect(result.runtimeEvidence?.coverageRatio).toBe(1);
  });

  it('다른 specId의 DriftReport는 runtime read model에 섞지 않는다', async () => {
    const result = await resolveVerificationReadModel(source(), artifact(), 'spec-a', {
      specId: 'other-spec',
      svc: 'svc-a',
      declared: [],
      implemented: [],
      missing: [],
      undocumented: [],
      coverage: 1,
    });

    expect(result.bindingStatus).toBe('invalid');
    expect(result.diagnostics[0]?.code).toBe('drift-spec-mismatch');
  });

  it('원본 artifact/definition snapshot을 변경하지 않고 quality claim을 섞지 않는다', async () => {
    const input = artifact();
    const inputBefore = structuredClone(input);
    const docBefore = structuredClone(DOC);
    const bodyBefore = structuredClone(BODY);

    const result = await resolveVerificationReadModel(source(), input, 'spec-a');

    expect(input).toEqual(inputBefore);
    expect(DOC).toEqual(docBefore);
    expect(BODY).toEqual(bodyBefore);
    expect('qualityClaim' in result).toBe(false);
  });

  it('docId가 rename돼도 불변 address binding으로 resolved를 유지한다', async () => {
    const renamedDoc = { ...DOC, docId: 'spec-a-renamed' };
    const renamedBody = { ...BODY, docId: 'spec-a-renamed' };
    const result = await resolveVerificationReadModel(
      source(renamedDoc, renamedBody),
      artifact(),
      'spec-a',
    );

    expect(result.bindingStatus).toBe('resolved');
    expect(result.currentDocId).toBe('spec-a-renamed');
    expect(result.docIdAtRun).toBe('spec-a');
  });

  it('binding이 없으면 unversioned이고 harness input을 만들지 않는다', async () => {
    const result = await resolveVerificationReadModel(
      source(),
      artifact({ reports: [{ report: REPORT }] }),
      'spec-a',
    );

    expect(result.bindingStatus).toBe('unversioned');
    expect(result.convention).toBe('unverified');
    expect(result.conventionInput).toBeUndefined();
  });

  it('revision/bodyHash mismatch는 stale-revision이고 compliant로 승격되지 않는다', async () => {
    const staleBody = { ...BODY, bodyHash: 'sha256:changed' };
    const result = await resolveVerificationReadModel(source(DOC, staleBody), artifact(), 'spec-a');

    expect(result.bindingStatus).toBe('stale-revision');
    expect(result.convention).toBe('unverified');
    expect(result.diagnostics.map((item) => item.code)).toContain('stale-revision');
  });

  it('현재 문서가 없으면 missing으로 분류한다', async () => {
    const result = await resolveVerificationReadModel(source(null, null), artifact(), 'spec-a');

    expect(result.bindingStatus).toBe('missing');
    expect(result.convention).toBe('unverified');
  });

  it('v1 분류 주소는 단건 anchor로 사용하지 않고 ambiguous-address로 격리한다', async () => {
    const v1Doc = { ...DOC, address: 'def_document:v1:123' };
    const v1Binding = { ...BINDING, definitionAddress: 'def_document:v1:123' };
    const result = await resolveVerificationReadModel(
      {
        get: async (docId) => (docId === v1Doc.docId ? v1Doc : null),
        getByAddress: async () => {
          throw new Error('v1 address must not be resolved as a unique address');
        },
        getBody: async (docId) => (docId === BODY.docId ? BODY : null),
      },
      artifact({ reports: [{ report: REPORT, binding: v1Binding }] }),
      'spec-a',
    );

    expect(result.bindingStatus).toBe('ambiguous-address');
    expect(result.convention).toBe('unverified');
    expect(result.diagnostics.map((item) => item.code)).toContain('ambiguous-address');
  });

  it('report가 없으면 unverified로 남긴다', async () => {
    const noReport = await resolveVerificationReadModel(
      source(),
      artifact({ reports: [] }),
      'spec-a',
    );

    expect(noReport.reportStatus).toBe('no-report');
    expect(noReport.convention).toBe('unverified');
  });

  it('오래된 report도 binding revision/bodyHash가 같으면 계속 사용한다', async () => {
    const result = await resolveVerificationReadModel(source(), artifact(), 'spec-a');

    expect(result.bindingStatus).toBe('resolved');
    expect(result.convention).toBe('compliant');
  });

  it('malformed artifact는 invalid로 분류한다', async () => {
    const result = await resolveVerificationReadModel(
      source(),
      artifact({ reports: [{ report: { ...REPORT, coverage: 2 } }] as never }),
      'spec-a',
    );

    expect(result.bindingStatus).toBe('invalid');
    expect(result.convention).toBe('unverified');
    expect(result.diagnostics[0]?.code).toBe('artifact-invalid');
  });

  it('CI/CLI producer가 artifact를 JSON 파일로 전달한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-verification-artifact-'));
    try {
      const path = join(dir, 'verification.json');
      const summary = {
        reports: [REPORT],
        totalSpecs: 1,
        verifiedSpecs: 1,
        fullyPassed: 1,
        generatedAt: '2026-01-01T00:01:00.000Z',
      };
      const written = await writeVerificationArtifactFile(path, {
        runStartedAt: '2026-01-01T00:00:01.000Z',
        runCompletedAt: '2026-01-01T00:02:00.000Z',
        summary,
        bindings: new Map([[BINDING.specId, BINDING]]),
      });

      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(written);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('captureVerificationDefinitionBindings', () => {
  it('run-start snapshot에서 address/revision/bodyHash binding을 만든다', async () => {
    const bindings = await captureVerificationDefinitionBindings(source(), ['spec-a'], {
      capturedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(bindings).toEqual([BINDING]);
  });

  it('존재하지 않거나 version snapshot이 불완전하면 캡처하지 않는다', async () => {
    await expect(
      captureVerificationDefinitionBindings(source(null, null), ['spec-a'], {
        capturedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('definition not found');

    await expect(
      captureVerificationDefinitionBindings(
        source(DOC, { ...BODY, bodyHash: undefined }),
        ['spec-a'],
        {
          capturedAt: '2026-01-01T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow('snapshot is incomplete');
  });

  it('binding capture는 파일 transport를 만들고 duplicate/invalid 입력을 거부한다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qa-sdk-verification-bindings-'));
    try {
      const filePath = join(directory, 'bindings.json');
      await writeVerificationBindingsFile(filePath, source(), ['spec-a'], {
        capturedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual([BINDING]);

      await expect(
        captureVerificationDefinitionBindings(source(), ['spec-a', 'spec-a'], {
          capturedAt: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('duplicate specId');
      await expect(
        captureVerificationDefinitionBindings(source(), ['spec-a'], {
          capturedAt: 'not-a-timestamp',
        }),
      ).rejects.toThrow('capturedAt');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
