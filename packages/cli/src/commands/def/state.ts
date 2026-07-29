// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createHarnessRegistry,
  deriveConventionState,
  deriveDocLifecycle,
  deriveSpecImplState,
  deriveSyncState,
  detectDrift,
  hashFrontmatter,
  readDefConfig,
  type DefDataSource,
  type ScanResult,
} from 'definition-catalog';
import type { DataSourceOptions } from 'definition-data-source';
import { analyzeDrift, extractDeclarations, scanImplementations, type DriftReport } from 'spec-analyzer';
import {
  resolveVerificationReadModel,
  type VerificationReadModel,
} from '../../lib/spec-definition-verification.js';
import {
  printDistributionLine,
  printMachineDistribution,
  printVerificationReadModel,
  type HarnessDocState,
} from './state-renderer.js';

type SourceFactory = (options: DataSourceOptions) => Promise<DefDataSource>;

export interface StateCommandDependencies {
  readonly root: string;
  readonly scan: () => Promise<ScanResult>;
  readonly createSource: SourceFactory;
  readonly closeSource: (source: DefDataSource | undefined) => void;
}
// ── def state — 하네스 상태 분포 ───────────────────────

export async function cmdState(
  rest: string[],
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions = {},
  dependencies: StateCommandDependencies,
) {
  const sourceHolder: { current?: DefDataSource } = {};
  try {
    return await cmdStateImpl(rest, flags, sourceOptions, sourceHolder, dependencies);
  } finally {
    dependencies.closeSource(sourceHolder.current);
  }
}

