// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk dkg — DKG 조회 + 자가 진단 CLI 명령어.
 *
 * bootstrapDkg()로 전체 DKG를 초기화한 후 조회/분석 수행.
 * 페이지네이션 지원.
 */

import { parseArgs } from 'node:util';
import {
  DEMO_CATALOG,
  encodePrefixByValue,
  latestPrefixVersion,
  type DemoAxisId,
} from 'demo-snapshot';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { extractCausalGraph, type FlowSchema } from 'decision-flow';
import { DEMO_TRANSITION_SPECS } from 'spec-transition';
import {
  CatalogRegistry,
  collectAxisUsage,
  summarizeAxisUsage,
  findUnusedAxes,
  createServiceBootConfig,
  getPrefixProfile,
  newLogId,
  newTransmissionId,
  newTraceId,
  newSpanId,
  now,
  toServiceDims,
  toTransmissionBuild,
  toTransmissionSource,
  type Catalog,
  type AxisVersionSnapshot,
  type EventRecord,
  type TransmissionEnvelope,
} from '@qa-sdk/core';
import { catalogToPrefixSpecs, catalogToSchemaSnapshot } from '@qa-sdk/spec-core';
import {
  GraphRegistry,
  analyzeImpact,
  createDemoTopology,
  exploreService,
  explorePrefix,
  exploreDsl,
  systemOverview,
  traceNode,
  recordDecision,
  recordObservation,
  prepareClaim,
  prepareRelease,
  claimKey,
  resolveObservation,
  safeEntryAdd,
  checkConstraints,
  checkDomainHealth,
  checkAllDomainsHealth,
  entryAddChain,
  systemHealthChain,
  convergeChain,
  traceFlows,
  validateDslInvariants,
  scaffoldDecision,
  inferMigrator,
  auditCoverage,
  transitionPrefix,
  transitionDecision,
  serviceHealthCheck,
  eventCoverageCheck,
  analyzeDslVersionSkew,
  type DkgNode,
  type DkgNodeDetails,
  type DecisionType,
  type ClaimData,
  type ObservationNode,
  type DecisionNode,
  type SkillNode,
  type TableNode,
  type ConstraintNode,
  type DkgEdgeType,
  type SpecNode,
  type ConvergeAction,
  type ObservationSuggestion,
  type TransitionSpecNode,
} from 'dkg';
import { bootstrapDkg } from 'dkg-enrichment';
import {
  scanAxisOverlaps,
  scanDecisionConflicts,
  analyzeDeploymentSkew,
  collectMetrics,
  metricsToObservations,
  resolveRecoveredMetrics,
  METRIC_DEFS,
  aggregateUsageData,
  analyzeCollectionHealth,
  analyzeEntryCoverage,
  DEMO_PATTERN_RULES,
  scanPromotionCandidates,
  analyzeSelfCheck,
  discoverCausality,
  type AddressContextRecord,
  type MetricValue,
  type CausalCandidate,
  type UsageData,
  type EntryUsage,
  type AddressUsage,
  type CoOccurrence,
} from '@qa-sdk/convergence';
import { auditSchemaHealth } from '@qa-sdk/spec-core';
import { executeEntryAdd, EntryAddError, writeCatalogFile } from '@qa-sdk/spec-core/propagation';
import { DkgSqliteStore, type UsageData as DkgUsageData } from 'dkg/store';
import { join, dirname } from 'node:path';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execaSync } from 'execa';
import { createInterface } from 'node:readline';
import { getQaSdkDir } from '../lib/qa-dir.js';
import {
  buildDkgFlowAddressMetadata,
  collectDkgCoreGateWarnings,
  formatDkgCoreGateWarnings,
  formatFlowInstanceCoreTrace,
  loadFlowInstanceMeta,
  saveFlowInstanceMeta,
  startDkgDecisionFlowBridge,
} from './dkg-decision-flow.js';

// ── Catalog Context ──────────────────────────────────
// CLI에서 --catalog 옵션으로 주입된 카탈로그.
// setCatalogContext()로 설정하면 DKG 명령어가 해당 카탈로그를 사용.

const registry = new CatalogRegistry();
let activeCatalogId = 'demo';
type BootstrapConfigInput = Parameters<typeof bootstrapDkg>[0]['config'];
type BootstrapCatalogInput = Parameters<typeof bootstrapDkg>[0]['catalog'];
type FlowSchemaConfigEntry = NonNullable<BootstrapConfigInput['flowSchemas']>[number];
type DkgEntryUsage = DkgUsageData['entryUsages'][number];
type DkgAddressUsage = DkgUsageData['addressUsages'][number];
type DecisionListData = {
  title?: string;
  finding?: string;
  lifecycle?: string;
  resolution?: { outcome?: string };
};

let _configOverride: BootstrapConfigInput | undefined;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function setCatalogContext(
  catalog?: BootstrapCatalogInput,
  config?: BootstrapConfigInput,
): void {
  if (catalog) {
    registry.register(catalog);
    activeCatalogId = catalog.id;
    registry.setDefault(activeCatalogId);
    graphCache.delete(activeCatalogId);
  }
  _configOverride = config;
}

/** 등록된 카탈로그 레지스트리 접근 (catalog list/info에서 사용). */
export function getCatalogRegistry(): CatalogRegistry {
  return registry;
}

// ── Shared ──────────────────────────────────────────

const STATE_DIR = getQaSdkDir();
const STATE_DB = join(STATE_DIR, 'state.sqlite');

const storeCache = new Map<string, DkgSqliteStore>();
const graphCache = new Map<string, GraphRegistry>();

