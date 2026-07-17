// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk quality — 품질 게이트/번들 조회 CLI.
 *
 * 우선순위:
 * 1. definition-data-source(local/server)에서 gate 메타 조회
 * 2. 데이터 소스가 없으면 markdown scan fallback
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execa, execaSync } from 'execa';
import { createDataSource, type DataSourceOptions } from 'definition-data-source';
import {
  createProgrammingArtifactRegistryRecord,
  type ProgrammingArtifactRegistryRecord,
} from 'operational-ontology/programming-artifacts';
import {
  CONTRACT_MARKER_NAMES,
  assembleContract,
  extractByLevel,
  scanAndBuild,
  type DefDataSource,
  type DefDoc,
  type MemoryDefinitionRegistry,
} from 'definition-catalog';
import {
  classifyHarnessDocRole,
  deriveHarnessState,
  getHarnessStateDef,
  getDomainDef,
  getGateKindDef,
  type QualityGateSpec,
} from 'work-domain';
import {
  QualityLedger,
  SqliteQualityStore,
  type GateDescriptor,
  type GateRunEntry,
  type GateStatus,
  type GateVerificationStatus,
} from 'quality-ledger';
import type { FileReviewStatus } from 'review-ledger';
import type {
  ClaimAuditBinding,
  ClaimAuditFileReview,
  ClaimAuditGateStatus,
  ClaimSectionInput,
  VerificationClaimAuditReport,
} from 'spec-tracker';
import { generateVerificationClaimAudit } from 'spec-tracker';
import { appendProgrammingArtifactRegistryRecord } from '../lib/programming-artifact-registry.js';
import { getQaSdkDir } from '../lib/qa-dir.js';
import {
  collectContainedQualityDocs,
  toGateDescriptors,
  toQualityTopologyDoc,
  type QualityTopologyDoc,
} from '../lib/quality-gate-topology.js';

const QA_DIR = getQaSdkDir();
const QUALITY_LEDGER_DB = join(QA_DIR, 'quality-ledger.sqlite');
const REVIEW_LEDGER_DB = join(QA_DIR, 'review-ledger.sqlite');

interface QualityEntry {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly level?: string;
  readonly scope: string;
  readonly aspect: string;
  readonly depth: string;
  readonly ref?: string;
  readonly gate: QualityGateSpec;
}

type SimpleDoc = QualityTopologyDoc;

export interface LoadedQualityDoc {
  readonly entry: QualityEntry;
  readonly purpose: string;
}

interface LoadedQualityIndex {
  readonly docs: LoadedQualityDoc[];
  readonly byId: Map<string, LoadedQualityDoc>;
  readonly source?: DefDataSource;
  readonly registry?: MemoryDefinitionRegistry;
  readonly errors: readonly { file: string; error: string }[];
}

export function closeQualityDataSource(source: DefDataSource | undefined): void {
  if (!source || !('close' in source) || typeof source.close !== 'function') return;
  source.close();
}

interface LoadedDocGraph {
  readonly registry: MemoryDefinitionRegistry;
  readonly bodies: ReadonlyMap<string, string>;
  readonly getBody: (id: string) => string | undefined;
  readonly errors: readonly { file: string; error: string }[];
}

function qualityDocDimension(value: string | undefined): string {
  return value ?? 'unknown';
}

interface QualityBundleStatusSummary {
  readonly bundleId: string;
  readonly title: string;
  readonly gateCount: number;
  readonly claimCount: number;
  readonly verifiedClaimCount: number;
  readonly bundleState: string;
  readonly verifiedGates: number;
  readonly totalGates: number;
  readonly reviewScopes: readonly string[];
}

interface QualityStatusSnapshot {
  readonly rootId: string;
  readonly bundles: readonly QualityBundleStatusSummary[];
  readonly generatedAt: string;
}

interface BundleVerification {
  readonly bundleId: string | null;
  readonly totalGates: number;
  readonly verifiedGates: number;
  readonly verified: boolean;
  readonly gateStatuses: ReadonlyMap<string, GateStatus>;
  readonly blockingGateStatuses: readonly GateStatus[];
}

type QualityRunFailureClass =
  | 'command-not-found'
  | 'infra-transient'
  | 'static-check-failure'
  | 'test-failure'
  | 'build-failure'
  | 'audit-failure'
  | 'ai-eval-failure'
  | 'success-pattern-mismatch';

interface QualityLedgerWithBundleVerification {
  resolveBundleVerification(descriptors: GateDescriptor[]): BundleVerification;
}

interface QualityLedgerWithRunContext {
  recordRun(input: {
    gateDocId: string;
    docVersion: number;
    bundleId?: string | null;
    command: string;
    outcome: 'pass' | 'fail';
    exitCode?: number | null;
    notes?: string | null;
    repoRoot?: string | null;
    gitBranch?: string | null;
    gitSha?: string | null;
    runDurationMs?: number | null;
    successPattern?: string | null;
    successPatternMatched?: boolean | null;
    failureClass?: QualityRunFailureClass | null;
  }): void;
}

interface GitRunContext {
  readonly repoRoot: string;
  readonly branch: string | null;
  readonly sha: string | null;
}

export interface EvaluatedGateRunResult {
  readonly outcome: 'pass' | 'fail';
  readonly note?: string;
  readonly failureClass?: QualityRunFailureClass;
  readonly successPatternMatched: boolean | null;
}

export interface QualityRunJsonResult {
  readonly gateDocId: string;
  readonly bundleId: string | null;
  readonly command: string;
  readonly outcome: 'pass' | 'fail';
  readonly exitCode: number;
  readonly durationMs: number;
  readonly note?: string;
  readonly failureClass?: QualityRunFailureClass;
  readonly successPattern?: string;
  readonly successPatternMatched: boolean | null;
  readonly git: {
    readonly repoRoot: string;
    readonly branch: string | null;
    readonly sha: string | null;
  };
  readonly diagnosis?: GateDiagnosis;
  readonly bundleVerification?: {
    readonly verified: boolean;
    readonly verifiedGates: number;
    readonly totalGates: number;
    readonly blockers: readonly {
      readonly gateDocId: string;
      readonly status: GateVerificationStatus;
    }[];
  };
  readonly next: {
    readonly onOutcome: 'pass' | 'fail';
    readonly candidates: readonly string[];
    readonly ranked?: readonly {
      readonly gateDocId: string;
      readonly score: number;
      readonly status: GateVerificationStatus;
      readonly reasons: readonly string[];
    }[];
  };
  readonly stdout: string;
  readonly stderr: string;
}

export interface GateDiagnosis {
  readonly gateDocId: string;
  readonly status: GateVerificationStatus;
  readonly summary: string;
  readonly failureClass?: QualityRunFailureClass;
  readonly flaky: boolean;
  readonly recommendations: readonly string[];
  readonly recentOutcomes: readonly ('pass' | 'fail')[];
  readonly lastRun: {
    readonly outcome: 'pass' | 'fail';
    readonly exitCode: number | null;
    readonly executedAt: string;
    readonly note: string | null;
    readonly gitBranch: string | null;
    readonly gitSha: string | null;
    readonly runDurationMs: number | null;
  } | null;
}

export interface RankedNextDoc {
  readonly doc: LoadedQualityDoc;
  readonly score: number;
  readonly status: GateVerificationStatus;
  readonly reasons: readonly string[];
}

function ensureLedgerDir(): void {
  if (!existsSync(QA_DIR)) mkdirSync(QA_DIR, { recursive: true });
}

function createLedger(): QualityLedger {
  ensureLedgerDir();
  return new QualityLedger(new SqliteQualityStore(QUALITY_LEDGER_DB));
}

function resolveBundleVerification(
  ledger: QualityLedger,
  descriptors: GateDescriptor[],
): BundleVerification {
  return (ledger as QualityLedgerWithBundleVerification).resolveBundleVerification(descriptors);
}

function getGitValue(cwd: string, args: string[]): string | null {
  try {
    const { stdout } = execaSync('git', args, { cwd });
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function detectGitRunContext(cwd: string): GitRunContext {
  return {
    repoRoot: getGitValue(cwd, ['rev-parse', '--show-toplevel']) ?? cwd,
    branch: getGitValue(cwd, ['branch', '--show-current']),
    sha: getGitValue(cwd, ['rev-parse', 'HEAD']),
  };
}

async function createReviewLedger(cwd: string) {
  ensureLedgerDir();
  const { ReviewLedger, SqliteReviewStore } = await import('review-ledger');
  return new ReviewLedger(new SqliteReviewStore(REVIEW_LEDGER_DB), cwd);
}

type ReviewLedgerInstance = Awaited<ReturnType<typeof createReviewLedger>>;

interface QualityStatusBuildContext {
  readonly ledger: QualityLedger;
  readonly reviewLedger: ReviewLedgerInstance;
}

export function parseQualityCommandArgs(args: string[]): {
  positional: string[];
  flags: Record<string, string>;
  sourceOptions: DataSourceOptions;
} {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let mode: DataSourceOptions['mode'];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--local') {
      mode = 'local';
      continue;
    }
    if (arg === '--server') {
      mode = 'server';
      continue;
    }
    if (arg === '--scan') {
      mode = 'scan';
      continue;
    }
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2);
      const next = args[index + 1];
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (next && !next.startsWith('--')) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = 'true';
      }
      continue;
    }
    positional.push(arg);
  }

  return {
    positional,
    flags,
    sourceOptions: { mode },
  };
}

