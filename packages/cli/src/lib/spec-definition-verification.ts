// @def.boundary docs-control-plane
// @def.doc spec-definition-merge-validation

import type {
  ConventionDeriveInput,
  ConventionState,
  DefDataSource,
  DefDoc,
  DefDocBody,
} from 'definition-catalog';
import { deriveConventionState } from 'definition-catalog';
import type { DriftReport } from 'spec-analyzer';
import type {
  ContractReport,
  VerificationArtifact,
  VerificationArtifactReport,
  VerificationDefinitionBinding,
  VerificationSummary,
} from 'spec-tracker';
import { createVerificationArtifact, validateVerificationArtifact } from 'spec-tracker';
import { writeFile } from 'node:fs/promises';

export type VerificationReportStatus = 'reported' | 'no-report';
export type VerificationBindingStatus =
  | 'resolved'
  | 'missing'
  | 'unversioned'
  | 'stale-revision'
  | 'invalid';

export type VerificationAdapterDiagnosticCode =
  | 'artifact-invalid'
  | 'definition-not-found'
  | 'snapshot-incomplete'
  | 'address-mismatch'
  | 'unversioned-binding'
  | 'stale-revision'
  | 'drift-spec-mismatch';

export interface VerificationAdapterDiagnostic {
  readonly code: VerificationAdapterDiagnosticCode | string;
  readonly message: string;
  readonly specId: string;
  readonly definitionAddress?: string;
}

export interface VerificationRuntimeEvidence {
  readonly evidences: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** ContractReport.coverage의 원래 0..1 ratio. */
  readonly coverageRatio: number;
}

export interface VerificationReadModel {
  readonly specId: string;
  readonly reportStatus: VerificationReportStatus;
  readonly bindingStatus: VerificationBindingStatus | null;
  readonly convention: ConventionState;
  readonly conventionInput?: ConventionDeriveInput;
  readonly runtimeEvidence?: VerificationRuntimeEvidence;
  readonly report?: ContractReport;
  readonly definitionAddress?: string;
  readonly docIdAtRun?: string;
  readonly currentDocId?: string;
  /** optional static DriftReport; runtime convention 상태와 독립적으로 표시한다. */
  readonly driftReport?: DriftReport;
  readonly diagnostics: readonly VerificationAdapterDiagnostic[];
}

export interface CaptureVerificationBindingsOptions {
  /** 테스트 실행 직전에 캡처한 시각. artifact runStartedAt과 같아야 한다. */
  readonly capturedAt: string;
}

/**
 * 테스트 실행 전에 현재 definition snapshot을 고정한다.
 *
 * 이 함수는 읽기 전용 datasource만 사용하며, revision/bodyHash가 없는 문서는
 * pinning을 가장하지 않도록 즉시 실패시킨다. 실행 종료 후 현재 문서를 다시 읽어
 * binding을 만드는 우회는 허용하지 않는다.
 */
export async function captureVerificationDefinitionBindings(
  source: Pick<DefDataSource, 'get' | 'getBody'>,
  specIds: readonly string[],
  options: CaptureVerificationBindingsOptions,
): Promise<readonly VerificationDefinitionBinding[]> {
  if (parseTimestamp(options.capturedAt) === null) {
    throw new Error('capturedAt must be a valid ISO timestamp');
  }

  const normalizedIds = specIds.map((specId) => specId.trim());
  if (normalizedIds.some((specId) => specId.length === 0)) {
    throw new Error('specIds must contain only non-empty values');
  }
  const duplicate = normalizedIds.find((specId, index) => normalizedIds.indexOf(specId) !== index);
  if (duplicate) throw new Error(`duplicate specId: ${duplicate}`);
  if (normalizedIds.length === 0) throw new Error('at least one specId is required');

  const bindings: VerificationDefinitionBinding[] = [];
  for (const specId of normalizedIds) {
    const doc = await source.get(specId);
    if (!doc) throw new Error(`definition not found at run start: ${specId}`);
    if (!doc.address) throw new Error(`definition address missing at run start: ${specId}`);

    const body = await source.getBody(doc.docId);
    const revision = doc.revision ?? body?.revision ?? doc.version;
    const bodyHash = body?.bodyHash;
    if (revision === undefined || bodyHash === undefined) {
      throw new Error(`definition snapshot is incomplete at run start: ${specId}`);
    }

    const docVersion = doc.docVersion ?? body?.docVersion;
    bindings.push({
      specId,
      definitionAddress: doc.address,
      docIdAtRun: doc.docId,
      ...(docVersion ? { docVersion } : {}),
      revision,
      bodyHash,
      capturedAt: options.capturedAt,
    });
  }

  return bindings;
}