function getStore(catalogId?: string): DkgSqliteStore {
  const id = catalogId ?? activeCatalogId;
  if (!storeCache.has(id)) {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    storeCache.set(id, new DkgSqliteStore(STATE_DB, id));
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직전에 .set() 보장
  return storeCache.get(id)!;
}

/** bootstrap 옵션 생성 — transitionSpecs 주입 DRY */
function bootstrapOptions(catalogOverride?: BootstrapCatalogInput) {
  const catalog = catalogOverride ?? DEMO_CATALOG;
  const config = _configOverride ?? DEMO_DKG_CONFIG;
  return { catalog, config, transitionSpecs: DEMO_TRANSITION_SPECS };
}

function getGraph(catalogId?: string): GraphRegistry {
  const id = catalogId ?? activeCatalogId;
  if (!graphCache.has(id)) {
    if (registry.has(id) && id !== 'demo') {
      const graph = bootstrapDkg(bootstrapOptions(registry.getCatalog(id)));
      graphCache.set(id, graph);
      console.log(`  (bootstrapped with custom catalog: ${id})`);
      return graph;
    }

    const store = getStore(id);
    const stats = store.stats();

    if (stats.nodes > 0) {
      const graph = store.loadGraph();
      graphCache.set(id, graph);
      console.log(
        `  (loaded from ${STATE_DB} [${id}]: ${stats.nodes} nodes, ${stats.edges} edges)`,
      );
    } else {
      const graph = bootstrapDkg(
        registry.has(id) ? bootstrapOptions(registry.getCatalog(id)) : bootstrapOptions(),
      );
      const saved = store.saveGraph(graph);
      store.setMeta('last_bootstrap', new Date().toISOString());
      graphCache.set(id, graph);
      console.log(
        `  (bootstrapped & saved [${id}]: ${saved.nodesWritten} nodes, ${saved.edgesWritten} edges)`,
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- 위에서 .set() 보장
  return graphCache.get(id)!;
}

// ── CLI 완전 관측 ──────────────────────────────────────
// 모든 CLI 명령 실행을 cli_event prefix로 기록한다.
// 명령어 이름은 교체 가능한 UI. 좌표(intent × domain × subject)가 안정 식별자.

const CLI_COMMAND_MAP: Record<string, { intent: string; domain: string; subject: string }> = {
  // dkg query
  'dkg report': { intent: 'query', domain: 'dkg-graph', subject: 'system' },
  'dkg axes': { intent: 'query', domain: 'dkg-graph', subject: 'axis' },
  'dkg prefixes': { intent: 'query', domain: 'dkg-graph', subject: 'prefix' },
  'dkg domains': { intent: 'query', domain: 'dkg-graph', subject: 'domain' },
  'dkg flow-schemas': { intent: 'query', domain: 'dkg-graph', subject: 'flow-schema' },
  'dkg flow-schema': { intent: 'query', domain: 'dkg-graph', subject: 'flow-schema' },
  'dkg dsl': { intent: 'query', domain: 'dkg-graph', subject: 'dsl-bundle' },
  'dkg service': { intent: 'query', domain: 'dkg-graph', subject: 'service' },
  'dkg prefix': { intent: 'query', domain: 'dkg-graph', subject: 'prefix' },
  'dkg overview': { intent: 'query', domain: 'dkg-graph', subject: 'system' },
  'dkg trace': { intent: 'analyze', domain: 'dkg-graph', subject: 'prefix' },
  'dkg claims': { intent: 'query', domain: 'dkg-graph', subject: 'observation' },
  'dkg timeline': { intent: 'query', domain: 'dkg-graph', subject: 'observation' },
  'dkg skills': { intent: 'query', domain: 'dkg-skill', subject: 'skill' },
  'dkg history': { intent: 'query', domain: 'convergence', subject: 'system' },
  'dkg skew': { intent: 'query', domain: 'convergence', subject: 'version' },
  'dkg coverage': { intent: 'query', domain: 'convergence', subject: 'prefix' },
  'dkg metrics': { intent: 'query', domain: 'convergence', subject: 'system' },
  'dkg patterns': { intent: 'query', domain: 'convergence', subject: 'prefix' },
  'dkg pattern-stats': { intent: 'query', domain: 'convergence', subject: 'prefix' },
  'dkg decisions list': { intent: 'query', domain: 'dkg-graph', subject: 'decision' },
  // dkg analyze
  'dkg impact': { intent: 'analyze', domain: 'dkg-graph', subject: 'axis' },
  'dkg overlaps': { intent: 'analyze', domain: 'convergence', subject: 'axis' },
  'dkg audit-events': { intent: 'query', domain: 'registry', subject: 'system' },
  'dkg self-check': { intent: 'analyze', domain: 'self-ref', subject: 'system' },
  'dkg converge': { intent: 'analyze', domain: 'convergence', subject: 'system' },
  'dkg promote': { intent: 'analyze', domain: 'self-ref', subject: 'axis' },
  'dkg discover-links': { intent: 'analyze', domain: 'convergence', subject: 'intent-link' },
  // dkg mutate
  'dkg decide': { intent: 'mutate', domain: 'dkg-graph', subject: 'decision' },
  'dkg observe': { intent: 'mutate', domain: 'dkg-graph', subject: 'observation' },
  'dkg claim': { intent: 'mutate', domain: 'dkg-graph', subject: 'prefix' },
  'dkg release': { intent: 'mutate', domain: 'dkg-graph', subject: 'prefix' },
  'dkg resolve': { intent: 'mutate', domain: 'dkg-graph', subject: 'observation' },
  'dkg link': { intent: 'mutate', domain: 'dkg-graph', subject: 'observation' },
  'dkg refresh': { intent: 'mutate', domain: 'dkg-graph', subject: 'system' },
  // dkg lifecycle
  'dkg version': { intent: 'lifecycle', domain: 'registry', subject: 'version' },
  'dkg publish': { intent: 'publish', domain: 'registry', subject: 'catalog' },
  // dkg backup
  'dkg export': { intent: 'backup', domain: 'system', subject: 'system' },
  'dkg import': { intent: 'backup', domain: 'system', subject: 'system' },
  'dkg decisions export': { intent: 'backup', domain: 'dkg-graph', subject: 'decision' },
  'dkg decisions import': { intent: 'backup', domain: 'dkg-graph', subject: 'decision' },
  // dkg run
  'dkg run': { intent: 'analyze', domain: 'dkg-skill', subject: 'skill' },
  // coordinate
  encode: { intent: 'query', domain: 'coordinate', subject: 'prefix' },
  decode: { intent: 'query', domain: 'coordinate', subject: 'prefix' },
  resolve: { intent: 'query', domain: 'coordinate', subject: 'prefix' },
  'find-version': { intent: 'query', domain: 'coordinate', subject: 'version' },
  'list-prefixes': { intent: 'query', domain: 'coordinate', subject: 'prefix' },
  'list-axes': { intent: 'query', domain: 'coordinate', subject: 'axis' },
  'derive-refs': { intent: 'analyze', domain: 'coordinate', subject: 'prefix' },
  impact: { intent: 'analyze', domain: 'coordinate', subject: 'axis' },
  // spec
  'spec list': { intent: 'query', domain: 'spec', subject: 'spec' },
  'spec resolve': { intent: 'query', domain: 'spec', subject: 'prefix' },
  'spec validate': { intent: 'analyze', domain: 'spec', subject: 'schema' },
  'spec trace': { intent: 'query', domain: 'spec', subject: 'spec' },
  'spec decode': { intent: 'query', domain: 'spec', subject: 'prefix' },
  'spec codegen': { intent: 'publish', domain: 'spec', subject: 'schema' },
  // service (registry 기반)
  'service list': { intent: 'query', domain: 'registry', subject: 'service' },
  'service show': { intent: 'analyze', domain: 'registry', subject: 'service' },
  'service owners': { intent: 'query', domain: 'registry', subject: 'prefix' },
  'service endpoints': { intent: 'query', domain: 'ingest', subject: 'service' },
  // ingest
  'ingest health': { intent: 'query', domain: 'ingest', subject: 'system' },
  'ingest send': { intent: 'mutate', domain: 'ingest', subject: 'prefix' },
  'ingest recent': { intent: 'query', domain: 'ingest', subject: 'prefix' },
  'ingest trace': { intent: 'query', domain: 'ingest', subject: 'prefix' },
  'ingest status': { intent: 'query', domain: 'ingest', subject: 'system' },
  'ingest services': { intent: 'query', domain: 'registry', subject: 'service' },
  // system
  init: { intent: 'init', domain: 'system', subject: 'catalog' },
  'scan git': { intent: 'init', domain: 'system', subject: 'schema' },
  register: { intent: 'publish', domain: 'registry', subject: 'schema' },
  'dry-run': { intent: 'analyze', domain: 'system', subject: 'prefix' },
  codegen: { intent: 'publish', domain: 'system', subject: 'schema' },
  inspect: { intent: 'query', domain: 'registry', subject: 'schema' },
  'catalog list': { intent: 'query', domain: 'catalog', subject: 'catalog' },
  'catalog info': { intent: 'query', domain: 'catalog', subject: 'catalog' },
  // 추가된 명령어
  'dkg add-entry': { intent: 'mutate', domain: 'dkg-graph', subject: 'axis' },
  'dkg reset': { intent: 'mutate', domain: 'system', subject: 'system' },
  'dkg spec add': { intent: 'mutate', domain: 'spec', subject: 'spec' },
  'dkg spec list': { intent: 'query', domain: 'spec', subject: 'spec' },
  'dkg spec transition': { intent: 'lifecycle', domain: 'spec', subject: 'spec' },
  'dkg diagram': { intent: 'query', domain: 'dkg-graph', subject: 'domain' },
  'dkg tables': { intent: 'query', domain: 'dkg-graph', subject: 'table' },
  'dkg table': { intent: 'query', domain: 'dkg-graph', subject: 'table' },
  'dkg transitions': { intent: 'query', domain: 'dkg-graph', subject: 'spec' },
  'dkg transition': { intent: 'analyze', domain: 'dkg-graph', subject: 'spec' },
  'dkg scan-tables': { intent: 'analyze', domain: 'dkg-graph', subject: 'table' },
  'dkg audit': { intent: 'analyze', domain: 'dkg-graph', subject: 'constraint' },
};

/**
 * CLI 명령 실행을 cli_event 좌표로 기록한다.
 * 명령어 이름이 아닌 의도(intent × domain × subject)가 좌표.
 */
export function emitCliEvent(command: string): void {
  const mapping = CLI_COMMAND_MAP[command];
  if (!mapping) return;
  try {
    const collectedAt = now();
    const version = latestVer('cli_event');
    const address = encodePrefixByValue(DEMO_CATALOG, 'cli_event', version, {
      cli_intent: mapping.intent,
      cli_domain: mapping.domain,
      cli_subject: mapping.subject,
    });
    const serialized = serializeAddressContext('cli_event', version, address);
    saveUsageTelemetry({
      collectedAt,
      entryUsages: [
        { axisId: 'cli_intent', entry: mapping.intent, count: 1, lastSeen: collectedAt },
        { axisId: 'cli_domain', entry: mapping.domain, count: 1, lastSeen: collectedAt },
        { axisId: 'cli_subject', entry: mapping.subject, count: 1, lastSeen: collectedAt },
      ],
      addressUsages: [{ prefix: 'cli_event', version, address, count: 1 }],
      versionPrefixes: [{ prefix: 'cli_event', version }],
    });
    persistAuditRecord({
      eventKey: 'cli.command.executed',
      eventPrefix: 'cli_event',
      command,
      addressContext: { cli_event: serialized },
      payload: {
        command,
        cli_intent: mapping.intent,
        cli_domain: mapping.domain,
        cli_subject: mapping.subject,
      },
    });
  } catch {
    // 인코딩 실패 시 무시
  }
}

/**
 * CLI 커버리지 분석 — 관측된 좌표 vs 전체 좌표.
 * dormant 좌표 = 한 번도 실행되지 않은 CLI 기능 경로.
 */
export function analyzeCliCoverage(): {
  totalCoords: number;
  observedCoords: number;
  dormantCoords: Array<{ coord: string; commands: string[] }>;
  coverageRate: number;
} {
  // 전체 고유 좌표 수집
  const allCoords = new Map<string, string[]>();
  for (const [cmd, m] of Object.entries(CLI_COMMAND_MAP)) {
    const key = `${m.intent}:${m.domain}:${m.subject}`;
    const list = allCoords.get(key) ?? [];
    list.push(cmd);
    allCoords.set(key, list);
  }

  // store의 usage_snapshots data JSON에서 cli_* entryUsage 직접 스캔
  const observedIntents = new Set<string>();
  const observedDomains = new Set<string>();
  const observedSubjects = new Set<string>();
  try {
    const s = getStore();
    const rows = s.getRecentUsageSnapshots(500);
    for (const row of rows) {
      try {
        const d = JSON.parse(row.data);
        for (const eu of d.entryUsages ?? []) {
          if (eu.axisId === 'cli_intent') observedIntents.add(eu.entry);
          if (eu.axisId === 'cli_domain') observedDomains.add(eu.entry);
          if (eu.axisId === 'cli_subject') observedSubjects.add(eu.entry);
        }
      } catch {
        /* 개별 snapshot JSON 파싱 실패 — 스킵 */
      }
    }
  } catch (err) {
    if (process.env.DEBUG) console.warn('[analyzeCliCoverage] store access failed:', err);
  }

  // 관측된 좌표 조합 판별
  const observed = new Set<string>();
  for (const [key] of allCoords) {
    const [intent, domain, subject] = key.split(':');
    if (
      observedIntents.has(intent) &&
      observedDomains.has(domain) &&
      observedSubjects.has(subject)
    ) {
      observed.add(key);
    }
  }

  const dormant = [...allCoords.entries()]
    .filter(([key]) => !observed.has(key))
    .map(([key, cmds]) => ({ coord: key, commands: cmds }));

  return {
    totalCoords: allCoords.size,
    observedCoords: observed.size,
    dormantCoords: dormant,
    coverageRate: allCoords.size > 0 ? observed.size / allCoords.size : 1,
  };
}

/** prefix의 최신 version ID. 하드코딩 방지. */
/** skill 실행 이벤트를 skill_execution prefix로 기록 */
function emitSkillExecution(skillId: string, category: string, outcome: string = 'ok'): void {
  try {
    const collectedAt = now();
    const ver = latestVer('skill_execution');
    encodePrefixByValue(DEMO_CATALOG, 'skill_execution', ver, {
      skill_id: skillId,
      skill_category: category,
      skill_outcome: outcome,
    });
    saveUsageTelemetry({
      collectedAt,
      entryUsages: [
        { axisId: 'skill_id', entry: skillId, count: 1, lastSeen: collectedAt },
        { axisId: 'skill_category', entry: category, count: 1, lastSeen: collectedAt },
        { axisId: 'skill_outcome', entry: outcome, count: 1, lastSeen: collectedAt },
      ],
      versionPrefixes: [{ prefix: 'skill_execution', version: ver }],
    });
  } catch {
    /* 기록 실패 시 무시 */
  }
}

function latestVer(prefixId: string): string {
  return latestPrefixVersion(DEMO_CATALOG, prefixId);
}

function cliSessionId(): string {
  return `cli-${process.env.USER ?? 'unknown'}`;
}

const CLI_AUDIT_SERVICE = createServiceBootConfig('qa-sdk-cli');
const CLI_AUDIT_SOURCE = toTransmissionSource(CLI_AUDIT_SERVICE, '@qa-sdk/cli', '0.1.0');
const CLI_AUDIT_BUILD = toTransmissionBuild(CLI_AUDIT_SERVICE);

function resolveAuditIngestUrl(): string | null {
  const base = process.env.QA_CLI_AUDIT_INGEST_URL ?? process.env.INGEST_URL;
  if (!base) return null;
  return base.endsWith('/v1/ingest') ? base : `${base}/v1/ingest`;
}

async function forwardAuditRecordToIngest(record: EventRecord): Promise<void> {
  const ingestUrl = resolveAuditIngestUrl();
  if (!ingestUrl) return;

  const dims = toServiceDims(CLI_AUDIT_SERVICE);
  const envelope: TransmissionEnvelope = {
    transmission_id: newTransmissionId(),
    sent_at: record.timestamp,
    owner: {
      owner_type: 'agent',
      owner_id: record.qa_session_id ?? cliSessionId(),
    },
    source: CLI_AUDIT_SOURCE,
    runtime: { platform: 'node' },
    build: CLI_AUDIT_BUILD,
    infra_context: {
      env: dims.env,
      region: dims.region,
      svc_name: dims.svc_name,
      namespace: dims.namespace,
    },
    records: [record],
  };

  try {
    await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (err) {
    if (process.env.DEBUG || process.env.QA_CLI_AUDIT_WARN === '1') {
      console.warn(`[cli-audit-ingest] 전송 실패 (${ingestUrl}): ${errorMessage(err)}`);
    }
  }
}

function serializeAddressContext(prefix: string, version: string, address: number): string {
  return `${prefix}:${version}:${address}`;
}

function toDkgEntryUsages(catalog: Catalog, entryUsages: readonly EntryUsage[]): DkgEntryUsage[] {
  return entryUsages.flatMap((usage) =>
    Object.values(catalog.prefixes)
      .filter((prefix) =>
        Object.values(prefix.dims).some(
          (dim) => dim.kind === 'axis' && dim.axisId === usage.axisId,
        ),
      )
      .map((prefix) => ({
        prefixId: prefix.id,
        entryId: usage.entry,
        count: usage.count,
      })),
  );
}

function toDkgAddressUsages(addressUsages: readonly AddressUsage[]): DkgAddressUsage[] {
  return addressUsages.map((usage) => ({
    prefixId: usage.prefix,
    version: usage.version,
    address: usage.address,
    count: usage.count,
  }));
}

function toDkgUsageData(catalog: Catalog, usage: UsageData): DkgUsageData {
  return {
    entryUsages: toDkgEntryUsages(catalog, usage.entryUsages),
    addressUsages: toDkgAddressUsages(usage.addressUsages),
    coOccurrences: usage.coOccurrences,
    versionUsages: usage.versionUsages,
    collectionPeriod: usage.collectionPeriod,
    ...(usage.sourceStats ? { sourceStats: usage.sourceStats } : {}),
  };
}

function saveUsageTelemetry(input: {
  collectedAt: string;
  entryUsages?: EntryUsage[];
  addressUsages?: AddressUsage[];
  versionPrefixes?: Array<{ prefix: string; version: string }>;
}): void {
  const entryUsages = input.entryUsages ?? [];
  const addressUsages = input.addressUsages ?? [];
  const versionUsages = (input.versionPrefixes ?? []).map(({ prefix, version }) => ({
    prefix,
    version,
    count: 1,
    lastSeen: input.collectedAt,
    sessions: [cliSessionId()],
  }));

  if (entryUsages.length === 0 && addressUsages.length === 0 && versionUsages.length === 0) {
    return;
  }

  const store = getStore();
  store.saveUsageSnapshot({
    entryUsages: toDkgEntryUsages(DEMO_CATALOG, entryUsages),
    addressUsages: toDkgAddressUsages(addressUsages),
    coOccurrences: [],
    versionUsages,
    collectionPeriod: { from: input.collectedAt, to: input.collectedAt },
  } satisfies DkgUsageData);
}

function makeAuditRecord(
  eventKey: string,
  payload: Record<string, unknown>,
  addressContext?: Record<string, string>,
): EventRecord {
  return {
    log_id: newLogId(),
    timestamp: now(),
    record_kind: 'log',
    trace_id: newTraceId(),
    span_id: newSpanId(),
    event_key: eventKey,
    event_version: '1',
    payload_format: 'json',
    payload_encoding: 'raw',
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload,
    qa_session_id: cliSessionId(),
    ...(addressContext && Object.keys(addressContext).length > 0
      ? { address_context: addressContext }
      : {}),
  };
}

function persistAuditRecord(input: {
  eventKey: string;
  payload: Record<string, unknown>;
  addressContext?: Record<string, string>;
  eventPrefix?: string;
  command?: string;
  targetId?: string;
  targetKind?: string;
  lifecycleFrom?: string;
  lifecycleTo?: string;
}): void {
  const store = getStore();
  const record = makeAuditRecord(input.eventKey, input.payload, input.addressContext);
  store.saveCliAuditEvent({
    record,
    eventPrefix: input.eventPrefix,
    command: input.command,
    targetId: input.targetId,
    targetKind: input.targetKind,
    lifecycleFrom: input.lifecycleFrom,
    lifecycleTo: input.lifecycleTo,
  });
  void forwardAuditRecordToIngest(record);
}

// ── DKG 이벤트 기록 (write 명령 상세) ──────────────────
// cli_event의 subset. mutate intent 명령의 상세 정보 기록.

function emitDkgEvent(
  op: string,
  targetKind: string,
  targetId: string,
  extra?: {
    decisionType?: string;
    obsSource?: string;
    nodeSource?: string;
    lifecycleState?: string;
    lifecycleFrom?: string;
    command?: string;
  },
): void {
  try {
    const collectedAt = now();
    const versionUsages: Array<{ prefix: string; version: string }> = [];
    const addressUsages: AddressUsage[] = [];
    const addressContext: Record<string, string> = {};

    // 기본 dkg_event
    try {
      const dkgVersion = latestVer('dkg_event');
      const dkgAddress = encodePrefixByValue(DEMO_CATALOG, 'dkg_event', dkgVersion, {
        dkg_op: op,
        dkg_target_kind: targetKind,
      });
      addressUsages.push({
        prefix: 'dkg_event',
        version: dkgVersion,
        address: dkgAddress,
        count: 1,
      });
      addressContext.dkg_event = serializeAddressContext('dkg_event', dkgVersion, dkgAddress);
      versionUsages.push({ prefix: 'dkg_event', version: dkgVersion });
    } catch {
      // dkg_target_kind에 등록되지 않은 값이어도 audit record 자체는 남긴다.
    }

    // 승격된 prefix: dkg_decision_event (decide 시)
    if (extra?.decisionType) {
      try {
        const decisionVersion = latestVer('dkg_decision_event');
        const decisionAddress = encodePrefixByValue(
          DEMO_CATALOG,
          'dkg_decision_event',
          decisionVersion,
          {
            decision_type: extra.decisionType,
            dkg_target_kind: targetKind,
            node_source: extra.nodeSource ?? 'manual',
          },
        );
        addressUsages.push({
          prefix: 'dkg_decision_event',
          version: decisionVersion,
          address: decisionAddress,
          count: 1,
        });
        addressContext.dkg_decision_event = serializeAddressContext(
          'dkg_decision_event',
          decisionVersion,
          decisionAddress,
        );
        versionUsages.push({ prefix: 'dkg_decision_event', version: decisionVersion });
      } catch {
        /* 값이 축에 없으면 건너뜀 */
      }
    }

    // 승격된 prefix: dkg_observation_event (observe 시)
    if (extra?.obsSource) {
      try {
        const observationVersion = latestVer('dkg_observation_event');
        const observationAddress = encodePrefixByValue(
          DEMO_CATALOG,
          'dkg_observation_event',
          observationVersion,
          {
            obs_source: extra.obsSource,
            dkg_target_kind: targetKind,
            lifecycle_state: extra.lifecycleState ?? 'active',
          },
        );
        addressUsages.push({
          prefix: 'dkg_observation_event',
          version: observationVersion,
          address: observationAddress,
          count: 1,
        });
        addressContext.dkg_observation_event = serializeAddressContext(
          'dkg_observation_event',
          observationVersion,
          observationAddress,
        );
        versionUsages.push({ prefix: 'dkg_observation_event', version: observationVersion });
      } catch {
        /* 값이 축에 없으면 건너뜀 */
      }
    }

    saveUsageTelemetry({
      collectedAt,
      addressUsages,
      versionPrefixes: versionUsages,
    });
    persistAuditRecord({
      eventKey: 'cli.dkg.operation',
      eventPrefix: 'dkg_event',
      command: extra?.command ?? 'dkg',
      targetId,
      targetKind,
      lifecycleFrom: extra?.lifecycleFrom,
      lifecycleTo: extra?.lifecycleState,
      addressContext,
      payload: {
        op,
        targetKind,
        targetId,
        ...(extra?.decisionType ? { decisionType: extra.decisionType } : {}),
        ...(extra?.obsSource ? { obsSource: extra.obsSource } : {}),
        ...(extra?.nodeSource ? { nodeSource: extra.nodeSource } : {}),
        ...(extra?.lifecycleFrom ? { lifecycleFrom: extra.lifecycleFrom } : {}),
        ...(extra?.lifecycleState ? { lifecycleTo: extra.lifecycleState } : {}),
      },
    });
  } catch {
    // 인코딩 실패 시 무시 (운영에 영향 없음)
  }
}

interface PageOptions {
  page?: number;
  limit?: number;
}

async function fetchVersionStatus(
  registryUrl: string,
  prefix: string,
  versionId: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(`${registryUrl}/prefixes/${prefix}/versions/${versionId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { status?: string };
    return data.status;
  } catch {
    return undefined;
  }
}

function paginate<T>(
  items: T[],
  opts: PageOptions,
): { items: T[]; page: number; totalPages: number; total: number } {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page,
    totalPages,
    total,
  };
}

function printPageInfo(result: { page: number; totalPages: number; total: number }): void {
  if (result.totalPages > 1) {
    console.log(`\n  page ${result.page}/${result.totalPages} (total: ${result.total})`);
  }
}

// ── dkg report ──────────────────────────────────────

export function dkgReport(): void {
  const graph = getGraph();

  const axes = graph.getNodesByKind('axis');
  const prefixes = graph.getNodesByKind('prefix');
  const domains = graph.getNodesByKind('domain');
  const consumers = graph.getNodesByKind('consumer');
  const decisions = graph.getNodesByKind('decision');
  const constraints = graph.getNodesByKind('constraint');
  const observations = graph.getNodesByKind('observation');

  console.log('\n══ DKG Report ══');
  console.log(`  Axes:         ${axes.length}`);
  console.log(`  Prefixes:     ${prefixes.length}`);
  console.log(`  Domains:      ${domains.length}`);
  console.log(`  Consumers:    ${consumers.length}`);
  console.log(`  Decisions:    ${decisions.length}`);
  console.log(`  Constraints:  ${constraints.length}`);
  console.log(`  Observations: ${observations.length}`);
  console.log(`  Nodes total:  ${graph.nodeCount}`);
  console.log(`  Edges total:  ${graph.edgeCount}`);

  // headroom 요약
  const criticalAxes = axes.filter((a) => {
    const axisData = DEMO_CATALOG.axes[a.id as DemoAxisId];
    if (!axisData) return false;
    const versionKeys = Object.keys(axisData.versions);
    const latest = (axisData.versions as Record<string, AxisVersionSnapshot>)[
      versionKeys[versionKeys.length - 1]
    ];
    if (!latest) return false;
    return (latest.capacity ?? latest.entries.length) === latest.entries.length;
  });

  if (criticalAxes.length > 0) {
    console.log(`\n  ⚠ headroom=0 축: ${criticalAxes.map((a) => a.id).join(', ')}`);
    console.log(
      `    (${decisions.length > 0 ? 'Decision으로 확장 계획 기록됨' : 'Decision 없음 — 확장 계획 필요'})`,
    );
  }

  // 수렴 분석 요약 — DEC-SEP/DEC-MERGE 분리 결정이 있는 쌍은 별도 표시
  const entriesMap = buildEntriesMap();
  const overlaps = scanAxisOverlaps(graph, entriesMap);
  function hasActiveDecision(a: string, b: string): boolean {
    // 1. ID 패턴 매칭 (bootstrap에서 생성된 DEC-SEP-{a}-{b})
    const ids = [
      `DEC-SEP-${a}-${b}`,
      `DEC-SEP-${b}-${a}`,
      `DEC-MERGE-${a}-${b}`,
      `DEC-MERGE-${b}-${a}`,
    ];
    const byId = ids.some((id) => {
      const n = graph.getNode(id);
      return n?.kind === 'decision' && (n as DecisionNode).lifecycle === 'active';
    });
    if (byId) return true;

    // 2. 전체 Decision 스캔 — ID 또는 title에 두 축이 모두 언급된 활성 Decision
    const allDecisions = graph.getNodesByKind('decision') as DecisionNode[];
    return allDecisions.some((d) => {
      if (d.lifecycle !== 'active') return false;
      const text = `${d.id} ${d.title}`;
      return text.includes(a) && text.includes(b);
    });
  }
  const mergeOverlaps = overlaps.filter((o) => o.recommendation === 'merge');
  const mergeCandidate = mergeOverlaps.filter((o) => !hasActiveDecision(o.a, o.b));
  const mergeSuppressed = mergeOverlaps.filter((o) => hasActiveDecision(o.a, o.b));
  const reviewAll = overlaps.filter((o) => o.recommendation === 'review');
  const reviewCandidate = reviewAll.filter((o) => !hasActiveDecision(o.a, o.b));
  const reviewSuppressed = reviewAll.filter((o) => hasActiveDecision(o.a, o.b));

  if (mergeCandidate.length > 0) {
    console.log(`\n  병합 후보: ${mergeCandidate.map((o) => `${o.a}↔${o.b}`).join(', ')}`);
  }
  if (mergeSuppressed.length > 0 || reviewSuppressed.length > 0) {
    const all = [...mergeSuppressed, ...reviewSuppressed];
    console.log(`  분리 유지 (결정됨): ${all.map((o) => `${o.a}↔${o.b}`).join(', ')}`);
  }
  if (reviewCandidate.length > 0) {
    console.log(`  검토 필요: ${reviewCandidate.map((o) => `${o.a}↔${o.b}`).join(', ')}`);
  }

  // 결정 충돌
  const conflicts = scanDecisionConflicts(graph);
  if (conflicts.length > 0) {
    console.log(`\n  결정 충돌: ${conflicts.length}개`);
  }

  // 영속 상태 정보
  const store = getStore();
  const storeStats = store.stats();
  const lastBootstrap = store.getMeta('last_bootstrap');
  console.log(`\n  ── 영속 상태 (${STATE_DB}) ──`);
  console.log(
    `  DB nodes: ${storeStats.nodes} (bootstrap: ${storeStats.bootstrapNodes}, manual: ${storeStats.manualNodes})`,
  );
  console.log(
    `  DB edges: ${storeStats.edges} (bootstrap: ${storeStats.bootstrapEdges}, manual: ${storeStats.manualEdges})`,
  );
  console.log(`  스냅샷: ${storeStats.snapshots}개, versionUsage: ${storeStats.versionUsages}건`);
  if (lastBootstrap) console.log(`  last bootstrap: ${lastBootstrap}`);

  // 최근 배포 스큐
  const recent = store.loadRecentVersionUsages(1);
  if (recent.length > 0 && recent[0].versionUsages.length > 0) {
    const skews = analyzeDeploymentSkew(recent[0].versionUsages);
    const critical = skews.filter((s) => s.severity === 'critical');
    const warning = skews.filter((s) => s.severity === 'warning');
    if (critical.length > 0) {
      console.log(`\n  🔴 배포 스큐 critical: ${critical.map((s) => s.prefix).join(', ')}`);
      for (const s of critical) console.log(`     ${s.summary}`);
    }
    if (warning.length > 0) {
      console.log(`  ⚠ 배포 스큐 warning: ${warning.map((s) => s.prefix).join(', ')}`);
    }
  }
}

// ── dkg axes ────────────────────────────────────────

export function dkgAxes(opts: PageOptions & { groupBy?: string }): void {
  const graph = getGraph();
  const axes = graph.getNodesByKind('axis');

  if (opts.groupBy === 'prefix') {
    // 축별 사용 prefix를 역추적하여 prefix 기준으로 그룹핑
    const prefixToAxes = new Map<string, string[]>();
    const usedAxes = new Set<string>();
    for (const prefix of graph.getNodesByKind('prefix')) {
      const edges = graph.edgesFrom(prefix.id, 'composes');
      const axisIds = edges.filter((e) => e.meta?.dimKind === 'axis').map((e) => e.to);
      if (axisIds.length > 0) {
        prefixToAxes.set(prefix.id, axisIds);
        for (const a of axisIds) usedAxes.add(a);
      }
    }
    console.log(`\n══ Axes by Prefix ══`);
    for (const [prefixId, axisIds] of [...prefixToAxes.entries()].toSorted((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      console.log(`  ${prefixId}`);
      for (const axisId of axisIds) {
        console.log(`    ${axisId}`);
      }
    }
    const unused = axes.filter((a) => !usedAxes.has(a.id));
    if (unused.length > 0) {
      console.log(`\n  ── 미사용 축 (${unused.length}) ──`);
      for (const a of unused) console.log(`    ${a.id}`);
    }
    return;
  }

  if (opts.groupBy === 'domain') {
    // 도메인별: domain → prefix → axis 경로로 그룹핑
    const domains = graph.getNodesByKind('domain');
    console.log(`\n══ Axes by Domain ══`);
    const domainAxes = new Set<string>();
    for (const domain of domains) {
      const axisSet = new Set<string>();
      for (const prefixId of domain.prefixes) {
        const edges = graph.edgesFrom(prefixId, 'composes');
        for (const e of edges) {
          if (e.meta?.dimKind === 'axis') axisSet.add(e.to);
        }
      }
      for (const a of axisSet) domainAxes.add(a);
      console.log(`  ${domain.id} (${axisSet.size}개 축)`);
      for (const axisId of [...axisSet].toSorted()) {
        console.log(`    ${axisId}`);
      }
    }
    const allAxisIds = new Set(axes.map((a) => a.id));
    const orphan = [...allAxisIds].filter((a) => !domainAxes.has(a));
    if (orphan.length > 0) {
      console.log(`\n  ── 도메인 미소속 축 (${orphan.length}) ──`);
      for (const a of orphan) console.log(`    ${a}`);
    }
    return;
  }

  const result = paginate(axes, opts);

  console.log(`\n══ Axes ══`);
  for (const axis of result.items) {
    const catalog = DEMO_CATALOG.axes[axis.id as DemoAxisId];
    let info = '';
    if (catalog) {
      const versionKeys = Object.keys(catalog.versions);
      const latest = (catalog.versions as Record<string, AxisVersionSnapshot>)[
        versionKeys[versionKeys.length - 1]
      ];
      const entries = latest?.entries?.length ?? 0;
      const cap = latest?.capacity ?? entries;
      info = ` entries=${entries} cap=${cap} headroom=${cap - entries}`;
    }
    console.log(`  ${axis.id.padEnd(15)} ${axis.name.padEnd(12)}${info}`);
  }

  printPageInfo(result);
}

// ── dkg prefixes ────────────────────────────────────

export function dkgPrefixes(opts: PageOptions): void {
  const graph = getGraph();
  const prefixes = graph.getNodesByKind('prefix');

  const result = paginate(prefixes, opts);

  console.log(`\n══ Prefixes ══`);
  for (const prefix of result.items) {
    const edges = graph.edgesFrom(prefix.id, 'composes');
    const axisDims = edges.filter((e) => e.meta?.dimKind === 'axis').length;
    const refDims = edges.filter((e) => e.meta?.dimKind === 'prefix_ref').length;
    const tblDims = edges.filter((e) => e.meta?.dimKind === 'table_ref').length;
    const cat = prefix.category ?? 'entity';
    const catTag = `[${cat}]`.padEnd(14);
    console.log(
      `  ${prefix.id.padEnd(17)} ${catTag} ${prefix.name.padEnd(15)} dims=${prefix.dimLabels.length} (axis:${axisDims} ref:${refDims} tbl:${tblDims})`,
    );
  }

  printPageInfo(result);

  // Catalog vs DKG gap 표시 (마지막 페이지에서만)
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;
  const catalogPrefixIds = Object.keys(catalog.prefixes);
  const dkgPrefixIds = new Set(prefixes.map((p) => p.id));
  const gap = catalogPrefixIds.filter((id) => !dkgPrefixIds.has(id));
  if (gap.length > 0) {
    console.log(`\n  ── Catalog에만 존재 (DKG 미등록: ${gap.length}건) ──`);
    for (const id of gap) {
      console.log(`    ${id}`);
    }
  }
}

// ── dkg domains ─────────────────────────────────────

export function dkgDomains(opts: PageOptions): void {
  const graph = getGraph();
  const domains = graph.getNodesByKind('domain');

  const result = paginate(domains, opts);

  console.log(`\n══ Domains ══`);
  for (const domain of result.items) {
    console.log(`  ${domain.id.padEnd(20)} ${domain.name}`);
    console.log(`    prefixes: ${domain.prefixes.join(', ')}`);
    console.log(`    exports:  ${domain.boundary.exports.join(', ')}`);
    if (domain.boundary.internal.length > 0) {
      console.log(`    internal: ${domain.boundary.internal.join(', ')}`);
    }
  }

  printPageInfo(result);
}

// ── dkg flow-schemas / dkg flow-schema ───────────────

export interface FlowSchemaListEntry {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly gateCount: number;
  readonly coreGateCount: number;
  readonly totalPaths: number;
  readonly axisCount: number;
  readonly prefixCount: number;
}

export interface FlowSchemaGateProfile {
  readonly id: string;
  readonly name: string;
  readonly phase: string;
  readonly weight: string;
  readonly branchCount: number;
  readonly subFlowId?: string;
}

export interface FlowSchemaProfileView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly totalPaths: number;
  readonly gateCount: number;
  readonly coreGateIds: readonly string[];
  readonly gates: readonly FlowSchemaGateProfile[];
  readonly directAxisIds: readonly string[];
  readonly directPrefixIds: readonly string[];
  readonly transitiveAxisIds: readonly string[];
  readonly transitivePrefixIds: readonly string[];
  readonly subFlowIds: readonly string[];
  readonly domainIds: readonly string[];
}

function activeDkgConfig(configOverride?: BootstrapConfigInput): BootstrapConfigInput {
  return configOverride ?? _configOverride ?? DEMO_DKG_CONFIG;
}

function getConfiguredFlowSchemaEntries(
  configOverride?: BootstrapConfigInput,
): readonly FlowSchemaConfigEntry[] {
  return activeDkgConfig(configOverride).flowSchemas ?? [];
}

function getConfiguredFlowSchema(
  flowSchemaId: string,
  configOverride?: BootstrapConfigInput,
): FlowSchema | undefined {
  return getConfiguredFlowSchemaEntries(configOverride).find(
    (entry) => entry.schema.id === flowSchemaId,
  )?.schema as FlowSchema | undefined;
}

function getFlowSchemaNode(
  graph: GraphRegistry,
  flowSchemaId: string,
): Extract<DkgNode, { kind: 'flow-schema' }> | null {
  const node = graph.getNode(flowSchemaId);
  if (!node || node.kind !== 'flow-schema') {
    return null;
  }
  return node;
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].toSorted((a, b) => a.localeCompare(b));
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function summarizeFlowSchemaGate(
  gate: Extract<DkgNode, { kind: 'flow-schema' }>['gates'][number],
  schema?: FlowSchema,
): FlowSchemaGateProfile {
  const resolved = schema?.gates.find((candidate) => candidate.id === gate.id);
  return {
    id: gate.id,
    name: gate.name,
    phase: gate.phase,
    weight: gate.weight,
    branchCount: resolved?.branches?.length ?? 0,
    subFlowId: resolved?.subFlowId,
  };
}

export function listFlowSchemas(
  graph: GraphRegistry,
  configOverride?: BootstrapConfigInput,
): FlowSchemaListEntry[] {
  return graph
    .getNodesByKind('flow-schema')
    .map((node) => {
      const schema = getConfiguredFlowSchema(node.id, configOverride);
      const gateCount = schema?.gates.length ?? node.gates.length;
      return {
        id: node.id,
        name: node.name,
        version: node.version,
        gateCount,
        coreGateCount: node.coreGateIds.length,
        totalPaths: node.totalPaths,
        axisCount: graph.neighbors(node.id, 'composes').length,
        prefixCount: graph.neighbors(node.id, 'observes').length,
      };
    })
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

export function getFlowSchemaProfile(
  graph: GraphRegistry,
  flowSchemaId: string,
  configOverride?: BootstrapConfigInput,
): FlowSchemaProfileView | null {
  const node = getFlowSchemaNode(graph, flowSchemaId);
  if (!node) {
    return null;
  }

  const schema = getConfiguredFlowSchema(flowSchemaId, configOverride);
  const cascade = graph.cascadeFromFlowSchema(flowSchemaId);

  return {
    id: node.id,
    name: node.name,
    version: node.version,
    totalPaths: node.totalPaths,
    gateCount: schema?.gates.length ?? node.gates.length,
    coreGateIds: [...node.coreGateIds],
    gates: node.gates.map((gate) => summarizeFlowSchemaGate(gate, schema)),
    directAxisIds: sortIds(graph.neighbors(flowSchemaId, 'composes')),
    directPrefixIds: sortIds(graph.neighbors(flowSchemaId, 'observes')),
    transitiveAxisIds: sortIds(uniqueIds(cascade.axes.map((axis) => axis.id))),
    transitivePrefixIds: sortIds(uniqueIds(cascade.prefixes.map((prefix) => prefix.id))),
    subFlowIds: sortIds(graph.neighbors(flowSchemaId, 'references')),
    domainIds: sortIds(graph.neighbors(flowSchemaId, 'contains')),
  };
}

function mermaidSafeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, '_');
}

function mermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function renderFlowSchemaDiagramMermaid(
  graph: GraphRegistry,
  flowSchemaId: string,
  configOverride?: BootstrapConfigInput,
): string {
  const node = getFlowSchemaNode(graph, flowSchemaId);
  if (!node) {
    throw new Error(`flow-schema를 찾을 수 없음: ${flowSchemaId}`);
  }

  const schema = getConfiguredFlowSchema(flowSchemaId, configOverride);
  if (!schema) {
    throw new Error(`DkgConfig.flowSchemas에 등록되지 않은 flow-schema: ${flowSchemaId}`);
  }

  const causalGraph = extractCausalGraph(schema);
  const lines: string[] = [
    'flowchart LR',
    `  %% FlowSchema: ${schema.id} (${schema.version})`,
    '  classDef core fill:#fde68a,stroke:#92400e,color:#451a03;',
    '  classDef structural fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a;',
    '  classDef tactical fill:#f3f4f6,stroke:#6b7280,color:#111827;',
  ];

  const nodeIds: string[] = [];

  for (const gate of schema.gates) {
    const mermaidId = mermaidSafeId(gate.id);
    nodeIds.push(mermaidId);
    const weight = gate.weight ?? 'tactical';
    const labelParts = [gate.id, gate.name, `${gate.phase} / ${weight}`];
    if (gate.subFlowId) {
      labelParts.push(`subFlow: ${gate.subFlowId}`);
    } else if (gate.branches) {
      labelParts.push(`branches: ${gate.branches.length}`);
    }
    lines.push(`  ${mermaidId}["${mermaidLabel(labelParts.join('<br/>'))}"]`);
    lines.push(`  class ${mermaidId} ${weight};`);
  }

  for (const edge of causalGraph.edges) {
    lines.push(`  ${mermaidSafeId(edge.from)} -->|${edge.kind}| ${mermaidSafeId(edge.to)}`);
  }

  if (causalGraph.roots.length > 0) {
    lines.push(`  %% roots: ${causalGraph.roots.join(', ')}`);
  }
  if (causalGraph.leaves.length > 0) {
    lines.push(`  %% leaves: ${causalGraph.leaves.join(', ')}`);
  }
  if (nodeIds.length === 0) {
    lines.push('  empty["gate 없음"]');
  }

  return lines.join('\n');
}

export function dkgFlowSchemas(opts: PageOptions): void {
  const graph = getGraph();
  const flows = listFlowSchemas(graph);
  const result = paginate(flows, opts);

  console.log(`\n══ Flow Schemas ══`);
  for (const flow of result.items) {
    console.log(
      `  ${flow.id.padEnd(20)} ${flow.name.padEnd(18)} version=${flow.version} gates=${flow.gateCount} core=${flow.coreGateCount} paths=${flow.totalPaths} axes=${flow.axisCount} prefixes=${flow.prefixCount}`,
    );
  }

  printPageInfo(result);
}

export function dkgFlowSchema(flowSchemaId: string): void {
  const graph = getGraph();
  const profile = getFlowSchemaProfile(graph, flowSchemaId);

  if (!profile) {
    console.error(`  flow-schema를 찾을 수 없음: ${flowSchemaId}`);
    return;
  }

  console.log(`\n══ Flow Schema: ${profile.id} ══`);
  console.log(`  name:       ${profile.name}`);
  console.log(`  version:    ${profile.version}`);
  console.log(`  gates:      ${profile.gateCount}`);
  console.log(`  totalPaths: ${profile.totalPaths}`);

  console.log(`\n  ── Core Gates (${profile.coreGateIds.length}) ──`);
  if (profile.coreGateIds.length === 0) {
    console.log('    없음');
  } else {
    console.log(`    ${profile.coreGateIds.join(', ')}`);
  }

  console.log(`\n  ── Gates (${profile.gates.length}) ──`);
  for (const gate of profile.gates) {
    const extras = [
      `phase=${gate.phase}`,
      `weight=${gate.weight}`,
      gate.subFlowId ? `subFlow=${gate.subFlowId}` : `branches=${gate.branchCount}`,
    ].join(' ');
    console.log(`    ${gate.id.padEnd(20)} ${gate.name} (${extras})`);
  }

  console.log(`\n  ── Related Axes ──`);
  console.log(`    direct:     ${profile.directAxisIds.join(', ') || '-'}`);
  console.log(`    transitive: ${profile.transitiveAxisIds.join(', ') || '-'}`);

  console.log(`\n  ── Related Prefixes ──`);
  console.log(`    direct:     ${profile.directPrefixIds.join(', ') || '-'}`);
  console.log(`    transitive: ${profile.transitivePrefixIds.join(', ') || '-'}`);

  console.log(`\n  ── Relations ──`);
  console.log(`    domains:    ${profile.domainIds.join(', ') || '-'}`);
  console.log(`    subFlows:   ${profile.subFlowIds.join(', ') || '-'}`);
}

// ── dkg impact ──────────────────────────────────────

/** 캐시된 DKG graph를 반환. cliImpact에 넘겨 이중 bootstrap 방지. */
export function getDkgGraph(): ReturnType<typeof getGraph> {
  return getGraph();
}

// ── dkg overlaps ────────────────────────────────────

export function dkgOverlaps(): void {
  const graph = getGraph();
  const entriesMap = buildEntriesMap();
  const overlaps = scanAxisOverlaps(graph, entriesMap);

  console.log(`\n══ Axis Overlaps ══`);
  if (overlaps.length === 0) {
    console.log('  중복 없음');
    return;
  }

  for (const o of overlaps) {
    const marker =
      o.recommendation === 'merge' ? '🔴' : o.recommendation === 'review' ? '🟡' : '🟢';
    console.log(
      `  ${marker} ${o.a} ↔ ${o.b}: [${o.sharedEntries.join(',')}] ${(o.overlapRatio * 100).toFixed(0)}% → ${o.recommendation}`,
    );
    console.log(`     ${o.reason}`);
  }
}

// ── dkg history — 스냅샷 히스토리 ─────────────────────

export function dkgHistory(opts: { limit?: number }): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(opts.limit ?? 10);

  console.log(`\n══ Usage 스냅샷 히스토리 (최근 ${recent.length}개) ══`);

  if (recent.length === 0) {
    console.log('  (스냅샷 없음. qa dkg collect로 수집 후 저장하세요.)');
    return;
  }

  for (const snap of recent) {
    console.log(`\n  #${snap.snapshotId} (${snap.collectedAt})`);

    // 배포 스큐
    const skews = analyzeDeploymentSkew(snap.versionUsages);
    for (const s of skews) {
      if (s.severity === 'ok') continue;
      const icon = s.severity === 'critical' ? '🔴' : '⚠';
      console.log(`    ${icon} ${s.summary}`);
    }

    // version 목록
    const byPrefix = new Map<string, string[]>();
    for (const vu of snap.versionUsages) {
      const list = byPrefix.get(vu.prefix) ?? [];
      list.push(`${vu.version}(${vu.count}건)`);
      byPrefix.set(vu.prefix, list);
    }
    for (const [prefix, versions] of byPrefix) {
      console.log(`    ${prefix}: ${versions.join(', ')}`);
    }
  }
}

// ── dkg audit-events — CLI lifecycle 감사 로그 ──────────

export function dkgAuditEvents(opts: {
  limit?: number;
  prefix?: string;
  command?: string;
  targetId?: string;
  lifecycleTo?: string;
  json?: boolean;
}): void {
  const store = getStore();
  const events = store.listRecentCliAuditEvents(opts.limit ?? 30, {
    ...(opts.prefix ? { eventPrefix: opts.prefix } : {}),
    ...(opts.command ? { command: opts.command } : {}),
    ...(opts.targetId ? { targetId: opts.targetId } : {}),
    ...(opts.lifecycleTo ? { lifecycleTo: opts.lifecycleTo } : {}),
  });

  if (opts.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  console.log(`\n══ CLI Audit Events (${events.length}건) ══`);
  if (events.length === 0) {
    console.log('  (없음)');
    return;
  }

  for (const event of events) {
    const prefix = event.eventPrefix ?? '-';
    const target = event.targetId ?? '-';
    const command = event.command ?? '-';
    const lifecycle =
      event.lifecycleFrom || event.lifecycleTo
        ? `${event.lifecycleFrom ?? '?'} → ${event.lifecycleTo ?? '?'}`
        : '-';
    console.log(`\n  #${event.id} ${event.timestamp}`);
    console.log(`    prefix=${prefix} command=${command}`);
    console.log(
      `    event=${event.eventKey}@${event.eventVersion} target=${target} kind=${event.targetKind ?? '-'}`,
    );
    console.log(`    lifecycle=${lifecycle}`);
    console.log(`    trace=${event.record.trace_id} session=${event.record.qa_session_id ?? '-'}`);
    if (event.record.address_context && Object.keys(event.record.address_context).length > 0) {
      console.log(`    address_context=${JSON.stringify(event.record.address_context)}`);
    }
    const payload =
      event.record.payload && typeof event.record.payload === 'object'
        ? JSON.stringify(event.record.payload)
        : String(event.record.payload ?? '');
    if (payload && payload !== 'undefined') {
      console.log(`    payload=${payload.slice(0, 240)}`);
    }
  }
}

// ── dkg export — JSON export ──────────────────────────

export function dkgExport(opts: { output?: string }): void {
  const store = getStore();
  const json = store.exportJson();

  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, json, 'utf-8');
    console.log(`  exported to ${opts.output}`);
  } else {
    console.log(json);
  }
}

// ── dkg import — JSON import ──────────────────────────

export function dkgImport(opts: { input: string }): void {
  const json = readFileSync(opts.input, 'utf-8');

  const store = getStore();
  const result = store.importJson(json);
  console.log(`  imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
}

// ── dkg decisions — 의사결정 백업/복원/조회 ───────────

export function dkgDecisionsExport(opts: { output?: string }): void {
  const store = getStore();
  const json = store.exportDecisions();
  const parsed = JSON.parse(json);

  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, json, 'utf-8');
    console.log(`  decisions exported to ${opts.output}`);
  } else {
    console.log(json);
  }

  console.log(
    `  summary: ${parsed.summary.decisions} decisions, ${parsed.summary.observations} observations, ${parsed.summary.versionEvents} version-events, ${parsed.summary.edges} edges`,
  );
}

export function dkgDecisionsImport(opts: { input: string }): void {
  const json = readFileSync(opts.input, 'utf-8');

  const store = getStore();
  const result = store.importDecisions(json);
  graphCache.delete(activeCatalogId);
  console.log(`  decisions imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
  console.log(`  (DKG 그래프 캐시 무효화됨. 다음 명령에서 자동 리로드)`);
}

export function dkgDecisionsList(opts: { limit?: number; kind?: string }): void {
  const store = getStore();
  const kinds = opts.kind ? [opts.kind] : ['decision', 'observation'];
  const rows = store.listRecentDecisions(opts.limit ?? 20, kinds);

  if (rows.length === 0) {
    console.log('\n  (의사결정/관측 기록 없음)');
    return;
  }

  console.log(`\n══ 최근 의사결정 (${rows.length}건) ══\n`);
  for (const r of rows) {
    const data = r.data as DecisionListData;
    const icon = r.kind === 'decision' ? '📋' : r.kind === 'observation' ? '👁' : '📦';
    const title = data.title ?? data.finding ?? r.id;
    const lifecycle = data.lifecycle ?? (data.resolution ? 'resolved' : 'open');
    console.log(`  ${icon} [${r.date.slice(0, 10)}] ${r.id}`);
    console.log(`     ${title}`);
    console.log(`     source=${r.source} lifecycle=${lifecycle}`);
  }
}

// ── dkg observations / dkg decisions / dkg constraints ──

export function dkgObservations(opts: PageOptions): void {
  const graph = getGraph();
  const observations = graph.getNodesByKind('observation');
  const result = paginate(observations, opts);

  console.log(`\n══ Observations (${observations.length}) ══`);
  for (const obs of result.items) {
    const status = obs.resolution ? `resolved(${obs.resolution.outcome})` : 'open';
    const icon = status.startsWith('resolved')
      ? '✅'
      : obs.intent === 'action-needed'
        ? '🔴'
        : '🟡';
    console.log(`  ${icon} ${obs.id}`);
    console.log(`     ${obs.finding}`);
    console.log(`     intent=${obs.intent ?? '?'} status=${status} source=${obs.source ?? '?'}`);
  }
  console.log(`\n  page ${result.page}/${result.totalPages} (total: ${observations.length})`);
}

export function dkgDecisions(opts: PageOptions): void {
  const graph = getGraph();
  const decisions = graph.getNodesByKind('decision');
  const result = paginate(decisions, opts);

  console.log(`\n══ Decisions (${decisions.length}) ══`);
  for (const dec of result.items) {
    const icon = dec.lifecycle === 'active' ? '📋' : dec.lifecycle === 'superseded' ? '📝' : '📦';
    console.log(`  ${icon} ${dec.id}`);
    console.log(`     ${dec.title}`);
    console.log(`     lifecycle=${dec.lifecycle ?? '?'}`);
  }
  console.log(`\n  page ${result.page}/${result.totalPages} (total: ${decisions.length})`);
}

export function dkgConstraints(_opts: PageOptions): void {
  const graph = getGraph();
  const constraints = graph.getNodesByKind('constraint');

  console.log(`\n══ Constraints (${constraints.length}) ══`);
  for (const c of constraints) {
    console.log(`  ${c.id}`);
    console.log(`     ${c.rule}`);
    if (c.scope?.length) console.log(`     targets: ${c.scope.join(', ')}`);
  }
}

// ── dkg refresh — bootstrap 재실행 → save ─────────────

export function dkgRefresh(): void {
  const store = getStore();

  // 0. 기존 manual 노드 수집 (resolved observation 보존용)
  const existingGraph = store.loadGraph();

  // 1. bootstrap 데이터만 삭제 (운영 데이터 보존)
  store.clearBootstrap();

  // 2. 새 bootstrap 그래프 생성 → 기존 그래프 전달 (resolved observation 재생성 방지)
  const graph = bootstrapDkg({ ...bootstrapOptions(), existingGraph });
  const saved = store.saveGraph(graph, 'bootstrap');
  store.setMeta('last_bootstrap', new Date().toISOString());

  // 3. 통계 조회
  const stats = store.stats();
  console.log(
    `  refreshed: ${saved.nodesWritten} bootstrap nodes, ${saved.edgesWritten} bootstrap edges`,
  );
  console.log(`  보존: ${stats.manualNodes} manual nodes, ${stats.manualEdges} manual edges`);
  console.log(`  합계: ${stats.nodes} nodes, ${stats.edges} edges`);
}

// ── dkg skew — 배포 스큐 상세 ─────────────────────────

export function dkgSkew(): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(1);

  if (recent.length === 0 || recent[0].versionUsages.length === 0) {
    console.log('\n  (스냅샷 없음. 이벤트 수집 후 실행하세요.)');
    return;
  }

  const skews = analyzeDeploymentSkew(recent[0].versionUsages);

  console.log(`\n══ 배포 스큐 (최근 스냅샷: ${recent[0].collectedAt}) ══`);

  for (const s of skews) {
    const icon = s.severity === 'ok' ? '✅' : s.severity === 'warning' ? '⚠' : '🔴';
    console.log(`\n  ${icon} ${s.prefix}`);
    console.log(`     latest: ${s.latestVersion}`);
    for (const v of s.activeVersions) {
      console.log(`     ${v.version}: ${v.count}건 [${v.sessions.join(', ')}]`);
    }
    if (s.staleConsumers.length > 0) {
      console.log('     구버전 서비스:');
      for (const sc of s.staleConsumers) {
        console.log(`       → ${sc.session}: ${sc.version} (${sc.count}건)`);
      }
    }
  }
}

// ── dkg coverage ──────────────────────────────────

export function dkgCoverage(): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(1);

  if (recent.length === 0) {
    console.log('\n  (스냅샷 없음. 이벤트 수집 후 실행하세요.)');
    return;
  }

  // prefix category별 분류
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const specMap = new Map(specs.map((s) => [s.id, s]));

  console.log(`\n══ Entry 관측 커버리지 (스냅샷: ${recent[0].collectedAt}) ══`);

  const byCategory = new Map<string, string[]>();
  for (const [id] of Object.entries(DEMO_CATALOG.prefixes)) {
    const cat = specMap.get(id)?.schema?.category ?? 'entity';
    const list = byCategory.get(cat) ?? [];
    list.push(id);
    byCategory.set(cat, list);
  }

  for (const [cat, prefixIds] of byCategory) {
    console.log(`\n  [${cat}]`);
    for (const id of prefixIds) {
      console.log(`    ${id.padEnd(17)} (coverage 분석은 이벤트 데이터 필요)`);
    }
  }

  console.log(
    `\n  total: ${Object.keys(DEMO_CATALOG.prefixes).length} prefixes, ${Object.keys(DEMO_CATALOG.axes).length} axes`,
  );
}

// ── dkg skills ────────────────────────────────────

export function dkgSkills(filter?: string): void {
  const graph = getGraph();
  const skillNodes = graph.getNodesByKind('skill');

  if (skillNodes.length === 0) {
    console.log('\n  (skill 노드 없음. dkg refresh로 재부트스트랩하세요.)');
    return;
  }

  // 필터 적용: 카테고리, 키워드, DSL/domain 검색
  const filtered = filter
    ? skillNodes.filter((s) => {
        const f = filter.toLowerCase();
        return (
          s.category === f ||
          s.id.toLowerCase().includes(f) ||
          s.name.toLowerCase().includes(f) ||
          (s.specialization?.dslBundles ?? []).some((d: string) => d.toLowerCase().includes(f)) ||
          (s.specialization?.domains ?? []).some((d: string) => d.toLowerCase().includes(f)) ||
          (s.specialization?.prefixes ?? []).some((p: string) => p.toLowerCase().includes(f))
        );
      })
    : skillNodes;

  // category별 그룹핑
  const byCategory = new Map<string, typeof skillNodes>();
  for (const s of filtered) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const label = filter ? ` (필터: "${filter}")` : '';
  console.log(`\n══ DKG Skills (${filtered.length}/${skillNodes.length}개${label}) ══`);

  if (filtered.length === 0) {
    console.log(`\n  "${filter}"와 일치하는 skill 없음`);
    console.log(`  카테고리: read, write, analysis, chain`);
    console.log(`  키워드: domain 이름, DSL 이름, prefix 이름으로 검색 가능`);
    return;
  }

  for (const [cat, skills] of byCategory) {
    console.log(`\n  [${cat}]`);
    for (const s of skills) {
      const deps = s.depends?.length ? ` depends=[${s.depends.join(',')}]` : '';
      console.log(`    ${s.id.padEnd(30)} ${s.name}`);
      console.log(`      ${s.description.slice(0, 90)}`);
      console.log(`      input: ${s.input} → output: ${s.output}${deps}`);
      // specialization 상세
      const spec = s.specialization;
      if (spec) {
        const parts: string[] = [];
        if (spec.dslBundles?.length) parts.push(`DSL: ${spec.dslBundles.join(',')}`);
        if (spec.domains?.length) parts.push(`domain: ${spec.domains.join(',')}`);
        if (spec.prefixes?.length) parts.push(`prefix: ${spec.prefixes.join(',')}`);
        if (spec.constraints?.length) parts.push(`제약: ${spec.constraints.join(',')}`);
        if (spec.intentLinks?.length) parts.push(`intent: ${spec.intentLinks.join(',')}`);
        if (spec.invariants?.length) parts.push(`invariant: ${spec.invariants.length}개`);
        console.log(`      소비: ${parts.join(' | ')}`);
      }
    }
  }

  if (!filter) {
    console.log(
      `\n  필터: dkg skills <카테고리|키워드>  예: dkg skills chain, dkg skills checkout`,
    );
  }
}

// ── dkg transitions ────────────────────────────────

export function dkgTransitions(specId?: string): void {
  const graph = getGraph();
  const tspecs = graph.getNodesByKind('transition-spec');

  if (tspecs.length === 0) {
    console.log('\n  (transition-spec 노드 없음. dkg refresh로 재부트스트랩하세요.)');
    return;
  }

  // 상세 조회
  if (specId) {
    const node = tspecs.find((t) => t.id === specId || t.transition === specId);
    if (!node) {
      console.log(`\n  transition-spec을 찾을 수 없음: ${specId}`);
      console.log(`  등록된 spec: ${tspecs.map((t) => t.transition).join(', ')}`);
      return;
    }

    console.log(`\n══ Transition: ${node.transition} (${node.version}) ══`);
    console.log(`  id:     ${node.id}`);
    console.log(`  effect: ${node.effectKind}`);
    console.log(`  match:  ${node.matchMode} (${node.coordinateCount}개 좌표)`);

    console.log(`\n  ── 축 참조 (역할별) ──`);
    console.log(`    match:  ${node.matchAxes.join(', ') || '(없음)'}`);
    console.log(`    input:  ${node.inputAxes.join(', ') || '(없음)'}`);
    console.log(`    output: ${node.outputAxes.join(', ') || '(없음)'}`);

    // 상태 의존성 탐색 기반: output→input 교차
    const otherSpecs = tspecs.filter((t) => t.id !== node.id);
    const produces = new Set(node.outputAxes);
    const requires = new Set(node.inputAxes);

    const dependsOn: string[] = []; // 이 spec의 input을 다른 spec이 output으로 만드는 경우
    const blocksFor: string[] = []; // 이 spec의 output을 다른 spec이 input으로 요구하는 경우

    for (const other of otherSpecs) {
      const otherProduces = new Set(other.outputAxes);
      const otherRequires = new Set(other.inputAxes);

      const inputOverlap = [...requires].filter((a) => otherProduces.has(a));
      if (inputOverlap.length > 0) {
        dependsOn.push(`${other.transition} (via ${inputOverlap.join(',')})`);
      }

      const outputOverlap = [...produces].filter((a) => otherRequires.has(a));
      if (outputOverlap.length > 0) {
        blocksFor.push(`${other.transition} (via ${outputOverlap.join(',')})`);
      }
    }

    if (dependsOn.length > 0 || blocksFor.length > 0) {
      console.log(`\n  ── 상태 의존성 ──`);
      if (dependsOn.length > 0) {
        console.log(`    선행 필요: ${dependsOn.join(', ')}`);
      }
      if (blocksFor.length > 0) {
        console.log(`    후속 가능: ${blocksFor.join(', ')}`);
      }
    }

    // DKG consumes 엣지
    const consumesEdges = graph.edgesFrom(node.id, 'consumes');
    if (consumesEdges.length > 0) {
      console.log(`\n  ── DKG consumes (${consumesEdges.length}개 축) ──`);
      for (const e of consumesEdges) {
        const target = graph.getNode(e.to);
        console.log(`    → ${e.to} [${target?.kind ?? '?'}]`);
      }
    }

    return;
  }

  // 목록 조회
  console.log(`\n══ Transition Specs (${tspecs.length}개) ══`);

  // effect별 그룹핑
  const byEffect = new Map<string, typeof tspecs>();
  for (const t of tspecs) {
    const list = byEffect.get(t.effectKind) ?? [];
    list.push(t);
    byEffect.set(t.effectKind, list);
  }

  for (const [effect, specs] of byEffect) {
    console.log(`\n  [${effect}]`);
    for (const t of specs) {
      console.log(
        `    ${t.transition.padEnd(25)} ${t.matchMode}(${t.coordinateCount}) → match:${t.matchAxes.length} input:${t.inputAxes.length} output:${t.outputAxes.length}`,
      );
    }
  }

  // 축 사용 빈도 요약
  const axisFreq = new Map<string, { match: number; input: number; output: number }>();
  for (const t of tspecs) {
    for (const a of t.matchAxes) {
      const f = axisFreq.get(a) ?? { match: 0, input: 0, output: 0 };
      f.match++;
      axisFreq.set(a, f);
    }
    for (const a of t.inputAxes) {
      const f = axisFreq.get(a) ?? { match: 0, input: 0, output: 0 };
      f.input++;
      axisFreq.set(a, f);
    }
    for (const a of t.outputAxes) {
      const f = axisFreq.get(a) ?? { match: 0, input: 0, output: 0 };
      f.output++;
      axisFreq.set(a, f);
    }
  }

  console.log(`\n  ── 축 사용 빈도 ──`);
  const sorted = [...axisFreq.entries()].toSorted((a, b) => {
    const totalA = a[1].match + a[1].input + a[1].output;
    const totalB = b[1].match + b[1].input + b[1].output;
    return totalB - totalA;
  });
  for (const [axis, freq] of sorted) {
    const parts: string[] = [];
    if (freq.match > 0) parts.push(`match:${freq.match}`);
    if (freq.input > 0) parts.push(`input:${freq.input}`);
    if (freq.output > 0) parts.push(`output:${freq.output}`);
    console.log(`    ${axis.padEnd(20)} ${parts.join(' ')}`);
  }
}

// ── dkg transition coverage/orphans/violations ────

export function dkgTransitionAnalysis(subcommand: string): void {
  const graph = getGraph();
  const tspecs = graph.getNodesByKind('transition-spec');

  if (tspecs.length === 0) {
    console.log('\n  (transition-spec 노드 없음)');
    return;
  }

  switch (subcommand) {
    case 'coverage': {
      console.log(`\n══ Transition Coverage ══`);
      console.log(`  정의된 spec: ${tspecs.length}개`);
      // effect 분포
      const byEffect = new Map<string, number>();
      for (const t of tspecs) {
        byEffect.set(t.effectKind, (byEffect.get(t.effectKind) ?? 0) + 1);
      }
      console.log(`  effect 분포:`);
      for (const [effect, count] of byEffect) {
        console.log(`    ${effect}: ${count}개`);
      }
      // 축 커버리지: 전체 축 중 transition이 참조하는 축 비율
      const allAxes = new Set(graph.getNodesByKind('axis').map((a) => a.id));
      const referencedAxes = new Set(tspecs.flatMap((t) => [...t.slotRefs]));
      const covered = [...referencedAxes].filter((a) => allAxes.has(a));
      console.log(
        `  축 커버리지: ${covered.length}/${allAxes.size} (${((covered.length / allAxes.size) * 100).toFixed(0)}%)`,
      );
      console.log(`  미참조 축: ${[...allAxes].filter((a) => !referencedAxes.has(a)).length}개`);
      break;
    }
    case 'orphans': {
      console.log(`\n══ Orphan Analysis ══`);
      // transition이 참조하지 않는 prefix (transition 관점에서 orphan)
      const prefixes = graph.getNodesByKind('prefix');
      const tspecAxes = new Set(tspecs.flatMap((t) => Array.from(t.matchAxes)));
      const orphanPrefixes = prefixes.filter((p) => {
        const composes = graph.edgesFrom(p.id, 'composes');
        const prefixAxes = composes.filter((e) => e.meta?.dimKind === 'axis').map((e) => e.to);
        return prefixAxes.length > 0 && !prefixAxes.some((a) => tspecAxes.has(a));
      });
      console.log(`  transition이 관찰하지 않는 prefix: ${orphanPrefixes.length}개`);
      for (const p of orphanPrefixes.slice(0, 10)) {
        console.log(`    ${p.id}`);
      }
      if (orphanPrefixes.length > 10) console.log(`    ... 외 ${orphanPrefixes.length - 10}개`);
      break;
    }
    case 'violations': {
      console.log(`\n══ Violation Summary ══`);
      // DKG에서 transition observation 조회
      const observations = graph.getNodesByKind('observation');
      const transObs = observations.filter((o) => o.id?.startsWith('OBS-TRANSITION-'));
      if (transObs.length === 0) {
        console.log('  기록된 전이 위반 없음');
      } else {
        console.log(`  전이 위반 observation: ${transObs.length}개`);
        for (const obs of transObs) {
          console.log(`    ${obs.id}: ${obs.finding}`);
        }
      }
      // constraint 상태
      const effectConstraint = graph.getNode('CON-EFFECT-VOCAB');
      if (effectConstraint && effectConstraint.kind === 'constraint') {
        const con = effectConstraint as ConstraintNode;
        console.log(`\n  CON-EFFECT-VOCAB: ${con.lifecycle} — ${con.rule?.slice(0, 80)}`);
      }
      break;
    }
    default:
      console.log(`  알 수 없는 서브커맨드: ${subcommand}`);
      console.log('  사용법: dkg transition coverage | orphans | violations');
  }
}

// ── dkg audit ─────────────────────────────────────

export function dkgAudit(): void {
  const graph = getGraph();

  console.log('\n══ DKG Audit ══');

  // 1. Observation 리포트
  const observations = graph.getNodesByKind('observation');
  console.log(`\n  Observations: ${observations.length}개`);
  for (const obs of observations) {
    const icon = obs.suggestion ? '⚠' : 'ℹ';
    console.log(`    ${icon} ${obs.id}`);
    console.log(`      ${obs.finding}`);
    // prompts → Decision 연결
    const prompted = graph.neighbors(obs.id, 'prompts');
    if (prompted.length > 0) {
      console.log(`      → Decision: ${prompted.join(', ')}`);
    }
  }

  // 2. Decision 리포트
  const decisions = graph.getNodesByKind('decision');
  console.log(`\n  Decisions: ${decisions.length}개`);
  for (const dec of decisions) {
    const governed = graph.neighbors(dec.id, 'governs');
    const justified = graph.neighbors(dec.id, 'justifies');
    const targets = [...governed, ...justified];
    console.log(`    ${dec.id}: ${dec.title}`);
    if (targets.length > 0) {
      console.log(`      → 대상: ${targets.join(', ')}`);
    }
    if (dec.alternatives && dec.alternatives.length > 0) {
      console.log(`      → 대안: ${dec.alternatives.length}개`);
    }
  }

  // 3. Constraint 위반 체크
  const constraints = graph.getNodesByKind('constraint');
  console.log(`\n  Constraints: ${constraints.length}개`);
  for (const con of constraints) {
    const icon = con.lifecycle === 'active' ? '✅' : '⏸';
    console.log(`    ${icon} ${con.id}: ${con.rule}`);
  }

  // 4. DSL 커버리지
  const dslBundles = graph.getNodesByKind('dsl-bundle');
  console.log(`\n  DSL Bundles: ${dslBundles.length}개`);
  for (const bundle of dslBundles) {
    const contains = graph.edgesFrom(bundle.id, 'contains');
    console.log(`    ${bundle.id}: [${contains.map((e) => e.to).join(',')}]`);
  }

  // 5. IntentLink invariant
  const links = graph.getNodesByKind('intent-link');
  console.log(`\n  IntentLinks: ${links.length}개`);
  for (const link of links) {
    console.log(`    ${link.id}: ${link.intent}`);
    if (link.invariant) console.log(`      invariant: ${link.invariant}`);
  }

  // 6. 축 사용 분석 (prefix dims + TransitionSpec)
  {
    // TransitionSpec에서 축 참조 수집
    const tSpecNodes = graph.getNodesByKind('transition-spec') as TransitionSpecNode[];
    const transitionAxes = tSpecNodes.map((n) => ({
      transition: n.transition,
      matchAxes: n.matchAxes ?? [],
      inputAxes: n.inputAxes ?? [],
      outputAxes: n.outputAxes ?? [],
    }));
    const entries = collectAxisUsage(DEMO_CATALOG, { transitionAxes });
    const summary = summarizeAxisUsage(entries);
    const unused = findUnusedAxes(DEMO_CATALOG, entries);

    console.log(`\n  ── Axis Usage (${summary.length} axes used) ──`);
    // source별 집계
    const sourceTotals: Record<string, number> = {};
    for (const e of entries) sourceTotals[e.source] = (sourceTotals[e.source] ?? 0) + 1;
    for (const [src, cnt] of Object.entries(sourceTotals)) {
      console.log(`    ${src}: ${cnt}건`);
    }

    if (unused.length > 0) {
      console.log(`\n  ⚠ 미사용 축 (${unused.length}): ${unused.join(', ')}`);
    } else {
      console.log(`\n  ✅ 전체 ${Object.keys(DEMO_CATALOG.axes).length}개 축 사용 확인`);
    }
  }

  // 7. 종합
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const byCategory = new Map<string, number>();
  for (const s of specs) {
    const cat = s.schema?.category ?? 'entity';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }

  console.log(`\n  ── 종합 ──`);
  console.log(`  ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);
  console.log(
    `  ${Object.keys(DEMO_CATALOG.axes).length} axes, ${Object.keys(DEMO_CATALOG.prefixes).length} prefixes`,
  );
  console.log(`  category: ${[...byCategory.entries()].map(([c, n]) => `${c}=${n}`).join(', ')}`);
}

// ── dkg service ─────────────────────────────────────

export function dkgService(serviceId?: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  if (!serviceId) {
    // 목록 모드
    const services = topo.listServices();
    console.log(`\n══ Services (${services.length}) ══`);
    for (const svc of services) {
      const owned = svc.ownedPrefixes.length;
      const consumed = svc.consumedPrefixes.length;
      const icon = svc.status === 'active' ? '✅' : svc.status === 'draining' ? '⏸' : '❌';
      console.log(
        `  ${icon} ${svc.serviceId.padEnd(20)} ${svc.name.padEnd(12)} team=${svc.team ?? '-'} owned=${owned} consumed=${consumed}`,
      );
    }
    return;
  }

  // 프로파일 모드
  const profile = exploreService(graph, topo, DEMO_CATALOG, serviceId);
  if (!profile) {
    console.error(`  서비스를 찾을 수 없음: ${serviceId}`);
    return;
  }

  console.log(`\n══ Service: ${profile.serviceId} ══`);
  console.log(`  name:   ${profile.name}`);
  console.log(`  team:   ${profile.team ?? '-'}`);
  console.log(`  status: ${profile.status}`);

  // owned prefixes
  console.log(`\n  ── Owned Prefixes (${profile.ownedPrefixes.length}) ──`);
  for (const p of profile.ownedPrefixes) {
    const hr = p.minHeadroom ? ` headroom=${p.minHeadroom.headroom}(${p.minHeadroom.axis})` : '';
    console.log(`    ${p.id.padEnd(17)} [${p.category}] dims=${p.dimCount}${hr}`);
  }

  // consumed prefixes
  console.log(`\n  ── Consumed Prefixes (${profile.consumedPrefixes.length}) ──`);
  for (const p of profile.consumedPrefixes) {
    const contract = p.contract ? ` via ${p.contract}` : '';
    console.log(`    ${p.id.padEnd(17)}${contract}`);
  }

  // contracts
  if (profile.contracts.length > 0) {
    console.log(`\n  ── Contracts (${profile.contracts.length}) ──`);
    for (const c of profile.contracts) {
      const role = c.provider === serviceId ? 'provider' : 'consumer';
      console.log(
        `    ${c.id.padEnd(17)} [${role}] prefix=${c.prefixId} stable=${c.stableVersion}`,
      );
    }
  }

  // DSL bindings
  if (profile.dslBindings.length > 0) {
    console.log(`\n  ── DSL Bindings ──`);
    console.log(`    ${profile.dslBindings.join(', ')}`);
  }

  // dependencies
  if (profile.dependencies.length > 0) {
    console.log(`\n  ── Dependencies (${profile.dependencies.length}) ──`);
    for (const d of profile.dependencies) {
      const arrow = d.direction === 'depends-on' ? '→' : '←';
      console.log(`    ${arrow} ${d.serviceId} via [${d.via.join(', ')}]`);
    }
  }

  // observations
  if (profile.observations.length > 0) {
    console.log(`\n  ── Observations (${profile.observations.length}) ──`);
    for (const o of profile.observations) {
      console.log(`    ${o.id}: ${o.finding.slice(0, 70)}`);
    }
  }

  // decisions
  if (profile.decisions.length > 0) {
    console.log(`\n  ── Decisions (${profile.decisions.length}) ──`);
    for (const d of profile.decisions) {
      console.log(`    ${d.id}: ${d.title}`);
    }
  }
}

// ── dkg prefix (exploration) ────────────────────────

export function dkgPrefix(prefixId: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const profile = explorePrefix(graph, topo, DEMO_CATALOG, prefixId);
  if (!profile) {
    console.error(`  prefix를 찾을 수 없음: ${prefixId}`);
    return;
  }

  console.log(`\n══ Prefix: ${profile.id} ══`);
  console.log(`  name:      ${profile.name}`);
  console.log(`  category:  ${profile.category}`);
  console.log(`  lifecycle: ${profile.lifecycle}`);
  console.log(`  owner:     ${profile.owner ?? '-'}`);

  // dimensions
  console.log(`\n  ── Dimensions (${profile.dimensions.length}) ──`);
  for (const d of profile.dimensions) {
    console.log(`    ${d.label.padEnd(17)} [${d.kind}] → ${d.ref}`);
  }

  // headroom
  if (profile.headroom.length > 0) {
    console.log(`\n  ── Axis Headroom ──`);
    for (const h of profile.headroom) {
      const bar = h.headroom === 0 ? ' ⚠' : '';
      console.log(
        `    ${h.axisId.padEnd(17)} entries=${h.entries} cap=${h.capacity} headroom=${h.headroom}${bar}`,
      );
    }
  }

  // consumers
  if (profile.consumers.length > 0) {
    console.log(`\n  ── Consumers ──`);
    console.log(`    ${profile.consumers.join(', ')}`);
  }

  // domains + DSL bundles
  if (profile.domains.length > 0) {
    console.log(`\n  ── Domains ──`);
    console.log(`    ${profile.domains.join(', ')}`);
  }
  if (profile.dslBundles.length > 0) {
    console.log(`\n  ── DSL Bundles ──`);
    console.log(`    ${profile.dslBundles.join(', ')}`);
  }

  // constraints
  if (profile.constraints.length > 0) {
    console.log(`\n  ── Constraints (${profile.constraints.length}) ──`);
    for (const c of profile.constraints) {
      console.log(`    ${c.id}: ${c.rule}`);
    }
  }

  // observations
  if (profile.observations.length > 0) {
    console.log(`\n  ── Observations (${profile.observations.length}) ──`);
    for (const o of profile.observations) {
      console.log(`    ${o.id}: ${o.finding.slice(0, 70)}`);
    }
  }

  // decisions
  if (profile.decisions.length > 0) {
    console.log(`\n  ── Decisions (${profile.decisions.length}) ──`);
    for (const d of profile.decisions) {
      console.log(`    ${d.id}: ${d.title}`);
    }
  }

  // intent-links
  if (profile.intentLinks.length > 0) {
    console.log(`\n  ── Intent Links (${profile.intentLinks.length}) ──`);
    for (const l of profile.intentLinks) {
      console.log(`    ${l.id}: ${l.intent.slice(0, 70)}`);
    }
  }

  // definition-catalog 문서 연결
  const specRelPath = `docs/specs/prefix-catalog/prefix-${prefixId}.spec.md`;
  try {
    const repoRoot = execaSync('git', ['rev-parse', '--show-toplevel']).stdout.trim();
    const specAbsPath = join(repoRoot, specRelPath);
    if (existsSync(specAbsPath)) {
      console.log(`\n  ── Spec Document ──`);
      console.log(`    ${specRelPath}`);
    }
  } catch {
    /* git 밖에서 실행 시 무시 */
  }
}

// ── dkg tables / dkg table ───────────────────────────

export function dkgTables(): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const tables = graph.getNodesByKind('table');
  if (tables.length === 0) {
    console.log('\n  테이블 노드 없음 (catalog에 tables 섹션이 정의되지 않음)');
    return;
  }

  console.log(`\n══ Tables (${tables.length}) ══`);
  for (const t of tables) {
    const prefixes = graph.getPrefixesForTable(t.id);
    const services = topo.getServicesForTable(t.id, graph);
    const uniqueServices = [...new Set(services.map((s) => s.serviceId))];
    const colRefs = graph.getTableColumnRefs(t.id);
    const fkCount = colRefs.filter((r) => r.refKind === 'fk').length;
    const axisCount = colRefs.filter((r) => r.refKind === 'column_axis').length;

    console.log(
      `  ${t.id.padEnd(14)} cols=${t.columns.length} prefixes=${prefixes.length} services=${uniqueServices.length} fk=${fkCount} axis_ref=${axisCount}`,
    );
  }
}

export function dkgTable(tableId: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const node = graph.getNode(tableId);
  if (!node || node.kind !== 'table') {
    console.error(`  테이블을 찾을 수 없음: ${tableId}`);
    return;
  }

  const tableNode = node as TableNode;
  console.log(`\n══ Table: ${tableNode.id} ══`);
  console.log(`  name:    ${tableNode.name}`);
  console.log(`  columns: ${tableNode.columns.join(', ')}`);

  // 컬럼 참조 상세
  const colRefs = graph.getTableColumnRefs(tableId);
  const kindLabels: Record<string, string> = {
    column_axis: 'axis',
    fk: 'FK',
    prefix_ref: 'prefix',
  };
  if (colRefs.length > 0) {
    console.log(`\n  ── Column References (${colRefs.length}) ──`);
    for (const ref of colRefs) {
      const kindLabel = kindLabels[ref.refKind] ?? ref.refKind;
      console.log(`    ${ref.column.padEnd(16)} → ${ref.targetId} [${kindLabel}]`);
    }
  }

  // 이 테이블을 참조하는 prefix (table_ref dim)
  const prefixes = graph.getPrefixesForTable(tableId);
  if (prefixes.length > 0) {
    console.log(`\n  ── Referencing Prefixes (${prefixes.length}) ──`);
    for (const p of prefixes) {
      const owner = topo.getOwner(p.prefixId);
      console.log(`    ${p.prefixId.padEnd(17)} dim="${p.dimLabel}" owner=${owner ?? '-'}`);
    }
  }

  // 이 테이블을 FK로 참조하는 다른 테이블
  const cascade = graph.cascadeFromTable(tableId);
  if (cascade.referencingTables.length > 0) {
    console.log(`\n  ── Referencing Tables (FK) (${cascade.referencingTables.length}) ──`);
    for (const rt of cascade.referencingTables) {
      console.log(`    ${rt.id.padEnd(14)} via column "${rt.column}"`);
    }
  }

  // 접근하는 서비스
  const services = topo.getServicesForTable(tableId, graph);
  if (services.length > 0) {
    console.log(`\n  ── Accessing Services (${services.length}) ──`);
    for (const s of services) {
      console.log(`    ${s.serviceId.padEnd(20)} via ${s.via} [${s.role}]`);
    }
  }

  // impact summary
  if (cascade.prefixes.length > 0 || services.length > 0) {
    console.log(`\n  ── Impact Summary ──`);
    console.log(`    이 테이블 변경 시:`);
    console.log(
      `      영향 prefix: ${cascade.prefixes.map((p) => p.prefixId).join(', ') || '없음'}`,
    );
    console.log(
      `      영향 service: ${[...new Set(services.map((s) => s.serviceId))].join(', ') || '없음'}`,
    );
    if (cascade.referencingTables.length > 0) {
      console.log(`      FK 참조 테이블: ${cascade.referencingTables.map((t) => t.id).join(', ')}`);
    }
  }
}

// ── dkg scan-tables ─────────────────────────────────

export function dkgScanTables(): void {
  // Known DB tables from schema files (manually maintained, but centralized here)
  const KNOWN_DB_TABLES = [
    // store (PostgreSQL)
    'qa_sessions',
    'traces',
    'event_records',
    'transmissions',
    'runtime_graphs',
    'scenario_specs',
    'verdict_reports',
    'dead_letter_queue',
    // index-meta (SQLite)
    'prefix_registry',
    'prefix_ref',
    'prefix_route',
    'schema_version',
    'version_lifecycle',
    'entry',
    'entry_flag',
    'migration_mapping',
    'address_state_cache',
    'address_range_cache',
    // registry-service (SQLite)
    'prefix',
    'draft_lock',
    'axis_profile',
    'catalogs',
    // query-service (SQLite)
    'policy_rule',
    // spec-core DKG (SQLite)
    'dkg_nodes',
    'dkg_edges',
    'usage_snapshots',
    'version_usages',
    'dkg_meta',
    'transition_state',
    // platform-demo-api (SQLite)
    'grants',
    'logs',
  ];

  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;
  const catalogTables = Object.values(catalog.tables ?? {}).map((t) => t.table);

  const registered = new Set(catalogTables);
  const known = new Set(KNOWN_DB_TABLES);

  // Tables in DB but not in catalog
  const missing = KNOWN_DB_TABLES.filter((t) => !registered.has(t));
  // Tables in catalog but not in known DB list
  const extra = catalogTables.filter((t) => !known.has(t));
  // Tables in both
  const matched = catalogTables.filter((t) => known.has(t));

  console.log(`\n══ Table Drift Scan ══`);
  console.log(`  DB tables:      ${KNOWN_DB_TABLES.length}`);
  console.log(`  Catalog tables: ${catalogTables.length}`);
  console.log(`  Matched:        ${matched.length}`);

  if (missing.length > 0) {
    console.log(`\n  ── 미등록 (DB에 있지만 catalog에 없음: ${missing.length}) ──`);
    for (const t of missing) {
      console.log(`    ${t}`);
    }
  }

  if (extra.length > 0) {
    console.log(`\n  ── 불일치 (catalog에 있지만 DB에 없음: ${extra.length}) ──`);
    for (const t of extra) {
      console.log(`    ${t}`);
    }
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`\n  드리프트 없음`);
  }
}

// ── dkg dsl ─────────────────────────────────────────

export function dkgDsl(dslId?: string): void {
  const graph = getGraph();

  if (!dslId) {
    // 목록 모드
    const bundles = graph.getNodesByKind('dsl-bundle');
    console.log(`\n══ DSL Bundles (${bundles.length}) ══`);
    for (const b of bundles) {
      const members = graph.neighbors(b.id, 'contains');
      console.log(
        `  ${b.id.padEnd(22)} ${b.name.padEnd(14)} members=${members.length} binding=${b.serviceBindingPrefix}`,
      );
    }
    return;
  }

  // 프로파일 모드
  const profile = exploreDsl(graph, DEMO_CATALOG, dslId);
  if (!profile) {
    console.error(`  DSL을 찾을 수 없음: ${dslId}`);
    return;
  }

  console.log(`\n══ DSL: ${profile.id} ══`);
  console.log(`  name:        ${profile.name}`);
  console.log(`  description: ${profile.description}`);

  // members
  console.log(`\n  ── Members (${profile.members.length}) ──`);
  for (const m of profile.members) {
    const ref = m.svcRefLabel ? ` svcRef=${m.svcRefLabel}` : '';
    console.log(`    ${m.prefixId.padEnd(17)} [${m.role}]${ref}`);
  }

  // service binding
  console.log(`\n  ── Service Binding ──`);
  console.log(`    prefix:    ${profile.serviceBinding.prefixId}`);
  console.log(`    fixedDims: ${profile.serviceBinding.fixedDims.join(', ')}`);

  // invariants
  if (profile.invariants.length > 0) {
    console.log(`\n  ── Invariants (${profile.invariants.length}) ──`);
    for (const inv of profile.invariants) {
      console.log(`    - ${inv}`);
    }
  }

  // version skew
  const sk = profile.versionSkew;
  const skIcon = sk.severity === 'ok' ? '✅' : sk.severity === 'minor' ? '⚠' : '🔴';
  console.log(`\n  ── Version Skew ──`);
  console.log(`    ${skIcon} ${sk.summary}`);
  if (sk.axisConflicts.length > 0) {
    for (const c of sk.axisConflicts) {
      console.log(`      ${c.axisId}: spread=${c.spread}`);
    }
  }
}

// ── dkg overview ────────────────────────────────────

export function dkgOverview(): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const overview = systemOverview(graph, topo, DEMO_CATALOG);

  console.log(`\n══ System Overview ══`);
  console.log(`  nodes: ${overview.nodeCount}, edges: ${overview.edgeCount}`);

  // services
  console.log(`\n  ── Services (${overview.services.length}) ──`);
  for (const svc of overview.services) {
    const icon = svc.status === 'active' ? '✅' : '⏸';
    console.log(
      `    ${icon} ${svc.serviceId.padEnd(20)} owned=${svc.ownedCount} consumed=${svc.consumedCount}`,
    );
  }

  // dependency graph
  const dg = overview.dependencyGraph;
  console.log(`\n  ── Dependency Graph ──`);
  console.log(`    edges: ${dg.edgeCount}, maxDepth: ${dg.maxDepth}`);
  console.log(`    roots:  ${dg.roots.join(', ') || '-'}`);
  console.log(`    leaves: ${dg.leaves.join(', ') || '-'}`);
  if (dg.cycles.length > 0) {
    console.log(`    ⚠ cycles: ${dg.cycles.map((c) => c.join('→')).join('; ')}`);
  }

  // domain health
  console.log(`\n  ── Domain Health ──`);
  for (const dh of overview.domainHealth) {
    const icon = dh.health === 'healthy' ? '✅' : dh.health === 'warning' ? '⚠' : '🔴';
    console.log(`    ${icon} ${dh.domainId.padEnd(22)} issues=${dh.issueCount}`);
  }

  // hot spots
  if (overview.hotSpots.length > 0) {
    console.log(`\n  ── Hot Spots (${overview.hotSpots.length}) ──`);
    for (const hs of overview.hotSpots) {
      const icon =
        hs.type === 'headroom-zero' ? '🔴' : hs.type === 'constraint-violation' ? '⚠' : 'ℹ';
      console.log(`    ${icon} [${hs.type}] ${hs.target}: ${hs.detail.slice(0, 60)}`);
    }
  }
}

// ── dkg trace ───────────────────────────────────────

export function dkgTrace(nodeId: string): void {
  const graph = getGraph();
  const store = getStore();
  const topo = createDemoTopology();

  const result = traceNode(graph, DEMO_CATALOG, nodeId, {
    topo,
    getClaim: (id) => {
      const raw = store.getMeta(`claim:${id}`);
      return raw ? JSON.parse(raw) : null;
    },
  });

  if (!result) {
    console.error(`  노드를 찾을 수 없음: ${nodeId}`);
    console.log(`\n  trace는 DKG 그래프의 노드 ID를 직접 받습니다.`);
    console.log(`  노드 ID 확인 방법:`);
    console.log(`    qa-sdk dkg prefixes     prefix 노드 ID 목록`);
    console.log(`    qa-sdk dkg axes         axis 노드 ID 목록`);
    console.log(`    qa-sdk dkg domains      domain 노드 ID 목록`);
    console.log(`    qa-sdk dkg service      service 노드 ID 목록`);
    console.log(`    qa-sdk dkg dsl          DSL 번들 노드 ID 목록`);
    console.log(`    qa-sdk dkg decisions list  decision 노드 ID 목록`);
    return;
  }

  console.log(`\n═══ Trace: ${result.id} [${result.kind}] ═══`);
  console.log(`  name: ${result.name}`);

  // claim
  if (result.claim) {
    console.log(`  ⚠ 작업중: ${result.claim.by} (${result.claim.at})`);
  }

  // kind-specific details — DkgNodeDetails<K> 타입으로 안전하게 접근
  if (result.kind === 'prefix') {
    const d = result.details as DkgNodeDetails<'prefix'>;
    console.log(`  category:  ${d.category ?? 'unknown'}`);
    console.log(`  lifecycle: ${d.lifecycle ?? 'active'}`);
    console.log(`  dims:      ${(d.dimLabels ?? []).join(', ')}`);
  } else if (result.kind === 'axis') {
    const d = result.details as DkgNodeDetails<'axis'>;
    console.log(`  versions: ${(d.currentVersions ?? []).join(', ')}`);
  } else if (result.kind === 'decision') {
    const d = result.details as DkgNodeDetails<'decision'>;
    console.log(`  lifecycle: ${d.lifecycle}`);
    console.log(`  context:   ${d.context}`);
    console.log(`  rationale: ${d.rationale}`);
    if (d.flowInstanceId) {
      console.log(`  flow:      ${d.flowInstanceId}`);
    }
  } else if (result.kind === 'observation') {
    const d = result.details as DkgNodeDetails<'observation'>;
    console.log(`  finding: ${d.finding}`);
    console.log(`  source:  ${d.source}`);
    if (d.resolution)
      console.log(`  resolved: ${d.resolution.outcome} → ${d.resolution.decisionId}`);
  }

  // composition
  if (result.composition.length > 0) {
    console.log(`\n  ── 구성 ──`);
    for (const c of result.composition) {
      const entries = c.entries ? ` [${c.entries.join(',')}] cap=${c.capacity}` : '';
      console.log(`    ${c.label.padEnd(17)} → ${c.targetId} [${c.dimKind}]${entries}`);
    }
  }

  // references
  if (result.references.length > 0) {
    console.log(`\n  ── 참조 ──`);
    for (const r of result.references) console.log(`    → ${r}`);
  }

  // membership
  if (result.membership.length > 0) {
    console.log(`\n  ── 소속 ──`);
    for (const m of result.membership) {
      console.log(`    ${m.id} [${m.kind}] — ${m.name}`);
    }
  }

  // constraints
  if (result.constraints.length > 0) {
    console.log(`\n  ── 제약 ──`);
    for (const c of result.constraints) {
      console.log(`    ${c.id}: ${c.rule}`);
    }
  }

  // causal chain (observation → decision)
  if (result.causalChain.length > 0) {
    console.log(`\n  ── 관측 → 의사결정 체인 ──`);
    for (const link of result.causalChain) {
      console.log(`    ${link.observation.id}: ${link.observation.finding}`);
      for (const dec of link.decisions) {
        console.log(`      → ${dec.id}: ${dec.title}`);
        console.log(`        rationale: ${dec.rationale.slice(0, 100)}`);
      }
    }
  }

  // direct decisions
  if (result.directDecisions.length > 0) {
    console.log(`\n  ── 의사결정 ──`);
    for (const d of result.directDecisions) {
      console.log(`    [${d.edgeType}] ${d.id}: ${d.title}`);
      console.log(`      context:   ${d.context}`);
      console.log(`      rationale: ${d.rationale.slice(0, 120)}`);
    }
  }

  if (result.kind === 'decision') {
    const flowInstanceId =
      result.kind === 'decision'
        ? (result.details as DkgNodeDetails<'decision'>).flowInstanceId
        : undefined;
    if (flowInstanceId) {
      console.log(`\n  ── 연결된 FlowInstance 코어 추적 ──`);
      const instance = loadFlowInstanceMeta(store, flowInstanceId);
      if (!instance) {
        console.log(`    저장된 FlowInstance를 찾을 수 없음: ${flowInstanceId}`);
      } else {
        const linkedFlows = graph
          .reverseNeighbors(result.id, 'justifies')
          .map((id) => graph.getNode(id))
          .filter(
            (node): node is Extract<DkgNode, { kind: 'flow-schema' }> =>
              node?.kind === 'flow-schema',
          );

        for (const flow of linkedFlows) {
          console.log(`    flow-schema: ${flow.id} (${flow.name})`);
        }
        for (const line of formatFlowInstanceCoreTrace(instance)) {
          console.log(line);
        }
      }
    }
  }

  // intent links
  if (result.intentLinks.length > 0) {
    console.log(`\n  ── 의도 링크 ──`);
    for (const l of result.intentLinks) {
      console.log(`    ${l.id}: ${l.intent}`);
      if (l.invariant) console.log(`      invariant: ${l.invariant}`);
    }
  }

  // consumes
  if (result.consumes.length > 0) {
    console.log(`\n  ── 소비 대상 (consumes) ──`);
    for (const c of result.consumes) {
      console.log(`    → ${c.id} [${c.kind}] — ${c.name}`);
    }
  }

  // topology
  if (result.topology) {
    console.log(`\n  ── 서비스 토폴로지 ──`);
    console.log(`    owner:     ${result.topology.owner ?? '-'}`);
    console.log(`    consumers: ${result.topology.consumers.join(', ') || '-'}`);
  }

  // cascade
  if (result.cascade) {
    console.log(`\n  ── cascade (변경 시 영향) ──`);
    if (result.cascade.domains.length > 0)
      console.log(`    domains:   ${result.cascade.domains.join(', ')}`);
    if (result.cascade.consumers.length > 0)
      console.log(`    consumers: ${result.cascade.consumers.join(', ')}`);
    if (result.cascade.affectedPrefixes && result.cascade.affectedPrefixes.length > 0) {
      console.log(`    prefixes:  ${result.cascade.affectedPrefixes.join(', ')}`);
    }
  }

  // summary tree
  console.log(`\n  ── 종합 ──`);
  console.log(`    ${result.id}`);
  if (result.composition.length > 0)
    console.log(`      ├── 구성: ${result.composition.map((c) => c.targetId).join(', ')}`);
  if (result.references.length > 0) console.log(`      ├── 참조: ${result.references.join(', ')}`);
  const domains = result.membership.filter((m) => m.kind === 'domain').map((m) => m.id);
  const dsls = result.membership.filter((m) => m.kind === 'dsl-bundle').map((m) => m.id);
  if (domains.length > 0) console.log(`      ├── domain:     ${domains.join(', ')}`);
  if (dsls.length > 0) console.log(`      ├── DSL:        ${dsls.join(', ')}`);
  if (result.constraints.length > 0)
    console.log(`      ├── 제약:       ${result.constraints.map((c) => c.id).join(', ')}`);
  if (result.intentLinks.length > 0)
    console.log(`      ├── intent:     ${result.intentLinks.map((l) => l.id).join(', ')}`);
  if (result.consumes.length > 0)
    console.log(`      ├── consumes:   ${result.consumes.map((c) => c.id).join(', ')}`);
  if (result.topology) {
    console.log(`      ├── owner:      ${result.topology.owner ?? '-'}`);
    console.log(`      └── consumers:  ${result.topology.consumers.join(', ') || '-'}`);
  }
  const allObs = result.causalChain.map((c) => c.observation.id);
  const allDecs = [
    ...result.directDecisions.map((d) => d.id),
    ...result.causalChain.flatMap((c) => c.decisions.map((d) => d.id)),
  ];
  const uniqueDecs = [...new Set(allDecs)];
  if (allObs.length > 0) console.log(`      Observations: ${allObs.join(', ')}`);
  if (uniqueDecs.length > 0) console.log(`      Decisions:    ${uniqueDecs.join(', ')}`);

  // applicable skills
  if (result.applicableSkills.length > 0) {
    const specialized = result.applicableSkills.filter((s) => s.specialized);
    const generic = result.applicableSkills.filter((s) => !s.specialized);

    if (specialized.length > 0) {
      console.log(`\n  ── 전문 Skill (${specialized.length}) ──`);
      for (const s of specialized) {
        console.log(`    ${s.id.padEnd(30)} ${s.name}`);
      }
    }
    if (generic.length > 0) {
      console.log(`\n  ── 범용 Skill (${generic.length}) ──`);
      const byCategory = new Map<string, (typeof generic)[number][]>();
      for (const s of generic) {
        const list = byCategory.get(s.category) ?? [];
        list.push(s);
        byCategory.set(s.category, list);
      }
      for (const [cat, skills] of byCategory) {
        console.log(`    [${cat}] ${skills.map((s) => s.name).join(', ')}`);
      }
    }
  }
}

// ── dkg decide ──────────────────────────────────────

function recordLegacyDecision(opts: {
  target: string;
  type: string;
  title: string;
  rationale: string;
  alternatives?: readonly string[];
  spec?: string;
}): DecisionNode | null {
  const graph = getGraph();
  const store = getStore();

  const result = recordDecision(graph, {
    targetId: opts.target,
    type: opts.type as DecisionType,
    title: opts.title,
    rationale: opts.rationale,
  });

  if (result.verdict === 'blocked') {
    console.error(`  ${result.reason}`);
    return null;
  }

  // skill이 반환한 노드/엣지를 그래프 + SQLite에 적용
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → decision 존재 보장
  const dec = result.decision!;
  graph.addNode(dec);
  const edges: Array<{ type: DkgEdgeType; from: string; to: string }> = [...result.edges];

  // --spec: 의사결정이 어떤 spec에 근거하는지 traces-to 엣지 연결
  if (opts.spec) {
    const specNode = graph.getNode(opts.spec);
    if (specNode && specNode.kind === 'spec') {
      edges.push({ type: 'traces-to', from: dec.id, to: opts.spec });
      graph.addEdge('traces-to', dec.id, opts.spec);
    } else {
      console.warn(`  ⚠ spec '${opts.spec}' 없음 — traces-to 연결 건너뜀`);
    }
  }

  for (const edge of edges) graph.addEdge(edge.type as DkgEdgeType, edge.from, edge.to);
  store.saveNodes([dec], edges, 'manual');
  store.setMeta('last_decision', dec.id);

  emitDkgEvent('decide', graph.getNode(opts.target)?.kind ?? 'prefix', opts.target, {
    decisionType:
      opts.type === 'capacity'
        ? 'capacity'
        : opts.type === 'merge'
          ? 'merge'
          : opts.type === 'deprecate'
            ? 'deprecate'
            : opts.type === 'new-axis'
              ? 'new-axis'
              : opts.type === 'new-prefix'
                ? 'new-prefix'
                : opts.type === 'dim-add'
                  ? 'dim-add'
                  : undefined,
    nodeSource: 'manual',
    command: 'dkg decide',
  });

  console.log(`\n══ Decision 기록 완료 ══`);
  console.log(`  id:        ${dec.id}`);
  console.log(`  type:      ${opts.type}`);
  console.log(`  target:    ${opts.target}`);
  console.log(`  title:     ${dec.title}`);
  console.log(`  rationale: ${dec.rationale}`);
  console.log(`  lifecycle: ${dec.lifecycle}`);
  if (dec.alternatives && dec.alternatives.length > 0) {
    console.log(`  alternatives:`);
    for (const alt of dec.alternatives) console.log(`    - ${alt}`);
  }
  if (opts.spec) console.log(`  spec:      ${opts.spec} (traces-to)`);
  console.log(`  (source: manual — refresh 시 보존됨)`);
  return dec;
}

function printBridgeGate(gate: {
  id: string;
  name: string;
  phase: string;
  branches?: readonly { id: string; label: string }[];
  weight?: string;
}) {
  const weight = gate.weight ?? 'tactical';
  const marker = weight === 'core' ? '★' : weight === 'structural' ? '◆' : '·';
  console.log(`\n  ${marker} 현재 gate: ${gate.id} (${gate.name}) [${gate.phase}]`);
  if (!gate.branches || gate.branches.length === 0) return;

  console.log('  선택지:');
  for (const branch of gate.branches) {
    console.log(`    - ${branch.id.padEnd(20)} ${branch.label}`);
  }
}

export async function dkgDecide(opts: {
  target: string;
  type: string;
  title: string;
  rationale: string;
  alternatives?: readonly string[];
  confidence?: number;
  spec?: string;
  force?: boolean;
  confirmProceed?: () => Promise<boolean>;
}): Promise<void> {
  const warnings = collectDkgCoreGateWarnings(opts.type);
  if (warnings.length > 0) {
    for (const line of formatDkgCoreGateWarnings(warnings)) {
      console.log(line);
    }

    if (opts.force) {
      console.log('  --force 지정으로 경고 확인을 건너뜀');
    } else {
      const confirmed = await (opts.confirmProceed?.() ?? confirmDkgProceed());
      if (!confirmed) {
        console.log('  중단: 코어 gate 경고 확인 후 다시 실행하세요.');
        console.log('  자동 진행이 필요하면 --force를 사용하세요.');
        return;
      }
    }
  }

  const decision = recordLegacyDecision(opts);
  if (!decision) {
    return;
  }

  try {
    const targetKind = getGraph().getNode(opts.target)?.kind;
    const bridge = await startDkgDecisionFlowBridge({
      type: opts.type,
      decisionId: decision.id,
      context: {
        source: 'dkg-decide',
        target: opts.target,
        ...(targetKind ? { targetKind } : {}),
        decisionType: opts.type,
        title: opts.title,
        rationale: opts.rationale,
        alternatives: opts.alternatives,
        spec: opts.spec,
      },
      evidence: {
        rationale: opts.rationale,
        scaffoldContext: decision.context,
        alternatives: decision.alternatives,
        reversalConditions: decision.reversalConditions,
        confidence: opts.confidence,
      },
      completeDefaults: true,
    });

    const graph = getGraph();
    const store = getStore();
    const bridgeMetadata = buildDkgFlowAddressMetadata(bridge.instance);
    const linkedDecision: DecisionNode = {
      ...decision,
      flowInstanceId: bridge.instance.id,
      ...(decision.metadata || bridgeMetadata
        ? {
            metadata: {
              ...decision.metadata,
              ...bridgeMetadata,
            },
          }
        : {}),
    };
    graph.replaceNode(linkedDecision);

    const bridgeEdges: Array<{ type: DkgEdgeType; from: string; to: string }> = [];
    if (
      graph.hasNode(bridge.instance.schemaId) &&
      !graph
        .edgesFrom(bridge.instance.schemaId, 'justifies')
        .some((edge) => edge.to === linkedDecision.id)
    ) {
      graph.addEdge('justifies', bridge.instance.schemaId, linkedDecision.id);
      bridgeEdges.push({
        type: 'justifies',
        from: bridge.instance.schemaId,
        to: linkedDecision.id,
      });
    }

    store.saveNodes([linkedDecision], bridgeEdges, 'manual');
    saveFlowInstanceMeta(store, bridge.instance);

    console.log(`\n══ coordinate-design 브릿지 ══`);
    console.log(`  decision:      ${linkedDecision.id}`);
    console.log(`  flow instance: ${bridge.instance.id}`);
    console.log(`  schema:        ${bridge.instance.schemaId} (${bridge.instance.schemaVersion})`);

    if (bridge.appliedSteps.length > 0) {
      console.log('  자동 매핑:');
      for (const step of bridge.appliedSteps) {
        console.log(`    - ${step.gateId.padEnd(20)} → ${step.branchId}`);
      }
    } else {
      console.log('  자동 매핑: 없음 — 순차 실행으로 안내');
    }

    if (bridge.currentGate) {
      printBridgeGate(bridge.currentGate);
    } else {
      console.log('\n  ✓ 플로우 완료');
    }
  } catch (err) {
    console.warn(`\n  ⚠ coordinate-design 브릿지 시작 실패: ${errorMessage(err)}`);
    console.warn('  decision은 기록됨. flow 연결만 실패.');
  }
}

async function confirmDkgProceed(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.warn('  비대화형 환경에서는 --force가 필요합니다.');
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question('  계속 진행하시겠습니까? [y/N] ', resolve);
    });
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}

// ── dkg observe ─────────────────────────────────────

export function dkgObserve(opts: { target: string; finding: string; suggestion?: string }): void {
  const graph = getGraph();
  const store = getStore();

  let suggestion: ObservationSuggestion | undefined;
  if (opts.suggestion) {
    try {
      suggestion = JSON.parse(opts.suggestion) as ObservationSuggestion;
    } catch {
      console.error('  --suggestion JSON 파싱 실패');
      return;
    }
  }

  const result = recordObservation(graph, {
    targetId: opts.target,
    finding: opts.finding,
    suggestion,
  });

  if (result.verdict === 'blocked') {
    console.error(`  ${result.reason}`);
    return;
  }

  // skill이 반환한 노드/엣지를 그래프 + SQLite에 적용
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → observation 존재 보장
  const obs = result.observation!;
  graph.addNode(obs);
  for (const edge of result.edges) graph.addEdge(edge.type, edge.from, edge.to);
  store.saveNodes([obs], result.edges, 'manual');

  emitDkgEvent('observe', graph.getNode(opts.target)?.kind ?? 'prefix', opts.target, {
    obsSource: 'manual',
    lifecycleState: 'active',
    command: 'dkg observe',
  });

  console.log(`\n══ Observation 기록 완료 ══`);
  console.log(`  id:      ${obs.id}`);
  console.log(`  target:  ${opts.target}`);
  console.log(`  finding: ${obs.finding}`);
  if (obs.suggestion) console.log(`  suggestion: ${JSON.stringify(obs.suggestion)}`);
  console.log(`  (source: manual — refresh 시 보존됨)`);
}

// ── dkg claim ───────────────────────────────────────

export function dkgClaim(opts: { target: string; by: string; reason?: string }): void {
  const graph = getGraph();
  const store = getStore();
  const topo = createDemoTopology();

  const existing = store.getMeta(claimKey(opts.target));
  const existingClaim: ClaimData | null = existing ? JSON.parse(existing) : null;

  const result = prepareClaim(graph, topo, opts.target, opts.by, existingClaim, opts.reason);

  if (result.verdict === 'blocked') {
    console.error(`  ${result.reason}`);
    if (existingClaim) {
      if (existingClaim.reason) console.error(`  사유: ${existingClaim.reason}`);
      console.error(`  해제하려면: qa-sdk dkg release ${opts.target}`);
    }
    return;
  }

  // claim 저장
  store.setMeta(claimKey(opts.target), JSON.stringify(result.claim));

  emitDkgEvent('claim', graph.getNode(opts.target)?.kind ?? 'prefix', opts.target, {
    command: 'dkg claim',
  });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → claim/impact 존재 보장
  const claim = result.claim!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → impact 존재 보장
  const impact = result.impact!;

  console.log(`\n══ Claim: ${opts.target} ══`);
  console.log(`  by:     ${claim.by}`);
  console.log(`  at:     ${claim.at}`);
  if (claim.reason) console.log(`  reason: ${claim.reason}`);

  // skill이 분석한 영향 범위 출력
  const hasImpact =
    impact.owner ||
    impact.consumers.length ||
    impact.domains.length ||
    impact.dslBundles.length ||
    impact.intentLinks.length ||
    impact.affectedPrefixes.length;

  if (hasImpact) {
    console.log(`\n  ── 전파 대상 ──`);
    if (impact.owner) console.log(`    owner:     ${impact.owner}`);
    if (impact.consumers.length > 0) console.log(`    consumers: ${impact.consumers.join(', ')}`);
    if (impact.domains.length > 0) console.log(`    domains:   ${impact.domains.join(', ')}`);
    if (impact.dslBundles.length > 0) console.log(`    DSL:       ${impact.dslBundles.join(', ')}`);
    if (impact.intentLinks.length > 0)
      console.log(`    intents:   ${impact.intentLinks.join(', ')}`);
    if (impact.affectedPrefixes.length > 0) {
      console.log(`    prefixes:  ${impact.affectedPrefixes.join(', ')}`);
    }
  }
}

// ── dkg release ─────────────────────────────────────

export function dkgRelease(target: string): void {
  const graph = getGraph();
  const store = getStore();

  const existing = store.getMeta(claimKey(target));
  const existingClaim: ClaimData | null = existing ? JSON.parse(existing) : null;

  const result = prepareRelease(graph, target, existingClaim);

  if (result.verdict === 'blocked') {
    console.error(`  ${result.reason}`);
    return;
  }

  // claim 해제 + observation 적용
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → observation/previousClaim 존재 보장
  const releaseObs = result.observation!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verdict !== "blocked" → previousClaim 존재 보장
  const prevClaim = result.previousClaim!;

  store.setMeta(claimKey(target), '');
  graph.addNode(releaseObs);
  for (const edge of result.edges) graph.addEdge(edge.type, edge.from, edge.to);
  store.saveNodes([releaseObs], result.edges, 'manual');

  emitDkgEvent('release', graph.getNode(target)?.kind ?? 'prefix', target, {
    command: 'dkg release',
  });

  console.log(`\n══ Release: ${target} ══`);
  console.log(`  was:  ${prevClaim.by} (${prevClaim.at})`);
  console.log(`  obs:  ${releaseObs.id}`);
  console.log(`  작업 완료 observation이 DKG에 기록됨`);
}

// ── dkg resolve ─────────────────────────────────────

export function dkgResolve(opts: {
  obsId: string;
  decisionId: string;
  outcome: string;
  note?: string;
}): void {
  const graph = getGraph();
  const store = getStore();

  const validOutcomes = ['accepted', 'deferred', 'rejected'];
  if (!validOutcomes.includes(opts.outcome)) {
    console.error(`  유효하지 않은 outcome: ${opts.outcome} (가능: ${validOutcomes.join(', ')})`);
    return;
  }

  // decision 존재 확인
  const dec = graph.getNode(opts.decisionId);
  if (!dec || dec.kind !== 'decision') {
    console.error(`  Decision을 찾을 수 없음: ${opts.decisionId}`);
    return;
  }

  const result = resolveObservation(graph, opts.obsId, {
    decisionId: opts.decisionId,
    outcome: opts.outcome as 'accepted' | 'deferred' | 'rejected',
    note: opts.note,
  });

  if (!result.success) {
    console.error(`  resolve 실패: ${result.reason}`);
    return;
  }

  // prompts 엣지 추가 (observation → decision)
  graph.addEdge('prompts', opts.obsId, opts.decisionId);

  // SQLite에 변경 저장 — resolveObservation이 graph를 직접 변경했으므로 해당 노드만 저장
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- resolveObservation 성공 후 obsId 노드 존재 보장
  const updatedObs = graph.getNode(opts.obsId)!;
  store.saveNodes(
    [updatedObs],
    [{ type: 'prompts', from: opts.obsId, to: opts.decisionId }],
    'manual',
  );

  emitDkgEvent('resolve', 'observation', opts.obsId, {
    command: 'dkg resolve',
  });

  console.log(`\n══ Resolve ══`);
  console.log(`  observation: ${opts.obsId}`);
  console.log(`  → decision:  ${opts.decisionId} (${(dec as DecisionNode).title})`);
  console.log(`  outcome:     ${opts.outcome}`);
  if (opts.note) console.log(`  note:        ${opts.note}`);
  console.log(`  루프 닫힘`);
}

// ── dkg link ────────────────────────────────────────

export function dkgLink(opts: { obsId: string; decisionId: string }): void {
  const graph = getGraph();
  const store = getStore();

  const obs = graph.getNode(opts.obsId);
  if (!obs || obs.kind !== 'observation') {
    console.error(`  Observation을 찾을 수 없음: ${opts.obsId}`);
    return;
  }

  const dec = graph.getNode(opts.decisionId);
  if (!dec || dec.kind !== 'decision') {
    console.error(`  Decision을 찾을 수 없음: ${opts.decisionId}`);
    return;
  }

  graph.addEdge('prompts', opts.obsId, opts.decisionId);
  store.saveNodes([], [{ type: 'prompts', from: opts.obsId, to: opts.decisionId }], 'manual');

  emitDkgEvent('link', 'observation', opts.obsId, {
    command: 'dkg link',
  });

  console.log(`\n══ Link ══`);
  console.log(`  ${opts.obsId} → prompts → ${opts.decisionId}`);
  console.log(`  "${(obs as ObservationNode).finding.slice(0, 50)}"`);
  console.log(`  → "${(dec as DecisionNode).title}"`);
}

// ── dkg timeline ────────────────────────────────────

export function dkgTimeline(opts: { open?: boolean }): void {
  const graph = getGraph();

  // 시간 정보가 있는 노드 수집
  const events: { date: string; kind: string; id: string; summary: string; open: boolean }[] = [];

  for (const node of graph.getNodesByKind('observation')) {
    const o = node as ObservationNode;
    events.push({
      date: o.date,
      kind: 'observation',
      id: o.id,
      summary: o.finding.slice(0, 60),
      open: !o.resolution,
    });
  }

  for (const node of graph.getNodesByKind('decision')) {
    const d = node as DecisionNode;
    events.push({
      date: d.date,
      kind: 'decision',
      id: d.id,
      summary: d.title,
      open: d.lifecycle === 'active',
    });
  }

  // 정렬
  events.sort((a, b) => a.date.localeCompare(b.date));

  // 필터
  const filtered = opts.open ? events.filter((e) => e.open) : events;

  const label = opts.open ? '열린 시나리오' : '전체 타임라인';
  console.log(`\n══ ${label} (${filtered.length}개) ══`);

  // 날짜별 그룹
  let lastDate = '';
  for (const e of filtered) {
    if (e.date !== lastDate) {
      lastDate = e.date;
      console.log(`\n  ${e.date}`);
    }

    const icon = e.kind === 'observation' ? (e.open ? '○' : '●') : e.open ? '◇' : '◆';
    const status = e.open ? '' : ' [closed]';
    console.log(`    ${icon} ${e.id.padEnd(40)} ${e.summary}${status}`);
  }

  // 요약
  const openObs = events.filter((e) => e.kind === 'observation' && e.open).length;
  const closedObs = events.filter((e) => e.kind === 'observation' && !e.open).length;
  const activeDec = events.filter((e) => e.kind === 'decision' && e.open).length;
  console.log(`\n  관측: ${openObs} open / ${closedObs} resolved`);
  console.log(`  결정: ${activeDec} active`);
}

// ── dkg claims ──────────────────────────────────────

export function dkgClaims(): void {
  const store = getStore();
  const graph = getGraph();

  // dkg_meta에서 claim: 키 조회
  const allMeta = store.getMetaByPrefix('claim:');

  if (allMeta.length === 0) {
    console.log('\n  활성 claim 없음');
    return;
  }

  console.log(`\n══ 활성 Claims (${allMeta.length}개) ══`);
  for (const row of allMeta) {
    const target = row.key.replace('claim:', '');
    const claim = JSON.parse(row.value) as ClaimData;
    const node = graph.getNode(target);
    const name = node && 'name' in node ? (node as { name: string }).name : target;
    console.log(`  ${target.padEnd(20)} by ${claim.by} (${claim.at})`);
    console.log(`    [${node?.kind ?? '?'}] ${name}`);
    if (claim.reason) console.log(`    사유: ${claim.reason}`);
  }
}

// ── dkg run ─────────────────────────────────────────

export function dkgRun(skillId: string, args: string[]): void {
  const graph = getGraph();

  // skill 노드 확인
  const skillNode = graph.getNode(skillId) as SkillNode | undefined;
  if (!skillNode || skillNode.kind !== 'skill') {
    console.error(`  skill을 찾을 수 없음: ${skillId}`);
    console.error(`  qa-sdk dkg skills 로 목록을 확인하세요`);
    return;
  }

  console.log(`\n══ Run: ${skillNode.name} (${skillId}) ══`);
  if (skillNode.specialization) {
    const spec = skillNode.specialization;
    if (spec.dslBundles?.length) console.log(`  DSL: ${spec.dslBundles.join(', ')}`);
    if (spec.prefixes?.length) console.log(`  prefix: ${spec.prefixes.join(', ')}`);
    if (spec.constraints?.length) console.log(`  제약: ${spec.constraints.join(', ')}`);
  }
  console.log('');

  // skill별 실행 라우팅
  switch (skillId) {
    case 'skill-safe-entry-add': {
      const axisId = args[0] || findArg(args, '--axis');
      const entry = args[1] || findArg(args, '--entry');
      if (!axisId || !entry) {
        console.error('  Usage: dkg run skill-safe-entry-add <axis> <entry>');
        return;
      }
      const result = safeEntryAdd(DEMO_CATALOG, graph, { axisId, entry });
      const icon =
        result.verdict === 'safe' ? '✅' : result.verdict === 'already-exists' ? 'ℹ' : '⚠';
      console.log(`  ${icon} verdict: ${result.verdict}`);
      console.log(`  ${result.summary}`);
      if (result.headroom) {
        console.log(
          `  headroom: ${result.headroom.remaining}/${result.headroom.capacity} (sufficient: ${result.headroom.sufficient})`,
        );
      }
      if (result.affectedPrefixes.length > 0) {
        console.log(`  영향 prefix: ${result.affectedPrefixes.map((p) => p.id).join(', ')}`);
      }
      break;
    }

    case 'skill-event-action-check':
    case 'skill-svc-binding-check': {
      const targetId = args[0];
      if (!targetId) {
        console.error('  Usage: dkg run ' + skillId + ' <targetId>');
        return;
      }
      const result = checkConstraints(graph, targetId);
      if (result.violations.length === 0) {
        console.log(`  ✅ ${targetId}: 위반 없음 (${result.passed.length} passed)`);
      } else {
        console.log(`  ⚠ ${targetId}: ${result.violations.length} violation(s)`);
        for (const v of result.violations) {
          console.log(`    ${v.constraintId} [${v.severity ?? 'warning'}]: ${v.rule}`);
        }
      }
      break;
    }

    case 'skill-domain-health': {
      const domainId = args[0];
      if (domainId) {
        const result = checkDomainHealth(graph, domainId);
        const icon =
          result.overallHealth === 'healthy'
            ? '✅'
            : result.overallHealth === 'warning'
              ? '⚠'
              : '🔴';
        console.log(`  ${icon} ${result.domainName}: ${result.overallHealth}`);
        if (result.issues.length > 0) {
          for (const i of result.issues) console.log(`    - ${i}`);
        }
        console.log(`  prefixes: ${result.prefixes.map((p) => p.id).join(', ')}`);
      } else {
        const results = checkAllDomainsHealth(graph);
        for (const r of results) {
          const icon =
            r.overallHealth === 'healthy' ? '✅' : r.overallHealth === 'warning' ? '⚠' : '🔴';
          console.log(
            `  ${icon} ${r.domainId.padEnd(22)} ${r.overallHealth} (issues: ${r.issues.length})`,
          );
        }
      }
      break;
    }

    case 'skill-entry-add-chain': {
      const axisId = args[0] || findArg(args, '--axis');
      const entry = args[1] || findArg(args, '--entry');
      if (!axisId || !entry) {
        console.error('  Usage: dkg run skill-entry-add-chain <axis> <entry>');
        return;
      }
      const result = entryAddChain(DEMO_CATALOG, graph, axisId, entry);
      console.log(`  overall: ${result.overallStatus}`);
      console.log(`  steps: ${result.steps.length}`);
      for (const step of result.steps) {
        const icon =
          step.status === 'ok'
            ? '✅'
            : step.status === 'skipped'
              ? '⏭'
              : step.status === 'warning'
                ? '⚠'
                : '🔴';
        console.log(`    ${icon} ${step.step}: ${step.message}`);
      }
      console.log(`\n  ${result.summary}`);
      break;
    }

    case 'skill-system-health-chain': {
      const result = systemHealthChain(graph);
      console.log(`  overall: ${result.overallStatus}`);
      for (const step of result.steps) {
        const icon = step.status === 'ok' ? '✅' : step.status === 'warning' ? '⚠' : '🔴';
        console.log(`    ${icon} ${step.step}: ${step.message}`);
      }
      console.log(`\n  ${result.summary}`);

      // ── metric 통합 출력 ──
      const chainMetrics = collectMetrics(DEMO_CATALOG, graph, null, {
        schemaHealthAuditor: auditSchemaHealth,
      });
      const relevantMetrics = chainMetrics.filter(
        (m) =>
          m.id.startsWith('metric:health') ||
          m.id.startsWith('metric:conflict') ||
          m.id.startsWith('metric:overlap') ||
          m.id.startsWith('metric:headroom'),
      );
      if (relevantMetrics.length > 0) {
        const warn = relevantMetrics.filter((m) => m.status !== 'ok');
        console.log(`\n  ── Metrics (${relevantMetrics.length}건, ${warn.length} issues) ──`);
        for (const m of warn) {
          const icon = m.status === 'warning' ? '⚠' : '🔴';
          console.log(`    ${icon} ${m.id}: ${m.detail ?? `value=${m.value}`}`);
        }
        if (warn.length === 0) console.log(`    ✅ 모든 metric 정상`);
      }
      break;
    }

    case 'skill-converge-chain': {
      const result = convergeChain(DEMO_CATALOG, graph, null, { entriesMap: buildEntriesMap() });
      console.log(`  actions: ${result.actions.length}`);
      for (const action of result.actions) {
        const target = convergeActionTarget(action);
        console.log(`    [${action.kind}] ${target}`);
      }
      console.log(
        `\n  merges: ${result.summary.merges}, deactivations: ${result.summary.deactivations}, simplifications: ${result.summary.simplifications}, observations: ${result.summary.observations}`,
      );
      if (result.observations.length > 0) {
        console.log(`  생성된 Observation:`);
        for (const o of result.observations) console.log(`    ${o.id}: ${o.finding.slice(0, 60)}`);
      }
      if (result.decisions.length > 0) {
        console.log(`  생성된 Decision:`);
        for (const d of result.decisions) console.log(`    ${d.id}: ${d.title}`);
      }
      break;
    }

    case 'skill-analyze-impact': {
      const targetId = args[0];
      if (!targetId) {
        console.error('  Usage: dkg run skill-analyze-impact <axis|prefix>');
        return;
      }
      const node = graph.getNode(targetId);
      if (!node) {
        console.error(`  노드 없음: ${targetId}`);
        return;
      }
      const input =
        node.kind === 'axis'
          ? { type: 'capacity-changed' as const, target: { axis: targetId } }
          : { type: 'ref-changed' as const, target: { prefix: targetId } };
      const result = analyzeImpact(graph, input);
      console.log(`  strideBreak: ${result.strideBreak}`);
      console.log(`  migrationRequired: ${result.migrationRequired}`);
      console.log(
        `  affectedPrefixes: ${result.affectedPrefixes.map((p) => p.id).join(', ') || '(없음)'}`,
      );
      console.log(
        `  affectedDomains: ${result.affectedDomains.map((d) => d.id).join(', ') || '(없음)'}`,
      );
      console.log(
        `  affectedConsumers: ${result.affectedConsumers.map((c) => c.id).join(', ') || '(없음)'}`,
      );
      if (result.constraintViolations.length > 0) {
        console.log(
          `  ⚠ constraint violations: ${result.constraintViolations.map((v) => v.constraintId).join(', ')}`,
        );
      }
      break;
    }

    case 'skill-self-check-analyze': {
      // Layer 2 (FAST) 순수 분석 — 실제 빌드/테스트 결과는 dkg self-check로 수행
      console.log('  ⚠ mock 입력 사용 (실제 진단: dkg self-check)');
      const mockResults = SELF_CHECK_PKGS.map((p) => ({
        pkg: p.name,
        kind: 'build' as const,
        result: 'success',
      }));
      const analysis = analyzeSelfCheck(mockResults, DEMO_CATALOG, 'cli-run');
      console.log(
        `  records: ${analysis.records.length}, entryUsage: ${analysis.usage.entryUsages.length}`,
      );
      console.log(`  coverage: ${Math.round(analysis.coverage.overallCoverageRate * 100)}%`);
      console.log(
        `  invariant: ${analysis.invariantViolations.length === 0 ? '통과' : analysis.invariantViolations.length + '건 위반'}`,
      );
      console.log(`  건전성: ${Math.round(analysis.health.healthRate * 100)}%`);
      break;
    }

    case 'skill-cli-coverage': {
      const cov = analyzeCliCoverage();
      console.log(
        `  커버리지: ${Math.round(cov.coverageRate * 100)}% (${cov.observedCoords}/${cov.totalCoords} 좌표)`,
      );
      console.log(`  dormant: ${cov.dormantCoords.length}개`);
      for (const d of cov.dormantCoords.slice(0, 10)) {
        console.log(`    ${d.coord.padEnd(35)} → ${d.commands.join(', ')}`);
      }
      break;
    }

    case 'skill-promote-scan': {
      dkgPromoteScan();
      break;
    }

    case 'skill-spec-manage': {
      dkgSpecList();
      break;
    }

    case 'skill-registry-publish': {
      const regUrl = args[0] || process.env.QA_REGISTRY_URL || 'http://localhost:3300';
      console.log(`  registry: ${regUrl}`);
      console.log(`  이 skill은 dkg publish --registry <url>로 실행하세요.`);
      break;
    }

    // ── read 스킬: 기존 조회 명령 재사용 ──
    case 'skill-trace': {
      const nodeId = args[0];
      if (!nodeId) {
        console.error('  Usage: dkg run skill-trace <nodeId>');
        return;
      }
      dkgTrace(nodeId);
      break;
    }
    case 'skill-explore-service': {
      dkgService(args[0]);
      break;
    }
    case 'skill-explore-prefix': {
      if (!args[0]) {
        console.error('  Usage: dkg run skill-explore-prefix <prefixId>');
        return;
      }
      dkgPrefix(args[0]);
      break;
    }
    case 'skill-explore-dsl': {
      dkgDsl(args[0]);
      break;
    }
    case 'skill-system-overview': {
      dkgOverview();
      break;
    }

    // ── write 스킬 ──
    case 'skill-record-decision': {
      const targetId = args[0];
      const type = (args[1] || 'capacity') as DecisionType;
      const title = args[2] || findArg(args, '--title');
      const rationale = args[3] || findArg(args, '--rationale');
      if (!targetId || !title || !rationale) {
        console.error(
          '  Usage: dkg run skill-record-decision <targetId> <type> <title> <rationale>',
        );
        return;
      }
      const result = recordDecision(graph, { targetId, type, title, rationale });
      if (result.verdict === 'blocked') {
        console.error(`  ⚠ ${result.reason}`);
      } else {
        const dec = result.decision!;
        graph.addNode(dec);
        for (const edge of result.edges)
          graph.addEdge(edge.type as DkgEdgeType, edge.from, edge.to);
        getStore().saveNodes([dec], result.edges, 'manual');
        console.log(`  ✅ Decision 기록: ${dec.id}`);
        console.log(`  ${result.summary}`);
      }
      break;
    }

    case 'skill-record-observation': {
      const targetId = args[0];
      const finding = args.slice(1).join(' ') || findArg(args, '--finding');
      if (!targetId || !finding) {
        console.error('  Usage: dkg run skill-record-observation <targetId> <finding>');
        return;
      }
      const result = recordObservation(graph, { targetId, finding });
      if (result.verdict === 'blocked') {
        console.error(`  ⚠ ${result.reason}`);
      } else {
        const obs = result.observation!;
        graph.addNode(obs);
        for (const edge of result.edges)
          graph.addEdge(edge.type as DkgEdgeType, edge.from, edge.to);
        getStore().saveNodes([obs], result.edges, 'manual');
        console.log(`  ✅ Observation 기록: ${obs.id}`);
        console.log(`  ${result.summary}`);
      }
      break;
    }

    case 'skill-claim': {
      const targetId = args[0];
      const by = args[1] || findArg(args, '--by') || 'cli-user';
      const reason = findArg(args, '--reason');
      if (!targetId) {
        console.error('  Usage: dkg run skill-claim <targetId> [by] [--reason ...]');
        return;
      }
      const store = getStore();
      const existingRaw = store.getMeta(claimKey(targetId));
      const existingClaim = existingRaw ? (JSON.parse(existingRaw) as ClaimData) : null;
      const topo = createDemoTopology();
      const result = prepareClaim(graph, topo, targetId, by, existingClaim, reason);
      if (result.verdict === 'blocked') {
        console.error(`  ⚠ ${result.reason}`);
      } else {
        store.setMeta(claimKey(targetId), JSON.stringify(result.claim));
        console.log(`  ✅ Claim 등록: ${targetId} by ${by}`);
        console.log(`  ${result.summary}`);
        if (result.impact?.affectedPrefixes.length) {
          console.log(`  영향 prefix: ${result.impact.affectedPrefixes.join(', ')}`);
        }
      }
      break;
    }

    case 'skill-release': {
      const targetId = args[0];
      if (!targetId) {
        console.error('  Usage: dkg run skill-release <targetId>');
        return;
      }
      const store = getStore();
      const existingRaw = store.getMeta(claimKey(targetId));
      const existingClaim = existingRaw ? (JSON.parse(existingRaw) as ClaimData) : null;
      const result = prepareRelease(graph, targetId, existingClaim);
      if (result.verdict === 'blocked') {
        console.error(`  ⚠ ${result.reason}`);
      } else {
        store.setMeta(claimKey(targetId), '');
        if (result.observation) {
          graph.addNode(result.observation);
          for (const edge of result.edges)
            graph.addEdge(edge.type as DkgEdgeType, edge.from, edge.to);
          getStore().saveNodes([result.observation], result.edges, 'manual');
        }
        console.log(`  ✅ Release 완료: ${targetId}`);
        console.log(`  ${result.summary}`);
      }
      break;
    }

    case 'skill-lifecycle-transition': {
      const nodeId = args[0];
      const toLifecycle = args[1];
      if (!nodeId || !toLifecycle) {
        console.error(
          '  Usage: dkg run skill-lifecycle-transition <nodeId> <active|deprecated|archived|superseded|reversed>',
        );
        return;
      }
      const node = graph.getNode(nodeId);
      if (!node) {
        console.error(`  노드 없음: ${nodeId}`);
        return;
      }
      const reason = findArg(args, '--reason');
      const supersededBy = findArg(args, '--superseded-by');
      let result;
      if (node.kind === 'prefix') {
        result = transitionPrefix(
          graph,
          nodeId,
          toLifecycle as 'active' | 'deprecated' | 'archived',
          { reason, supersededBy },
        );
      } else if (node.kind === 'decision') {
        result = transitionDecision(graph, nodeId, toLifecycle as 'superseded' | 'reversed', {
          reason,
          supersededBy,
        });
      } else if (node.kind === 'observation') {
        const decisionId = findArg(args, '--decision');
        const outcome = (findArg(args, '--outcome') || 'accepted') as
          | 'accepted'
          | 'deferred'
          | 'rejected';
        if (!decisionId) {
          console.error('  observation 해소에는 --decision 필수');
          return;
        }
        result = resolveObservation(graph, nodeId, { decisionId, outcome, note: reason });
      } else {
        console.error(`  지원하지 않는 노드 종류: ${node.kind}`);
        return;
      }
      const icon = result.success ? '✅' : '⚠';
      console.log(`  ${icon} ${result.nodeId}: ${result.from} → ${result.to}`);
      if (result.reason) console.log(`  ${result.reason}`);
      break;
    }

    // ── analysis 스킬 (미연결분) ──
    case 'skill-decision-scaffold': {
      const type = (args[0] || 'capacity') as DecisionType;
      const targetId = args[1] || findArg(args, '--target') || 'unknown';
      const title = args[2] || findArg(args, '--title') || `${type} 의사결정`;
      const rationale = args[3] || findArg(args, '--rationale') || '(rationale 미입력)';
      // 유형별 params 구성
      const scaffoldParams: Record<string, Record<string, unknown>> = {
        capacity: { axis: targetId, currentUsed: 0, currentCapacity: 32, proposedCapacity: 64 },
        'new-axis': { axisId: targetId, entries: [], capacity: 32 },
        'new-prefix': { prefixId: targetId, dims: [], domain: undefined },
        'dim-add': { prefix: targetId, newDim: 'unknown', defaultValue: 1 },
        merge: { targets: [targetId], into: targetId, overlapEntries: [] },
        deprecate: { target: targetId, replacement: undefined },
      };
      const dec = scaffoldDecision({
        type,
        id: `DEC-SCAFFOLD-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        title,
        params: (scaffoldParams[type] ?? { type }) as unknown as Parameters<
          typeof scaffoldDecision
        >[0]['params'],
        rationale,
      });
      console.log(`  id:         ${dec.id}`);
      console.log(`  type:       ${type}`);
      console.log(`  context:    ${dec.context}`);
      console.log(`  rationale:  ${dec.rationale}`);
      if (dec.alternatives?.length) {
        console.log(`  alternatives:`);
        for (const a of dec.alternatives) console.log(`    - ${a}`);
      }
      if (dec.reversalConditions?.length) {
        console.log(`  reversalConditions:`);
        for (const r of dec.reversalConditions) console.log(`    - ${r}`);
      }
      break;
    }

    case 'skill-infer-migrator': {
      const fromLabels = (args[0] || '').split(',').filter(Boolean);
      const toLabels = (args[1] || '').split(',').filter(Boolean);
      if (fromLabels.length === 0 || toLabels.length === 0) {
        console.error('  Usage: dkg run skill-infer-migrator <fromLabels> <toLabels>');
        console.error('    예: dkg run skill-infer-migrator env,region,svc env,region,svc,ns');
        return;
      }
      const result = inferMigrator({ fromLabels, toLabels, changedLabels: [] });
      console.log(`  pattern:     ${result.pattern}`);
      console.log(`  description: ${result.description}`);
      console.log(`  migrator:    ${result.migrator ? '자동 생성됨' : 'null (수동 필요)'}`);
      if (result.warnings?.length) {
        for (const w of result.warnings) console.log(`  ⚠ ${w}`);
      }
      break;
    }

    case 'skill-observation-coverage': {
      const entryUsages: DkgUsageData['entryUsages'] = [];
      const addressUsages: DkgUsageData['addressUsages'] = [];
      const catalog = registry.has(activeCatalogId)
        ? registry.getCatalog(activeCatalogId)
        : DEMO_CATALOG;
      const result = auditCoverage(catalog, graph, entryUsages, addressUsages);
      const report = result.report;
      console.log(`  전체 커버리지: ${Math.round(report.overallCoverageRate * 100)}%`);
      console.log(`  dormant: ${report.dormantCount}개, phantom: ${report.phantomCount}개`);
      if (report.prefixes.length > 0) {
        const low = report.prefixes.filter((p) => p.coverageRate < 0.5);
        if (low.length > 0) {
          console.log(`  저커버리지 prefix (${low.length}개):`);
          for (const p of low.slice(0, 10)) {
            console.log(`    ${p.prefixId}: ${Math.round(p.coverageRate * 100)}%`);
          }
        }
      }
      if (result.observations.length > 0) {
        console.log(`  생성된 Observation: ${result.observations.length}건`);
        for (const o of result.observations) console.log(`    ${o.id}: ${o.finding.slice(0, 60)}`);
      }
      break;
    }

    case 'skill-flow-trace': {
      // 실 데이터 없으면 빈 배열로 실행 (구조 검증용)
      const records: AddressContextRecord[] = [];
      const result = traceFlows(graph, records);
      console.log(`  totalRecords:  ${result.totalRecords}`);
      console.log(`  checkedRecords: ${result.checkedRecords}`);
      console.log(`  violations:    ${result.violations.length}`);
      if (result.violations.length > 0) {
        for (const v of result.violations.slice(0, 5)) {
          console.log(`    ⚠ ${v.intentLinkId}: ${v.invariant}`);
        }
      }
      if (result.observations.length > 0) {
        console.log(`  생성된 Observation: ${result.observations.length}건`);
      }
      console.log(`  ${result.summary}`);
      break;
    }

    case 'skill-service-health': {
      const regUrl = args[0] || process.env.QA_REGISTRY_URL || 'http://localhost:3300';
      const env = args[1] || 'dev';
      serviceHealthCheck(regUrl, env)
        .then((result) => {
          const icon =
            result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠' : '🔴';
          console.log(
            `  ${icon} status: ${result.status} (up: ${result.up}, down: ${result.down}, total: ${result.total})`,
          );
          if (result.downServices.length > 0) {
            console.log(`  다운 서비스:`);
            for (const s of result.downServices) console.log(`    🔴 ${s}`);
          }
          if (result.observations.length > 0) {
            console.log(`  생성된 Observation: ${result.observations.length}건`);
          }
        })
        .catch((err) => console.error(`  ⚠ 헬스체크 실패: ${errorMessage(err)}`));
      break;
    }

    case 'skill-event-coverage': {
      const ingestUrl = args[0] || process.env.QA_INGEST_ENDPOINT || 'http://localhost:3200';
      eventCoverageCheck(ingestUrl, graph)
        .then((result) => {
          console.log(
            `  커버리지: ${result.coveragePercent}% (${result.observedPrefixes}/${result.definedPrefixes})`,
          );
          if (result.unobserved.length > 0) {
            console.log(`  미관측 prefix (${result.unobserved.length}개):`);
            for (const p of result.unobserved.slice(0, 10)) console.log(`    - ${p}`);
            if (result.unobserved.length > 10)
              console.log(`    ... 외 ${result.unobserved.length - 10}개`);
          }
          if (result.observations.length > 0) {
            console.log(`  생성된 Observation: ${result.observations.length}건`);
          }
        })
        .catch((err) => console.error(`  ⚠ 커버리지 체크 실패: ${errorMessage(err)}`));
      break;
    }

    // ── 카탈로그 기반 analysis 스킬 ──
    case 'skill-schema-health-audit': {
      const result = auditSchemaHealth(graph);
      const icon = result.failed === 0 ? '✅' : '⚠';
      console.log(
        `  ${icon} ${result.totalPrefixes} prefixes 검사: ${result.passed} 통과, ${result.failed} 위반`,
      );
      if (result.violations.length > 0) {
        for (const v of result.violations) {
          console.log(`    ⚠ ${v.prefixId} [${v.category}]:`);
          for (const e of v.errors) console.log(`      - ${e}`);
        }
      }
      if (result.observations.length > 0) {
        console.log(`  생성된 Observation: ${result.observations.length}건`);
        for (const o of result.observations) console.log(`    ${o.id}: ${o.finding.slice(0, 70)}`);
      }
      if (result.decisions.length > 0) {
        console.log(`  생성된 Decision: ${result.decisions.length}건`);
        for (const d of result.decisions) console.log(`    ${d.id}: ${d.title}`);
      }
      console.log(`  ${result.summary}`);
      break;
    }

    case 'skill-commerce-skew-audit': {
      const bundleId = args[0];
      const catalog = registry.has(activeCatalogId)
        ? registry.getCatalog(activeCatalogId)
        : DEMO_CATALOG;
      const prefixes = catalog.prefixes as unknown as Record<
        string,
        { versions: ReadonlyArray<{ version: string }> }
      >;
      const bundles = graph.getNodesByKind('dsl-bundle') as Array<{
        id: string;
        name: string;
        memberPrefixes: readonly string[];
      }>;
      const targets = bundleId ? bundles.filter((b) => b.id === bundleId) : bundles;
      if (targets.length === 0) {
        console.error(`  DSL 번들 없음${bundleId ? `: ${bundleId}` : ''}`);
        return;
      }
      for (const bundle of targets) {
        const versions: Array<{ prefix: string; latest: string; count: number }> = [];
        for (const pid of bundle.memberPrefixes) {
          const pdef = prefixes[pid];
          if (!pdef) continue;
          const latest = pdef.versions[pdef.versions.length - 1]?.version ?? '?';
          versions.push({ prefix: pid, latest, count: pdef.versions.length });
        }
        const uniqueLatest = new Set(versions.map((v) => v.latest));
        const severity = uniqueLatest.size <= 1 ? 'ok' : uniqueLatest.size <= 2 ? 'minor' : 'major';
        const icon = severity === 'ok' ? '✅' : severity === 'minor' ? '⚠' : '🔴';
        console.log(`  ${icon} ${bundle.id} (${bundle.name}): ${severity}`);
        for (const v of versions) {
          console.log(`    ${v.prefix.padEnd(20)} ${v.latest} (${v.count} versions)`);
        }
        if (severity !== 'ok') {
          console.log(`    → ${uniqueLatest.size}종 버전 혼재: ${[...uniqueLatest].join(', ')}`);
        }
      }
      break;
    }

    case 'skill-prefix-capacity-audit': {
      const targetPrefix = args[0];
      const catalog = registry.has(activeCatalogId)
        ? registry.getCatalog(activeCatalogId)
        : DEMO_CATALOG;
      const prefixIds = targetPrefix ? [targetPrefix] : Object.keys(catalog.prefixes);
      let warnings = 0;
      let critical = 0;
      for (const pid of prefixIds) {
        try {
          const profile = getPrefixProfile(catalog, pid);
          const issues: string[] = [];
          for (const dim of profile.dims) {
            // prefix_ref는 닫힌 참조 집합이므로 headroom=0이 정상
            if (dim.kind === 'prefix_ref') continue;
            if (dim.headroom !== undefined && dim.headroom <= 0) {
              issues.push(
                `${dim.label}: headroom=0 (capacity=${dim.capacity}, entries=${dim.entries})`,
              );
              critical++;
            } else if (dim.headroom !== undefined && dim.headroom <= 1) {
              issues.push(
                `${dim.label}: headroom=${dim.headroom} (capacity=${dim.capacity}, entries=${dim.entries})`,
              );
              warnings++;
            }
          }
          if (!profile.safePrecision) {
            issues.push(`CON-007: totalSpace > 2^53, safePrecision=false`);
            critical++;
          }
          if (issues.length > 0 || targetPrefix) {
            const icon = issues.some((i) => i.includes('headroom=0') || i.includes('CON-007'))
              ? '🔴'
              : issues.length > 0
                ? '⚠'
                : '✅';
            console.log(
              `  ${icon} ${pid} (${profile.version}): totalSpace=${profile.totalSpace}, safePrecision=${profile.safePrecision}`,
            );
            for (const dim of profile.dims) {
              const hdr = dim.headroom !== undefined ? `, headroom=${dim.headroom}` : '';
              const ent = dim.entries !== undefined ? `entries=${dim.entries}` : 'entries=?';
              console.log(
                `    ${dim.label.padEnd(15)} [${dim.kind}] ${ent}, capacity=${dim.capacity}${hdr}, stride=${dim.stride}`,
              );
            }
            for (const i of issues) console.log(`    ⚠ ${i}`);
          }
        } catch {
          /* prefix가 빈 경우 skip */
        }
      }
      console.log(
        `\n  총 ${prefixIds.length} prefix 검사: ⚠ ${warnings} warning, 🔴 ${critical} critical`,
      );
      break;
    }

    case 'skill-gate-refentries-check': {
      const catalog = registry.has(activeCatalogId)
        ? registry.getCatalog(activeCatalogId)
        : DEMO_CATALOG;
      const prefixIds = Object.keys(catalog.prefixes);
      let totalRefs = 0;
      let undefinedRefs = 0;
      for (const pid of prefixIds) {
        try {
          const profile = getPrefixProfile(catalog, pid);
          const refDims = profile.dims.filter((d) => d.kind === 'prefix_ref');
          for (const dim of refDims) {
            totalRefs++;
            if (dim.entries === undefined) {
              undefinedRefs++;
              console.log(
                `  ⚠ ${pid} → ${dim.label}: refEntries 미정의 (capacity=${dim.capacity}, reserved 처리됨)`,
              );
            }
          }
        } catch {
          /* skip */
        }
      }
      if (undefinedRefs === 0) {
        console.log(`  ✅ CON-006 통과: ${totalRefs}개 prefix_ref 모두 refEntries 정의됨`);
      } else {
        console.log(
          `\n  CON-006: ${totalRefs}개 prefix_ref 중 ${undefinedRefs}개 미정의 → GateEngine reserved 처리`,
        );
      }
      break;
    }

    case 'skill-table-impact': {
      const tableId = args[0];
      const tables = graph.getNodesByKind('table') as TableNode[];
      if (tables.length === 0) {
        console.log('  (table 노드 없음)');
        break;
      }
      if (!tableId) {
        console.log(`\n══ Tables (${tables.length}개) ══`);
        for (const t of tables) {
          const refs = graph.edgesFrom(t.id, 'references');
          console.log(`  ${t.id.padEnd(25)} columns: ${t.columns.length}, refs: ${refs.length}`);
        }
        console.log(`\n  상세: dkg run skill-table-impact <tableId>`);
      } else {
        const table = tables.find((t) => t.id === tableId);
        if (!table) {
          console.error(`  테이블 없음: ${tableId}`);
          return;
        }
        console.log(`\n══ Table: ${table.id} ══`);
        console.log(`  columns: ${table.columns.join(', ')}`);
        // 이 테이블을 참조하는 노드들
        const incomingRefs = graph.edgesTo(table.id, 'references');
        if (incomingRefs.length > 0) {
          console.log(`\n  참조하는 노드 (${incomingRefs.length}개):`);
          for (const e of incomingRefs) {
            const node = graph.getNode(e.from);
            console.log(`    ← ${e.from} [${node?.kind ?? '?'}]`);
          }
        }
        // 이 테이블이 참조하는 축/prefix
        const outgoingRefs = graph.edgesFrom(table.id, 'references');
        if (outgoingRefs.length > 0) {
          console.log(`\n  참조 대상 (${outgoingRefs.length}개):`);
          for (const e of outgoingRefs) {
            const node = graph.getNode(e.to);
            console.log(`    → ${e.to} [${node?.kind ?? '?'}]`);
          }
        }
        // 소속 domain
        const domains = graph.edgesTo(table.id, 'contains');
        if (domains.length > 0) {
          console.log(`\n  소속 domain: ${domains.map((e) => e.from).join(', ')}`);
        }
      }
      break;
    }

    // ── 런타임 데이터 기반 analysis 스킬 ──
    // address_context 레코드가 있으면 실 검증, 없으면 구조 검증만 수행
    case 'skill-checkout-flow-verify': {
      const bundles = (
        graph.getNodesByKind('dsl-bundle') as Array<{
          id: string;
          invariants?: readonly string[];
          memberPrefixes: readonly string[];
        }>
      ).filter((b) => b.id === 'dsl-checkout');
      if (bundles.length === 0) {
        console.log('  dsl-checkout 번들 없음');
        break;
      }
      const bundle = bundles[0];
      console.log(`  번들: ${bundle.id} (멤버: ${bundle.memberPrefixes.join(', ')})`);
      console.log(`  불변조건: ${bundle.invariants?.length ?? 0}개`);
      for (const inv of bundle.invariants ?? []) console.log(`    - ${inv}`);
      // 실 데이터로 검증
      const dslResult = validateDslInvariants(graph, [], {
        excludeBundles: graph
          .getNodesByKind('dsl-bundle')
          .map((b: { id: string }) => b.id)
          .filter((id: string) => id !== 'dsl-checkout'),
      });
      if (dslResult.violations.length > 0) {
        console.log(`\n  위반 ${dslResult.violations.length}건:`);
        for (const v of dslResult.violations)
          console.log(`    ⚠ ${v.bundleId}: ${v.invariant.slice(0, 70)}`);
      } else {
        console.log(`\n  ✅ 위반 없음 (${dslResult.checkedRecords}건 검사)`);
      }
      if (dslResult.checkedRecords === 0)
        console.log(`  ℹ address_context 레코드 없음 — ingest 데이터 수집 후 재실행`);
      break;
    }

    case 'skill-infra-impact-verify': {
      const bundles = (
        graph.getNodesByKind('dsl-bundle') as Array<{
          id: string;
          invariants?: readonly string[];
          memberPrefixes: readonly string[];
        }>
      ).filter((b) => b.id === 'dsl-infra');
      if (bundles.length === 0) {
        console.log('  dsl-infra 번들 없음');
        break;
      }
      const bundle = bundles[0];
      console.log(`  번들: ${bundle.id} (멤버: ${bundle.memberPrefixes.join(', ')})`);
      console.log(`  불변조건: ${bundle.invariants?.length ?? 0}개`);
      for (const inv of bundle.invariants ?? []) console.log(`    - ${inv}`);
      const infraResult = validateDslInvariants(graph, [], {
        excludeBundles: graph
          .getNodesByKind('dsl-bundle')
          .map((b: { id: string }) => b.id)
          .filter((id: string) => id !== 'dsl-infra'),
      });
      if (infraResult.violations.length > 0) {
        console.log(`\n  위반 ${infraResult.violations.length}건:`);
        for (const v of infraResult.violations)
          console.log(`    ⚠ ${v.bundleId}: ${v.invariant.slice(0, 70)}`);
      } else {
        console.log(`\n  ✅ 위반 없음 (${infraResult.checkedRecords}건 검사)`);
      }
      if (infraResult.checkedRecords === 0)
        console.log(`  ℹ address_context 레코드 없음 — ingest 데이터 수집 후 재실행`);
      break;
    }

    case 'skill-pipeline-phase-verify': {
      const bundles = (
        graph.getNodesByKind('dsl-bundle') as Array<{
          id: string;
          invariants?: readonly string[];
          memberPrefixes: readonly string[];
        }>
      ).filter((b) => b.id === 'dsl-pipeline');
      if (bundles.length === 0) {
        console.log('  dsl-pipeline 번들 없음');
        break;
      }
      const bundle = bundles[0];
      console.log(`  번들: ${bundle.id} (멤버: ${bundle.memberPrefixes.join(', ')})`);
      console.log(`  불변조건: ${bundle.invariants?.length ?? 0}개`);
      for (const inv of bundle.invariants ?? []) console.log(`    - ${inv}`);
      const pipeResult = validateDslInvariants(graph, [], {
        excludeBundles: graph
          .getNodesByKind('dsl-bundle')
          .map((b: { id: string }) => b.id)
          .filter((id: string) => id !== 'dsl-pipeline'),
      });
      if (pipeResult.violations.length > 0) {
        console.log(`\n  위반 ${pipeResult.violations.length}건:`);
        for (const v of pipeResult.violations)
          console.log(`    ⚠ ${v.bundleId}: ${v.invariant.slice(0, 70)}`);
      } else {
        console.log(`\n  ✅ 위반 없음 (${pipeResult.checkedRecords}건 검사)`);
      }
      if (pipeResult.checkedRecords === 0)
        console.log(`  ℹ address_context 레코드 없음 — ingest 데이터 수집 후 재실행`);
      break;
    }

    case 'skill-pattern-analysis': {
      console.log(`  패턴 규칙: ${DEMO_PATTERN_RULES.length}개`);
      for (const rule of DEMO_PATTERN_RULES) {
        console.log(
          `    ${rule.id}: ${rule.behaviorPattern} (${rule.identificationMode}, priority=${rule.priority})`,
        );
        if (rule.description) console.log(`      ${rule.description}`);
      }
      console.log(`\n  ℹ 세션 이벤트 시퀀스(ClassifierInput[])가 필요합니다.`);
      console.log(`  ingest-server에서 수집된 세션 데이터로 패턴을 분류합니다.`);
      console.log(`  현재 데이터 없음 — ingest 파이프라인 가동 후 재실행`);
      break;
    }

    case 'skill-policy-rule-verify': {
      // 카탈로그 기반 구조 검증: prefix별 PolicyRule dim 완전성
      const catalog = registry.has(activeCatalogId)
        ? registry.getCatalog(activeCatalogId)
        : DEMO_CATALOG;
      const policyPrefixes = Object.entries(
        catalog.prefixes as unknown as Record<
          string,
          { versions?: ReadonlyArray<{ dims?: ReadonlyArray<{ label: string }> }> }
        >,
      ).filter(
        ([, p]) =>
          p.versions?.some((v) =>
            v.dims?.some(
              (d) =>
                d.label.includes('role') || d.label.includes('perm') || d.label.includes('rbac'),
            ),
          ) ?? false,
      );
      console.log(`  권한 관련 prefix: ${policyPrefixes.length}개`);
      for (const [pid] of policyPrefixes) {
        const profile = getPrefixProfile(catalog, pid);
        const dims = profile.dims.map((d) => d.label);
        console.log(`    ${pid}: dims=[${dims.join(', ')}]`);
      }
      // DSL 접근 제어 번들 확인
      const aclBundles = (
        graph.getNodesByKind('dsl-bundle') as Array<{
          id: string;
          memberPrefixes: readonly string[];
        }>
      ).filter((b) => b.id === 'dsl-access-control');
      if (aclBundles.length > 0) {
        console.log(`\n  dsl-access-control 멤버: ${aclBundles[0].memberPrefixes.join(', ')}`);
      }
      // CON-003 제약 확인
      const con003 = (graph.getNodesByKind('constraint') as ConstraintNode[]).filter((c) =>
        c.id.includes('CON-003'),
      );
      if (con003.length > 0) {
        console.log(`\n  CON-003: ${con003[0].rule}`);
        for (const [pid] of policyPrefixes) {
          const result = checkConstraints(graph, pid);
          const icon = result.violations.length === 0 ? '✅' : '⚠';
          console.log(
            `    ${icon} ${pid}: ${result.violations.length === 0 ? '통과' : result.violations.map((v) => v.rule).join('; ')}`,
          );
        }
      }
      console.log(
        `\n  ℹ PolicyRule 충돌 검사(detectConflicts)는 MetaCodec 인스턴스 필요 — 런타임 환경에서 실행`,
      );
      break;
    }

    default:
      console.log(`  ${skillId}는 아직 CLI 실행을 지원하지 않음`);
      console.log(`  input:  ${skillNode.input}`);
      console.log(`  output: ${skillNode.output}`);
      break;
  }

  // skill 실행 이벤트 기록
  emitSkillExecution(skillId, skillNode.category);

  // next-steps 추천
  suggestNextSteps(graph, skillId, skillNode);
}