function toQualityDoc(doc: DefDoc): LoadedQualityDoc | undefined {
  if (!doc.gate) return undefined;
  return {
    entry: {
      id: doc.docId,
      title: doc.title ?? doc.docId,
      version: doc.version,
      level: doc.level,
      scope: qualityDocDimension(doc.scope),
      aspect: qualityDocDimension(doc.aspect),
      depth: qualityDocDimension(doc.depth),
      ref: doc.sourcePath,
      gate: doc.gate,
    },
    purpose: doc.purpose ?? '',
  };
}

function toSimpleDoc(doc: DefDoc | undefined | null): SimpleDoc | undefined {
  if (!doc) return undefined;
  return {
    id: doc.docId,
    title: doc.title ?? doc.docId,
    version: doc.version,
    level: doc.level,
    scope: qualityDocDimension(doc.scope),
    aspect: qualityDocDimension(doc.aspect),
    depth: qualityDocDimension(doc.depth),
    serviceId: doc.svc,
    tags: doc.tags,
    gate: doc.gate,
  };
}

async function loadQualityDocsFromDataSource(
  options: DataSourceOptions,
): Promise<LoadedQualityIndex> {
  const source = await createDataSource(options);
  try {
    const docs = (await source.list({ tag: 'quality-gate', limit: 1000 }))
      .map(toQualityDoc)
      .filter((doc): doc is LoadedQualityDoc => doc !== undefined)
      .toSorted((a, b) => a.entry.id.localeCompare(b.entry.id));

    return {
      docs,
      byId: new Map(docs.map((doc) => [doc.entry.id, doc])),
      source,
      errors: [],
    };
  } catch (error) {
    closeQualityDataSource(source);
    throw error;
  }
}

async function loadQualityDocsFromScan(rootDir: string): Promise<LoadedQualityIndex> {
  const result = await scanAndBuild(rootDir, [join(rootDir, 'docs')]);
  const docs: LoadedQualityDoc[] = [];

  for (const entry of result.registry.all()) {
    if (!entry.gate || !entry.ref) continue;
    const absPath = join(rootDir, entry.ref);
    const content = await readFile(absPath, 'utf-8');
    docs.push({
      entry: {
        id: entry.id,
        title: entry.title,
        version: entry.revision ?? 1,
        level: entry.level,
        scope: qualityDocDimension(entry.scope),
        aspect: qualityDocDimension(entry.aspect),
        depth: qualityDocDimension(entry.depth),
        ref: entry.ref,
        gate: entry.gate,
      },
      purpose: extractByLevel(content, 'purpose').text.trim(),
    });
  }

  docs.sort((a, b) => a.entry.id.localeCompare(b.entry.id));
  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.entry.id, doc])),
    registry: result.registry,
    errors: result.errors,
  };
}

async function loadDocGraph(rootDir: string): Promise<LoadedDocGraph> {
  const result = await scanAndBuild(rootDir, [join(rootDir, 'docs')]);
  const bodies = new Map<string, string>();
  const getBody = (id: string): string | undefined => {
    const cached = bodies.get(id);
    if (cached !== undefined) return cached;

    const entry = result.registry.get(id);
    if (!entry?.ref) return undefined;

    try {
      const body = readFileSync(join(rootDir, entry.ref), 'utf-8');
      bodies.set(id, body);
      return body;
    } catch {
      return undefined;
    }
  };

  return {
    registry: result.registry,
    bodies,
    getBody,
    errors: result.errors,
  };
}

function loadQualityDocsFromGraph(graph: LoadedDocGraph): LoadedQualityIndex {
  const docs: LoadedQualityDoc[] = [];

  for (const entry of graph.registry.all()) {
    if (!entry.gate || !entry.ref) continue;
    docs.push({
      entry: {
        id: entry.id,
        title: entry.title,
        version: entry.revision ?? 1,
        level: entry.level,
        scope: qualityDocDimension(entry.scope),
        aspect: qualityDocDimension(entry.aspect),
        depth: qualityDocDimension(entry.depth),
        ref: entry.ref,
        gate: entry.gate,
      },
      purpose: extractByLevel(graph.getBody(entry.id) ?? '', 'purpose').text.trim(),
    });
  }

  docs.sort((a, b) => a.entry.id.localeCompare(b.entry.id));
  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.entry.id, doc])),
    registry: graph.registry,
    errors: graph.errors,
  };
}

async function loadQualityDocs(
  rootDir: string,
  options: DataSourceOptions,
): Promise<LoadedQualityIndex> {
  const scanData = await loadQualityDocsFromScan(rootDir);
  let data: LoadedQualityIndex | undefined;

  try {
    data = await loadQualityDocsFromDataSource(options);
    if (data.docs.length === 0) {
      closeQualityDataSource(data.source);
      return scanData;
    }

    const merged = new Map(scanData.docs.map((doc) => [doc.entry.id, doc]));
    for (const doc of data.docs) {
      const existing = merged.get(doc.entry.id);
      if (!existing) {
        merged.set(doc.entry.id, doc);
        continue;
      }

      merged.set(doc.entry.id, {
        ...existing,
        ...doc,
        entry: {
          ...existing.entry,
          ...doc.entry,
        },
        purpose: doc.purpose || existing.purpose,
      });
    }

    const docs = [...merged.values()].toSorted((a, b) => a.entry.id.localeCompare(b.entry.id));
    return {
      docs,
      byId: new Map(docs.map((doc) => [doc.entry.id, doc])),
      source: data.source,
      registry: scanData.registry,
      errors: scanData.errors,
    };
  } catch {
    closeQualityDataSource(data?.source);
    // fallback below
  }
  return scanData;
}

async function withQualityDocs<T>(
  rootDir: string,
  sourceOptions: DataSourceOptions,
  callback: (index: LoadedQualityIndex) => Promise<T> | T,
): Promise<T> {
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    return await callback(index);
  } finally {
    closeQualityDataSource(index.source);
  }
}