async function cmdStateImpl(
  rest: string[],
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions = {},
  sourceHolder: { current?: DefDataSource } = {},
  dependencies: StateCommandDependencies,
) {
  const root = dependencies.root;
  const registry = createHarnessRegistry();

  // --deps: 의존 관계만 출력
  if (flags['deps']) {
    printDeps(registry);
    return;
  }

  const scanResult = await dependencies.scan();
  const config = await readDefConfig(root);
  const configExists = config.lastSyncedAt !== '';

  // checksum 비교 — drift 감지
  const currentChecksums: Record<string, string> = {};
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    currentChecksums[id] = hashFrontmatter(
      `${entry.scope}:${entry.aspect}:${entry.depth}:${entry.level ?? 'leaf'}:${entry.lifecycle}`,
    );
  }
  const drift = detectDrift(config, currentChecksums);
  const checksumMatch = drift.length === 0;

  // 전역 sync 상태
  const syncState = deriveSyncState({
    configExists,
    configCount: config.documentCount,
    scanCount: scanResult.registered,
    checksumMatch,
  });

  let verificationArtifact: unknown | undefined;
  let verificationSource: DefDataSource | undefined;
  const artifactPath = flags['verification-artifact'];
  const driftEnabled = flags['verification-drift'] === 'true' || flags['verification-drift'] === '';
  if (artifactPath || driftEnabled) {
    const now = new Date().toISOString();
    try {
      verificationArtifact = artifactPath
        ? (JSON.parse(readFileSync(resolve(root, artifactPath), 'utf8')) as unknown)
        : {
            schemaVersion: 1,
            runStartedAt: now,
            runCompletedAt: now,
            reports: [],
          };
    } catch {
      // Adapter가 invalid artifact로 진단하도록 빈 object를 전달한다.
      verificationArtifact = {};
    }

    try {
      verificationSource = await dependencies.createSource(sourceOptions);
      sourceHolder.current = verificationSource;
    } catch (error) {
      console.log(`verification artifact source unavailable: ${(error as Error).message}`);
    }
  }

  const driftReports = new Map<string, DriftReport>();
  const implementationsByService = new Map<
    string,
    Awaited<ReturnType<typeof scanImplementations>>
  >();
  if (driftEnabled && verificationSource) {
    for (const entry of scanResult.registry.all()) {
      if (!entry.serviceId) continue;
      try {
        const body = await verificationSource.getBody(entry.id);
        if (!body) continue;
        const declared = extractDeclarations(body.body, entry.id);
        let implemented = implementationsByService.get(entry.serviceId);
        if (!implemented) {
          implemented = await scanImplementations(join(root, 'packages', entry.serviceId));
          implementationsByService.set(entry.serviceId, implemented);
        }
        driftReports.set(entry.id, analyzeDrift(entry.id, entry.serviceId, declared, implemented));
      } catch {
        // Static drift is optional sidecar evidence; runtime state remains available.
      }
    }
  }

  // 각 문서별 상태 파생
  const docStates: HarnessDocState[] = [];
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    const lifecycle = deriveDocLifecycle(entry.lifecycle);

    const hasSvc = !!entry.serviceId;
    const svcDir = entry.serviceId ? join(root, 'packages', entry.serviceId) : null;
    let hasCode = false;
    let hasTests = false;
    if (svcDir) {
      try {
        const { readdirSync } = await import('node:fs');
        const srcDir = join(svcDir, 'src');
        hasCode = existsSync(srcDir) && readdirSync(srcDir).some((f) => f.endsWith('.ts'));
        hasTests = existsSync(srcDir) && readdirSync(srcDir).some((f) => f.endsWith('.test.ts'));
      } catch {
        /* 디렉토리 없음 */
      }
    }

    const specImpl = deriveSpecImplState({
      hasSvc,
      hasCode,
      hasTests,
      testsPass: null,
      isSourceReferenced: entry.depth === 'implementation' || entry.depth === 'validation',
    });

    let verification: VerificationReadModel | undefined;
    if (verificationArtifact !== undefined && verificationSource) {
      verification = await resolveVerificationReadModel(
        verificationSource,
        verificationArtifact,
        id,
        driftReports.get(id),
      );
    }

    // artifact가 없거나 binding이 현재 definition snapshot과 연결되지 않을 때만 unverified 유지
    const convention =
      verification?.convention ??
      deriveConventionState({
        evidenceCount: 0,
        coverage: 0,
        hasFailures: false,
      });

    docStates.push({
      id,
      lifecycle,
      specImpl,
      convention,
      ...(verification ? { verification } : {}),
    });
  }

  const target = rest[0];
  const jsonOutput = flags['json'] === 'true' || flags['json'] === '';

  // 특정 머신 분포
  if (target && registry.machines.has(target)) {
    printMachineDistribution(target, docStates, syncState);
    return;
  }

  // 특정 문서 상태
  if (target) {
    const doc = docStates.find((d) => d.id === target);
    if (!doc) {
      console.log(`문서 "${target}" 없음`);
      return;
    }
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            id: doc.id,
            'doc-lifecycle': doc.lifecycle,
            'spec-impl': doc.specImpl,
            'convention-compliance': doc.convention,
            'db-sync': syncState,
            ...(doc.verification ? { verification: doc.verification } : {}),
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`${doc.id}`);
    console.log(`  doc-lifecycle:          ${doc.lifecycle}`);
    console.log(`  spec-impl:              ${doc.specImpl}`);
    console.log(`  convention-compliance:   ${doc.convention}`);
    console.log(`  db-sync:                ${syncState}`);
    if (doc.verification) printVerificationReadModel(doc.verification);
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ documents: docStates, 'db-sync': syncState }, null, 2));
    return;
  }

  // 전체 분포
  console.log(`── 문서 계층 (${docStates.length}건) ──────────────────────`);
  printDistributionLine(
    'doc-lifecycle',
    docStates.map((d) => d.lifecycle),
  );
  printDistributionLine(
    'spec-impl',
    docStates.map((d) => d.specImpl),
  );
  printDistributionLine(
    'convention',
    docStates.map((d) => d.convention),
  );
  if (verificationArtifact !== undefined) {
    printDistributionLine(
      'verification-report',
      docStates.map((d) => d.verification?.reportStatus ?? 'not-evaluated'),
    );
    printDistributionLine(
      'verification-binding',
      docStates.map((d) => d.verification?.bindingStatus ?? 'not-evaluated'),
    );
    if (driftEnabled) {
      printDistributionLine(
        'verification-drift',
        docStates.map((d) => (d.verification?.driftReport ? 'available' : 'not-available')),
      );
    }
  }
  console.log(`db-sync              ${syncState}`);

  console.log(`\n── 시스템 계층 ────────────────────────`);
  console.log(`address-state        (외부 서비스 연결 필요)`);
  console.log(`version-lifecycle    (외부 서비스 연결 필요)`);
  console.log(`service-status       (외부 서비스 연결 필요)`);
  console.log(`event-status         (외부 서비스 연결 필요)`);
  console.log(`metric-health        (외부 서비스 연결 필요)`);

  console.log(`\n── 프로세스 계층 ──────────────────────`);
  console.log(`decision-flow        (외부 서비스 연결 필요)`);
  console.log(`policy-candidate     (외부 서비스 연결 필요)`);
}

function printDeps(registry: ReturnType<typeof createHarnessRegistry>) {
  const cascade = registry.dependencies.filter((d) => d.kind === 'cascade');
  const guard = registry.dependencies.filter((d) => d.kind === 'guard');
  const notify = registry.dependencies.filter((d) => d.kind === 'notify');

  if (cascade.length > 0) {
    console.log('cascade:');
    for (const d of cascade) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
  if (guard.length > 0) {
    console.log('guard:');
    for (const d of guard) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
  if (notify.length > 0) {
    console.log('notify:');
    for (const d of notify) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
}