/** skill 실행 후 다음 행동 추천 */
function suggestNextSteps(graph: GraphRegistry, skillId: string, skillNode: SkillNode): void {
  const suggestions: string[] = [];

  // 1. depends 역방향: 이 skill에 의존하는 다른 skill
  const dependents = graph.getNodesByKind('skill').filter((s) => s.depends?.includes(skillId));
  for (const dep of dependents) {
    suggestions.push(`dkg run ${dep.id}  — ${dep.name}`);
  }

  // 2. 카테고리 기반 워크플로우 추천
  const WORKFLOW_HINTS: Record<string, string[]> = {
    // analysis 후 → 기록
    'skill-domain-health': ['dkg run skill-record-observation <domainId> <finding>'],
    'skill-schema-health-audit': ['dkg run skill-record-observation <prefixId> <finding>'],
    'skill-commerce-skew-audit': ['dkg run skill-record-observation <dslId> <finding>'],
    'skill-prefix-capacity-audit': [
      'dkg run skill-record-decision <axisId> capacity <title> <rationale>',
    ],
    'skill-analyze-impact': ['dkg run skill-record-decision <targetId> <type> <title> <rationale>'],
    // 기록 후 → 추적
    'skill-record-decision': ['dkg run skill-trace <targetId>  — 결정 영향 추적'],
    'skill-record-observation': ['dkg run skill-trace <targetId>  — 관측 맥락 확인'],
    // chain 후 → 상세
    'skill-system-health-chain': [
      'dkg run skill-prefix-capacity-audit  — headroom 상세 확인',
      'dkg run skill-commerce-skew-audit  — 버전 스큐 상세',
    ],
    'skill-converge-chain': [
      'dkg run skill-record-decision <targetId> merge <title> <rationale>  — merge 결정 기록',
    ],
    'skill-entry-add-chain': [
      'dkg run skill-record-decision <axisId> capacity <title> <rationale>  — capacity 결정 기록',
    ],
    // claim 사이클
    'skill-claim': ['dkg run skill-release <targetId>  — 작업 완료 후 해제'],
    'skill-release': ['dkg run skill-trace <targetId>  — 변경 이력 확인'],
  };

  const hints = WORKFLOW_HINTS[skillId];
  if (hints) {
    for (const h of hints) suggestions.push(h);
  }

  if (suggestions.length > 0) {
    console.log(`\n  ── 다음 행동 ──`);
    for (const s of suggestions.slice(0, 3)) {
      console.log(`    → ${s}`);
    }
  }
}

