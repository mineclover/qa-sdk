import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { collectImpactFindings } from './api-impact-collector.js';
import { resolveSourceProfiles } from './api-impact-sources.js';
import {
  buildDependencyGraph,
  extractSymbolsForLineRanges,
  findMethodReachability,
  parseTypeScriptFile,
} from './api-impact-ast.js';
import { findConsumerMatches } from './api-impact-consumers.js';
import { evaluateImpactBaseline } from './api-impact-baseline.js';
import {
  collectChangedSymbols,
  filterApiImpactFiles,
  mergeChangedFiles,
} from './api-impact-diff.js';
import { evaluateImpactPolicy, findingKey, readBaselineKeys } from './api-impact-policy.js';
import {
  analyzeApiImpact,
  parseImpactCliOptions,
  resolveConsumerRootsForSite,
} from './api-impact-analyzer.js';
import type { ApiImpactFinding } from './api-impact-model.js';
import { findImplementations } from './endpoint-mapper.js';
import type { ImplementationSite } from './endpoint-mapper.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('api impact source profiles', () => {
  it('resolves external roots from environment instead of a machine-local path', () => {
    const profiles = resolveSourceProfiles('/workspace/qa-sdk', {
      QA_API_IMPACT_OA_SDK_ROOT: '/workspace/oa-sdk',
      QA_API_IMPACT_SIM_ROOT: 'fixtures/enterprise-pm',
    });

    expect(profiles[0]).toMatchObject({
      id: 'oa-sdk',
      endpointRoot: '/workspace/oa-sdk/packages/schemas/src/domains',
      implementationRoot: '/workspace/qa-sdk/fixtures/enterprise-pm/services',
      consumerRoot: '/workspace/qa-sdk/fixtures/enterprise-pm/scenarios/src',
    });
    expect(profiles[1]?.id).toBe('enterprise-pm');

    expect(resolveConsumerRootsForSite({ serviceId: 'oa-sdk' }, profiles)).toEqual([
      '/workspace/qa-sdk/fixtures/enterprise-pm/scenarios/src',
    ]);
    expect(resolveConsumerRootsForSite({ serviceId: 'missing' }, profiles)).toEqual([]);
  });
});

describe('api impact changed files', () => {
  it('merges tracked and untracked files without duplicates', () => {
    expect(
      mergeChangedFiles(['src/a.ts', 'src/shared.ts'], ['src/new.ts', 'src/shared.ts']),
    ).toEqual(['src/a.ts', 'src/shared.ts', 'src/new.ts']);
  });

  it('keeps only source and OpenAPI files for impact analysis', () => {
    expect(
      filterApiImpactFiles(['docs/README.md', 'src/new.ts', 'contracts/spec.yaml', 'package.json']),
    ).toEqual(['src/new.ts', 'contracts/spec.yaml']);
  });

  it('recovers full-file symbols when a diff is unavailable', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'project.service.ts');
    writeFileSync(filePath, 'export class ProjectService { create() {} }');

    expect(collectChangedSymbols(root, ['project.service.ts']).get(filePath)).toEqual([
      'ProjectService',
      'ProjectService.create',
    ]);
  });
});