/** run-start binding을 CI/CLI가 다음 단계의 artifact producer에 전달할 JSON으로 저장한다. */
export async function writeVerificationBindingsFile(
  filePath: string,
  source: Pick<DefDataSource, 'get' | 'getBody'>,
  specIds: readonly string[],
  options: CaptureVerificationBindingsOptions,
): Promise<readonly VerificationDefinitionBinding[]> {
  const bindings = await captureVerificationDefinitionBindings(source, specIds, options);
  await writeFile(filePath, `${JSON.stringify(bindings, null, 2)}\n`, 'utf8');
  return bindings;
}

/** CI/CLI가 run-start binding을 포함한 artifact를 파일로 전달하는 producer 경계. */
export async function writeVerificationArtifactFile(
  filePath: string,
  input: {
    readonly runStartedAt: string;
    readonly runCompletedAt: string;
    readonly summary: VerificationSummary;
    readonly bindings?: ReadonlyMap<string, VerificationDefinitionBinding>;
  },
): Promise<VerificationArtifact> {
  const artifact = createVerificationArtifact(input);
  await writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifact;
}

type VerificationSource = Pick<DefDataSource, 'get' | 'getByAddress' | 'getBody'>;

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createDiagnostic(
  code: VerificationAdapterDiagnosticCode | string,
  message: string,
  specId: string,
  definitionAddress?: string,
): VerificationAdapterDiagnostic {
  return { code, message, specId, ...(definitionAddress ? { definitionAddress } : {}) };
}

function currentRevision(doc: DefDoc, body: DefDocBody | null): number | undefined {
  // sync/scan sources expose the default revision through DefDoc.version when
  // frontmatter did not declare an explicit revision. bodyHash still pins the
  // actual content, so this fallback must not be used without bodyHash.
  return doc.revision ?? body?.revision ?? doc.version;
}

function currentDocVersion(doc: DefDoc, body: DefDocBody | null): string | undefined {
  return doc.docVersion ?? body?.docVersion;
}

function isBindingVersioned(binding: VerificationDefinitionBinding): boolean {
  return binding.revision !== undefined && binding.bodyHash !== undefined;
}

function runtimeEvidence(report: ContractReport): VerificationRuntimeEvidence {
  return {
    evidences: report.evidences,
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
    coverageRatio: report.coverage,
  };
}

function deriveConvention(
  report: ContractReport,
): { readonly convention: ConventionState; readonly input?: ConventionDeriveInput } {
  // ContractReport는 0..1 ratio, harness input은 0..100 percentage다.
  const input: ConventionDeriveInput = {
    evidenceCount: report.evidences,
    coverage: report.coverage * 100,
    hasFailures: report.failed > 0,
  };
  return { convention: deriveConventionState(input), input };
}

function noReport(
  specId: string,
  diagnostics: readonly VerificationAdapterDiagnostic[] = [],
): VerificationReadModel {
  return {
    specId,
    reportStatus: 'no-report',
    bindingStatus: null,
    convention: 'unverified',
    diagnostics,
  };
}

function invalidArtifact(
  specId: string,
  message: string,
): VerificationReadModel {
  return {
    specId,
    reportStatus: 'no-report',
    bindingStatus: 'invalid',
    convention: 'unverified',
    diagnostics: [createDiagnostic('artifact-invalid', message, specId)],
  };
}

function findArtifactReport(
  artifact: VerificationArtifact,
  specId: string,
): VerificationArtifactReport | undefined {
  return artifact.reports.find((item) => item.report.specId === specId);
}

async function resolveCurrentDoc(
  source: VerificationSource,
  specId: string,
  binding: VerificationDefinitionBinding | undefined,
): Promise<DefDoc | null> {
  if (binding) {
    const byAddress = await source.getByAddress(binding.definitionAddress);
    if (byAddress) return byAddress;
    // Address가 사라진 경우 docId fallback은 rename 진단을 가능하게 한다.
    return source.get(binding.docIdAtRun);
  }
  return source.get(specId);
}