// ── dkg metrics ─────────────────────────────────────

export function dkgMetrics(): void {
  const graph = getGraph();
  const store = getStore();

  // usage data 로드 (있으면)
  const recent = store.loadRecentVersionUsages(1);
  const usage: UsageData | null =
    recent.length > 0 && recent[0].versionUsages.length > 0
      ? {
          entryUsages: [] as EntryUsage[],
          addressUsages: [] as AddressUsage[],
          coOccurrences: [] as CoOccurrence[],
          versionUsages: recent[0].versionUsages,
          collectionPeriod: { from: recent[0].collectedAt, to: recent[0].collectedAt },
        }
      : null;

  const metrics = collectMetrics(DEMO_CATALOG, graph, usage, {
    schemaHealthAuditor: auditSchemaHealth,
  });

  console.log(`\n══ Metrics Dashboard ══`);
  console.log(`  정의: ${METRIC_DEFS.length}종, 측정: ${metrics.length}건\n`);

  // status별 카운트
  const ok = metrics.filter((m) => m.status === 'ok').length;
  const warning = metrics.filter((m) => m.status === 'warning').length;
  const critical = metrics.filter((m) => m.status === 'critical').length;

  console.log(`  ✅ ok: ${ok}  ⚠ warning: ${warning}  🔴 critical: ${critical}\n`);

  // category별 그룹핑
  const byCategory = new Map<string, MetricValue[]>();
  for (const m of metrics) {
    const cat = m.id.split(':')[1] ?? 'unknown';
    const list = byCategory.get(cat) ?? [];
    list.push(m);
    byCategory.set(cat, list);
  }

  for (const [cat, catMetrics] of byCategory) {
    console.log(`  ── ${cat} ──`);
    for (const m of catMetrics) {
      const icon = m.status === 'ok' ? '✅' : m.status === 'warning' ? '⚠' : '🔴';
      const target = m.target ? ` (${m.target})` : '';
      console.log(
        `    ${icon} ${m.id.padEnd(35)} value=${String(m.value).padEnd(5)} ${m.detail ?? ''}${target}`,
      );
    }
    console.log('');
  }

  // 자동 Observation 후보
  const autoObs = metricsToObservations(metrics);
  if (autoObs.length > 0) {
    console.log(`  ── 자동 Observation 후보 (${autoObs.length}건) ──`);
    for (const obs of autoObs) {
      console.log(`    ${obs.id}: ${obs.finding}`);
    }
    console.log(`\n  이 Observation을 DKG에 기록하려면 각각 dkg observe로 수동 등록하세요.`);
  }
}