describe('api impact analysis integration', () => {
  it('keeps implementation and consumer findings within the matching profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const profiles = ['oa-sdk', 'enterprise-pm'].map((id) => {
      const operationToken = id.replace(/-/g, '');
      const endpointRoot = join(root, id, 'spec');
      const implementationRoot = join(root, id, 'services');
      const consumerRoot = join(root, id, 'consumers');
      mkdirSync(endpointRoot, { recursive: true });
      mkdirSync(implementationRoot, { recursive: true });
      mkdirSync(consumerRoot, { recursive: true });
      writeFileSync(
        join(endpointRoot, 'spec.yaml'),
        ['paths:', '  /projects:', '    post:', `      operationId: ${operationToken}Create`].join(
          '\n',
        ),
      );
      writeFileSync(
        join(implementationRoot, 'project.controller.ts'),
        [
          "@Controller('projects')",
          'class ProjectController {',
          '  @Post()',
          '  create() {}',
          '}',
        ].join('\n'),
      );
      writeFileSync(
        join(consumerRoot, 'scenario.ts'),
        `const ${operationToken}Create = () => fetchImpl('/projects', { method: 'POST' });`,
      );
      return { id, endpointRoot, implementationRoot, consumerRoot };
    });

    const progress: string[] = [];
    const result = analyzeApiImpact(root, profiles, ['oa-sdk/services/project.controller.ts'], {
      strict: true,
      onProgress: (event) => progress.push(event.stage),
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ serviceId: 'oa-sdk', status: 'confirmed' });
    expect(result.findings[0]?.consumers).toEqual(['oa-sdk/consumers/scenario.ts']);
    expect(result.summary.gateBlocking).toBe(1);
    expect(progress).toEqual(['profile', 'profile', 'graph', 'graph', 'symbols', 'impact']);
  });
});