function matchesFilter(doc: LoadedQualityDoc, flags: Record<string, string>): boolean {
  const gate = doc.entry.gate;
  if (flags['kind'] && gate.kind !== flags['kind']) return false;
  if (flags['domain'] && gate.workDomain !== flags['domain']) return false;
  if (flags['story'] && gate.storyId !== flags['story']) return false;
  if (flags['pkg'] && gate.package !== flags['pkg']) return false;
  if (flags['q']) {
    const q = flags['q'].toLowerCase();
    const haystack = [
      doc.entry.id,
      doc.entry.title,
      gate.command,
      gate.storyId ?? '',
      gate.package ?? '',
      doc.purpose,
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function printDocLine(doc: LoadedQualityDoc): void {
  const gate = doc.entry.gate;
  const domain = getDomainDef(gate.workDomain);
  const kind = getGateKindDef(gate.kind);
  const extras = [
    gate.package ? `pkg=${gate.package}` : '',
    gate.storyId ? `story=${gate.storyId}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  console.log(
    `  ${doc.entry.id}  ${kind.scope}/${gate.kind}  ${domain.id}${extras ? `  ${extras}` : ''}`,
  );
  console.log(`    ${gate.command}`);
  if (doc.purpose) console.log(`    ${doc.purpose.slice(0, 100)}`);
}

export function selectNextDocs(
  current: LoadedQualityDoc,
  allDocs: readonly LoadedQualityDoc[],
  outcome: 'pass' | 'fail',
): LoadedQualityDoc[] {
  const ids =
    outcome === 'pass'
      ? (current.entry.gate.suggestOnPass ?? [])
      : (current.entry.gate.suggestOnFail ?? []);
  if (ids.length === 0) return [];

  const byId = new Map(allDocs.map((doc) => [doc.entry.id, doc]));
  return ids.map((id) => byId.get(id)).filter((doc): doc is LoadedQualityDoc => doc !== undefined);
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function evaluateGateRunResult(params: {
  gateKind: QualityGateSpec['kind'];
  exitCode: number | null | undefined;
  stdout: string;
  stderr: string;
  successPattern?: string;
}): EvaluatedGateRunResult {
  const exitCode = params.exitCode ?? 1;
  const successPattern = params.successPattern?.trim();

  if (exitCode !== 0) {
    const output = `${params.stdout}\n${params.stderr}`.toLowerCase();
    let failureClass: QualityRunFailureClass;

    if (
      output.includes('command not found') ||
      output.includes('is not recognized as an internal or external command') ||
      output.includes('no such file or directory')
    ) {
      failureClass = 'command-not-found';
    } else if (
      output.includes('econnreset') ||
      output.includes('econnrefused') ||
      output.includes('etimedout') ||
      output.includes('eai_again') ||
      output.includes('network error') ||
      output.includes('socket hang up') ||
      output.includes('fetch failed')
    ) {
      failureClass = 'infra-transient';
    } else {
      const scope = getGateKindDef(params.gateKind).scope;
      failureClass =
        scope === 'static'
          ? 'static-check-failure'
          : scope === 'build'
            ? 'build-failure'
            : scope === 'audit'
              ? 'audit-failure'
              : scope === 'ai'
                ? 'ai-eval-failure'
                : 'test-failure';
    }

    return {
      outcome: 'fail',
      note: `command exited with code ${exitCode}`,
      failureClass,
      successPatternMatched: successPattern ? false : null,
    };
  }

  if (!successPattern) {
    return {
      outcome: 'pass',
      successPatternMatched: null,
    };
  }

  if (successPattern === 'exit_code=0') {
    return {
      outcome: 'pass',
      successPatternMatched: true,
    };
  }

  const containsMatch = successPattern.match(/^(stdout|stderr|output)\s+contains\s+(.+)$/);
  if (!containsMatch) {
    return {
      outcome: 'pass',
      note: `unsupported successPattern "${successPattern}" ignored; fallback=exit_code=0`,
      successPatternMatched: null,
    };
  }

  const [, source, rawNeedle] = containsMatch;
  const needle = stripWrappingQuotes(rawNeedle.trim());
  const haystack =
    source === 'stdout'
      ? params.stdout
      : source === 'stderr'
        ? params.stderr
        : `${params.stdout}\n${params.stderr}`.trim();

  if (haystack.includes(needle)) {
    return {
      outcome: 'pass',
      successPatternMatched: true,
    };
  }

  return {
    outcome: 'fail',
    note: `successPattern mismatch: ${source} missing "${needle}"`,
    failureClass: 'success-pattern-mismatch',
    successPatternMatched: false,
  };
}

export function buildQualityRunJsonResult(params: {
  gateDocId: string;
  bundleId: string | null;
  command: string;
  outcome: 'pass' | 'fail';
  exitCode: number;
  durationMs: number;
  note?: string;
  failureClass?: QualityRunFailureClass;
  successPattern?: string;
  successPatternMatched: boolean | null;
  git: GitRunContext;
  diagnosis?: GateDiagnosis;
  bundleVerification?: BundleVerification;
  rankedNextDocs?: readonly RankedNextDoc[];
  stdout: string;
  stderr: string;
}): QualityRunJsonResult {
  return {
    gateDocId: params.gateDocId,
    bundleId: params.bundleId,
    command: params.command,
    outcome: params.outcome,
    exitCode: params.exitCode,
    durationMs: params.durationMs,
    note: params.note,
    failureClass: params.failureClass,
    successPattern: params.successPattern,
    successPatternMatched: params.successPatternMatched,
    git: {
      repoRoot: params.git.repoRoot,
      branch: params.git.branch,
      sha: params.git.sha,
    },
    diagnosis: params.diagnosis,
    bundleVerification: params.bundleVerification
      ? {
          verified: params.bundleVerification.verified,
          verifiedGates: params.bundleVerification.verifiedGates,
          totalGates: params.bundleVerification.totalGates,
          blockers: params.bundleVerification.blockingGateStatuses.map((status) => ({
            gateDocId: status.gateDocId,
            status: status.status,
          })),
        }
      : undefined,
    next: {
      onOutcome: params.outcome,
      candidates: (params.rankedNextDocs ?? []).map((candidate) => candidate.doc.entry.id),
      ranked: params.rankedNextDocs?.map((candidate) => ({
        gateDocId: candidate.doc.entry.id,
        score: candidate.score,
        status: candidate.status,
        reasons: candidate.reasons,
      })),
    },
    stdout: params.stdout,
    stderr: params.stderr,
  };
}

function detectFlakyHistory(history: readonly GateRunEntry[]): boolean {
  const recent = history.slice(0, 4).map((entry) => entry.outcome);
  if (recent.length < 2) return false;
  if (new Set(recent).size < 2) return false;
  return recent.some((outcome, index) => index > 0 && recent[index - 1] !== outcome);
}

function normalizeFailureClass(
  failureClass: string | null | undefined,
): QualityRunFailureClass | undefined {
  if (!failureClass) return undefined;
  if (failureClass === 'command-exit') return 'test-failure';
  if (
    failureClass === 'command-not-found' ||
    failureClass === 'infra-transient' ||
    failureClass === 'static-check-failure' ||
    failureClass === 'test-failure' ||
    failureClass === 'build-failure' ||
    failureClass === 'audit-failure' ||
    failureClass === 'ai-eval-failure' ||
    failureClass === 'success-pattern-mismatch'
  ) {
    return failureClass;
  }
  return undefined;
}

export function buildGateDiagnosis(params: {
  gateDocId: string;
  status: GateStatus;
  history: readonly GateRunEntry[];
  nextCandidateIds: readonly string[];
}): GateDiagnosis {
  const { gateDocId, status, history, nextCandidateIds } = params;
  const lastRun = status.lastRun;
  const flaky = detectFlakyHistory(history);
  const recommendations: string[] = [];
  let summary = '';
  let failureClass: QualityRunFailureClass | undefined;

  if (!lastRun) {
    summary = '실행 이력이 없어 아직 검증되지 않았다.';
    recommendations.push(`qa-sdk quality run ${gateDocId}`);
  } else if (status.status === 'stale') {
    summary = `최신 실행이 현재 문서 버전(${status.currentVersion})보다 오래돼 다시 검증이 필요하다.`;
    recommendations.push(`qa-sdk quality run ${gateDocId}`);
  } else if (status.status === 'verified') {
    summary = '최신 실행이 현재 문서 버전에서 통과했다.';
    if (flaky) {
      summary += ' 최근 결과 변동이 있어 flake 가능성은 남아 있다.';
      recommendations.push('최근 pass/fail 변동이 있어 환경 또는 비결정성 요인을 점검한다.');
    }
  } else {
    failureClass = normalizeFailureClass(lastRun.failureClass) ?? 'test-failure';

    if (failureClass === 'success-pattern-mismatch') {
      summary = '명령 자체는 종료됐지만 successPattern 판정에 실패했다.';
      recommendations.push('gate 문서의 successPattern과 실제 stdout/stderr를 비교한다.');
    } else if (failureClass === 'command-not-found') {
      summary = '실행 명령 자체를 찾지 못했다.';
      recommendations.push('PATH, 패키지 스크립트, 실행 명령 오탈자를 점검한다.');
    } else if (failureClass === 'infra-transient') {
      summary = '네트워크/환경 계열의 일시적 실패로 보인다.';
      recommendations.push('재시도 전 네트워크/레지스트리/외부 서비스 상태를 확인한다.');
    } else if (failureClass === 'static-check-failure') {
      summary = '정적 검증 단계에서 실패했다.';
      recommendations.push('타입/린트/정적 분석 오류를 먼저 정리한다.');
    } else if (failureClass === 'build-failure') {
      summary = '빌드 단계에서 실패했다.';
      recommendations.push('빌드 로그와 export/tsup/vite 설정을 점검한다.');
    } else if (failureClass === 'audit-failure') {
      summary = '감사/메타 검증 단계에서 실패했다.';
      recommendations.push('의존성, 라이선스, 문서/보안 감사 출력을 확인한다.');
    } else if (failureClass === 'ai-eval-failure') {
      summary = 'AI 평가/비용 추적 단계에서 실패했다.';
      recommendations.push('평가 데이터셋, 모델 출력, 비용 한도 조건을 점검한다.');
    } else {
      summary = `테스트/통합 검증이 exit code ${lastRun.exitCode ?? 1}로 실패했다.`;
      recommendations.push('실패 테스트와 직전 변경 범위를 함께 확인한다.');
    }

    if (flaky) {
      summary += ' 최근 성공/실패가 교차해 flake 가능성이 있다.';
      recommendations.push('직전 성공 실행과 현재 실패 실행의 환경 차이를 비교한다.');
    }
  }

  if (nextCandidateIds.length > 0) {
    recommendations.push(
      `qa-sdk quality next ${gateDocId} --outcome=${status.status === 'verified' ? 'pass' : 'fail'}`,
    );
  }

  return {
    gateDocId,
    status: status.status,
    summary,
    failureClass,
    flaky,
    recommendations,
    recentOutcomes: history.slice(0, 5).map((entry) => entry.outcome),
    lastRun: lastRun
      ? {
          outcome: lastRun.outcome,
          exitCode: lastRun.exitCode,
          executedAt: lastRun.executedAt,
          note: lastRun.notes,
          gitBranch: lastRun.gitBranch,
          gitSha: lastRun.gitSha,
          runDurationMs: lastRun.runDurationMs,
        }
      : null,
  };
}

const NEXT_SCOPE_BONUS: Record<string, number> = {
  static: 18,
  audit: 16,
  unit: 12,
  integration: 8,
  build: 6,
  system: 3,
  ai: 1,
};

export function rankNextDocs(params: {
  current: LoadedQualityDoc;
  candidates: readonly LoadedQualityDoc[];
  outcome: 'pass' | 'fail';
  candidateStatuses: ReadonlyMap<string, GateStatus>;
  diagnosis?: GateDiagnosis;
}): RankedNextDoc[] {
  const { current, candidates, outcome, candidateStatuses, diagnosis } = params;

  return candidates
    .map((doc, index) => {
      const status = candidateStatuses.get(doc.entry.id)?.status ?? 'unverified';
      const reasons: string[] = ['명시적 suggest 경로'];
      let score = 100 - index * 5;

      const scope = getGateKindDef(doc.entry.gate.kind).scope;
      score += NEXT_SCOPE_BONUS[scope] ?? 0;
      reasons.push(`${scope} scope`);

      if (status === 'unverified') {
        score += 16;
        reasons.push('아직 실행되지 않음');
      } else if (status === 'stale') {
        score += 14;
        reasons.push('현재 버전 기준 stale');
      } else if (status === 'failed') {
        score += 8;
        reasons.push('최근 실패 이력');
      } else {
        score -= 12;
        reasons.push('이미 verified');
      }

      if (
        outcome === 'fail' &&
        (diagnosis?.failureClass === 'command-not-found' ||
          diagnosis?.failureClass === 'build-failure' ||
          diagnosis?.failureClass === 'static-check-failure' ||
          diagnosis?.failureClass === 'test-failure' ||
          diagnosis?.failureClass === 'audit-failure' ||
          diagnosis?.failureClass === 'ai-eval-failure' ||
          diagnosis?.failureClass === 'infra-transient')
      ) {
        if (current.entry.gate.kind === 'build' && doc.entry.gate.kind === 'typecheck') {
          score += 20;
          reasons.push('build 실패의 선행 정적 검증');
        }
        if (current.entry.gate.kind === 'unit-test' && doc.entry.gate.kind === 'build') {
          score += 14;
          reasons.push('test 실패 전 빌드/산출물 확인');
        }
      }

      if (outcome === 'fail' && diagnosis?.failureClass === 'success-pattern-mismatch') {
        if (status === 'verified') {
          score += 6;
          reasons.push('이미 통과한 이웃 gate와 결과 비교');
        }
      }

      if (outcome === 'fail' && diagnosis?.failureClass === 'infra-transient') {
        if (status === 'verified') {
          score += 10;
          reasons.push('환경성 실패 여부 비교용 verified 이웃 gate');
        }
      }

      return {
        doc,
        score,
        status,
        reasons,
      };
    })
    .toSorted((a, b) => b.score - a.score || a.doc.entry.id.localeCompare(b.doc.entry.id));
}

async function findParentBundle(
  index: LoadedQualityIndex,
  entryId: string,
): Promise<SimpleDoc | undefined> {
  if (index.source) {
    return toSimpleDoc(await index.source.getParent(entryId));
  }

  const parentLink = index.registry
    ?.getLinks(entryId, 'incoming')
    .find((link) => link.linkType === 'contains');
  const doc = parentLink ? index.registry?.get(parentLink.sourceId) : undefined;
  return doc ? toQualityTopologyDoc(doc, { version: 0 }) : undefined;
}

async function findContractDocs(index: LoadedQualityIndex, entryId: string): Promise<SimpleDoc[]> {
  if (index.source) {
    const links = await index.source.getOutgoingLinks(entryId);
    const results: SimpleDoc[] = [];
    for (const link of links) {
      if (link.type !== 'depends_on') continue;
      const doc = await index.source.get(link.target);
      const simple = toSimpleDoc(doc);
      if (simple && simple.scope === 'interface') results.push(simple);
    }
    return results;
  }

  const ids =
    index.registry
      ?.getLinks(entryId, 'outgoing')
      .filter((link) => link.linkType === 'depends_on')
      .map((link) => link.targetId) ?? [];

  return ids
    .map((id) => index.registry?.get(id))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined)
    .filter((doc) => doc.scope === 'interface')
    .map((doc) => toQualityTopologyDoc(doc, { version: 0 }));
}

async function findBundleChildren(
  index: LoadedQualityIndex,
  bundleId: string,
): Promise<SimpleDoc[]> {
  if (index.source) {
    return (await index.source.getChildren(bundleId))
      .map((doc) => toSimpleDoc(doc))
      .filter((doc): doc is SimpleDoc => doc !== undefined);
  }

  const ids =
    index.registry
      ?.getLinks(bundleId, 'outgoing')
      .filter((link) => link.linkType === 'contains')
      .map((link) => link.targetId) ?? [];

  return ids
    .map((id) => index.registry?.get(id))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined)
    .map((doc) => toQualityTopologyDoc(doc, { version: 0 }));
}

async function getBundleDoc(
  index: LoadedQualityIndex,
  bundleId: string,
): Promise<SimpleDoc | undefined> {
  if (index.source) {
    return toSimpleDoc(await index.source.get(bundleId));
  }
  const doc = index.registry?.get(bundleId);
  return doc ? toQualityTopologyDoc(doc, { version: 0 }) : undefined;
}

export function collectClaimAuditReviewScopes(
  bundle: SimpleDoc,
  docs: readonly SimpleDoc[],
): string[] {
  const scopes = new Set<string>();

  for (const doc of docs) {
    if (doc.gate?.package) scopes.add(doc.gate.package);
    if (doc.gate?.storyId) scopes.add(`docs:quality-gates`);
  }

  if (scopes.size === 0 && bundle.serviceId) {
    scopes.add(bundle.serviceId);
  }

  return [...scopes].toSorted();
}

export function buildClaimAuditBindings(packageScopes: readonly string[]): ClaimAuditBinding[] {
  if (packageScopes.length === 0) return [];

  const bindings = packageScopes.map((scope) => `scope:${scope}`);

  return CONTRACT_MARKER_NAMES.map((marker) => ({
    marker: marker as ClaimSectionInput['marker'],
    implementation: {
      bindings,
      implementedBindings: bindings,
    },
  }));
}

function toClaimAuditGateStatuses(
  statuses: ReadonlyMap<string, { status: GateVerificationStatus }>,
): ClaimAuditGateStatus[] {
  return [...statuses.entries()].map(([gateDocId, status]) => ({
    gateDocId,
    status: status.status,
  }));
}

function toClaimAuditReviews(reviews: readonly FileReviewStatus[]): ClaimAuditFileReview[] {
  return reviews.map((review) => ({
    filePath: review.filePath,
    status: review.status,
  }));
}

function printBundleVerificationSummary(bundleVerification: BundleVerification): void {
  console.log(
    `  verification: ${bundleVerification.verifiedGates}/${bundleVerification.totalGates} gate verified`,
  );
  if (bundleVerification.blockingGateStatuses.length === 0) return;

  const blockers = bundleVerification.blockingGateStatuses
    .map(
      (status: { gateDocId: string; status: GateVerificationStatus }) =>
        `${status.gateDocId}(${status.status})`,
    )
    .join(', ');
  console.log(`  blockers: ${blockers}`);
}

export function buildReviewBindings(
  bindings: readonly ClaimAuditBinding[],
  reviews: readonly FileReviewStatus[],
): ClaimAuditBinding[] {
  const reviewByFile = new Map(reviews.map((review) => [review.filePath, review]));

  return bindings.map((binding) => {
    const files =
      binding.implementation?.implementedBindings ?? binding.implementation?.bindings ?? [];
    if (files.length === 0) return binding;

    const matched = files
      .map((file) => reviewByFile.get(file))
      .filter((review): review is FileReviewStatus => review !== undefined);

    if (matched.length === 0) return binding;

    const anyReviewed = matched.some((review) => review.status === 'reviewed');
    const allReviewed = matched.every((review) => review.status === 'reviewed');
    const hasStale = matched.some((review) => review.status === 'stale');

    return {
      ...binding,
      review: {
        reviewed: anyReviewed,
        accepted: allReviewed,
      },
      stale: binding.stale === true || hasStale,
    };
  });
}

function reviewStatusesForBindings(
  reviewLedger: ReviewLedgerInstance,
  bindings: readonly ClaimAuditBinding[],
): FileReviewStatus[] {
  const files = new Set<string>();
  for (const binding of bindings) {
    for (const file of binding.implementation?.implementedBindings ??
      binding.implementation?.bindings ??
      []) {
      files.add(file);
    }
  }
  return [...files].map((file) => reviewLedger.statusForFile(file));
}

export function extractSourceFileBindings(
  body: string,
  rootDir: string,
): {
  implementation: string[];
  tests: string[];
} {
  const seenImplementation = new Set<string>();
  const seenTests = new Set<string>();
  const matches = [...body.matchAll(/`([^`]+\.(?:[cm]?[jt]sx?|mjs|cjs))`/g)];

  for (const match of matches) {
    const relPath = resolveRepoPath(match[1], rootDir);
    if (!relPath) continue;
    seenImplementation.add(relPath);

    for (const testPath of deriveTestPaths(relPath, rootDir)) {
      seenTests.add(testPath);
    }
  }

  return {
    implementation: [...seenImplementation].toSorted(),
    tests: [...seenTests].toSorted(),
  };
}

function resolveRepoPath(rawPath: string, rootDir: string): string | null {
  const normalized = rawPath.replace(/^\.?\//, '');
  const candidates = [
    normalized,
    `packages/${normalized}`,
    `docs/${normalized}`,
    `scripts/${normalized}`,
  ];

  for (const candidate of candidates) {
    if (existsSync(join(rootDir, candidate))) {
      return candidate;
    }
  }

  return null;
}

function deriveTestPaths(implementationPath: string, rootDir: string): string[] {
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(implementationPath)) {
    return [implementationPath];
  }

  const extMatch = implementationPath.match(/\.([cm]?[jt]sx?|mjs|cjs)$/);
  if (!extMatch) return [];

  const ext = extMatch[1];
  const base = implementationPath.slice(0, -(ext.length + 1));
  const candidates = [`${base}.test.${ext}`, `${base}.spec.${ext}`];

  return candidates.filter((candidate) => existsSync(join(rootDir, candidate)));
}

export function buildSourceBindings(
  contract: { allSections: readonly { sourceId: string }[] },
  bodies: ReadonlyMap<string, string> | ((sourceId: string) => string | undefined),
  rootDir: string,
): ClaimAuditBinding[] {
  const sourceIds = [...new Set(contract.allSections.map((section) => section.sourceId))];
  const results: ClaimAuditBinding[] = [];
  const getBody =
    typeof bodies === 'function' ? bodies : (sourceId: string) => bodies.get(sourceId);

  for (const sourceId of sourceIds) {
    const body = getBody(sourceId);
    if (!body) continue;

    const bindings = extractSourceFileBindings(body, rootDir);
    if (bindings.implementation.length === 0 && bindings.tests.length === 0) {
      continue;
    }

    results.push({
      sourceId,
      implementation:
        bindings.implementation.length > 0
          ? {
              bindings: bindings.implementation,
              implementedBindings: bindings.implementation,
            }
          : undefined,
      testing: bindings.tests.length > 0 ? { bindings: bindings.tests } : undefined,
    });
  }

  return results;
}

function printClaimAudit(report: VerificationClaimAuditReport): void {
  console.log('claim audit');
  for (const [state, count] of Object.entries(report.counts).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${state.padEnd(12)} ${count}`);
  }

  const rows = report.claims.slice(0, 20);
  if (rows.length > 0) {
    console.log('\n  claims:');
    for (const row of rows) {
      console.log(`    [${row.compositeState}] ${row.claim.claimId}`);
      console.log(`      ${row.claim.text}`);
      if (row.missing.length > 0) {
        console.log(`      missing: ${row.missing.join(', ')}`);
      }
      if (row.blockers.length > 0) {
        console.log(`      blockers: ${row.blockers.join(', ')}`);
      }
    }
    if (report.claims.length > rows.length) {
      console.log(`\n  ... 외 ${report.claims.length - rows.length}건`);
    }
  }
}

async function buildBundleStatusSummary(
  rootDir: string,
  index: LoadedQualityIndex,
  graph: LoadedDocGraph,
  context: QualityStatusBuildContext,
  bundleId: string,
): Promise<QualityBundleStatusSummary | null> {
  const bundle = graph.registry.get(bundleId);
  if (!bundle) return null;

  const descendants = collectContainedQualityDocs(graph.registry, bundleId, { version: 0 }).map(
    (doc) => {
      const indexed = index.byId.get(doc.id);
      if (!indexed) return doc;
      return {
        ...doc,
        version: indexed.entry.version,
        gate: indexed.entry.gate,
      };
    },
  );

  const gateDocs = descendants
    .map((doc) => index.byId.get(doc.id))
    .filter((doc): doc is LoadedQualityDoc => doc !== undefined)
    .map((doc) => ({
      id: doc.entry.id,
      title: doc.entry.title,
      version: doc.entry.version,
      level: doc.entry.level,
      scope: doc.entry.scope,
      aspect: doc.entry.aspect,
      depth: doc.entry.depth,
      gate: doc.entry.gate,
    }));

  if (gateDocs.length === 0) return null;

  const contract = assembleContract(
    bundleId,
    (id) => graph.registry.get(id),
    (id, direction) => graph.registry.getLinks(id, direction),
    graph.getBody,
  );

  const bundleVerification = resolveBundleVerification(
    context.ledger,
    toGateDescriptors(bundle.id, gateDocs),
  );
  const reviewScopes = collectClaimAuditReviewScopes(
    {
      id: bundle.id,
      title: bundle.title,
      version: 0,
      level: bundle.level,
      scope: qualityDocDimension(bundle.scope),
      aspect: qualityDocDimension(bundle.aspect),
      depth: qualityDocDimension(bundle.depth),
      serviceId: bundle.serviceId,
      tags: bundle.tags,
    },
    gateDocs,
  );

  const sourceBindings = contract ? buildSourceBindings(contract, graph.getBody, rootDir) : [];
  const reviews = reviewStatusesForBindings(context.reviewLedger, sourceBindings);
  const report = contract
    ? generateVerificationClaimAudit({
        sections: contract.allSections.map((section) => ({
          specId: contract.group.id,
          subjectRef: `bundle:${bundleId}:${section.sourceId}`,
          marker: section.marker,
          sourceId: section.sourceId,
          body: section.body,
        })),
        bindings: [
          ...buildReviewBindings(sourceBindings, reviews),
          ...buildClaimAuditBindings(reviewScopes),
        ],
        gateStatuses: toClaimAuditGateStatuses(bundleVerification.gateStatuses),
        reviews: [],
      })
    : undefined;

  const stateSnapshot = deriveHarnessState(
    [
      {
        id: bundle.id,
        title: bundle.title,
        version: 0,
        level: bundle.level,
        scope: qualityDocDimension(bundle.scope),
        aspect: qualityDocDimension(bundle.aspect),
        depth: qualityDocDimension(bundle.depth),
        serviceId: bundle.serviceId,
        tags: bundle.tags,
      },
      ...descendants,
    ],
    { verified: bundleVerification.verified },
  );

  return {
    bundleId,
    title: bundle.title,
    gateCount: gateDocs.length,
    claimCount: report?.claims.length ?? 0,
    verifiedClaimCount: report?.counts['verified'] ?? 0,
    bundleState: stateSnapshot.current,
    verifiedGates: bundleVerification.verifiedGates,
    totalGates: bundleVerification.totalGates,
    reviewScopes,
  };
}

async function cmdStatus(
  rootDir: string,
  rootId: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const snapshot = await buildQualityStatus(rootDir, rootId, sourceOptions);
  if (!snapshot) return;

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(snapshot.rootId);
  console.log(`  bundles: ${snapshot.bundles.length}`);
  console.log('');
  for (const summary of snapshot.bundles) {
    console.log(
      `  ${summary.bundleId} :: state=${summary.bundleState} :: claims=${summary.verifiedClaimCount}/${summary.claimCount} :: gates=${summary.verifiedGates}/${summary.totalGates}`,
    );
  }
}

async function buildQualityStatus(
  rootDir: string,
  rootId: string,
  sourceOptions: DataSourceOptions,
): Promise<QualityStatusSnapshot | null> {
  const graph = await loadDocGraph(rootDir);
  const build = async (index: LoadedQualityIndex): Promise<QualityStatusSnapshot | null> => {
    const root = graph.registry.get(rootId);
    if (!root) {
      console.error(`bundle/system 문서 "${rootId}" 없음`);
      process.exitCode = 1;
      return null;
    }

    const directChildren = graph.registry
      .getLinks(rootId, 'outgoing')
      .filter((link) => link.linkType === 'contains')
      .map((link) => link.targetId);

    const ledger = createLedger();
    const reviewLedger = await createReviewLedger(rootDir);
    try {
      const summaries: QualityBundleStatusSummary[] = [];
      for (const id of directChildren) {
        const summary = await buildBundleStatusSummary(
          rootDir,
          index,
          graph,
          { ledger, reviewLedger },
          id,
        );
        if (summary) summaries.push(summary);
      }
      return {
        rootId,
        bundles: summaries.toSorted((a, b) => a.bundleId.localeCompare(b.bundleId)),
        generatedAt: new Date().toISOString(),
      };
    } finally {
      ledger.store.close();
      reviewLedger.close();
    }
  };

  if (sourceOptions.mode === 'scan') {
    return build(loadQualityDocsFromGraph(graph));
  }
  return withQualityDocs(rootDir, sourceOptions, build);
}

async function cmdExport(
  rootDir: string,
  rootId: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const snapshot = await buildQualityStatus(rootDir, rootId, sourceOptions);
  if (!snapshot) return;
  const output = flags['output'] ?? join(rootDir, 'artifacts', `quality-status-${rootId}.json`);

  const dir = dirname(output);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n');

  if (flags['artifact-registry']) {
    const record = buildQualityStatusArtifactRegistryRecord({
      rootDir,
      rootId,
      output,
      snapshot,
    });
    await appendProgrammingArtifactRegistryRecord(flags['artifact-registry'], record);
    console.log(`artifact registry: ${record.artifactId} -> ${flags['artifact-registry']}`);
  }

  console.log(`written: ${output}`);
  console.log(`bundles: ${snapshot.bundles.length}`);
}

export function buildQualityStatusArtifactRegistryRecord(input: {
  rootDir: string;
  rootId: string;
  output: string;
  snapshot: QualityStatusSnapshot;
}): ProgrammingArtifactRegistryRecord {
  const outputPath = portablePath(input.rootDir, input.output);
  const bundleIds = input.snapshot.bundles.map((bundle) => bundle.bundleId);
  return createProgrammingArtifactRegistryRecord({
    artifactId: `quality-status-${input.rootId}`,
    artifactRef: outputPath,
    kind: 'quality-status',
    producedByRef: `qa-sdk quality export ${input.rootId}`,
    derivedFromRefs: [input.rootId, ...bundleIds],
    verifiesRefs: [input.rootId, ...bundleIds],
    ownerDefinitionId: input.rootId,
    materializesOutputRefs: [input.rootId],
    outputPath,
    verificationRefs: bundleIds,
    createdAt: input.snapshot.generatedAt,
    metadata: buildQualityStatusArtifactRegistryMetadata(input.snapshot),
  });
}

function buildQualityStatusArtifactRegistryMetadata(
  snapshot: QualityStatusSnapshot,
): Record<string, unknown> {
  const bundles = snapshot.bundles.map((bundle) => ({
    bundleId: bundle.bundleId,
    bundleState: bundle.bundleState,
    verifiedGateCount: bundle.verifiedGates,
    totalGateCount: bundle.totalGates,
    claimCount: bundle.claimCount,
    verifiedClaimCount: bundle.verifiedClaimCount,
  }));

  return {
    rootId: snapshot.rootId,
    generatedAt: snapshot.generatedAt,
    bundleCount: bundles.length,
    bundleStates: Object.fromEntries(
      bundles.map((bundle) => [bundle.bundleId, bundle.bundleState]),
    ),
    totals: {
      verifiedGateCount: bundles.reduce((sum, bundle) => sum + bundle.verifiedGateCount, 0),
      totalGateCount: bundles.reduce((sum, bundle) => sum + bundle.totalGateCount, 0),
      claimCount: bundles.reduce((sum, bundle) => sum + bundle.claimCount, 0),
      verifiedClaimCount: bundles.reduce((sum, bundle) => sum + bundle.verifiedClaimCount, 0),
    },
    bundles,
  };
}

function portablePath(rootDir: string, filePath: string): string {
  const resolved = resolve(filePath);
  const rel = relative(rootDir, resolved);
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel;
  return filePath;
}

async function cmdList(
  rootDir: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  await withQualityDocs(rootDir, sourceOptions, async ({ docs, errors }) => {
    const filtered = docs.filter((doc) => matchesFilter(doc, flags));

    console.log(`quality gates: ${filtered.length}건`);
    if (errors.length > 0) {
      console.log(`scan warnings: ${errors.length}건 (다른 문서 파싱 에러 포함)`);
    }

    for (const doc of filtered) printDocLine(doc);
  });
}

async function cmdShow(
  rootDir: string,
  gateId: string,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdShowWithIndex(index, gateId);
  } finally {
    closeQualityDataSource(index.source);
  }
}

async function cmdShowWithIndex(index: LoadedQualityIndex, gateId: string): Promise<void> {
  const doc = index.byId.get(gateId);
  if (!doc) {
    console.error(`gate 문서 "${gateId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const gate = doc.entry.gate;
  const domain = getDomainDef(gate.workDomain);
  const kind = getGateKindDef(gate.kind);
  const ledger = createLedger();
  const gateStatus = ledger.statusForGate({
    gateDocId: doc.entry.id,
    docVersion: doc.entry.version,
  });

  console.log(doc.entry.id);
  console.log(`  title:      ${doc.entry.title}`);
  console.log(`  kind:       ${gate.kind} (${kind.nameKo}, scope=${kind.scope})`);
  console.log(`  domain:     ${gate.workDomain} (${domain.nameKo})`);
  console.log(`  status:     ${gateStatus.status}`);
  if (gate.subDomainId) console.log(`  subDomain:  ${gate.subDomainId}`);
  if (gate.package) console.log(`  package:    ${gate.package}`);
  if (gate.storyId) console.log(`  story:      ${gate.storyId}`);
  console.log(`  command:    ${gate.command}`);
  if (gate.successPattern) console.log(`  success:    ${gate.successPattern}`);
  if (doc.entry.ref) console.log(`  file:       ${doc.entry.ref}`);
  const parentBundle = await findParentBundle(index, doc.entry.id);
  if (parentBundle) console.log(`  bundle:     ${parentBundle.id}`);
  if (doc.purpose) console.log(`\n  purpose: ${doc.purpose}`);

  const contracts = await findContractDocs(index, doc.entry.id);
  if (contracts.length > 0) {
    console.log('\n  contracts:');
    for (const contract of contracts) {
      console.log(`    - ${contract.id} (${contract.scope}/${contract.aspect})`);
    }
  }

  if (gate.references?.length) {
    console.log('\n  references:');
    for (const ref of gate.references) console.log(`    - ${ref}`);
  }

  const nextOnPass = selectNextDocs(doc, index.docs, 'pass');
  const nextOnFail = selectNextDocs(doc, index.docs, 'fail');
  if (nextOnPass.length > 0) {
    console.log('\n  next on pass:');
    for (const next of nextOnPass) console.log(`    - ${next.entry.id}`);
  }
  if (nextOnFail.length > 0) {
    console.log('\n  next on fail:');
    for (const next of nextOnFail) console.log(`    - ${next.entry.id}`);
  }

  ledger.store.close();
}

async function cmdBundle(
  rootDir: string,
  bundleId: string,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdBundleWithIndex(index, bundleId);
  } finally {
    closeQualityDataSource(index.source);
  }
}

async function cmdBundleWithIndex(index: LoadedQualityIndex, bundleId: string): Promise<void> {
  const bundle = await getBundleDoc(index, bundleId);
  if (!bundle) {
    console.error(`bundle 문서 "${bundleId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const children = (
    index.registry
      ? collectContainedQualityDocs(index.registry, bundleId, { version: 0 })
      : await findBundleChildren(index, bundleId)
  ).map((doc) => {
    const indexed = index.byId.get(doc.id);
    if (!indexed) return doc;
    return {
      ...doc,
      version: indexed.entry.version,
      gate: indexed.entry.gate,
    };
  });

  const gateDocs = children
    .map((doc) => index.byId.get(doc.id))
    .filter((doc): doc is LoadedQualityDoc => doc !== undefined)
    .map((doc) => ({
      id: doc.entry.id,
      title: doc.entry.title,
      version: doc.entry.version,
      level: doc.entry.level,
      scope: doc.entry.scope,
      aspect: doc.entry.aspect,
      depth: doc.entry.depth,
      gate: doc.entry.gate,
    }));
  const ledger = createLedger();
  const gateDescriptors = toGateDescriptors(bundle.id, gateDocs);
  const bundleVerification = resolveBundleVerification(ledger, gateDescriptors);
  const gateStatuses = bundleVerification.gateStatuses;
  const stateSnapshot = deriveHarnessState([bundle, ...children], {
    verified: bundleVerification.verified,
  });
  const stateDef = getHarnessStateDef(stateSnapshot.current);
  const groups = new Map<string, SimpleDoc[]>();

  for (const child of children) {
    const role = classifyHarnessDocRole(child);
    const key = `${role} / ${child.level ?? 'leaf'} / ${child.scope}`;
    const list = groups.get(key) ?? [];
    list.push(child);
    groups.set(key, list);
  }

  console.log(bundle.id);
  console.log(`  title: ${bundle.title}`);
  console.log(`  scope: ${bundle.scope}/${bundle.aspect}`);
  console.log(`  depth: ${bundle.depth}`);
  if (bundle.level) console.log(`  level: ${bundle.level}`);
  console.log(`  state: ${stateSnapshot.current} (${stateDef.nameKo})`);
  if (stateSnapshot.next) {
    console.log(
      `  next:  ${stateSnapshot.next} (${getHarnessStateDef(stateSnapshot.next).nameKo})`,
    );
  }
  if (stateSnapshot.missing.length > 0) {
    console.log(`  missing: ${stateSnapshot.missing.join(', ')}`);
  }
  printBundleVerificationSummary(bundleVerification);

  for (const [groupKey, entries] of [...groups.entries()].toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`\n  ${groupKey}`);
    for (const entry of entries.toSorted((a, b) => a.id.localeCompare(b.id))) {
      const gateDoc = index.byId.get(entry.id);
      if (gateDoc) {
        const status = gateStatuses.get(entry.id)?.status ?? 'unverified';
        console.log(
          `    - ${entry.id} :: ${gateDoc.entry.gate.kind} :: ${gateDoc.entry.gate.command} [${status}]`,
        );
      } else {
        console.log(`    - ${entry.id} :: ${entry.scope}/${entry.aspect} :: ${entry.depth}`);
      }
    }
  }

  ledger.store.close();
}

async function cmdRun(
  rootDir: string,
  gateId: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdRunWithIndex(index, rootDir, gateId, flags);
  } finally {
    closeQualityDataSource(index.source);
  }
}

async function cmdRunWithIndex(
  index: LoadedQualityIndex,
  rootDir: string,
  gateId: string,
  flags: Record<string, string>,
): Promise<void> {
  const doc = index.byId.get(gateId);
  if (!doc) {
    console.error(`gate 문서 "${gateId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const gate = doc.entry.gate;
  const json = flags['json'] === 'true';
  if (!json) {
    console.log(`${doc.entry.id} 실행`);
    console.log(`  command: ${gate.command}`);
  }

  if (flags['dry-run'] === 'true') {
    if (json) {
      console.log(
        JSON.stringify(
          {
            gateDocId: doc.entry.id,
            command: gate.command,
            dryRun: true,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log('  dry-run: 명령을 실행하지 않았습니다');
    return;
  }

  const git = detectGitRunContext(rootDir);
  const startedAt = Date.now();
  const result = await execa('/bin/zsh', ['-lc', gate.command], {
    cwd: rootDir,
    reject: false,
  });
  const durationMs = Date.now() - startedAt;

  if (!json && result.stdout) {
    process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  }
  if (!json && result.stderr) {
    process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  }

  const evaluation = evaluateGateRunResult({
    gateKind: gate.kind,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    successPattern: gate.successPattern,
  });
  const outcome = evaluation.outcome;
  const exitCode = result.exitCode ?? 1;

  if (!json && outcome === 'pass') {
    console.log(`\n✓ ${doc.entry.id} 통과`);
    if (evaluation.note) {
      console.log(`  note: ${evaluation.note}`);
    }
  } else if (!json) {
    console.error(`\n✗ ${doc.entry.id} 실패 (exit=${exitCode})`);
    if (evaluation.note) {
      console.error(`  reason: ${evaluation.note}`);
    }
  }
  if (outcome === 'fail') {
    process.exitCode = exitCode === 0 ? 1 : exitCode;
  }

  const ledger = createLedger();
  const parentBundle = await findParentBundle(index, doc.entry.id);
  (ledger as QualityLedgerWithRunContext).recordRun({
    gateDocId: doc.entry.id,
    docVersion: doc.entry.version,
    bundleId: parentBundle?.id ?? null,
    command: gate.command,
    outcome,
    exitCode,
    notes: evaluation.note ?? null,
    repoRoot: git.repoRoot,
    gitBranch: git.branch,
    gitSha: git.sha,
    runDurationMs: durationMs,
    successPattern: gate.successPattern ?? null,
    successPatternMatched: evaluation.successPatternMatched,
    failureClass: evaluation.failureClass ?? null,
  });

  let bundleVerification: BundleVerification | undefined;
  if (parentBundle) {
    const bundleChildren = await findBundleChildren(index, parentBundle.id);
    bundleVerification = resolveBundleVerification(
      ledger,
      toGateDescriptors(parentBundle.id, bundleChildren),
    );
    if (!json) {
      console.log(`\n${parentBundle.id}`);
      printBundleVerificationSummary(bundleVerification);
    }
  }

  const gateStatus = ledger.statusForGate({
    gateDocId: doc.entry.id,
    docVersion: doc.entry.version,
  });
  const history = ledger.history(doc.entry.id, 5);
  const nextDocs = selectNextDocs(doc, index.docs, outcome);
  const diagnosis = buildGateDiagnosis({
    gateDocId: doc.entry.id,
    status: gateStatus,
    history,
    nextCandidateIds: nextDocs.map((next) => next.entry.id),
  });
  const candidateStatuses = ledger.statusForGates(
    nextDocs.map((next) => ({
      gateDocId: next.entry.id,
      docVersion: next.entry.version,
    })),
  );
  const rankedNextDocs = rankNextDocs({
    current: doc,
    candidates: nextDocs,
    outcome,
    candidateStatuses,
    diagnosis,
  });
  if (json) {
    console.log(
      JSON.stringify(
        buildQualityRunJsonResult({
          gateDocId: doc.entry.id,
          bundleId: parentBundle?.id ?? null,
          command: gate.command,
          outcome,
          exitCode,
          durationMs,
          note: evaluation.note,
          failureClass: evaluation.failureClass,
          successPattern: gate.successPattern,
          successPatternMatched: evaluation.successPatternMatched,
          git,
          diagnosis,
          bundleVerification,
          rankedNextDocs,
          stdout: result.stdout,
          stderr: result.stderr,
        }),
        null,
        2,
      ),
    );
    ledger.store.close();
    return;
  }

  ledger.store.close();
  if (rankedNextDocs.length > 0) {
    console.log(`\n추천 다음 작업 (${outcome} 기준):`);
    for (const next of rankedNextDocs) {
      console.log(
        `  - ${next.doc.entry.id} [score=${next.score}] :: ${next.doc.entry.gate.command}`,
      );
    }
  }
}

async function cmdNext(
  rootDir: string,
  gateId: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const outcome = flags['outcome'] === 'fail' ? 'fail' : 'pass';
  const json = flags['json'] === 'true';
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdNextWithIndex(index, gateId, outcome, json);
  } finally {
    closeQualityDataSource(index.source);
  }
}

async function cmdNextWithIndex(
  index: LoadedQualityIndex,
  gateId: string,
  outcome: 'pass' | 'fail',
  json: boolean,
): Promise<void> {
  const doc = index.byId.get(gateId);
  if (!doc) {
    console.error(`gate 문서 "${gateId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const ledger = createLedger();
  const gateStatus = ledger.statusForGate({
    gateDocId: doc.entry.id,
    docVersion: doc.entry.version,
  });
  const history = ledger.history(doc.entry.id, 5);
  const nextDocs = selectNextDocs(doc, index.docs, outcome);
  const diagnosis = buildGateDiagnosis({
    gateDocId: doc.entry.id,
    status: gateStatus,
    history,
    nextCandidateIds: nextDocs.map((next) => next.entry.id),
  });
  const candidateStatuses = ledger.statusForGates(
    nextDocs.map((next) => ({
      gateDocId: next.entry.id,
      docVersion: next.entry.version,
    })),
  );
  const rankedNextDocs = rankNextDocs({
    current: doc,
    candidates: nextDocs,
    outcome,
    candidateStatuses,
    diagnosis,
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          gateDocId: gateId,
          outcome,
          diagnosis,
          candidates: rankedNextDocs.map((candidate) => ({
            gateDocId: candidate.doc.entry.id,
            score: candidate.score,
            status: candidate.status,
            reasons: candidate.reasons,
            command: candidate.doc.entry.gate.command,
          })),
        },
        null,
        2,
      ),
    );
    ledger.store.close();
    return;
  }

  console.log(`${gateId} → next (${outcome})`);
  console.log(`  diagnosis: ${diagnosis.summary}`);
  if (rankedNextDocs.length === 0) {
    console.log('  추천할 다음 gate/doc 없음');
    ledger.store.close();
    return;
  }

  for (const next of rankedNextDocs) {
    printDocLine(next.doc);
    console.log(`    score=${next.score}  status=${next.status}`);
    console.log(`    reasons: ${next.reasons.join(', ')}`);
  }
  ledger.store.close();
}

async function cmdDiagnose(
  rootDir: string,
  gateId: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const json = flags['json'] === 'true';
  const outcome = flags['outcome'] === 'pass' ? 'pass' : 'fail';
  const index = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdDiagnoseWithIndex(index, gateId, outcome, json);
  } finally {
    closeQualityDataSource(index.source);
  }
}

async function cmdDiagnoseWithIndex(
  index: LoadedQualityIndex,
  gateId: string,
  outcome: 'pass' | 'fail',
  json: boolean,
): Promise<void> {
  const doc = index.byId.get(gateId);
  if (!doc) {
    console.error(`gate 문서 "${gateId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const ledger = createLedger();
  const gateStatus = ledger.statusForGate({
    gateDocId: doc.entry.id,
    docVersion: doc.entry.version,
  });
  const history = ledger.history(doc.entry.id, 5);
  const nextDocs = selectNextDocs(doc, index.docs, outcome);
  const diagnosis = buildGateDiagnosis({
    gateDocId: doc.entry.id,
    status: gateStatus,
    history,
    nextCandidateIds: nextDocs.map((next) => next.entry.id),
  });
  const candidateStatuses = ledger.statusForGates(
    nextDocs.map((next) => ({
      gateDocId: next.entry.id,
      docVersion: next.entry.version,
    })),
  );
  const rankedNextDocs = rankNextDocs({
    current: doc,
    candidates: nextDocs,
    outcome,
    candidateStatuses,
    diagnosis,
  });
  ledger.store.close();

  if (json) {
    console.log(
      JSON.stringify(
        {
          gateDocId: gateId,
          diagnosis,
          candidates: rankedNextDocs.map((candidate) => ({
            gateDocId: candidate.doc.entry.id,
            score: candidate.score,
            status: candidate.status,
            reasons: candidate.reasons,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(gateId);
  console.log(`  status: ${diagnosis.status}`);
  console.log(`  summary: ${diagnosis.summary}`);
  if (diagnosis.failureClass) console.log(`  failureClass: ${diagnosis.failureClass}`);
  console.log(`  flaky: ${diagnosis.flaky ? 'yes' : 'no'}`);
  if (diagnosis.lastRun) {
    console.log(`  lastRun: ${diagnosis.lastRun.executedAt}`);
    console.log(`  exit: ${diagnosis.lastRun.exitCode ?? 0}`);
    if (diagnosis.lastRun.gitBranch) console.log(`  branch: ${diagnosis.lastRun.gitBranch}`);
    if (diagnosis.lastRun.gitSha) console.log(`  sha: ${diagnosis.lastRun.gitSha}`);
  }
  if (diagnosis.recommendations.length > 0) {
    console.log('  recommendations:');
    for (const recommendation of diagnosis.recommendations) {
      console.log(`    - ${recommendation}`);
    }
  }
  if (rankedNextDocs.length > 0) {
    console.log('  ranked next:');
    for (const candidate of rankedNextDocs) {
      console.log(
        `    - ${candidate.doc.entry.id} [score=${candidate.score}] ${candidate.reasons.join(', ')}`,
      );
    }
  }
}

async function cmdClaims(
  rootDir: string,
  bundleId: string,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const graph = await loadDocGraph(rootDir);
  const qualityIndex = await loadQualityDocs(rootDir, sourceOptions);
  try {
    await cmdClaimsWithIndex(graph, qualityIndex, rootDir, bundleId);
  } finally {
    closeQualityDataSource(qualityIndex.source);
  }
}

async function cmdClaimsWithIndex(
  graph: LoadedDocGraph,
  qualityIndex: LoadedQualityIndex,
  rootDir: string,
  bundleId: string,
): Promise<void> {
  const bundle = graph.registry.get(bundleId);
  if (!bundle) {
    console.error(`bundle 문서 "${bundleId}" 없음`);
    process.exitCode = 1;
    return;
  }

  const contract = assembleContract(
    bundleId,
    (id) => graph.registry.get(id),
    (id, direction) => graph.registry.getLinks(id, direction),
    graph.getBody,
  );

  if (!contract) {
    console.error(`bundle "${bundleId}"에서 contract를 조립할 수 없음`);
    process.exitCode = 1;
    return;
  }

  const descendants = collectContainedQualityDocs(graph.registry, bundleId, { version: 0 });
  const gateDocs = descendants
    .map((doc) => {
      const indexed = qualityIndex.byId.get(doc.id);
      if (!indexed) return doc;
      return {
        ...doc,
        version: indexed.entry.version,
        gate: indexed.entry.gate,
      };
    })
    .filter((doc): doc is SimpleDoc & { gate: QualityGateSpec } => doc.gate !== undefined);

  const qualityLedger = createLedger();
  const bundleVerification = resolveBundleVerification(
    qualityLedger,
    toGateDescriptors(bundle.id, gateDocs),
  );
  const gateStatuses = bundleVerification.gateStatuses;

  const reviewLedger = await createReviewLedger(rootDir);
  const reviewScopes = collectClaimAuditReviewScopes(
    {
      id: bundle.id,
      title: bundle.title,
      version: 0,
      level: bundle.level,
      scope: qualityDocDimension(bundle.scope),
      aspect: qualityDocDimension(bundle.aspect),
      depth: qualityDocDimension(bundle.depth),
      serviceId: bundle.serviceId,
      tags: bundle.tags,
    },
    gateDocs,
  );
  const sourceBindings = buildSourceBindings(contract, graph.getBody, rootDir);
  const reviews = reviewStatusesForBindings(reviewLedger, sourceBindings);
  const reviewedBindings = buildReviewBindings(sourceBindings, reviews);

  const report = generateVerificationClaimAudit({
    sections: contract.allSections.map((section) => ({
      specId: contract.group.id,
      subjectRef: `bundle:${bundleId}:${section.sourceId}`,
      marker: section.marker,
      sourceId: section.sourceId,
      body: section.body,
    })),
    bindings: [...reviewedBindings, ...buildClaimAuditBindings(reviewScopes)],
    gateStatuses: toClaimAuditGateStatuses(gateStatuses),
    reviews: [],
  });

  console.log(bundleId);
  console.log(`  contract sections: ${contract.allSections.length}`);
  console.log(`  claims:            ${report.claims.length}`);
  console.log(`  gate docs:         ${gateDocs.length}`);
  console.log(
    `  review scopes:     ${reviewScopes.length > 0 ? reviewScopes.join(', ') : '(없음)'}`,
  );
  if (report.claims.length === 0) {
    console.log(
      '  note: contract marker(^inputs/^outputs/^evidence 등)가 없어 claim audit 결과가 비어 있음',
    );
  }
  printClaimAudit(report);

  qualityLedger.store.close();
  reviewLedger.store.close();
}

function printUsage(): void {
  console.log(`Usage:
  qa-sdk quality list [--local|--server|--scan] [--domain=<id>] [--kind=<id>] [--story=<id>] [--pkg=<name>] [--q=<text>]
  qa-sdk quality status [bundle-or-system-id] [--json]
  qa-sdk quality export [bundle-or-system-id] [--output=<path>] [--artifact-registry=<file>]
  qa-sdk quality bundle <bundle-doc-id> [--local|--server|--scan]
  qa-sdk quality claims <bundle-doc-id>
  qa-sdk quality show <gate-doc-id> [--local|--server|--scan]
  qa-sdk quality run <gate-doc-id> [--local|--server|--scan] [--dry-run] [--json]
  qa-sdk quality next <gate-doc-id> [--local|--server|--scan] [--outcome=pass|fail] [--json]
  qa-sdk quality diagnose <gate-doc-id> [--local|--server|--scan] [--outcome=pass|fail] [--json]`);
}

export async function cliQuality(
  args: string[],
  options: { rootDir?: string } = {},
): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const { positional, flags, sourceOptions } = parseQualityCommandArgs(args);
  const [cmd, ...rest] = positional;

  switch (cmd) {
    case undefined:
    case 'list':
      await cmdList(rootDir, flags, sourceOptions);
      return;
    case 'status':
      await cmdStatus(rootDir, rest[0] ?? 'quality-gates-system', flags, sourceOptions);
      return;
    case 'export':
      await cmdExport(rootDir, rest[0] ?? 'quality-gates-system', flags, sourceOptions);
      return;
    case 'bundle':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdBundle(rootDir, rest[0], sourceOptions);
      return;
    case 'claims':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdClaims(rootDir, rest[0], sourceOptions);
      return;
    case 'show':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdShow(rootDir, rest[0], sourceOptions);
      return;
    case 'run':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdRun(rootDir, rest[0], flags, sourceOptions);
      return;
    case 'next':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdNext(rootDir, rest[0], flags, sourceOptions);
      return;
    case 'diagnose':
      if (!rest[0]) {
        printUsage();
        return;
      }
      await cmdDiagnose(rootDir, rest[0], flags, sourceOptions);
      return;
    default:
      printUsage();
  }
}
