// @def.boundary spec-engine-system
// @def.doc spec-tracker-system

import type { ContractReport, VerificationSummary } from './types.js';

/** 현재 artifact wire format 버전. 파일 transport의 schema discriminator로 사용한다. */
export const VERIFICATION_ARTIFACT_SCHEMA_VERSION = 1 as const;

/** 테스트 시작 시 definition snapshot에서 캡처한 binding. */
export interface VerificationDefinitionBinding {
  readonly specId: string;
  readonly definitionAddress: string;
  readonly docIdAtRun: string;
  readonly docVersion?: string;
  readonly revision?: number;
  readonly bodyHash?: string;
  readonly capturedAt: string;
}

/** 하나의 ContractReport와 optional definition binding의 transport 단위. */
export interface VerificationArtifactReport {
  readonly report: ContractReport;
  /** 없으면 상위 adapter가 unversioned로 판정한다. */
  readonly binding?: VerificationDefinitionBinding;
}

/** CI artifact 또는 CLI 파일 입력으로 전달되는 순수 read-only 검증 결과. */
export interface VerificationArtifact {
  readonly schemaVersion: typeof VERIFICATION_ARTIFACT_SCHEMA_VERSION;
  readonly runStartedAt: string;
  readonly runCompletedAt: string;
  readonly reports: readonly VerificationArtifactReport[];
}

export type VerificationArtifactDiagnosticCode =
  | 'invalid-schema-version'
  | 'invalid-run-timestamp'
  | 'run-order-invalid'
  | 'reports-invalid'
  | 'duplicate-spec-id'
  | 'invalid-spec-id'
  | 'invalid-report-counts'
  | 'invalid-report-coverage'
  | 'invalid-report-timestamp'
  | 'invalid-binding'
  | 'binding-spec-mismatch'
  | 'binding-before-run-invalid';