describe('collectImpactFindings', () => {
  it('keeps source-token matches as heuristic and unconfirmed', () => {
    const root = createFixtureRoot('class ProjectController { create() { return Graph; } }');
    const findings = collectImpactFindings(
      ['src/graph.service.ts'],
      new Map([['GET /projects', createSite(join(root, 'project.controller.ts'))]]),
      root,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      status: 'unconfirmed',
      confidence: 'heuristic',
      changedFile: 'src/graph.service.ts',
      reason: 'Heuristic candidate via source token: Graph',
    });
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: 'fallback',
        symbol: 'Graph',
      }),
    ]);
  });

  it('does not create a heuristic candidate when the source token is absent', () => {
    const root = createFixtureRoot('class ProjectController { create() {} }');
    const findings = collectImpactFindings(
      ['src/graph.service.ts'],
      new Map([['POST /projects', createSite(join(root, 'project.controller.ts'))]]),
      root,
    );

    expect(findings).toEqual([]);
  });

  it('does not treat a Graph route name as a dependency token', () => {
    const root = createFixtureRoot('class ProjectController { delegationGraph() { return 1; } }');
    const findings = collectImpactFindings(
      ['src/graph.service.ts'],
      new Map([
        ['GET /projects/graph', createSite(join(root, 'project.controller.ts'), 'delegationGraph')],
      ]),
      root,
    );

    expect(findings).toEqual([]);
  });

  it.each([
    'project.use-case.ts',
    'project.query.ts',
    'project.port.ts',
    'project.adapter.ts',
    'project.module.ts',
  ])('keeps %s changes in the conservative fallback coverage', (changedFile) => {
    const root = createFixtureRoot('class ProjectController { create() { return Project; } }');
    const findings = collectImpactFindings(
      [changedFile],
      new Map([['POST /projects', createSite(join(root, 'project.controller.ts'))]]),
      root,
    );

    expect(findings[0]).toMatchObject({
      status: 'unconfirmed',
      confidence: 'heuristic',
      reason: 'Heuristic candidate via source token: Project',
    });
  });

  it('marks a changed mapped controller as direct and confirmed', () => {
    const root = createFixtureRoot('class ProjectController { create() {} }');
    const findings = collectImpactFindings(
      ['project.controller.ts'],
      new Map([['POST /projects', createSite(join(root, 'project.controller.ts'))]]),
      root,
      {
        resolveConsumers: () => [
          {
            filePath: 'simulations/enterprise-pm/scenarios/src/project.ts',
            kind: 'operation-id',
            detail: 'contains OpenAPI operationId project.create',
          },
        ],
      },
    );

    expect(findings[0]).toMatchObject({
      status: 'confirmed',
      confidence: 'direct',
      reason: 'Direct implementation change (Controller)',
    });
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: 'controller',
      symbol: 'ProjectController.create',
    });
    expect(findings[0]?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'consumer',
          serviceId: 'enterprise-pm',
        }),
      ]),
    );
  });

  it('uses AST DI and call evidence for a reachable service change', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const servicePath = join(root, 'project.service.ts');
    const controllerPath = join(root, 'project.controller.ts');
    writeFileSync(servicePath, 'export class ProjectService { create() {} }');
    writeFileSync(
      controllerPath,
      [
        "import { ProjectService } from './project.service.js';",
        "@Controller('projects')",
        'class ProjectController {',
        '  constructor(@Inject(ProjectService) private readonly service: ProjectService) {}',
        '  @Post()',
        '  create() { return this.service.create(); }',
        '}',
      ].join('\n'),
    );
    const findings = collectImpactFindings(
      ['project.service.ts'],
      new Map([['POST /projects', createSite(controllerPath)]]),
      root,
      {
        dependencyGraph: buildDependencyGraph([controllerPath, servicePath]),
        changedSymbols: new Map([[servicePath, ['ProjectService.create']]]),
      },
    );

    expect(findings[0]).toMatchObject({
      status: 'confirmed',
      confidence: 'di',
      reason: 'Structural impact via di dependency',
    });
    expect(findings[0]?.evidence.map((evidence) => evidence.kind)).toEqual(['di', 'call']);
  });

  it('keeps an unreachable changed method as a candidate', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const servicePath = join(root, 'project.service.ts');
    const controllerPath = join(root, 'project.controller.ts');
    writeFileSync(servicePath, 'export class ProjectService { create() {} }');
    writeFileSync(
      controllerPath,
      [
        "import { ProjectService } from './project.service.js';",
        "@Controller('projects')",
        'class ProjectController {',
        '  constructor(@Inject(ProjectService) private readonly service: ProjectService) {}',
        '  @Post()',
        '  create() { return this.service.create(); }',
        '}',
      ].join('\n'),
    );
    const findings = collectImpactFindings(
      ['project.service.ts'],
      new Map([['POST /projects', createSite(controllerPath)]]),
      root,
      {
        dependencyGraph: buildDependencyGraph([controllerPath, servicePath]),
        changedSymbols: new Map([[servicePath, ['ProjectService.update']]]),
      },
    );

    expect(findings[0]).toMatchObject({
      status: 'candidate',
      confidence: 'di',
      reason: 'Structural dependency found; changed method reachability is unconfirmed',
    });
  });

  it('does not confirm a dependency-only path when changed method reachability is unknown', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const servicePath = join(root, 'project.service.ts');
    const controllerPath = join(root, 'project.controller.ts');
    writeFileSync(servicePath, 'export class ProjectService { create() {} }');
    writeFileSync(
      controllerPath,
      [
        "import { ProjectService } from './project.service.js';",
        "@Controller('projects')",
        'class ProjectController {',
        '  constructor(@Inject(ProjectService) private readonly service: ProjectService) {}',
        '  @Post()',
        '  create() { return 1; }',
        '}',
      ].join('\n'),
    );
    const findings = collectImpactFindings(
      ['project.service.ts'],
      new Map([['POST /projects', createSite(controllerPath)]]),
      root,
      {
        dependencyGraph: buildDependencyGraph([controllerPath, servicePath]),
        changedSymbols: new Map([[servicePath, []]]),
      },
    );

    expect(findings[0]).toMatchObject({
      status: 'candidate',
      confidence: 'di',
      reason: 'Structural dependency found; changed method reachability is unconfirmed',
    });
  });
});

function createFixtureRoot(controllerSource: string): string {
  const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
  temporaryDirectories.push(root);
  writeFileSync(join(root, 'project.controller.ts'), controllerSource);
  return root;
}

function createSite(filePath: string, methodName = 'create'): ImplementationSite {
  return {
    filePath,
    className: 'ProjectController',
    methodName,
    lineNumber: 1,
    api: 'POST /projects',
    method: 'POST',
    path: '/projects',
    operationId: 'project.create',
    serviceId: 'enterprise-pm',
  };
}