/** artifact와 현재 definition snapshot을 조합하되 원본을 변경하지 않는다. */
async function resolveRuntimeVerificationReadModel(
  source: VerificationSource,
  artifactInput: unknown,
  specId: string,
): Promise<VerificationReadModel> {
  const validation = validateVerificationArtifact(artifactInput);
  if (!validation.valid) {
    const summary = validation.diagnostics.map((item) => `${item.code}(${item.path})`).join(', ');
    return invalidArtifact(specId, `VerificationArtifact validation failed: ${summary}`);
  }

  const artifact = artifactInput as VerificationArtifact;
  const item = findArtifactReport(artifact, specId);
  const currentDoc = await resolveCurrentDoc(source, specId, item?.binding);

  if (!currentDoc) {
    return {
      ...noReport(specId),
      bindingStatus: 'missing',
      diagnostics: [
        createDiagnostic('definition-not-found', '현재 definition snapshot을 찾지 못함', specId),
      ],
    };
  }

  if (!item) {
    return {
      ...noReport(specId),
      currentDocId: currentDoc.docId,
      definitionAddress: currentDoc.address,
    };
  }

  const report = item.report;
  const binding = item.binding;
  const diagnostics: VerificationAdapterDiagnostic[] = [];
  if (!binding) {
    return {
      specId,
      reportStatus: 'reported',
      bindingStatus: 'unversioned',
      convention: 'unverified',
      report,
      runtimeEvidence: runtimeEvidence(report),
      currentDocId: currentDoc.docId,
      definitionAddress: currentDoc.address,
      diagnostics: [
        createDiagnostic('unversioned-binding', 'report에 run-start definition binding이 없음', specId),
      ],
    };
  }

  const body = await source.getBody(currentDoc.docId);
  if (!currentDoc.address || currentDoc.address !== binding.definitionAddress) {
    diagnostics.push(
      createDiagnostic(
        'address-mismatch',
        '현재 문서 address가 run-start binding과 일치하지 않음',
        specId,
        binding.definitionAddress,
      ),
    );
    return {
      specId,
      reportStatus: 'reported',
      bindingStatus: 'stale-revision',
      convention: 'unverified',
      report,
      runtimeEvidence: runtimeEvidence(report),
      definitionAddress: binding.definitionAddress,
      docIdAtRun: binding.docIdAtRun,
      currentDocId: currentDoc.docId,
      diagnostics,
    };
  }

  if (!isBindingVersioned(binding)) {
    diagnostics.push(
      createDiagnostic(
        'unversioned-binding',
        'binding에는 revision과 bodyHash가 모두 있어야 함',
        specId,
        binding.definitionAddress,
      ),
    );
    return {
      specId,
      reportStatus: 'reported',
      bindingStatus: 'unversioned',
      convention: 'unverified',
      report,
      runtimeEvidence: runtimeEvidence(report),
      definitionAddress: binding.definitionAddress,
      docIdAtRun: binding.docIdAtRun,
      currentDocId: currentDoc.docId,
      diagnostics,
    };
  }

  const revision = currentRevision(currentDoc, body);
  const bodyHash = body?.bodyHash;
  const docVersion = currentDocVersion(currentDoc, body);
  if (revision === undefined || bodyHash === undefined) {
    diagnostics.push(
      createDiagnostic(
        'snapshot-incomplete',
        '현재 definition snapshot에 revision 또는 bodyHash가 없어 비교할 수 없음',
        specId,
        binding.definitionAddress,
      ),
    );
    return {
      specId,
      reportStatus: 'reported',
      bindingStatus: 'invalid',
      convention: 'unverified',
      report,
      runtimeEvidence: runtimeEvidence(report),
      definitionAddress: binding.definitionAddress,
      docIdAtRun: binding.docIdAtRun,
      currentDocId: currentDoc.docId,
      diagnostics,
    };
  }

  if (
    revision !== binding.revision ||
    bodyHash !== binding.bodyHash ||
    (binding.docVersion !== undefined && docVersion !== binding.docVersion)
  ) {
    diagnostics.push(
      createDiagnostic(
        'stale-revision',
        '현재 definition snapshot의 revision/docVersion/bodyHash가 run-start binding과 다름',
        specId,
        binding.definitionAddress,
      ),
    );
    return {
      specId,
      reportStatus: 'reported',
      bindingStatus: 'stale-revision',
      convention: 'unverified',
      report,
      runtimeEvidence: runtimeEvidence(report),
      definitionAddress: binding.definitionAddress,
      docIdAtRun: binding.docIdAtRun,
      currentDocId: currentDoc.docId,
      diagnostics,
    };
  }

  const derived = deriveConvention(report);
  return {
    specId,
    reportStatus: 'reported',
    bindingStatus: 'resolved',
    convention: derived.convention,
    ...(derived.input ? { conventionInput: derived.input } : {}),
    report,
    runtimeEvidence: runtimeEvidence(report),
    definitionAddress: binding.definitionAddress,
    docIdAtRun: binding.docIdAtRun,
    currentDocId: currentDoc.docId,
    diagnostics,
  };
}

/** runtime evidence와 optional static drift를 소유권을 섞지 않고 read model로 결합한다. */
export async function resolveVerificationReadModel(
  source: VerificationSource,
  artifactInput: unknown,
  specId: string,
  driftReport?: DriftReport,
): Promise<VerificationReadModel> {
  if (driftReport && driftReport.specId !== specId) {
    return {
      ...invalidArtifact(specId, 'DriftReport specId가 현재 read model specId와 다름'),
      diagnostics: [
        createDiagnostic(
          'drift-spec-mismatch',
          `DriftReport.specId=${driftReport.specId}는 ${specId}와 다름`,
          specId,
        ),
      ],
    };
  }

  const model = await resolveRuntimeVerificationReadModel(source, artifactInput, specId);
  return driftReport ? { ...model, driftReport } : model;
}
