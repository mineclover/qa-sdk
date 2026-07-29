// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  CONCERN_TAGS,
  deriveDomainRoot,
  detectOwnerRootMismatch,
  type DefDataSource,
  type DefDoc,
  type DomainRootRegistry,
} from 'definition-catalog';
import {
  buildBoundedDefinitionContext,
} from '../../lib/context-runtime/definition-document-context.js';
import {
  loadProviderTokenCounter,
  loadProviderTokenCounterFromRegistry,
  readProviderUsageEvent,
} from '../../lib/context-runtime/provider-usage-adapters.js';
import {
  createContextUsageLedger,
  type ContextStopPolicy,
  type ContextUsageSummary,
} from 'context-runtime';
import { persistDefinitionTaskHandoff } from './handoff-commands.js';
import { formatLinkRef, getRootDir, parseCsvFlag } from './shared.js';

export interface ContextCommandDependencies {
  readonly buildDomainRootRegistry: (
    source: DefDataSource,
  ) => Promise<DomainRootRegistry>;
}

const CONCERN_TAG_SET = new Set<string>(CONCERN_TAGS);

function extractConcernTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => CONCERN_TAG_SET.has(tag));
}

function parseNonNegativeIntegerFlag(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseContextStopPolicy(flags: Record<string, string>): ContextStopPolicy | undefined {
  const routeKeys = parseCsvFlag(flags['stop-routes']);
  const factKeys = parseCsvFlag(flags['stop-facts']);
  const evidenceKeys = parseCsvFlag(flags['stop-evidence']);
  const hasStopFlags =
    flags['stop-routes'] !== undefined ||
    flags['stop-facts'] !== undefined ||
    flags['stop-evidence'] !== undefined ||
    flags['no-progress-limit'] !== undefined;
  if (!hasStopFlags) return undefined;
  if (flags['no-progress-limit'] === 'true') {
    throw new Error('--no-progress-limit에는 양의 정수가 필요합니다');
  }

  const obligations = [
    ...routeKeys.map((key) => ({ kind: 'route' as const, key })),
    ...factKeys.map((key) => ({ kind: 'fact' as const, key })),
    ...evidenceKeys.map((key) => ({ kind: 'evidence' as const, key })),
  ];
  if (obligations.length === 0) {
    throw new Error(
      '--stop-routes/--stop-facts/--stop-evidence 중 하나 이상의 obligation이 필요합니다',
    );
  }

  const noProgressLimit = flags['no-progress-limit']
    ? parseNonNegativeIntegerFlag(flags['no-progress-limit'], 'no-progress-limit')
    : undefined;
  if (noProgressLimit !== undefined && noProgressLimit < 1) {
    throw new Error('--no-progress-limit must be a positive integer');
  }
  return Object.freeze({
    obligations: Object.freeze(obligations),
    ...(noProgressLimit !== undefined ? { noProgressLimit } : {}),
  });
}
export async function cmdContext(
  source: DefDataSource,
  docId: string,
  flags: Record<string, string> = {},
  dependencies: ContextCommandDependencies,
) {
  const doc = await source.get(docId);
  if (!doc) {
    console.log(`문서 "${docId}" 없음`);
    return;
  }

  if (flags['bounded'] === 'true') {
    if (flags['initial-usage'] && flags['provider-usage']) {
      throw new Error('--initial-usage와 --provider-usage는 동시에 사용할 수 없습니다');
    }
    const providerUsage = flags['provider-usage']
      ? createContextUsageLedger([
          readProviderUsageEvent(
            flags['provider-usage'],
            flags['provider'],
            flags['provider-phase'],
          ),
        ]).snapshot()
      : undefined;
    if (flags['tokenizer-module'] && flags['tokenizer-registry']) {
      throw new Error('--tokenizer-module과 --tokenizer-registry는 동시에 사용할 수 없습니다');
    }
    if (
      !flags['tokenizer-module'] &&
      !flags['tokenizer-registry'] &&
      (flags['tokenizer-provider'] !== undefined || flags['tokenizer-model'] !== undefined)
    ) {
      throw new Error(
        '--tokenizer-provider/--tokenizer-model은 --tokenizer-module 또는 --tokenizer-registry와 함께 사용해야 합니다',
      );
    }
    const tokenizerSelection = {
      ...(flags['tokenizer-provider'] ? { provider: flags['tokenizer-provider'] } : {}),
      ...(flags['tokenizer-model'] ? { model: flags['tokenizer-model'] } : {}),
    };
    const stopPolicy = parseContextStopPolicy(flags);
    const tokenCounter = flags['tokenizer-module']
      ? await loadProviderTokenCounter(flags['tokenizer-module'], tokenizerSelection)
      : flags['tokenizer-registry']
        ? await loadProviderTokenCounterFromRegistry(
            flags['tokenizer-registry'],
            tokenizerSelection,
          )
        : undefined;
    const bounded = await buildBoundedDefinitionContext({
      source,
      docId,
      document: doc,
      ...(flags['initial-usage']
        ? { initialUsage: readInitialUsageSummary(flags['initial-usage']) }
        : {}),
      ...(providerUsage ? { initialUsage: providerUsage } : {}),
      ...(tokenCounter ? { tokenCounter } : {}),
      ...(flags['used-tokens']
        ? { usedTokens: parseNonNegativeIntegerFlag(flags['used-tokens'], 'used-tokens') }
        : {}),
      ...(!flags['used-tokens'] && tokenCounter
        ? { usedTokensMeasurement: 'measured' as const }
        : {}),
      ...(stopPolicy ? { stopPolicy } : {}),
    });
    const persistedHandoff = flags['handoff-out']
      ? await persistDefinitionTaskHandoff(bounded, flags)
      : undefined;
    const boundedOutput = persistedHandoff
      ? { ...bounded, handoff: persistedHandoff.handoff }
      : bounded;
    if (flags['json'] === 'true') {
      console.log(JSON.stringify(boundedOutput, null, 2));
      return;
    }
    console.log(`# bounded 컨텍스트: ${doc.title ?? doc.docId}\n`);
    console.log(`discovery: ${bounded.discovery.status}`);
    console.log(`selected routes: ${bounded.discovery.selectedRouteKeys.join(', ') || '(없음)'}`);
    console.log(`working: ${bounded.workingContext.status}`);
    if (bounded.stopDecision) {
      console.log(`stop: ${bounded.stopDecision.reason} → ${bounded.stopDecision.action}`);
    }
    if (bounded.discovery.decomposition) {
      console.log(
        `decomposition: ${bounded.discovery.decomposition.children.length} child task(s) [${bounded.discovery.decomposition.reason}]`,
      );
    }
    console.log(
      `facts: ${bounded.workingContext.facts.map((fact) => fact.factKey).join(', ') || '(없음)'}`,
    );
    console.log(
      `manifest: ${bounded.manifest?.digest ?? '(not created — working context blocked)'}`,
    );
    if (persistedHandoff) console.log(`handoff: ${persistedHandoff.path}`);
    console.log(`observation: ${bounded.observation.eventName}`);
    return;
  }

  const parent = await source.getParent(docId);
  const outgoing = await source.getOutgoingLinks(docId);
  const incoming = await source.getIncomingLinks(docId);

  console.log(`# 컨텍스트: ${doc.title ?? doc.docId}\n`);
  const typeLabel =
    doc.type === 'knowledge' && doc.knowledgeKind
      ? `type: knowledge/${doc.knowledgeKind}`
      : doc.type
        ? `type: ${doc.type}`
        : '';
  console.log(
    `scope: ${doc.scope}/${doc.aspect}  depth: ${doc.depth}  lifecycle: ${doc.lifecycle}`,
  );
  if (typeLabel) console.log(typeLabel);
  if (doc.layer) console.log(`layer: ${doc.layer}`);
  if (doc.svc) console.log(`svc: ${doc.svc}`);
  if (doc.address) console.log(`address: ${doc.address}`);

  // domain_root 파생 — fail-open
  try {
    const registry = await dependencies.buildDomainRootRegistry(source);
    const entry = registry.get(docId);
    if (entry) {
      const derivedRoot = deriveDomainRoot(entry, registry);
      if (derivedRoot === docId) {
        console.log(`도메인 루트: self`);
      } else {
        console.log(`도메인 루트: ${derivedRoot}`);
      }
      const mismatch = detectOwnerRootMismatch(entry, derivedRoot, registry);
      if (mismatch === 'mismatch' && entry.owner_system) {
        console.log(`⚠ owner_system (${entry.owner_system}) 과 파생 root (${derivedRoot}) 불일치`);
      }
    }
  } catch {
    // 파생 실패 시 조용히 스킵 (context의 나머지 출력은 계속)
  }

  // 목적
  if (doc.purpose) {
    console.log(`\n## 이 문서의 목적`);
    console.log(doc.purpose);
  }

  // 소속 (부모 그룹)
  if (parent) {
    console.log(`\n## 소속`);
    console.log(`- ${parent.docId}: ${parent.purpose?.slice(0, 120) ?? ''}`);
  }

  // 적용되는 제약
  const outgoingConstraints = outgoing.filter((l) => l.type === 'constrains');
  const implementedContracts = outgoing.filter((l) => l.type === 'implements');
  const constraintIncoming = incoming.filter((l) => l.type === 'constrains');
  if (
    outgoingConstraints.length > 0 ||
    implementedContracts.length > 0 ||
    constraintIncoming.length > 0
  ) {
    console.log(`\n## 적용되는 제약`);
    for (const c of constraintIncoming) {
      const cDoc = await source.get(c.source);
      console.log(
        `- [${formatLinkRef(c.source, c.sourceAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
    for (const c of outgoingConstraints) {
      const cDoc = await source.get(c.target);
      console.log(
        `- [constrains → ${formatLinkRef(c.target, c.targetAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
    for (const c of implementedContracts) {
      const cDoc = await source.get(c.target);
      console.log(
        `- [implements → ${formatLinkRef(c.target, c.targetAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
  }

  // 의존 대상
  const deps = outgoing.filter(
    (l) => l.type === 'depends_on' || l.type === 'implements' || l.type === 'refines',
  );
  if (deps.length > 0) {
    console.log(`\n## 의존 대상`);
    for (const d of deps) {
      const dDoc = await source.get(d.target);
      console.log(
        `- [${d.type}] ${formatLinkRef(d.target, d.targetAddress)}: ${dDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
  }

  // concerns (태그 기반 — 직접 + 상속)
  const directConcerns = extractConcernTags(doc.tags);
  const inheritedConcerns: string[] = [];
  for (const link of [...deps, ...(parent ? [{ target: parent.docId, type: 'contains' }] : [])]) {
    const target = await source.get(link.target);
    if (!target) continue;
    const tConcerns = extractConcernTags(target.tags);
    for (const c of tConcerns) {
      inheritedConcerns.push(`${c} from ${link.target} via ${link.type}`);
    }
  }
  if (directConcerns.length > 0 || inheritedConcerns.length > 0) {
    console.log(`\n## concerns`);
    if (directConcerns.length > 0) console.log(`직접: ${directConcerns.join(', ')}`);
    if (inheritedConcerns.length > 0) {
      for (const ic of new Set(inheritedConcerns)) {
        console.log(`상속: ${ic}`);
      }
    }
  }

  // 영향 범위
  const blastRadius = incoming.filter((l) => l.type !== 'contains');
  console.log(`\n## 영향 범위`);
  console.log(`blast radius: ${blastRadius.length}건`);
  for (const b of blastRadius.slice(0, 10)) {
    console.log(`- [${b.type}] ${formatLinkRef(b.source, b.sourceAddress)}`);
  }
  if (blastRadius.length > 10) console.log(`  ... 외 ${blastRadius.length - 10}건`);

  const requests = await source.getFeedbackRequestsByDocId(docId, 5);
  if (requests.length > 0) {
    console.log(`\n## 최근 Feedback Requests`);
    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : '';
      console.log(`- ${request.id}${model}: ${request.purpose}`);
    }
  }
}

function readInitialUsageSummary(value: string): ContextUsageSummary {
  if (value === 'true') {
    throw new Error('--initial-usage에는 usage summary JSON 파일 경로가 필요합니다');
  }

  const path = resolve(getRootDir(), value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`initial usage summary를 읽을 수 없습니다: ${path}`, { cause: error });
  }
  return parsed as ContextUsageSummary;
}

export { cmdHandoff, cmdHandoffAggregate, persistDefinitionTaskHandoff } from './handoff-commands.js';