describe('api impact AST graph', () => {
  it('extracts controller routes, constructor DI, and method calls', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const servicePath = join(root, 'project.service.ts');
    const controllerPath = join(root, 'project.controller.ts');
    writeFileSync(servicePath, 'export class ProjectService { create() {} }');
    writeFileSync(
      controllerPath,
      [
        "import { ProjectService } from './project.service.js';",
        "@Controller('projects')",
        'class ProjectController {',
        '  constructor(@Inject(ProjectService) private readonly service: ProjectService) {}',
        '  @Post()',
        '  create() { return this.service.create(); }',
        '}',
      ].join('\n'),
    );

    const controller = parseTypeScriptFile(controllerPath);
    const graph = buildDependencyGraph([controllerPath, servicePath]);
    const reachability = findMethodReachability(
      graph,
      { filePath: controllerPath, className: 'ProjectController', methodName: 'create' },
      servicePath,
      ['ProjectService.create'],
    );

    expect(controller.routes).toEqual([
      expect.objectContaining({
        className: 'ProjectController',
        methodName: 'create',
        method: 'POST',
        path: '/projects',
      }),
    ]);
    expect(controller.dependencyEdges).toEqual([
      expect.objectContaining({
        dependencyName: 'ProjectService',
        targetFilePath: servicePath,
        propertyName: 'service',
      }),
    ]);
    expect(controller.methodCalls).toEqual([
      expect.objectContaining({
        targetFilePath: servicePath,
        targetMethodName: 'create',
      }),
    ]);
    expect(reachability?.dependencyEdges).toHaveLength(1);
    expect(reachability?.methodCalls).toHaveLength(1);
  });

  it('maps changed lines to class and method symbols', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'project.service.ts');
    writeFileSync(filePath, 'class ProjectService {\n  create() { return 1; }\n}\n');
    const file = parseTypeScriptFile(filePath);

    expect(extractSymbolsForLineRanges(file, [{ start: 2, end: 2 }])).toEqual([
      'ProjectService',
      'ProjectService.create',
    ]);
  });

  it('keeps identical routes separate when source profiles differ', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const controllerPath = join(root, 'project.controller.ts');
    writeFileSync(
      controllerPath,
      [
        "@Controller('projects')",
        'class ProjectController {',
        '  @Post()',
        '  create() {}',
        '}',
      ].join('\n'),
    );

    const mapping = findImplementations(
      root,
      [
        {
          method: 'POST',
          path: '/projects',
          operationId: 'enterpriseCreate',
          sourceFile: 'enterprise.yaml',
          sourceProfileId: 'enterprise-pm',
        },
        {
          method: 'POST',
          path: '/projects',
          operationId: 'oaCreate',
          sourceFile: 'oa.yaml',
          sourceProfileId: 'oa-sdk',
        },
      ],
      [root],
    );

    expect(mapping.size).toBe(2);
    expect(mapping.get('enterprise-pm:POST /projects')).toMatchObject({
      operationId: 'enterpriseCreate',
      serviceId: 'enterprise-pm',
    });
    expect(mapping.get('oa-sdk:POST /projects')).toMatchObject({
      operationId: 'oaCreate',
      serviceId: 'oa-sdk',
    });
  });
});

describe('api impact consumers', () => {
  it('recognizes operationId and HTTP method/path calls separately from text fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(root);
    const consumerRoot = join(root, 'scenarios');
    const consumerFile = join(consumerRoot, 'scenario.ts');
    const textOnlyFile = join(consumerRoot, 'notes.ts');
    mkdirSync(consumerRoot, { recursive: true });
    writeFileSync(
      consumerFile,
      [
        '// operationId: delegateProject',
        'const delegateProject = () =>',
        "  fetchImpl(`http://sim/projects/${project.id}/delegate`, { method: 'POST' });",
      ].join('\n'),
    );
    writeFileSync(textOnlyFile, '// POST /projects/{projectId}/delegate');
    writeFileSync(join(consumerRoot, 'comments.ts'), '// operationId: delegateProject');

    const matches = findConsumerMatches(
      {
        ...createSite(join(root, 'project.controller.ts')),
        api: 'POST /projects/{projectId}/delegate',
        method: 'POST',
        path: '/projects/{projectId}/delegate',
        operationId: 'delegateProject',
      },
      [consumerRoot],
      root,
    );

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filePath: 'scenarios/scenario.ts', kind: 'operation-id' }),
        expect.objectContaining({ filePath: 'scenarios/scenario.ts', kind: 'http-call' }),
        expect.objectContaining({ filePath: 'scenarios/notes.ts', kind: 'text-path' }),
      ]),
    );
    expect(matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filePath: 'scenarios/comments.ts', kind: 'operation-id' }),
      ]),
    );
  });
});