export interface VerificationArtifactDiagnostic {
  readonly code: VerificationArtifactDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export interface VerificationArtifactValidation {
  readonly valid: boolean;
  readonly diagnostics: readonly VerificationArtifactDiagnostic[];
}

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseTimestamp(value: unknown): number | null {
  if (!isNonEmptyString(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDiagnostic(
  diagnostics: VerificationArtifactDiagnostic[],
  code: VerificationArtifactDiagnosticCode,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function validateReport(
  report: unknown,
  path: string,
  diagnostics: VerificationArtifactDiagnostic[],
): string | null {
  if (!isRecord(report)) {
    addDiagnostic(diagnostics, 'reports-invalid', path, 'report must be an object');
    return null;
  }

  const specId = report['specId'];
  if (!isNonEmptyString(specId)) {
    addDiagnostic(diagnostics, 'invalid-spec-id', `${path}.specId`, 'specId must be non-empty');
    return null;
  }

  const evidenceCount = report['evidences'];
  const passed = report['passed'];
  const failed = report['failed'];
  const skipped = report['skipped'];
  const countsValid =
    isCount(evidenceCount) && isCount(passed) && isCount(failed) && isCount(skipped);
  if (!countsValid) {
    addDiagnostic(
      diagnostics,
      'invalid-report-counts',
      path,
      'evidences must equal passed + failed + skipped and all counts must be non-negative integers',
    );
  } else if (evidenceCount !== passed + failed + skipped) {
    addDiagnostic(
      diagnostics,
      'invalid-report-counts',
      path,
      'evidences must equal passed + failed + skipped and all counts must be non-negative integers',
    );
  }

  const coverage = report['coverage'];
  const passedCount = countsValid ? (passed as number) : null;
  const failedCount = countsValid ? (failed as number) : null;
  const testable = passedCount !== null && failedCount !== null ? passedCount + failedCount : null;
  if (
    !isFiniteNumber(coverage) ||
    coverage < 0 ||
    coverage > 1 ||
    (testable === 0 && coverage !== 0) ||
    (testable !== null &&
      testable > 0 &&
      Math.abs(coverage - (passedCount as number) / testable) > Number.EPSILON * 16)
  ) {
    addDiagnostic(
      diagnostics,
      'invalid-report-coverage',
      `${path}.coverage`,
      'coverage must be the 0..1 ratio passed / (passed + failed)',
    );
  }

  if (parseTimestamp(report['lastVerified']) === null) {
    addDiagnostic(
      diagnostics,
      'invalid-report-timestamp',
      `${path}.lastVerified`,
      'lastVerified must be a valid ISO timestamp',
    );
  }

  return specId;
}

function validateBinding(
  binding: unknown,
  path: string,
  reportSpecId: string,
  runStartedAt: number,
  diagnostics: VerificationArtifactDiagnostic[],
): void {
  if (!isRecord(binding)) {
    addDiagnostic(diagnostics, 'invalid-binding', path, 'binding must be an object');
    return;
  }

  if (!isNonEmptyString(binding['specId'])) {
    addDiagnostic(diagnostics, 'invalid-binding', `${path}.specId`, 'binding specId is required');
  } else if (binding['specId'] !== reportSpecId) {
    addDiagnostic(
      diagnostics,
      'binding-spec-mismatch',
      `${path}.specId`,
      'binding specId must match report specId',
    );
  }
  if (!isNonEmptyString(binding['definitionAddress'])) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.definitionAddress`,
      'definitionAddress is required',
    );
  }
  if (!isNonEmptyString(binding['docIdAtRun'])) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.docIdAtRun`,
      'docIdAtRun is required',
    );
  }
  if (binding['docVersion'] !== undefined && !isNonEmptyString(binding['docVersion'])) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.docVersion`,
      'docVersion must be a non-empty string when present',
    );
  }
  if (
    binding['revision'] !== undefined &&
    (typeof binding['revision'] !== 'number' ||
      !Number.isInteger(binding['revision']) ||
      binding['revision'] < 0)
  ) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.revision`,
      'revision must be a non-negative integer when present',
    );
  }
  if (binding['bodyHash'] !== undefined && !isNonEmptyString(binding['bodyHash'])) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.bodyHash`,
      'bodyHash must be a non-empty string when present',
    );
  }

  const capturedAt = parseTimestamp(binding['capturedAt']);
  if (capturedAt === null) {
    addDiagnostic(
      diagnostics,
      'invalid-binding',
      `${path}.capturedAt`,
      'capturedAt must be a valid ISO timestamp',
    );
  } else if (capturedAt > runStartedAt) {
    addDiagnostic(
      diagnostics,
      'binding-before-run-invalid',
      `${path}.capturedAt`,
      'capturedAt must not be after runStartedAt',
    );
  }
}

/** 외부 JSON을 적용하기 전에 artifact의 구조적 불변조건을 검증한다. */
export function validateVerificationArtifact(input: unknown): VerificationArtifactValidation {
  const diagnostics: VerificationArtifactDiagnostic[] = [];
  if (!isRecord(input)) {
    addDiagnostic(diagnostics, 'reports-invalid', '$', 'artifact must be an object');
    return { valid: false, diagnostics };
  }

  if (input['schemaVersion'] !== VERIFICATION_ARTIFACT_SCHEMA_VERSION) {
    addDiagnostic(
      diagnostics,
      'invalid-schema-version',
      '$.schemaVersion',
      `schemaVersion must be ${VERIFICATION_ARTIFACT_SCHEMA_VERSION}`,
    );
  }

  const runStartedAt = parseTimestamp(input['runStartedAt']);
  const runCompletedAt = parseTimestamp(input['runCompletedAt']);
  if (runStartedAt === null) {
    addDiagnostic(
      diagnostics,
      'invalid-run-timestamp',
      '$.runStartedAt',
      'runStartedAt must be a valid ISO timestamp',
    );
  }
  if (runCompletedAt === null) {
    addDiagnostic(
      diagnostics,
      'invalid-run-timestamp',
      '$.runCompletedAt',
      'runCompletedAt must be a valid ISO timestamp',
    );
  }
  if (runStartedAt !== null && runCompletedAt !== null && runStartedAt > runCompletedAt) {
    addDiagnostic(
      diagnostics,
      'run-order-invalid',
      '$',
      'runStartedAt must not be after runCompletedAt',
    );
  }

  const reports = input['reports'];
  if (!Array.isArray(reports)) {
    addDiagnostic(diagnostics, 'reports-invalid', '$.reports', 'reports must be an array');
    return { valid: diagnostics.length === 0, diagnostics };
  }

  const seenSpecIds = new Set<string>();
  for (const [index, item] of reports.entries()) {
    const path = `$.reports[${index}]`;
    if (!isRecord(item)) {
      addDiagnostic(diagnostics, 'reports-invalid', path, 'report item must be an object');
      continue;
    }
    const specId = validateReport(item['report'], `${path}.report`, diagnostics);
    if (specId !== null) {
      if (seenSpecIds.has(specId)) {
        addDiagnostic(diagnostics, 'duplicate-spec-id', path, `duplicate report specId: ${specId}`);
      }
      seenSpecIds.add(specId);
      if (item['binding'] !== undefined && runStartedAt !== null) {
        validateBinding(item['binding'], `${path}.binding`, specId, runStartedAt, diagnostics);
      } else if (item['binding'] !== undefined) {
        validateBinding(item['binding'], `${path}.binding`, specId, Number.POSITIVE_INFINITY, diagnostics);
      }
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/** typed artifact 생성 시에도 동일한 wire validation을 적용한다. */
export function createVerificationArtifact(input: {
  readonly runStartedAt: string;
  readonly runCompletedAt: string;
  readonly summary: VerificationSummary;
  readonly bindings?: ReadonlyMap<string, VerificationDefinitionBinding>;
}): VerificationArtifact {
  const artifact: VerificationArtifact = {
    schemaVersion: VERIFICATION_ARTIFACT_SCHEMA_VERSION,
    runStartedAt: input.runStartedAt,
    runCompletedAt: input.runCompletedAt,
    reports: input.summary.reports.map((report) => {
      const binding = input.bindings?.get(report.specId);
      return binding ? { report, binding } : { report };
    }),
  };
  const validation = validateVerificationArtifact(artifact);
  if (!validation.valid) {
    const detail = validation.diagnostics.map((item) => `${item.code} at ${item.path}`).join(', ');
    throw new Error(`Invalid verification artifact: ${detail}`);
  }
  return artifact;
}