// ── dkg converge ────────────────────────────────────

/**
 * 통합 convergence 파이프라인.
 * metrics + convergeChain + systemHealthChain을 순차 실행하고
 * --persist 시 결과를 DKG store에 자동 저장.
 */
export function dkgConverge(opts: { persist?: boolean; verbose?: boolean }): void {
  const graph = getGraph();
  const store = getStore();
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;

  console.log(`\n══ Convergence Pipeline ══`);

  // 1. Usage data 로드
  const recent = store.loadRecentVersionUsages(5);
  const usage: UsageData | null =
    recent.length > 0 && recent[0].versionUsages.length > 0
      ? {
          entryUsages: [] as EntryUsage[],
          addressUsages: [] as AddressUsage[],
          coOccurrences: [] as CoOccurrence[],
          versionUsages: recent.flatMap((s) => s.versionUsages),
          collectionPeriod: {
            from: recent[recent.length - 1]?.collectedAt ?? new Date().toISOString(),
            to: recent[0]?.collectedAt ?? new Date().toISOString(),
          },
        }
      : null;

  console.log(
    `  usage snapshots: ${recent.length}개 로드${usage ? ` (${usage.versionUsages.length} version usages)` : ' (없음)'}`,
  );

  // 2. Metrics 수집
  const metrics = collectMetrics(catalog, graph, usage, {
    schemaHealthAuditor: auditSchemaHealth,
  }) as MetricValue[];
  const ok = metrics.filter((m) => m.status === 'ok').length;
  const warning = metrics.filter((m) => m.status === 'warning').length;
  const critical = metrics.filter((m) => m.status === 'critical').length;
  console.log(
    `\n  metrics: ${metrics.length}건 (ok=${ok}, warning=${warning}, critical=${critical})`,
  );

  // 3. 자동 Observation 생성 + ok 복귀 시 자동 해소
  const autoObs = metricsToObservations(metrics);
  const existingObs = graph.getNodesByKind('observation');
  const autoResolved = resolveRecoveredMetrics(metrics, existingObs);

  if (autoObs.length > 0) {
    console.log(`  auto observations: ${autoObs.length}건`);
    if (opts.verbose) {
      for (const obs of autoObs) console.log(`    ${obs.id}: ${obs.finding.slice(0, 80)}`);
    }
  }
  if (autoResolved.length > 0) {
    console.log(`  auto-resolved: ${autoResolved.length}건 (metric ok 복귀)`);
    if (opts.verbose) {
      for (const obs of autoResolved) console.log(`    ✅ ${obs.id}`);
    }
  }

  // 4. Converge Chain
  const entriesMap = buildEntriesMap(catalog);
  const dkgUsage = usage ? toDkgUsageData(catalog, usage) : null;
  const convergeResult = convergeChain(catalog, graph, dkgUsage, { entriesMap });
  console.log(`\n  converge chain:`);
  console.log(`    actions: ${convergeResult.actions.length}건`);
  console.log(
    `    merges=${convergeResult.summary.merges}, deactivations=${convergeResult.summary.deactivations}, simplifications=${convergeResult.summary.simplifications}, observations=${convergeResult.summary.observations}`,
  );
  if (opts.verbose) {
    for (const action of convergeResult.actions) {
      const target = convergeActionTarget(action);
      console.log(`      [${action.kind}] ${target}`);
    }
  }

  // 5. System Health Chain
  const healthResult = systemHealthChain(graph);
  console.log(`\n  system health:`);
  console.log(`    steps: ${healthResult.steps.length}건`);
  for (const step of healthResult.steps) {
    const icon = step.status === 'ok' ? '✅' : step.status === 'warning' ? '⚠' : '🔴';
    console.log(`    ${icon} ${step.step}: ${step.message}`);
  }

  // 5.5. DSL 번들 불변조건 검증 (usage snapshot의 versionUsage에서 파생)
  if (usage && usage.versionUsages.length > 0) {
    // versionUsage → 간이 AddressContextRecord 변환 (prefix 존재만 체크)
    const prefixSet = new Set(usage.versionUsages.map((v) => v.prefix));
    const syntheticRecord: AddressContextRecord = {
      address_context: Object.fromEntries([...prefixSet].map((p) => [p, `${p}:v1:0`])),
      timestamp: new Date().toISOString(),
      session_id: 'converge',
    };
    const dslResult = validateDslInvariants(graph, [syntheticRecord]);
    console.log(`\n  dsl invariants: ${dslResult.summary}`);
    if (opts.verbose && dslResult.violations.length > 0) {
      for (const v of dslResult.violations) {
        console.log(`    ⚠ ${v.bundleId}: ${v.invariant.slice(0, 80)}`);
      }
    }
  }

  // 6. Persist (--persist)
  if (opts.persist) {
    console.log(`\n  ── 저장 ──`);

    // Stale timestamp 기반 observation 정리 (결정적 ID 전환 후)
    const cleaned = store.cleanStaleMetricObservations();
    if (cleaned > 0) {
      console.log(`    stale observation ${cleaned}건 정리 (timestamp→결정적 ID 전환)`);
    }

    // Resolved observation 정리 (30일 이상 경과)
    const pruned = store.pruneResolvedObservations(30);
    if (pruned > 0) {
      console.log(`    resolved observation ${pruned}건 정리 (30일 이상 경과)`);
    }

    // Usage snapshot + auto observations
    if (usage) {
      const snapResult = store.saveUsageSnapshotWithObservations(dkgUsage!, autoObs);
      console.log(
        `    usage snapshot #${snapResult.snapshotId} 저장 (observations: ${snapResult.observationsWritten})`,
      );
    } else if (autoObs.length > 0) {
      // usage 없어도 observation은 저장
      const edges = autoObs.flatMap((obs) =>
        (obs.subjects ?? []).map((s: string) => ({
          type: 'observes' as const,
          from: obs.id,
          to: s,
        })),
      );
      store.saveNodes(autoObs, edges, 'auto');
      console.log(`    observations ${autoObs.length}건 저장 (usage 없음)`);
    }

    // metric observation → 자동 prompts 연결 (Decision이 이미 존재하면 연결)
    let promptsLinked = 0;
    for (const obs of autoObs) {
      if (!obs.id?.startsWith('OBS-METRIC-')) continue;
      // 이미 prompts 엣지가 있으면 skip
      const existing = graph.neighbors(obs.id, 'prompts');
      if (existing.length > 0) continue;
      // subject에서 대상 식별 → 관련 Decision 검색
      for (const subject of obs.subjects ?? []) {
        const decisions = graph
          .reverseNeighbors(subject, 'governs')
          .concat(graph.reverseNeighbors(subject, 'justifies'));
        for (const decId of decisions) {
          store.saveNodes([], [{ type: 'prompts' as const, from: obs.id, to: decId }], 'auto');
          promptsLinked++;
          break; // 첫 매칭 Decision에만 연결
        }
      }
    }
    if (promptsLinked > 0) {
      console.log(`    metric observation → decision prompts ${promptsLinked}건 자동 연결`);
    }

    // Converge chain 결과 저장
    const allNodes: DkgNode[] = [...convergeResult.observations, ...convergeResult.decisions];
    if (allNodes.length > 0) {
      const edges = allNodes.flatMap((n) => {
        if (n.kind === 'observation') {
          return n.subjects.map((s) => ({ type: 'observes' as const, from: n.id, to: s }));
        }
        return [];
      });
      store.saveNodes(allNodes, edges, 'auto');
      console.log(`    converge 결과 ${allNodes.length}건 저장`);
    }

    // Auto-resolved observations 영속화
    if (autoResolved.length > 0) {
      for (const obs of autoResolved) {
        store.updateNode(obs);
      }
      console.log(`    auto-resolved ${autoResolved.length}건 영속화`);
    }

    // Monitoring observation 자동 만료 (30일 이상 변화 없음)
    const EXPIRE_DAYS = 30;
    const expireCutoff = new Date(Date.now() - EXPIRE_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    let expiredCount = 0;
    for (const obs of existingObs) {
      if (obs.resolution) continue;
      const obsNode = obs as ObservationNode;
      if (obsNode.intent !== 'monitoring') continue;
      if (obsNode.date > expireCutoff) continue;
      // 30일 이상 된 monitoring observation → 자동 만료
      const expired: ObservationNode = {
        ...obsNode,
        resolution: {
          decisionId: 'auto-expire',
          outcome: 'deferred' as const,
          note: `${EXPIRE_DAYS}일 이상 변화 없어 자동 만료`,
        },
      };
      store.updateNode(expired);
      graph.replaceNode(expired);
      expiredCount++;
    }
    if (expiredCount > 0) {
      console.log(`    monitoring 자동 만료: ${expiredCount}건 (${EXPIRE_DAYS}일 초과)`);
    }

    store.setMeta('last_convergence', new Date().toISOString());
    console.log(`    last_convergence 메타 업데이트`);
  }

  // 요약 + 미해결 observation 가이드
  const total =
    autoObs.length + convergeResult.observations.length + convergeResult.decisions.length;
  console.log(
    `\n  총 ${metrics.length} metrics, ${total} observations/decisions 생성, ${autoResolved.length} auto-resolved${opts.persist ? ' (저장됨)' : ' (--persist로 저장)'}`,
  );

  // 미해결 observation 카테고리별 안내
  const unresolvedObs = existingObs.filter((o) => !o.resolution);
  if (unresolvedObs.length > 0) {
    // ID 접두사 기반 카테고리 분류 (실제 ID 패턴에서 파생)
    const groups: Record<string, typeof unresolvedObs> = {};
    for (const obs of unresolvedObs) {
      let category: string;
      if (obs.id.startsWith('OBS-METRIC-metric-coverage-')) category = 'coverage-gap';
      else if (obs.id.startsWith('OBS-METRIC-metric-health-')) category = 'domain-health';
      else if (obs.id.startsWith('OBS-METRIC-')) category = 'metric';
      else if (obs.id.startsWith('OBS-FLOW-')) category = 'flow-violation';
      else if (obs.id.startsWith('OBS-SELF-')) category = 'self-check';
      else category = 'other';
      (groups[category] ??= []).push(obs);
    }

    console.log(`\n  ── 미해결 observation (${unresolvedObs.length}건) ──`);
    for (const [category, items] of Object.entries(groups)) {
      console.log(`\n    [${category}] ${items.length}건`);
      const top = items.slice(0, 2);
      for (const obs of top) {
        console.log(`      ${obs.id}: ${obs.finding?.slice(0, 60) ?? '?'}`);
      }
      if (items.length > 2) {
        console.log(`      ... 외 ${items.length - 2}건`);
      }
    }
    console.log(`\n  해소 방법: qa-sdk dkg resolve <obsId> --decision <decId> --outcome accepted`);
  }
}

// ── dkg patterns — 패턴 규칙 조회 ──────────────────────

export function dkgPatterns(): void {
  console.log(`\n══ 패턴 분류 규칙 (${DEMO_PATTERN_RULES.length}개) ══\n`);
  for (const rule of DEMO_PATTERN_RULES) {
    const icon =
      rule.identificationMode === 'service'
        ? '🤖'
        : rule.identificationMode === 'anonymous'
          ? '👤'
          : '🔑';
    console.log(`  ${icon} ${rule.id}`);
    console.log(
      `     mode=${rule.identificationMode} pattern=${rule.behaviorPattern} confidence=${rule.defaultConfidence} priority=${rule.priority ?? 0}`,
    );
    if (rule.description) console.log(`     ${rule.description}`);
    const m = rule.match;
    if (m.requiredKeys?.length) console.log(`     required: [${m.requiredKeys.join(', ')}]`);
    if (m.excludedKeys?.length) console.log(`     excluded: [${m.excludedKeys.join(', ')}]`);
    if (m.requiredSequence?.length)
      console.log(`     sequence: [${m.requiredSequence.join(' → ')}]`);
  }
}

// ── dkg pattern-stats — 패턴 건전성 ────────────────────

export function dkgPatternStats(): void {
  // 현재 저장된 스냅샷에서 패턴 데이터를 조회하는 것은 수집이 활성화된 후에 가능
  // 여기서는 규칙 기반 시뮬레이션 출력
  console.log(`\n══ 패턴 통계 ══\n`);
  console.log(`  (패턴 수집이 활성화되면 여기에 실시간 통계가 표시됩니다)`);
  console.log(`  활성화: PATTERN_CLASSIFICATION_ENABLED=true`);
  console.log(`\n  등록된 규칙: ${DEMO_PATTERN_RULES.length}개`);

  const byMode = new Map<string, number>();
  for (const r of DEMO_PATTERN_RULES) {
    byMode.set(r.identificationMode, (byMode.get(r.identificationMode) ?? 0) + 1);
  }
  console.log(`\n  식별 모드별 규칙 수:`);
  for (const [mode, count] of byMode) {
    console.log(`    ${mode}: ${count}개`);
  }
}

// ── dkg publish ─────────────────────────────────────

export async function dkgPublish(opts: { registry?: string; versionId?: string }): Promise<void> {
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;
  const registryUrl = opts.registry ?? process.env.QA_REGISTRY_URL ?? 'http://localhost:3300';
  const versionId = opts.versionId ?? 'v1';

  console.log(`\n══ Publish to Registry ══`);
  console.log(`  catalog: ${activeCatalogId}`);
  console.log(`  registry: ${registryUrl}`);
  console.log(`  versionId: ${versionId}\n`);

  // 1. catalog → SchemaSnapshot
  const snapshot = catalogToSchemaSnapshot(catalog, { id: activeCatalogId });
  console.log(`  axes: ${snapshot.axes.length}`);
  console.log(`  composites: ${snapshot.composites.length}`);

  // 2. registry-service에 import
  try {
    const res = await fetch(`${registryUrl}/schema/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, versionId }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`  registry 오류 (${res.status}): ${errBody}`);
      return;
    }

    const result = (await res.json()) as {
      imported: { axes: number; composites: number; versionId: string };
      analysis: {
        ready: boolean;
        diagnostics: Array<{ level: string; prefix: string; message: string }>;
        releaseOrder: string[];
      };
    };

    console.log(
      `\n  imported: axes=${result.imported.axes}, composites=${result.imported.composites}`,
    );
    console.log(`  ready: ${result.analysis.ready}`);

    if (result.analysis.diagnostics.length > 0) {
      console.log(`  diagnostics:`);
      for (const d of result.analysis.diagnostics) {
        const icon = d.level === 'error' ? '🔴' : d.level === 'warn' ? '⚠' : 'ℹ';
        console.log(`    ${icon} ${d.prefix}: ${d.message}`);
      }
    }

    if (result.analysis.releaseOrder.length > 0) {
      console.log(`  release order: ${result.analysis.releaseOrder.join(' → ')}`);
    }

    emitDkgEvent('promote', 'system', 'publish', {
      command: 'dkg publish',
    });
  } catch (err: unknown) {
    console.error(`  연결 실패: ${errorMessage(err)}`);
    console.error(`  registry-service가 ${registryUrl}에서 실행 중인지 확인하세요.`);
  }
}

// ── dkg version ─────────────────────────────────────

export async function dkgVersion(
  action: string,
  prefix: string,
  versionId: string,
  opts: { registry?: string },
): Promise<void> {
  const registryUrl = opts.registry ?? process.env.QA_REGISTRY_URL ?? 'http://localhost:3300';

  if (action === 'list') {
    try {
      const res = await fetch(`${registryUrl}/prefixes/${prefix}/versions`);
      if (!res.ok) {
        console.error(`오류: ${res.status}`);
        return;
      }
      const versions = (await res.json()) as Array<{
        versionId: string;
        status: string;
        capacity: number;
        shape?: number[];
        stride?: number[];
      }>;
      console.log(`\n══ Versions: ${prefix} ══`);
      for (const v of versions) {
        const icon =
          v.status === 'active'
            ? '✅'
            : v.status === 'draft'
              ? '📝'
              : v.status === 'locked'
                ? '🔒'
                : '⏸';
        console.log(
          `  ${icon} ${v.versionId.padEnd(8)} [${v.status}] cap=${v.capacity}${v.shape ? ` shape=[${v.shape}]` : ''}${v.stride ? ` stride=[${v.stride}]` : ''}`,
        );
      }
    } catch (err: unknown) {
      console.error(`연결 실패: ${errorMessage(err)}`);
    }
    return;
  }

  const endpoints: Record<string, string> = {
    lock: 'lock',
    unlock: 'unlock',
    release: 'release',
    activate: 'activate',
    deprecate: 'deprecate',
  };
  const endpoint = endpoints[action];
  if (!endpoint) {
    console.error(`알 수 없는 action: ${action}. (list|lock|release|activate|deprecate)`);
    return;
  }

  const beforeStatus = await fetchVersionStatus(registryUrl, prefix, versionId);

  try {
    const res = await fetch(`${registryUrl}/prefixes/${prefix}/versions/${versionId}/${endpoint}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.text();
      persistAuditRecord({
        eventKey: 'cli.dkg.version',
        eventPrefix: 'cli_event',
        command: 'dkg version',
        targetId: `${prefix}:${versionId}`,
        targetKind: 'version',
        lifecycleFrom: beforeStatus,
        payload: {
          action,
          prefix,
          versionId,
          registryUrl,
          ok: false,
          statusCode: res.status,
          error: body.slice(0, 400),
        },
      });
      console.error(`오류 (${res.status}): ${body}`);
      return;
    }
    const result = await res.json();
    const afterStatus = await fetchVersionStatus(registryUrl, prefix, versionId);
    console.log(`\n  ${prefix}:${versionId} → ${action} 완료`);
    if (action === 'activate' && result) {
      console.log(`  결과:`, JSON.stringify(result, null, 2).slice(0, 200));
    }

    // version 상태 전이 후 자동 drift check
    if (action === 'activate' || action === 'deprecate') {
      console.log(`\n  prefix drift check (${prefix})...`);
      try {
        const { prefixDrift } = await import('./prefix-stamp.js');
        const catalog = DEMO_CATALOG as import('@qa-sdk/core').Catalog;
        if (catalog) prefixDrift(catalog);
      } catch {
        console.log('  drift check 건너뜀 (카탈로그 로드 실패)');
      }
    }

    persistAuditRecord({
      eventKey: 'cli.dkg.version',
      eventPrefix: 'cli_event',
      command: 'dkg version',
      targetId: `${prefix}:${versionId}`,
      targetKind: 'version',
      lifecycleFrom: beforeStatus,
      lifecycleTo: afterStatus ?? action,
      payload: {
        action,
        prefix,
        versionId,
        registryUrl,
        beforeStatus,
        afterStatus,
        ok: true,
        ...(result && typeof result === 'object' ? { result } : {}),
      },
    });
  } catch (err: unknown) {
    persistAuditRecord({
      eventKey: 'cli.dkg.version',
      eventPrefix: 'cli_event',
      command: 'dkg version',
      targetId: `${prefix}:${versionId}`,
      targetKind: 'version',
      lifecycleFrom: beforeStatus,
      payload: {
        action,
        prefix,
        versionId,
        registryUrl,
        ok: false,
        error: errorMessage(err),
      },
    });
    console.error(`연결 실패: ${errorMessage(err)}`);
  }
}

// ── dkg spec ────────────────────────────────────────

export function dkgSpecAdd(opts: {
  id: string;
  type: string;
  title: string;
  lifecycle?: string;
  rationale?: string;
  governs?: string[];
}): void {
  const graph = getGraph();
  const store = getStore();

  const validTypes = ['req', 'feat', 'uc', 'evt', 'ls', 'adr'];
  if (!validTypes.includes(opts.type)) {
    console.error(`  유효하지 않은 type: ${opts.type} (${validTypes.join(', ')})`);
    return;
  }

  const existing = graph.getNode(opts.id);
  if (existing) {
    console.error(`  이미 존재: ${opts.id}`);
    return;
  }

  const spec = {
    kind: 'spec' as const,
    id: opts.id,
    type: opts.type as 'req' | 'feat' | 'uc' | 'evt' | 'ls' | 'adr',
    title: opts.title,
    lifecycle: (opts.lifecycle ?? 'draft') as 'draft' | 'active' | 'deprecated',
    rationale: opts.rationale,
  };

  const edges: Array<{ type: DkgEdgeType; from: string; to: string }> = [];
  if (opts.governs) {
    for (const target of opts.governs) {
      if (graph.getNode(target)) {
        edges.push({ type: 'governs', from: opts.id, to: target });
      }
    }
  }

  graph.addNode(spec);
  for (const e of edges) graph.addEdge(e.type, e.from, e.to);
  store.saveNodes([spec], edges, 'manual');

  // spec_event 기록
  emitSpecEvent(opts.type, opts.lifecycle ?? 'draft', {
    targetId: opts.id,
    command: 'dkg spec add',
  });

  emitDkgEvent('decide', 'spec', opts.id, {
    command: 'dkg spec add',
  });

  console.log(`\n══ Spec 등록 완료 ══`);
  console.log(`  id:        ${opts.id}`);
  console.log(`  type:      ${opts.type}`);
  console.log(`  title:     ${opts.title}`);
  console.log(`  lifecycle: ${opts.lifecycle ?? 'draft'}`);
  if (edges.length > 0) console.log(`  governs:   ${edges.map((e) => e.to).join(', ')}`);
}

export function dkgSpecList(): void {
  const graph = getGraph();
  const specs = graph.getNodesByKind('spec');

  console.log(`\n══ Spec Documents (${specs.length}개) ══`);
  if (specs.length === 0) {
    console.log('  (없음)');
    return;
  }

  const byType = new Map<string, typeof specs>();
  for (const s of specs) {
    const list = byType.get(s.type) ?? [];
    list.push(s);
    byType.set(s.type, list);
  }

  for (const [type, items] of byType) {
    console.log(`\n  [${type}]`);
    for (const s of items) {
      const icon = s.lifecycle === 'active' ? '✅' : s.lifecycle === 'draft' ? '📝' : '⏸';
      const governs = graph.neighbors(s.id, 'governs');
      const governsStr = governs.length > 0 ? ` → ${governs.join(', ')}` : '';
      console.log(`    ${icon} ${s.id.padEnd(25)} ${s.title}${governsStr}`);
    }
  }
}

export function dkgSpecTransition(specId: string, toLifecycle: string): void {
  const graph = getGraph();
  const store = getStore();

  const specNode = graph.getNode(specId);
  if (!specNode || specNode.kind !== 'spec') {
    console.error(`  spec을 찾을 수 없음: ${specId}`);
    return;
  }
  const spec = specNode as SpecNode;

  const validLifecycles = ['draft', 'active', 'deprecated'] as const;
  if (!validLifecycles.includes(toLifecycle as (typeof validLifecycles)[number])) {
    console.error(`  유효하지 않은 lifecycle: ${toLifecycle} (${validLifecycles.join(', ')})`);
    return;
  }

  const fromLifecycle = spec.lifecycle;
  const updated = { ...spec, lifecycle: toLifecycle as SpecNode['lifecycle'] };
  graph.replaceNode(updated);
  store.saveNodes([updated], [], 'manual');

  // spec_event 기록
  emitSpecEvent(spec.type, toLifecycle, {
    targetId: specId,
    lifecycleFrom: fromLifecycle,
    command: 'dkg spec transition',
  });
  emitDkgEvent('transition', 'spec', specId, {
    command: 'dkg spec transition',
    lifecycleFrom: fromLifecycle,
    lifecycleState: toLifecycle,
  });

  console.log(`\n══ Spec Transition ══`);
  console.log(`  ${specId}: ${fromLifecycle} → ${toLifecycle}`);
}

/** spec 변경 이벤트를 spec_event prefix로 기록 */
function emitSpecEvent(
  specType: string,
  lifecycleState: string,
  extra?: { targetId?: string; lifecycleFrom?: string; command?: string },
): void {
  try {
    const collectedAt = now();
    const ver = latestVer('spec_event');
    const address = encodePrefixByValue(DEMO_CATALOG, 'spec_event', ver, {
      spec_type: specType,
      lifecycle_state: lifecycleState,
    });
    const serialized = serializeAddressContext('spec_event', ver, address);
    saveUsageTelemetry({
      collectedAt,
      entryUsages: [
        { axisId: 'spec_type', entry: specType, count: 1, lastSeen: collectedAt },
        { axisId: 'lifecycle_state', entry: lifecycleState, count: 1, lastSeen: collectedAt },
      ],
      addressUsages: [{ prefix: 'spec_event', version: ver, address, count: 1 }],
      versionPrefixes: [{ prefix: 'spec_event', version: ver }],
    });
    persistAuditRecord({
      eventKey: 'cli.spec.lifecycle',
      eventPrefix: 'spec_event',
      command: extra?.command ?? 'dkg spec',
      targetId: extra?.targetId,
      targetKind: 'spec',
      lifecycleFrom: extra?.lifecycleFrom,
      lifecycleTo: lifecycleState,
      addressContext: { spec_event: serialized },
      payload: {
        specType,
        lifecycleState,
        ...(extra?.targetId ? { targetId: extra.targetId } : {}),
        ...(extra?.lifecycleFrom ? { lifecycleFrom: extra.lifecycleFrom } : {}),
      },
    });
  } catch {
    /* 기록 실패 시 무시 */
  }
}

// ── dkg reset ───────────────────────────────────────

export function dkgReset(target: string, opts: { catalogId?: string; confirm?: boolean }): void {
  const store = getStore(opts.catalogId);

  if (!opts.confirm) {
    console.log(`\n══ Reset: ${target} ══`);
    console.log(`  catalog: ${store.catalogId}`);
    console.log(`  대상: ${target}`);
    console.log(`\n  현재 상태:`);
    const stats = store.stats();
    console.log(
      `    nodes: ${stats.nodes} (bootstrap: ${stats.bootstrapNodes}, manual: ${stats.manualNodes})`,
    );
    console.log(`    edges: ${stats.edges}`);
    console.log(`    snapshots: ${stats.snapshots}`);
    console.log(`\n  --confirm 플래그로 실행을 확인하세요.`);
    return;
  }

  console.log(`\n══ Reset: ${target} (--confirm) ══`);

  switch (target) {
    case 'bootstrap': {
      const result = store.clearBootstrap();
      console.log(`  bootstrap 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      console.log(`  → dkg refresh로 재부트스트랩하세요.`);
      break;
    }
    case 'operational': {
      const result = store.clearOperational();
      console.log(`  운영 데이터 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      console.log(`  (observation, decision, claim 등 manual/auto/metric 데이터)`);
      break;
    }
    case 'snapshots': {
      const result = store.clearSnapshots();
      console.log(
        `  스냅샷 삭제: ${result.snapshotsDeleted} snapshots, ${result.versionUsagesDeleted} version usages`,
      );
      break;
    }
    case 'auto': {
      const result = store.clearBySource('auto');
      console.log(`  auto 데이터 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      break;
    }
    case 'catalog': {
      const catId = opts.catalogId ?? 'demo';
      const result = store.deleteCatalog(catId);
      console.log(
        `  카탈로그 '${catId}' 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`,
      );
      break;
    }
    case 'all': {
      const snapResult = store.clearSnapshots();
      const catResult = store.deleteCatalog(store.catalogId);
      console.log(`  전체 초기화:`);
      console.log(`    nodes: ${catResult.nodesDeleted}, edges: ${catResult.edgesDeleted}`);
      console.log(
        `    snapshots: ${snapResult.snapshotsDeleted}, versionUsages: ${snapResult.versionUsagesDeleted}`,
      );
      console.log(`  → dkg refresh로 재부트스트랩하세요.`);
      break;
    }
    default:
      console.error(`  알 수 없는 대상: ${target}`);
      console.error(`  사용 가능: bootstrap, operational, snapshots, auto, catalog, all`);
  }

  emitCliEvent('dkg reset');
}

// ── dkg promote ─────────────────────────────────────

export function dkgPromoteScan(): void {
  const graph = getGraph();
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;

  emitDkgEvent('promote', 'system', 'scan', {
    command: 'dkg promote',
  });

  // 기존 축 이름 수집
  const existingAxes = new Set(Object.keys(catalog.axes ?? {}));

  const candidates = scanPromotionCandidates(graph, { existingAxes });

  console.log(`\n══ Coordinate Promotion Scan ══`);
  console.log(`  후보: ${candidates.length}건\n`);

  const promote = candidates.filter((c) => c.verdict === 'promote');
  const review = candidates.filter((c) => c.verdict === 'review');
  const keep = candidates.filter((c) => c.verdict === 'keep');

  if (promote.length > 0) {
    console.log(`  ── 승격 권장 (${promote.length}건) ──`);
    for (const c of promote) {
      console.log(`    ${c.field.padEnd(30)} [${c.source}]`);
      console.log(
        `      values: [${c.values.slice(0, 6).join(', ')}${c.values.length > 6 ? ', ...' : ''}] (${c.values.length}개)`,
      );
      console.log(
        `      5Q: finite=${c.q1_finite} decision=${c.q2_decision} shared=${c.q3_shared} stable=${c.q4_stable} cap=${c.q5_capacity}`,
      );
      console.log(`      → ${c.reason}`);
    }
  }

  if (review.length > 0) {
    console.log(`\n  ── 검토 필요 (${review.length}건) ──`);
    for (const c of review) {
      console.log(`    ${c.field.padEnd(30)} [${c.source}]`);
      console.log(
        `      values: [${c.values.slice(0, 6).join(', ')}${c.values.length > 6 ? ', ...' : ''}] (${c.values.length}개)`,
      );
      console.log(`      → ${c.reason}`);
    }
  }

  if (keep.length > 0) {
    console.log(`\n  ── 유지 (${keep.length}건) ──`);
    for (const c of keep) {
      const tag = c.alreadyAxis ? ' [이미 축]' : '';
      console.log(`    ${c.field.padEnd(30)} ${c.reason}${tag}`);
    }
  }

  console.log(`\n  승격=${promote.length}, 검토=${review.length}, 유지=${keep.length}`);
}

// ── dkg self-check ──────────────────────────────────

const SELF_CHECK_PKGS = [
  // 기존 12개
  { name: 'spec-core', filter: '@qa-sdk/spec-core', hasTest: true, hasBuild: true },
  { name: 'cli', filter: '@qa-sdk/cli', hasTest: true, hasBuild: true },
  { name: 'sdk', filter: '@qa-sdk/sdk', hasTest: true, hasBuild: true },
  { name: 'demo-snapshot', filter: 'demo-snapshot', hasTest: true, hasBuild: true },
  { name: 'weighted-index', filter: 'weighted-index', hasTest: true, hasBuild: true },
  { name: 'bit-index', filter: 'bit-index', hasTest: true, hasBuild: true },
  { name: 'permission-engine', filter: 'permission-engine', hasTest: true, hasBuild: true },
  { name: 'index-meta', filter: 'index-meta', hasTest: true, hasBuild: true },
  { name: 'platform-demo', filter: 'platform-demo', hasTest: false, hasBuild: true },
  { name: 'ingest-server', filter: '@qa-sdk/ingest-server', hasTest: true, hasBuild: true },
  { name: 'registry-service', filter: '@qa-sdk/registry-service', hasTest: true, hasBuild: true },
  { name: 'e2e', filter: '@qa-sdk/e2e', hasTest: true, hasBuild: false },
  // 서비스 + 코어 8개 추가
  { name: 'core', filter: '@qa-sdk/core', hasTest: true, hasBuild: true },
  { name: 'engine', filter: '@qa-sdk/engine', hasTest: true, hasBuild: true },
  { name: 'store', filter: '@qa-sdk/store', hasTest: true, hasBuild: true },
  { name: 'gate-service', filter: 'gate-service', hasTest: true, hasBuild: true },
  { name: 'query-service', filter: 'query-service', hasTest: true, hasBuild: true },
  { name: 'decode-service', filter: '@qa-sdk/decode-service', hasTest: true, hasBuild: true },
  { name: 'registry-client', filter: '@qa-sdk/registry-client', hasTest: true, hasBuild: true },
  // 미관리 → 관리 전환 (8개)
  { name: 'apm', filter: '@qa-sdk/apm', hasTest: true, hasBuild: true },
  { name: 'browser-sdk', filter: '@qa-sdk/browser', hasTest: true, hasBuild: true },
  { name: 'event-catalog', filter: '@qa-sdk/event-catalog', hasTest: true, hasBuild: true },
  { name: 'pino', filter: '@qa-sdk/pino', hasTest: true, hasBuild: true },
  { name: 'viz-3d', filter: '@qa-sdk/viz-3d', hasTest: true, hasBuild: true },
  { name: 'viz-web', filter: '@qa-sdk/viz-web', hasTest: true, hasBuild: true },
  { name: 'demo-tests', filter: 'demo-tests', hasTest: true, hasBuild: false },
  { name: 'weighted-wasm', filter: 'weighted-wasm', hasTest: true, hasBuild: true },
];

/**
 * 테스트 파일명 → api_surface 매핑.
 * vitest 출력에서 파일명을 파싱하여 해당 인터페이스 영역을 결정한다.
 */
const FILE_TO_SURFACE: Record<string, string> = {
  // encode-decode: 라운드트립
  'weighted-index.test': 'encode-decode',
  'weighted-index-big.test': 'encode-decode',
  'bit-index.test': 'encode-decode',
  'bridge.test': 'encode-decode',
  'meta-codec.test': 'encode-decode',
  'meta-codec-big.test': 'encode-decode',
  'prefix-registry.test': 'encode-decode',
  'label-registry.test': 'encode-decode',
  'prefix-decoder.test': 'encode-decode',
  // stride-calc
  'calc.test': 'stride-calc',
  'layout-fit.test': 'stride-calc',
  'layout-fit-bigint.test': 'stride-calc',
  'capacity-planner.test': 'stride-calc',
  'capacity-guard.test': 'stride-calc',
  // bitmask-ops
  'bitmask.test': 'bitmask-ops',
  'bit-field-layout.test': 'bitmask-ops',
  'bit-mask-set.test': 'bitmask-ops',
  'bit-width.test': 'bitmask-ops',
  // dim-extract
  'partial-binder.test': 'dim-extract',
  // perm-grant
  'permission-set.test': 'perm-grant',
  'permission-view-cache.test': 'perm-grant',
  'scoped-engine.test': 'perm-grant',
  'ternary-mask.test': 'perm-grant',
  // protocol-codec
  'permission-codec.test': 'protocol-codec',
  'composite-address.test': 'protocol-codec',
  'semantic-address.test': 'protocol-codec',
  'pack-format.test': 'protocol-codec',
  'format-adapter.test': 'protocol-codec',
  // state-lifecycle
  'migration.test': 'state-lifecycle',
  'migrate-address.test': 'state-lifecycle',
  'version-lifecycle.test': 'state-lifecycle',
  'entry-metadata-store.test': 'state-lifecycle',
  'sql-entry-flag-store.test': 'state-lifecycle',
  'memory-store.test': 'state-lifecycle',
  'sql-store.test': 'state-lifecycle',
  'address-protocol-manager.test': 'state-lifecycle',
  'lifecycle.test': 'state-lifecycle',
  'activation-gate.test': 'state-lifecycle',
  // query-resolve
  'cross-index-query.test': 'query-resolve',
  'gate-aware-query.test': 'query-resolve',
  'version-query.test': 'query-resolve',
  'address-resolver.test': 'query-resolve',
  'meta-resolver.test': 'query-resolve',
  'address-range-cache.test': 'query-resolve',
  // schema-validate
  'schema.test': 'schema-validate',
  'category-rules.test': 'schema-validate',
  'validate-entry.test': 'schema-validate',
  'compile-schema.test': 'schema-validate',
  'spec-loader.test': 'schema-validate',
  'table-def.test': 'schema-validate',
  // convergence-analysis
  'convergence.test': 'convergence-analysis',
  'deployment-skew.test': 'convergence-analysis',
  'capacity-optimizer.test': 'convergence-analysis',
  'category-filter.test': 'convergence-analysis',
  'pipeline-e2e.test': 'convergence-analysis',
  'observation-lifecycle.test': 'convergence-analysis',
  'ref-entries-sync.test': 'convergence-analysis',
  // dkg-graph
  'dkg.test': 'dkg-graph',
  'dkg-sqlite-store.test': 'dkg-graph',
  'claim-operation.test': 'dkg-graph',
  'record-operation.test': 'dkg-graph',
  'skills-suite.test': 'dkg-graph',
  'trace-demo.test': 'dkg-graph',
  'service-explorer.test': 'dkg-graph',
  'doc-sync.test': 'dkg-graph',
  'semantic-ref.test': 'dkg-graph',
  'converge-chain.test': 'dkg-graph',
  'converge-review.test': 'dkg-graph',
  // integration
  'self-evaluation.test': 'integration',
  'lifecycle-e2e.test': 'integration',
  'cli-query.test': 'integration',
  'operational-loop.test': 'integration',
  'dsl-e2e.test': 'integration',
  'shopping-flow.test': 'integration',
  'demo-run.test': 'integration',
  'scenarios.test': 'integration',
};

/** 테스트 파일 → qa_module 매핑 (spec-core 세분화) */
const FILE_TO_MODULE: Record<string, string> = {
  // schema
  'category-rules.test': 'schema',
  'schema.test': 'schema',
  'schema-prefix-consumer.test': 'schema',
  // export-surface
  'export-surface.registry.test': 'export-surface',
  // spec
  'spec-document.registry.test': 'spec',
  // loader
  'catalog-bridge.test': 'loader',
  'spec-loader.test': 'loader',
  // codegen
  'codegen.test': 'codegen',
  // dkg
  'dkg.test': 'dkg',
  'doc-sync.test': 'dkg',
  'semantic-ref.test': 'dkg',
  'cli-query.test': 'dkg',
  'lifecycle-e2e.test': 'dkg',
  // dkg-skills
  'skills-suite.test': 'dkg-skills',
  'trace-demo.test': 'dkg-skills',
  'service-explorer.test': 'dkg-skills',
  'claim-operation.test': 'dkg-skills',
  'record-operation.test': 'dkg-skills',
  'converge-chain.test': 'dkg-skills',
  'converge-review.test': 'dkg-skills',
  'operational-loop.test': 'dkg-skills',
  // convergence
  'convergence.test': 'convergence',
  'capacity-optimizer.test': 'convergence',
  'category-filter.test': 'convergence',
  'deployment-skew.test': 'convergence',
  'observation-lifecycle.test': 'convergence',
  'pattern-classifier.test': 'convergence',
  'pipeline-e2e.test': 'convergence',
  'ref-entries-sync.test': 'convergence',
  'self-check-analyzer.test': 'convergence',
  // propagation
  'activation-gate.test': 'propagation',
  'lifecycle.test': 'propagation',
  'publish.test': 'propagation',
  // store
  'dkg-sqlite-store.test': 'store',
  // visualization
  'self-evaluation.test': 'visualization',
  // shared (demo-run, scenarios)
  'demo-run.test': 'shared',
  'scenarios.test': 'shared',
};

/** E2E 시나리오 → qa_module 매핑 */
const E2E_SCENARIOS = [
  'shopping-flow',
  'event-pipeline',
  'iframe-integration',
  'scenario-selector',
  'shop-ingest-integration',
  'anonymous-browse',
  'cart-abandon',
  'multi-product-purchase',
] as const;

interface SelfCheckResult {
  pkg: string;
  kind: 'build' | 'test';
  result: string;
  /** qa_module 값 (E2E 시나리오명 또는 "_all") */
  module?: string;
  tests?: number;
  passed?: number;
  failed?: number;
  durationMs?: number;
}

/**
 * dkg self-check — 빌드/테스트 실행 + 좌표 인코딩 + convergence 분석 + invariant 검증.
 *
 * 기본(dry-run): 분석 결과를 출력만. DKG 상태 변경 없음.
 * --apply: snapshot 저장 + observation 생성/해소를 수행.
 *
 * DEC-CAPACITY-dsl-dev-mmzyw4go: CLI는 데이터 공급/탐색 인터페이스.
 */
export function dkgSelfCheck(opts: { apply?: boolean; fast?: boolean } = {}): void {
  const apply = opts.apply ?? false;
  const fast = opts.fast ?? false;
  const graph = getGraph();
  const store = apply ? getStore() : null;

  const now = new Date().toISOString();
  const runId = `self-check-${Date.now()}`;
  const results: SelfCheckResult[] = [];
  const fileContracts: Array<{ pkg: string; surface: string; result: string }> = [];
  const cwd = process.env.HOME ? join(process.env.HOME, 'workflow/qa-sdk') : '.';

  console.log(`\n══ Self-Check${fast ? ' (--fast)' : ''}${apply ? ' (--apply)' : ''} ══`);
  console.log(`  run: ${runId}\n`);

  // ════════════════════════════════════════════════════════════
  //  Step 1: 빌드/테스트 실행 (--fast 시 스킵)
  // ════════════════════════════════════════════════════════════

  if (fast) {
    console.log(`\n  ── Phase A: 스킵 (--fast) ──`);
    // mock 결과로 대체 — analyzeSelfCheck에서 합성 이벤트 생성에만 사용
    for (const pkg of SELF_CHECK_PKGS) {
      results.push({
        pkg: pkg.name,
        kind: 'build',
        module: '_all',
        result: 'success',
        durationMs: 0,
      });
      if (pkg.hasTest)
        results.push({
          pkg: pkg.name,
          kind: 'test',
          module: '_all',
          result: 'passed',
          tests: 0,
          passed: 0,
          failed: 0,
          durationMs: 0,
        });
    }
  } else {
    console.log(`  ── Build ──`);
    for (const pkg of SELF_CHECK_PKGS) {
      if (!pkg.hasBuild) {
        results.push({
          pkg: pkg.name,
          kind: 'build',
          module: '_all',
          result: 'skipped',
          durationMs: 0,
        });
        console.log(`    ⏭ ${pkg.name.padEnd(20)} (no build script)`);
        continue;
      }
      const t0 = Date.now();
      let result: string;
      try {
        execaSync('pnpm', ['--filter', pkg.filter, 'build'], { cwd, timeout: 60000 });
        result = 'success';
      } catch (err: unknown) {
        const execErr = err as { stderr?: string; stdout?: string };
        const stderr = (execErr.stderr ?? '') + (execErr.stdout ?? '');
        result = stderr.includes('TS') ? 'type-error' : 'failure';
      }
      const dur = Date.now() - t0;
      results.push({ pkg: pkg.name, kind: 'build', module: '_all', result, durationMs: dur });
      const icon = result === 'success' ? '✅' : result === 'type-error' ? '🔴' : '⚠';
      console.log(`    ${icon} ${pkg.name.padEnd(20)} ${result} (${dur}ms)`);
    }

    console.log(`\n  ── Test ──`);
    for (const pkg of SELF_CHECK_PKGS) {
      if (!pkg.hasTest) {
        console.log(`    ⏭ ${pkg.name.padEnd(20)} (no tests)`);
        continue;
      }

      // E2E 패키지: 시나리오별로 분리 실행
      if (pkg.name === 'e2e') {
        console.log(`    📋 ${pkg.name.padEnd(20)} (시나리오별 실행)`);
        for (const scenario of E2E_SCENARIOS) {
          const t0 = Date.now();
          let result: string;
          let tests = 0,
            passed = 0,
            failed = 0;
          try {
            const { stdout: output } = execaSync(
              'pnpm',
              ['--filter', pkg.filter, 'exec', 'playwright', 'test', `tests/${scenario}.spec.ts`],
              { cwd, timeout: 180000 },
            );
            const passedMatch = output.match(/(\d+)\s+passed/);
            const failedMatch = output.match(/(\d+)\s+failed/);
            passed = passedMatch ? parseInt(passedMatch[1]) : 0;
            failed = failedMatch ? parseInt(failedMatch[1]) : 0;
            tests = passed + failed;
            result = failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'skipped';
          } catch {
            result = 'error';
          }
          const dur = Date.now() - t0;
          results.push({
            pkg: pkg.name,
            kind: 'test',
            module: scenario,
            result,
            tests,
            passed,
            failed,
            durationMs: dur,
          });
          const icon = result === 'passed' ? '✅' : result === 'failed' ? '⚠' : '🔴';
          const detail = result === 'error' ? '실행 실패' : `${passed}/${tests} (${dur}ms)`;
          console.log(`      ${icon} ${scenario.padEnd(28)} ${result} ${detail}`);
        }
        continue;
      }

      const t0 = Date.now();
      let result: string;
      let tests = 0,
        passed = 0,
        failed = 0;
      let output = '';
      try {
        output =
          execaSync('pnpm', ['--filter', pkg.filter, 'test'], { cwd, timeout: 120000, all: true })
            .all ?? '';
        const testsMatch = output.match(/Tests\s+(\d+)\s+passed/);
        const altPassMatch = output.match(/(\d+)\s+passed\s+\((\d+)\)/);
        const failMatch = output.match(/(\d+)\s+failed/);
        passed = testsMatch
          ? parseInt(testsMatch[1])
          : altPassMatch
            ? parseInt(altPassMatch[1])
            : parseInt(output.match(/(\d+) passed/)?.[1] ?? '0');
        failed = failMatch ? parseInt(failMatch[1]) : 0;
        tests = passed + failed;
        result = failed > 0 ? 'failed' : 'passed';
      } catch {
        result = 'error';
      }
      const dur = Date.now() - t0;
      results.push({
        pkg: pkg.name,
        kind: 'test',
        module: '_all',
        result,
        tests,
        passed,
        failed,
        durationMs: dur,
      });
      const icon = result === 'passed' ? '✅' : result === 'failed' ? '⚠' : '🔴';
      const detail = result === 'error' ? '실행 실패' : `${passed}/${tests} (${dur}ms)`;
      console.log(`    ${icon} ${pkg.name.padEnd(20)} ${result} ${detail}`);

      // 파일별 결과 파싱 → contract_check 기록
      // vitest 출력: " ✓ src/path/file.test.ts  (N tests) Xms" 또는 " × src/path/file.test.ts"
      if (output) {
        const fileLines = output.split('\n').filter((l) => l.match(/[✓×✗]\s+\S+\.test\.ts/));
        for (const line of fileLines) {
          const fileMatch = line.match(/([✓×✗])\s+\S*?([\w][\w.-]*?)\.test\.ts/);
          if (!fileMatch) continue;
          const fileStatus = fileMatch[1] === '✓' ? 'passed' : 'failed';
          const fileName = fileMatch[2];
          const surface = FILE_TO_SURFACE[`${fileName}.test`];
          if (surface) {
            fileContracts.push({ pkg: pkg.name, surface, result: fileStatus });
          }
          // qa_module별 test_event 레코드 생성
          const mod = FILE_TO_MODULE[`${fileName}.test`];
          if (mod) {
            results.push({
              pkg: pkg.name,
              kind: 'test',
              module: mod,
              result: fileStatus,
              tests: 0,
              passed: 0,
              failed: 0,
              durationMs: 0,
            });
          }
        }
      }
    }
  } // end of if (!fast) — Step 1 빌드/테스트

  // ════════════════════════════════════════════════════════════
  //  Phase A: AddressContextRecord 생성 → aggregateUsageData
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase A: aggregate ──`);
  const records: AddressContextRecord[] = [];

  for (const r of results) {
    const prefixId = r.kind === 'build' ? 'build_event' : 'test_event';
    const resultAxis = r.kind === 'build' ? 'build_result' : 'test_result';
    const qaModule = r.module ?? '_all';
    try {
      const address = encodePrefixByValue(DEMO_CATALOG, prefixId, latestVer(prefixId), {
        qa_pkg: r.pkg,
        qa_module: qaModule,
        [resultAxis]: r.result,
      });
      records.push({
        address_context: { [prefixId]: `${prefixId}:v2:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `${r.kind}:${r.pkg}:${qaModule}`,
        execution_mode: 'live' as const,
        execution_id: runId,
      });
    } catch {
      // entry가 카탈로그에 없으면 건너뜀 (예: type-error는 build_result에 있음)
    }
  }

  // contract_check records (파일별 인터페이스 계약)
  for (const c of fileContracts) {
    try {
      const address = encodePrefixByValue(
        DEMO_CATALOG,
        'contract_check',
        latestVer('contract_check'),
        {
          qa_pkg: c.pkg,
          api_surface: c.surface,
          test_result: c.result,
        },
      );
      records.push({
        address_context: { contract_check: `contract_check:v1:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `contract:${c.pkg}:${c.surface}`,
        execution_mode: 'live' as const,
        execution_id: runId,
      });
    } catch {
      // qa_pkg v2에 없는 패키지 등은 건너뜀
    }
  }

  // 합성 이벤트 — analyzeSelfCheck의 SYNTHETIC_EVENTS를 재활용하여 전체 도메인 커버리지 확보
  const syntheticAnalysis = analyzeSelfCheck(results, DEMO_CATALOG, runId);
  const bizRecords = syntheticAnalysis.bizRecords;
  // analyzeSelfCheck가 생성한 records에 contract records를 병합
  for (const r of syntheticAnalysis.records) {
    // build/test records는 이미 위에서 생성 — synthetic만 추가
    if (r.execution_mode === 'synthetic') {
      records.push(r);
    }
  }

  const usage = aggregateUsageData(DEMO_CATALOG, records);
  console.log(
    `    records: ${records.length}건 (build/test ${results.length} + contract ${fileContracts.length} + biz ${bizRecords})`,
  );
  console.log(
    `    entryUsage: ${usage.entryUsages.length}, addressUsage: ${usage.addressUsages.length}`,
  );

  // ════════════════════════════════════════════════════════════
  //  Phase B: convergence 분석
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase B: convergence ──`);

  // B-1: collection health
  const health = analyzeCollectionHealth(DEMO_CATALOG, records);
  const healthIcon = health.healthRate >= 0.9 ? '✅' : health.healthRate >= 0.5 ? '⚠' : '🔴';
  console.log(`    ${healthIcon} 건전성: ${health.summary}`);

  // B-2: entry coverage
  const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);
  const buildCov = coverage.prefixes.find((p) => p.prefixId === 'build_event');
  const testCov = coverage.prefixes.find((p) => p.prefixId === 'test_event');
  if (buildCov) console.log(`    build_event: ${buildCov.summary}`);
  if (testCov) console.log(`    test_event:  ${testCov.summary}`);
  console.log(`    전체: ${coverage.summary}`);

  // B-3: metrics with usage data
  const metrics = collectMetrics(DEMO_CATALOG, graph, usage, {
    schemaHealthAuditor: auditSchemaHealth,
  });
  const metricIssues = metrics.filter((m) => m.status !== 'ok');
  console.log(`    metrics: ${metrics.length}건, ${metricIssues.length} issues`);

  // B-4: schema health (metric에 포함되지만 명시 출력)
  const schemaMetric = metrics.find((m) => m.id === 'metric:schema:violations');
  if (schemaMetric) {
    const sIcon = schemaMetric.status === 'ok' ? '✅' : '⚠';
    console.log(`    ${sIcon} schema: ${schemaMetric.detail}`);
  }

  // ════════════════════════════════════════════════════════════
  //  Phase C: 관측 자동 해소
  // ════════════════════════════════════════════════════════════

  // ── observation 해소/생성 후보 탐색 (읽기 전용) ──
  const existingObs = graph.getNodesByKind('observation');
  const resolveTargets: Array<{ obs: ObservationNode; reason: string }> = [];

  for (const obs of existingObs.filter(
    (o) => o.id.startsWith('OBS-SELF-BUILD-') && !o.resolution,
  )) {
    const prevFailed = (obs.subjects as string[]) ?? [];
    const stillFailing = prevFailed.filter((pkg) =>
      results.some(
        (r) =>
          r.kind === 'build' && r.pkg === pkg && r.result !== 'success' && r.result !== 'skipped',
      ),
    );
    if (stillFailing.length === 0 && prevFailed.length > 0)
      resolveTargets.push({ obs, reason: `${prevFailed.join(',')}: 성공` });
  }
  for (const obs of existingObs.filter((o) => o.id.startsWith('OBS-SELF-TEST-') && !o.resolution)) {
    const prevFailed = (obs.subjects as string[]) ?? [];
    const stillFailing = prevFailed.filter((pkg) =>
      results.some((r) => r.kind === 'test' && r.pkg === pkg && r.result !== 'passed'),
    );
    if (stillFailing.length === 0 && prevFailed.length > 0)
      resolveTargets.push({ obs, reason: '전부 통과' });
  }
  for (const obs of existingObs.filter(
    (o) => o.id.startsWith('OBS-SELF-METRIC-') && !o.resolution,
  )) {
    if (metricIssues.filter((m) => m.status === 'critical').length === 0)
      resolveTargets.push({ obs, reason: 'critical 해소' });
  }

  // ════════════════════════════════════════════════════════════
  //  Phase D: DSL 불변조건 검증
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase D: invariant ──`);
  const invariantViolations: string[] = [];

  // dsl-dev 불변조건 1: "빌드 실패 후 테스트 금지" (skipped 제외)
  for (const r of results) {
    if (r.kind !== 'build' || r.result === 'success' || r.result === 'skipped') continue;
    // 이 패키지에 테스트가 실행됐는가?
    const testRan = results.find((t) => t.kind === 'test' && t.pkg === r.pkg);
    if (testRan) {
      invariantViolations.push(`${r.pkg}: 빌드 ${r.result}인데 테스트 실행됨 (${testRan.result})`);
    }
  }

  // dsl-dev 불변조건 2: "테스트 실패 시 해당 패키지의 빌드 성공이 선행" (hasBuild=false 제외)
  for (const r of results) {
    if (r.kind !== 'test' || r.result === 'passed') continue;
    const pkgDef = SELF_CHECK_PKGS.find((p) => p.name === r.pkg);
    if (!pkgDef?.hasBuild) continue; // 빌드 스크립트 없는 패키지는 제외
    const buildResult = results.find((b) => b.kind === 'build' && b.pkg === r.pkg);
    if (!buildResult || buildResult.result !== 'success') {
      invariantViolations.push(`${r.pkg}: 테스트 ${r.result}인데 빌드 성공이 선행되지 않음`);
    }
  }

  const newObsCandidates: Array<{ id: string; finding: string; subjects: string[] }> = [];

  if (invariantViolations.length > 0) {
    console.log(`    🔴 dsl-dev invariant 위반 ${invariantViolations.length}건:`);
    for (const v of invariantViolations) console.log(`      ${v}`);
    if (!existingObs.some((o) => o.id.startsWith('OBS-SELF-INVARIANT-') && !o.resolution)) {
      newObsCandidates.push({
        id: `OBS-SELF-INVARIANT-${runId}`,
        finding: `dsl-dev invariant 위반: ${invariantViolations.join('; ')}`,
        subjects: ['dsl-dev'],
      });
    }
  } else {
    console.log(`    ✅ dsl-dev 불변조건 통과`);
  }

  // ════════════════════════════════════════════════════════════
  //  Phase E: IntentLink 흐름 검증
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase E: flow-trace ──`);
  // 합성 이벤트는 단일 prefix만 포함하므로 IntentLink 검증에서 제외 (false positive 방지)
  const liveRecords = records.filter((r) => r.execution_mode !== 'synthetic');
  const flowResult = traceFlows(graph, liveRecords, { date: now.slice(0, 10) });
  if (flowResult.violations.length > 0) {
    console.log(
      `    🔴 IntentLink 위반 ${flowResult.violations.length}종 (${flowResult.violations.reduce((s, v) => s + v.count, 0)}건):`,
    );
    for (const v of flowResult.violations) {
      console.log(
        `      ${v.intentLinkId}: missing=[${v.missingPrefixes.join(',')}] (${v.count}건)`,
      );
    }
  } else {
    console.log(
      `    ✅ IntentLink 흐름 정상 (${flowResult.checkedRecords}건 검사, ${graph.getNodesByKind('intent-link').length}개 링크)`,
    );
  }

  // ════════════════════════════════════════════════════════════
  //  Phase F: DSL 번들 불변조건 검증
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase F: DSL invariant ──`);
  // self-check에서 생성된 레코드로 DSL 번들 불변조건 검증
  // dsl-dev는 Phase D invariant 검증에서 이미 처리하므로 제외
  const dslResult = validateDslInvariants(graph, liveRecords, {
    date: now.slice(0, 10),
    excludeBundles: ['dsl-dev'],
  });
  if (dslResult.violations.length > 0) {
    console.log(
      `    ⚠ DSL 불변조건 위반 ${dslResult.violations.length}종 (${dslResult.violations.reduce((s, v) => s + v.count, 0)}건):`,
    );
    for (const v of dslResult.violations) {
      console.log(`      ${v.bundleId}: ${v.invariant.slice(0, 80)}`);
    }
  } else {
    const bundleCount =
      (graph.getNodesByKind('dsl-bundle') as { invariants?: readonly string[] }[]).filter(
        (b) => b.invariants && b.invariants.length > 0,
      ).length - 1; // dsl-dev 제외
    console.log(
      `    ✅ DSL 불변조건 정상 (${bundleCount}개 번들, ${dslResult.checkedRecords}건 검사)`,
    );
  }

  // ════════════════════════════════════════════════════════════
  //  저장 + 새 Observation 생성
  // ════════════════════════════════════════════════════════════

  // 빌드/테스트 실패 observation 후보
  const failedBuilds = results.filter(
    (r) => r.kind === 'build' && r.result !== 'success' && r.result !== 'skipped',
  );
  if (
    failedBuilds.length > 0 &&
    !existingObs.some((o) => o.id.startsWith('OBS-SELF-BUILD-') && !o.resolution)
  ) {
    newObsCandidates.push({
      id: `OBS-SELF-BUILD-${runId}`,
      finding: `빌드 실패 ${failedBuilds.length}건: ${failedBuilds.map((r) => `${r.pkg}(${r.result})`).join(', ')}`,
      subjects: failedBuilds.map((r) => r.pkg),
    });
  }
  const failedTests = results.filter((r) => r.kind === 'test' && r.result !== 'passed');
  if (
    failedTests.length > 0 &&
    !existingObs.some((o) => o.id.startsWith('OBS-SELF-TEST-') && !o.resolution)
  ) {
    newObsCandidates.push({
      id: `OBS-SELF-TEST-${runId}`,
      finding: `테스트 실패 ${failedTests.length}건: ${failedTests.map((r) => `${r.pkg}(${r.result})`).join(', ')}`,
      subjects: failedTests.map((r) => r.pkg),
    });
  }

  // ════════════════════════════════════════════════════════════
  //  --apply: DKG 상태 변경 (옵트인)
  // ════════════════════════════════════════════════════════════

  if (apply && store) {
    console.log(`\n  ── Apply ──`);
    const snapshotId = store.saveUsageSnapshot(toDkgUsageData(DEMO_CATALOG, usage));
    console.log(`    snapshot #${snapshotId} 저장`);

    for (const { obs, reason } of resolveTargets) {
      const resolved: ObservationNode = {
        ...obs,
        resolution: { decisionId: 'auto', outcome: 'accepted', note: `${runId}: ${reason}` },
      };
      store.saveNodes([resolved], [], 'auto');
      graph.replaceNode(resolved);
      console.log(`    resolved: ${obs.id} (${reason})`);
    }
    for (const cand of newObsCandidates) {
      const obs: ObservationNode = {
        kind: 'observation',
        id: cand.id,
        date: now.slice(0, 10),
        source: 'metric',
        intent: 'action-needed',
        subjects: cand.subjects,
        finding: cand.finding,
      };
      store.saveNodes(
        [obs],
        [{ type: 'observes', from: obs.id, to: cand.subjects[0] ?? 'build_event' }],
        'auto',
      );
      console.log(`    created: ${cand.id}`);
    }
  } else if (resolveTargets.length > 0 || newObsCandidates.length > 0) {
    console.log(`\n  ── Pending (--apply로 반영) ──`);
    for (const { obs, reason } of resolveTargets)
      console.log(`    해소 후보: ${obs.id} (${reason})`);
    for (const cand of newObsCandidates) console.log(`    생성 후보: ${cand.id}: ${cand.finding}`);
  }

  // ════════════════════════════════════════════════════════════
  //  종합
  // ════════════════════════════════════════════════════════════

  const buildSummary = { success: 0, failure: 0, skipped: 0, total: 0 };
  const testSummary = { passed: 0, failed: 0, tests: 0, total: 0 };
  for (const r of results) {
    if (r.kind === 'build') {
      buildSummary.total++;
      if (r.result === 'success') buildSummary.success++;
      else if (r.result === 'skipped') buildSummary.skipped++;
      else buildSummary.failure++;
    } else {
      testSummary.total++;
      testSummary.tests += r.tests ?? 0;
      testSummary.passed += r.passed ?? 0;
      testSummary.failed += r.failed ?? 0;
    }
  }

  const buildCount = buildSummary.total - buildSummary.skipped;
  console.log(`\n  ── 종합 ──`);
  console.log(
    `  build:      ${buildSummary.success}/${buildCount} success${buildSummary.failure > 0 ? ` (${buildSummary.failure} failed)` : ''}${buildSummary.skipped > 0 ? ` (${buildSummary.skipped} skipped)` : ''}`,
  );
  console.log(
    `  test:       ${testSummary.passed}/${testSummary.tests} passed${testSummary.failed > 0 ? ` (${testSummary.failed} failed)` : ''}`,
  );
  console.log(
    `  coverage:   build_event ${buildCov ? Math.round(buildCov.coverageRate * 100) : '?'}%, test_event ${testCov ? Math.round(testCov.coverageRate * 100) : '?'}%`,
  );
  console.log(`  health:     건전성 ${Math.round(health.healthRate * 100)}%`);
  console.log(
    `  invariant:  ${invariantViolations.length === 0 ? '통과' : `${invariantViolations.length}건 위반`}`,
  );

  // contract 요약
  if (fileContracts.length > 0) {
    const bySurface = new Map<string, { passed: number; failed: number }>();
    for (const c of fileContracts) {
      const s = bySurface.get(c.surface) ?? { passed: 0, failed: 0 };
      if (c.result === 'passed') s.passed++;
      else s.failed++;
      bySurface.set(c.surface, s);
    }
    const failedSurfaces = [...bySurface.entries()].filter(([, s]) => s.failed > 0);
    console.log(
      `  contracts:  ${fileContracts.length}건 (${bySurface.size} surfaces)${failedSurfaces.length > 0 ? ` — ${failedSurfaces.map(([k, v]) => `${k}:${v.failed}F`).join(', ')}` : ''}`,
    );
  }
  // cli_event 커버리지 + dormant 명령 감지
  const cliCov = analyzeCliCoverage();
  const dormantList = cliCov.dormantCoords.slice(0, 5);
  console.log(
    `  cli_event:  ${Math.round(cliCov.coverageRate * 100)}% (${cliCov.observedCoords}/${cliCov.totalCoords} 좌표, ${Object.keys(CLI_COMMAND_MAP).length}개 명령)`,
  );
  if (dormantList.length > 0) {
    console.log(`  dormant:    ${cliCov.dormantCoords.length}개 미사용 좌표`);
    for (const d of dormantList) {
      console.log(`    ${d.coord.padEnd(35)} → ${d.commands.join(', ')}`);
    }
    if (cliCov.dormantCoords.length > 5)
      console.log(`    ... +${cliCov.dormantCoords.length - 5}개`);
  }

  if (!apply && (resolveTargets.length > 0 || newObsCandidates.length > 0)) {
    console.log(
      `  pending:    ${resolveTargets.length} resolve, ${newObsCandidates.length} new obs (--apply로 반영)`,
    );
  }

  const hasProblem =
    buildSummary.failure > 0 || testSummary.failed > 0 || invariantViolations.length > 0;
  console.log(hasProblem ? `\n  ⚠ 문제 감지` : `\n  ✅ 전체 정상`);
}

function findArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// ── helpers ─────────────────────────────────────────

/** ConvergeAction의 대상을 사람이 읽을 수 있는 문자열로 추출 */
function convergeActionTarget(action: ConvergeAction): string {
  switch (action.kind) {
    case 'merge':
      return action.targets.join('↔');
    case 'deactivate':
      return action.axis;
    case 'simplify':
      return action.prefix;
    case 'observe':
      return action.source;
  }
}

function buildEntriesMap(catalog?: Catalog): Map<string, readonly string[]> {
  const cat = catalog ?? DEMO_CATALOG;
  const map = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(cat.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    if (latest && latest.entries) {
      map.set(id, [...latest.entries]);
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════
// dkg add-entry — 축 entry 추가 (check → mutate → record)
// ═══════════════════════════════════════════════════════════════

/**
 * 축에 entry를 추가한다.
 *
 * --dry-run: 검사 + 변이 계산만, 그래프/스토어 반영 안 함 (기본)
 * --apply:   실제 반영 (DKG 그래프 + SQLite 저장)
 */
export function dkgAddEntry(opts: {
  axisId: string;
  entry: string;
  apply?: boolean;
  expandCapacity?: boolean;
  writeFile?: string;
}): void {
  const graph = getGraph();
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;
  const dryRun = !(opts.apply ?? false);
  const store = dryRun ? undefined : getStore();

  const flags = [
    dryRun ? 'dry-run' : 'apply',
    opts.expandCapacity ? 'expand-capacity' : '',
    opts.writeFile ? 'write-file' : '',
  ]
    .filter(Boolean)
    .join(', ');

  console.log(`\n══ Add Entry: ${opts.entry} → ${opts.axisId} (${flags}) ══`);

  try {
    const result = executeEntryAdd(catalog, graph, opts.axisId, opts.entry, {
      dryRun,
      expandCapacity: opts.expandCapacity,
      store,
    });

    // ── 검사 결과 ──
    const { check, mutation, versionEvent, capacityExpanded, warnings } = result;
    const icon = check.verdict === 'safe' ? '✅' : '⚠';
    console.log(`\n  ${icon} verdict: ${check.verdict}`);
    console.log(
      `  headroom: ${check.headroom.remaining}/${check.headroom.capacity} → ${check.headroom.remaining - 1}/${check.headroom.capacity}`,
    );

    if (capacityExpanded && mutation.capacityChange) {
      console.log(
        `  ⚠ capacity 확장: ${mutation.capacityChange.from} → ${mutation.capacityChange.to} (stride-break)`,
      );
    }

    // ── 축 버전 ──
    console.log(`\n  ── 축 버전 ──`);
    console.log(`  ${opts.axisId}: ${mutation.oldVersion} → ${mutation.newVersion}`);
    console.log(`  entries: +${opts.entry} (append-only, position ${check.headroom.current})`);

    // ── 영향 prefix ──
    if (mutation.affectedPrefixes.length > 0) {
      console.log(`\n  ── 영향 prefix (${mutation.affectedPrefixes.length}개) ──`);
      for (const pv of mutation.updatedPrefixVersions) {
        console.log(`    ${pv.prefixId}: ${pv.oldVersion} → ${pv.newVersion}`);
      }
    }

    // ── VersionEvent ──
    console.log(`\n  ── VersionEvent ──`);
    console.log(`  id: ${versionEvent.id}`);
    console.log(`  ${versionEvent.fromVersion} → ${versionEvent.toVersion}`);
    for (const ch of versionEvent.changes) {
      console.log(`    [${ch.kind}] ${ch.detail}`);
    }
    console.log(`  impact: ${versionEvent.impact}`);

    // ── 경고 ──
    if (warnings.length > 0) {
      console.log(`\n  ── 경고 (${warnings.length}건) ──`);
      for (const w of warnings) {
        console.log(`    ${w}`);
      }
    }

    // ── 저장 상태 ──
    if (result.graphUpdated) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- graphUpdated=true → !dryRun → store 존재 보장
      const saved = store!.saveGraph(graph);
      console.log(`\n  ✅ 저장 완료 (${saved.nodesWritten} nodes, ${saved.edgesWritten} edges)`);

      // ── CatalogRegistry re-register ──
      registry.register(mutation.catalog as Catalog);
      console.log(`  ✅ CatalogRegistry 갱신 (${activeCatalogId})`);

      // ── 파일 기록 ──
      if (opts.writeFile) {
        // demo 카탈로그인 경우 경고
        if (activeCatalogId === 'demo') {
          console.log(`\n  ⚠ demo 카탈로그는 구조가 특수합니다 (refEntries 파생 체인).`);
          console.log(
            `    packages/demo-snapshot/src/demo-catalog.ts 자동 재생성은 지원하지 않습니다.`,
          );
          console.log(`    변이된 카탈로그를 별도 경로에 기록합니다.`);
        }

        const writeResult = writeCatalogFile(mutation.catalog as Catalog, opts.writeFile);
        if (writeResult.written) {
          console.log(`  ✅ 카탈로그 파일 기록: ${opts.writeFile}`);
        } else {
          console.log(`  ℹ 카탈로그 파일 변경 없음 (기존과 동일): ${opts.writeFile}`);
        }
      }
    } else {
      console.log(`\n  ℹ dry-run — --apply 플래그로 실제 반영`);
    }
  } catch (error) {
    if (error instanceof EntryAddError) {
      console.log(`\n  ✗ ${error.verdict}: ${error.message}`);
    } else {
      console.error(`\n  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ── dkg diagram ──────────────────────────────────────────

import {
  intentLinkDiagram,
  allIntentLinksDiagram,
  dslDiagram,
  domainDiagram,
  serviceDiagram,
  constraintDiagram,
  tableDiagram,
  observationLoopDiagram,
  tableErDiagram,
  transitionSpecDiagram,
  transitionDagDiagram,
  listAllDiagrams,
} from '@qa-sdk/spec-core/viz';
import type { MermaidDiagramOptions } from '@qa-sdk/spec-core/viz';
// createDemoTopology already imported from dkg

export async function dkgDiagram(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', default: 'mmd' },
      'no-invariants': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const kind = positionals[0];
  const id = positionals[1];

  const validKinds = [
    'intent-links',
    'dsl',
    'signal',
    'domain',
    'service',
    'constraint',
    'table',
    'table-er',
    'observation-loop',
    'transition-spec',
    'transition-dag',
    'flow-schema',
    'list',
  ];
  if (!kind || !validKinds.includes(kind)) {
    console.log(
      'Usage: qa-sdk dkg diagram <kind> [id] [--output path] [--format mmd|html|svg|png] [--no-invariants]',
    );
    console.log(
      '  kind: list | intent-links | dsl | signal | domain | service | constraint | table | observation-loop | transition-spec | transition-dag | flow-schema',
    );
    console.log('');
    console.log('Examples:');
    console.log('  qa-sdk dkg diagram list                        선택 가능한 다이어그램 리스트');
    console.log('  qa-sdk dkg diagram intent-links                전체 IntentLink 시퀀스');
    console.log('  qa-sdk dkg diagram intent-links IL-xxx         단일 IntentLink');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout            DSL 번들 시퀀스');
    console.log('  qa-sdk dkg diagram domain dom-commerce         도메인 prefix 시퀀스');
    console.log('  qa-sdk dkg diagram service svc-ingest          서비스 소유/소비 관계');
    console.log('  qa-sdk dkg diagram constraint CON-001          constraint 대상');
    console.log('  qa-sdk dkg diagram table tbl-orders            테이블 참조 관계');
    console.log('  qa-sdk dkg diagram observation-loop            observation→decision 루프');
    console.log('  qa-sdk dkg diagram flow-schema coordinate-design  FlowSchema gate 인과 그래프');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout -o f.mmd   파일 출력');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout --format html -o f.html  HTML 출력');
    return;
  }

  const graph = getGraph();

  // ── list: 선택 가능한 다이어그램 리스트 ──
  if (kind === 'list') {
    const topo = createDemoTopology();
    const allDiagrams = listAllDiagrams(graph, topo);
    const flowSchemas = listFlowSchemas(graph);

    console.log('');
    console.log('══ Available Diagrams ══');

    for (const [diagramKind, entries] of Object.entries(allDiagrams)) {
      console.log('');
      console.log(`[${diagramKind}] (${entries.length}개)`);
      for (const entry of entries) {
        const desc = entry.label.length > 60 ? entry.label.slice(0, 57) + '...' : entry.label;
        console.log(`  ${entry.id.padEnd(28)} ${desc}`);
      }
    }

    if (flowSchemas.length > 0) {
      console.log('');
      console.log(`[flow-schema] (${flowSchemas.length}개)`);
      for (const flow of flowSchemas) {
        console.log(`  ${flow.id.padEnd(28)} ${flow.name}`);
      }
    }

    console.log('');
    console.log('Usage:');
    console.log('  qa-sdk dkg diagram intent-links              전체 IntentLink 시퀀스');
    console.log('  qa-sdk dkg diagram intent-links IL-xxx       단일 IntentLink');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout          DSL 번들 시퀀스');
    console.log('  qa-sdk dkg diagram domain dom-commerce       도메인 prefix 시퀀스');
    console.log('  qa-sdk dkg diagram service svc-ingest        서비스 소유/소비 관계');
    console.log('  qa-sdk dkg diagram constraint CON-001        constraint 대상');
    console.log('  qa-sdk dkg diagram table tbl-orders          테이블 참조 관계');
    console.log('  qa-sdk dkg diagram observation-loop          observation→decision 루프');
    console.log('  qa-sdk dkg diagram flow-schema coordinate-design  FlowSchema gate 인과 그래프');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout -o f.mmd 파일 출력');
    console.log('  qa-sdk dkg diagram dsl dsl-checkout --format html -o f.html  HTML 출력');
    return;
  }

  const opts: MermaidDiagramOptions = { showInvariants: !values['no-invariants'] };
  let mmd: string;

  switch (kind) {
    case 'intent-links': {
      mmd = id ? intentLinkDiagram(graph, id, opts) : allIntentLinksDiagram(graph, opts);
      break;
    }
    case 'dsl': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram dsl <dslId>');
        return;
      }
      mmd = dslDiagram(graph, id, opts);
      break;
    }
    case 'signal': {
      if (!id) {
        console.log('Available signal IDs require DEMO_SIGNALS from viz-3d.');
        console.log('Signal diagram은 향후 DEMO_SIGNALS 연동 시 지원 예정.');
        return;
      }
      console.log('Signal diagram은 향후 DEMO_SIGNALS 연동 시 지원 예정.');
      return;
    }
    case 'domain': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram domain <domainId>');
        return;
      }
      mmd = domainDiagram(graph, id, opts);
      break;
    }
    case 'service': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram service <serviceId>');
        return;
      }
      const topo = createDemoTopology();
      mmd = serviceDiagram(graph, topo, id, opts);
      break;
    }
    case 'constraint': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram constraint <constraintId>');
        return;
      }
      mmd = constraintDiagram(graph, id, opts);
      break;
    }
    case 'table': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram table <tableId>');
        return;
      }
      mmd = tableDiagram(graph, id, opts);
      break;
    }
    case 'observation-loop': {
      mmd = observationLoopDiagram(graph, opts);
      break;
    }
    case 'table-er': {
      mmd = tableErDiagram(graph, opts);
      break;
    }
    case 'transition-spec': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram transition-spec <specId>');
        return;
      }
      mmd = transitionSpecDiagram(graph, id, opts);
      break;
    }
    case 'transition-dag': {
      mmd = transitionDagDiagram(graph, opts);
      break;
    }
    case 'flow-schema': {
      if (!id) {
        console.error('Usage: qa-sdk dkg diagram flow-schema <flowSchemaId>');
        return;
      }
      mmd = renderFlowSchemaDiagramMermaid(graph, id);
      break;
    }
    default:
      console.error(`Unknown diagram kind: ${kind}`);
      return;
  }

  // Output
  const outputPath = values.output as string | undefined;
  const format = (values.format as string) ?? 'mmd';

  if (format === 'html') {
    const title =
      kind === 'dsl'
        ? `DSL: ${id}`
        : kind === 'intent-links'
          ? (id ?? '전체 IntentLink')
          : kind === 'domain'
            ? `Domain: ${id}`
            : kind === 'service'
              ? `Service: ${id}`
              : kind === 'constraint'
                ? `Constraint: ${id}`
                : kind === 'table'
                  ? `Table: ${id}`
                  : kind === 'table-er'
                    ? 'All Tables ER'
                    : kind === 'observation-loop'
                      ? 'Observation Loop'
                      : kind === 'transition-spec'
                        ? `Transition: ${id}`
                        : kind === 'transition-dag'
                          ? 'Transition DAG'
                          : kind === 'flow-schema'
                            ? `Flow Schema: ${id}`
                            : kind;
    const html = wrapMermaidHtml(mmd, title);
    if (outputPath) {
      writeFileSync(outputPath, html, 'utf-8');
      console.log(`  Written: ${outputPath}`);
    } else {
      console.log(html);
    }
    return;
  }

  if (outputPath) {
    writeFileSync(outputPath, mmd, 'utf-8');
    console.log(`  Written: ${outputPath}`);
  } else {
    console.log(mmd);
  }

  // Optional render via mmdc
  if ((format === 'svg' || format === 'png') && outputPath) {
    try {
      const { execa } = await import('execa');
      const ext = format;
      const renderOut = outputPath.replace(/\.mmd$/, `.${ext}`);
      await execa('mmdc', ['-i', outputPath, '-o', renderOut]);
      console.log(`  Rendered: ${renderOut}`);
    } catch (err: unknown) {
      const execErr = err as { code?: string; message?: string };
      if (execErr.code === 'ENOENT' || execErr.message?.includes('ENOENT')) {
        console.log('  mmdc not found. Install with: npm install -g @mermaid-js/mermaid-cli');
      } else {
        console.error(`  mmdc error: ${errorMessage(err)}`);
      }
    }
  }
}

// ── dkg discover-links — co-occurrence 기반 IntentLink 후보 발견 ──

/**
 * usage 스냅샷의 co-occurrence 데이터에서 인과 관계 후보를 추출하고
 * IntentLink/constraint 등록 후보를 추천한다.
 */
export function dkgDiscoverLinks(): void {
  const graph = getGraph();
  const store = getStore();

  console.log(`\n══ IntentLink 후보 발견 (co-occurrence 기반) ══`);

  // 1. 최근 스냅샷에서 co-occurrence 데이터 로드
  const rawSnapshots = store.getRecentUsageSnapshots(10);

  if (rawSnapshots.length === 0) {
    console.log('\n  (usage 스냅샷 없음)');
    console.log(
      '  이벤트를 수집하고 dkg converge --persist 를 실행하면 co-occurrence 데이터가 축적됩니다.',
    );
    return;
  }

  // 2. 스냅샷 JSON 파싱 → coOccurrences 추출 → 병합
  const merged = new Map<
    string,
    {
      sourcePrefix: string;
      sourceEntry: string;
      targetPrefix: string;
      targetEntry: string;
      count: number;
      totalSourceCount: number;
    }
  >();
  let parsedCount = 0;

  for (const snap of rawSnapshots) {
    try {
      const usage = JSON.parse(snap.data) as {
        coOccurrences?: Array<{
          sourcePrefix: string;
          sourceEntry: string;
          targetPrefix: string;
          targetEntry: string;
          count: number;
          totalSourceCount: number;
        }>;
      };
      for (const co of usage.coOccurrences ?? []) {
        const key = `${co.sourcePrefix}:${co.sourceEntry}→${co.targetPrefix}:${co.targetEntry}`;
        const existing = merged.get(key);
        if (existing) {
          existing.count += co.count;
          existing.totalSourceCount += co.totalSourceCount;
        } else {
          merged.set(key, {
            sourcePrefix: co.sourcePrefix,
            sourceEntry: co.sourceEntry,
            targetPrefix: co.targetPrefix,
            targetEntry: co.targetEntry,
            count: co.count,
            totalSourceCount: co.totalSourceCount,
          });
        }
      }
      parsedCount++;
    } catch {
      /* JSON 파싱 실패 스킵 */
    }
  }

  const coOccurrences = [...merged.values()];

  if (coOccurrences.length === 0) {
    console.log(
      `\n  스냅샷 ${rawSnapshots.length}개 로드됨 (${parsedCount}개 파싱), co-occurrence 데이터 없음.`,
    );
    console.log(
      '  이벤트 수집 시 address_context에 여러 prefix가 포함되어야 co-occurrence가 집계됩니다.',
    );
    return;
  }

  console.log(
    `  스냅샷: ${rawSnapshots.length}개 (${parsedCount}개 파싱), co-occurrence 쌍: ${coOccurrences.length}개`,
  );

  // 3. 인과 후보 추출
  const candidates = discoverCausality(graph, coOccurrences);

  if (candidates.length === 0) {
    // 임계값 미달이지만 발견된 co-occurrence 패턴 표시
    const sorted = coOccurrences.toSorted((a, b) => b.count - a.count);
    const top = sorted.slice(0, 10);
    console.log(`\n  임계값 미달 — 상위 co-occurrence 패턴 (${top.length}건):`);
    for (const co of top) {
      const rate = co.totalSourceCount > 0 ? Math.round((co.count / co.totalSourceCount) * 100) : 0;
      const existingIL = graph
        .getNodesByKind('intent-link')
        .find(
          (il) =>
            il.endpoints?.includes(co.sourcePrefix) && il.endpoints?.includes(co.targetPrefix),
        );
      const tag = existingIL ? ` [이미 등록: ${existingIL.id}]` : '';
      console.log(
        `    ${co.sourcePrefix} → ${co.targetPrefix}: ${co.count}건 (rate ${rate}%)${tag}`,
      );
    }
    console.log(
      `\n  임계값: count >= 100 필요 (현재 최대 ${top[0]?.count ?? 0}건). 더 많은 트래픽 축적 필요.`,
    );
    return;
  }

  // 4. 결과 표시 — confidence별 그룹
  const high = candidates.filter((c) => c.confidence === 'high');
  const medium = candidates.filter((c) => c.confidence === 'medium');
  const low = candidates.filter((c) => c.confidence === 'low');

  if (high.length > 0) {
    console.log(`\n  ── HIGH confidence (IntentLink 후보) ── [${high.length}건]`);
    for (const c of high) {
      printCandidate(c);
    }
  }

  if (medium.length > 0) {
    console.log(`\n  ── MEDIUM confidence (constraint 후보) ── [${medium.length}건]`);
    for (const c of medium) {
      printCandidate(c);
    }
  }

  if (low.length > 0) {
    console.log(`\n  ── LOW confidence (추가 관측 필요) ── [${low.length}건]`);
    for (const c of low) {
      printCandidate(c);
    }
  }

  // 5. 기존 IntentLink와 비교
  const intentLinks = graph.getNodesByKind('intent-link');
  if (intentLinks.length > 0) {
    console.log(`\n  ── 기존 IntentLink (${intentLinks.length}개) ──`);
    for (const link of intentLinks) {
      const matchingCo = coOccurrences.find(
        (co) => link.intent.includes(co.sourceEntry) && link.intent.includes(co.targetEntry),
      );
      if (matchingCo) {
        const rate =
          matchingCo.totalSourceCount > 0
            ? ((matchingCo.count / matchingCo.totalSourceCount) * 100).toFixed(1)
            : 'N/A';
        console.log(
          `    ${link.id}: ${link.intent} — 관측됨 (rate=${rate}%, count=${matchingCo.count})`,
        );
      } else {
        console.log(`    ${link.id}: ${link.intent} — (co-occurrence 데이터 없음)`);
      }
    }
  }

  console.log(
    `\n  합계: ${candidates.length}건 (high=${high.length}, medium=${medium.length}, low=${low.length})`,
  );
}

function printCandidate(c: CausalCandidate): void {
  const ratePercent = (c.coOccurrenceRate * 100).toFixed(1);
  console.log(`    ${c.source.prefix}:${c.source.entry} → ${c.target.prefix}:${c.target.entry}`);
  console.log(`      rate=${ratePercent}%  count=${c.observedCount}  추천: ${c.suggestion}`);
}

/** Mermaid 텍스트를 CDN 기반 self-contained HTML로 래핑 */
function wrapMermaidHtml(mmd: string, title: string): string {
  const escaped = mmd.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — QA-SDK Diagram</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; background: #fafbfc; }
  h1 { font-size: 18px; color: #24292e; margin-bottom: 16px; }
  #diagram { background: #fff; border: 1px solid #e1e4e8; border-radius: 6px; padding: 24px; }
  .source { margin-top: 24px; }
  .source summary { cursor: pointer; color: #586069; font-size: 13px; }
  .source pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<h1>${title}</h1>
<div id="diagram">
  <pre class="mermaid">
${mmd}
  </pre>
</div>
<details class="source">
  <summary>Mermaid source</summary>
  <pre>${escaped}</pre>
</details>
<script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
</body>
</html>`;
}