describe('api impact policy', () => {
  it('keeps advisory as the default and only strict-confirmed findings block', () => {
    const direct = createFinding('confirmed', 'di', 'ProjectService.create');
    const heuristic = createFinding('unconfirmed', 'heuristic', 'Graph');
    const candidate = createFinding('candidate', 'di', 'ProjectService.update');

    const result = evaluateImpactPolicy([direct, heuristic, candidate], { strict: true });

    expect(result.summary).toMatchObject({
      total: 3,
      visible: 3,
      advisory: 2,
      reviewRequired: 1,
      gateBlocking: 1,
    });
  });

  it('filters confidence and exact baseline identities without changing findings', () => {
    const direct = createFinding('confirmed', 'di', 'ProjectService.create');
    const transitive = createFinding('confirmed', 'transitive', 'ProjectService.list');
    const heuristic = createFinding('unconfirmed', 'heuristic', 'Graph');
    const baseline = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-'));
    temporaryDirectories.push(baseline);
    const baselinePath = join(baseline, 'baseline.json');
    writeFileSync(baselinePath, JSON.stringify({ affectedApis: [direct] }));

    const result = evaluateImpactPolicy([direct, transitive, heuristic], {
      minimumConfidence: 'transitive',
      baselineKeys: readBaselineKeys(baselinePath),
    });

    expect(result.findings).toEqual([transitive]);
    expect(result.summary).toMatchObject({
      confidenceExcluded: 1,
      baselineExcluded: 1,
    });
    expect(findingKey(direct)).toContain('enterprise-pm|POST /projects');
  });

  it('parses operational options while preserving text as the default format', () => {
    expect(
      parseImpactCliOptions([
        '--format',
        'json',
        '--confidence=di',
        '--baseline',
        'impact-baseline.json',
        '--strict',
      ]),
    ).toEqual({
      format: 'json',
      minimumConfidence: 'di',
      baselinePath: 'impact-baseline.json',
      strict: true,
    });
    expect(parseImpactCliOptions([])).toEqual({
      format: 'text',
      minimumConfidence: undefined,
      baselinePath: undefined,
      strict: false,
    });
  });

  it('measures confirmed impact separately from retained heuristic warnings', () => {
    const positive = createFinding('confirmed', 'di', 'ProjectService.create');
    const warning = createFinding('unconfirmed', 'heuristic', 'Graph');

    const report = evaluateImpactBaseline([
      {
        id: 'positive',
        expected: 'impact',
        findings: [positive],
      },
      {
        id: 'heuristic-warning',
        expected: 'no-impact',
        findings: [warning],
        expectedConfidence: ['heuristic'],
        expectedStatus: ['unconfirmed'],
      },
    ]);

    expect(report).toMatchObject({
      passed: true,
      truePositive: 1,
      trueNegative: 1,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
    });
    expect(report.cases[1]).toMatchObject({
      findingCount: 1,
      confirmedImpactCount: 0,
      warningCount: 1,
    });
  });
});

function createFinding(
  status: ApiImpactFinding['status'],
  confidence: ApiImpactFinding['confidence'],
  changedSymbol: string,
): ApiImpactFinding {
  return {
    api: 'POST /projects',
    serviceId: 'enterprise-pm',
    operationId: 'project.create',
    method: 'POST',
    path: '/projects',
    entryPoint: {
      filePath: '/workspace/project.controller.ts',
      className: 'ProjectController',
      methodName: 'create',
      lineNumber: 1,
    },
    changedFile: 'src/project.service.ts',
    changedSymbols: [changedSymbol],
    status,
    confidence,
    reason: 'fixture',
    evidence: [],
    consumers: [],
  };
}
