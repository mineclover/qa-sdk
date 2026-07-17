import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeApiImpact } from './api-impact-analyzer.js';
import type {
  ApiImpactEvidence,
  ApiImpactFinding,
  ImpactConfidence,
  ImpactStatus,
} from './api-impact-model.js';

export type BaselineExpectation = 'impact' | 'no-impact';

export interface ApiImpactBaselineCase {
  id: string;
  expected: BaselineExpectation;
  findings: readonly ApiImpactFinding[];
  expectedConfidence?: readonly ImpactConfidence[];
  expectedStatus?: readonly ImpactStatus[];
  expectedEvidenceKinds?: readonly ApiImpactEvidence['kind'][];
}

export interface ApiImpactBaselineCaseResult {
  id: string;
  expected: BaselineExpectation;
  predicted: BaselineExpectation;
  findingCount: number;
  confirmedImpactCount: number;
  warningCount: number;
  confidences: ImpactConfidence[];
  statuses: ImpactStatus[];
  evidenceKinds: ApiImpactEvidence['kind'][];
  passed: boolean;
  classificationErrors: string[];
}

export interface ApiImpactBaselineReport {
  passed: boolean;
  totalCases: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  cases: ApiImpactBaselineCaseResult[];
}

const ENDPOINT = {
  method: 'POST',
  path: '/projects',
  operationId: 'projectCreate',
  sourceFile: 'fixture.yaml',
  sourceProfileId: 'enterprise-pm',
} as const;

export function evaluateImpactBaseline(
  cases: readonly ApiImpactBaselineCase[],
): ApiImpactBaselineReport {
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  const results = cases.map((baselineCase) => {
    const confirmedImpactCount = baselineCase.findings.filter(
      (finding) => finding.status === 'confirmed' && finding.confidence !== 'heuristic',
    ).length;
    const predicted: BaselineExpectation = confirmedImpactCount > 0 ? 'impact' : 'no-impact';
    if (baselineCase.expected === 'impact' && predicted === 'impact') truePositive++;
    if (baselineCase.expected === 'no-impact' && predicted === 'no-impact') trueNegative++;
    if (baselineCase.expected === 'no-impact' && predicted === 'impact') falsePositive++;
    if (baselineCase.expected === 'impact' && predicted === 'no-impact') falseNegative++;

    const classificationErrors: string[] = [];
    if (baselineCase.expectedConfidence?.length) {
      for (const confidence of baselineCase.expectedConfidence) {
        if (!baselineCase.findings.some((finding) => finding.confidence === confidence)) {
          classificationErrors.push(`expected confidence ${confidence}`);
        }
      }
    }
    if (baselineCase.expectedStatus?.length) {
      for (const status of baselineCase.expectedStatus) {
        if (!baselineCase.findings.some((finding) => finding.status === status)) {
          classificationErrors.push(`expected status ${status}`);
        }
      }
    }
    if (baselineCase.expectedEvidenceKinds) {
      const actualEvidenceKinds = baselineCase.findings
        .flatMap((finding) => finding.evidence.map((evidence) => evidence.kind))
        .sort();
      const expectedEvidenceKinds = [...baselineCase.expectedEvidenceKinds].sort();
      if (JSON.stringify(actualEvidenceKinds) !== JSON.stringify(expectedEvidenceKinds)) {
        classificationErrors.push(
          `expected evidence ${expectedEvidenceKinds.join(',')}, got ${actualEvidenceKinds.join(',')}`,
        );
      }
    }

    return {
      id: baselineCase.id,
      expected: baselineCase.expected,
      predicted,
      findingCount: baselineCase.findings.length,
      confirmedImpactCount,
      warningCount: baselineCase.findings.length - confirmedImpactCount,
      confidences: unique(baselineCase.findings.map((finding) => finding.confidence)),
      statuses: unique(baselineCase.findings.map((finding) => finding.status)),
      evidenceKinds: baselineCase.findings
        .flatMap((finding) => finding.evidence.map((evidence) => evidence.kind))
        .sort(),
      passed: baselineCase.expected === predicted && classificationErrors.length === 0,
      classificationErrors,
    };
  });

  const precision = ratio(truePositive, truePositive + falsePositive, 1);
  const recall = ratio(truePositive, truePositive + falseNegative, 1);
  const falsePositiveRate = ratio(falsePositive, falsePositive + trueNegative, 0);

  return {
    passed: results.every((result) => result.passed),
    totalCases: cases.length,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    precision,
    recall,
    falsePositiveRate,
    cases: results,
  };
}

export function runApiImpactBaseline(): ApiImpactBaselineReport {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'qa-sdk-api-impact-baseline-'));
  try {
    return evaluateImpactBaseline(buildBaselineCases(fixtureRoot));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function buildBaselineCases(root: string): ApiImpactBaselineCase[] {
  return [
    buildFixtureCase(root, {
      id: 'negative-delegation-graph-name',
      expected: 'no-impact',
      controllerSource: controllerSource('return this.delegationGraph();'),
      changedFile: 'graph.service.ts',
      extraFiles: { 'graph.service.ts': 'export class GraphService { validate() {} }' },
      expectedConfidence: ['heuristic'],
      expectedStatus: ['unconfirmed'],
      expectedEvidenceKinds: ['fallback'],
    }),
    buildFixtureCase(root, {
      id: 'negative-graph-catalog-controller',
      expected: 'no-impact',
      controllerSource: controllerSource('return this.listGraphs();', 'GraphCatalogController'),
      changedFile: 'graph.service.ts',
      extraFiles: { 'graph.service.ts': 'export class GraphService { validate() {} }' },
      expectedConfidence: ['heuristic'],
      expectedStatus: ['unconfirmed'],
      expectedEvidenceKinds: ['fallback'],
    }),
    buildFixtureCase(root, {
      id: 'negative-unrelated-controller',
      expected: 'no-impact',
      controllerSource: controllerSource('return 1;'),
      changedFile: 'graph.service.ts',
      extraFiles: { 'graph.service.ts': 'export class GraphService { validate() {} }' },
    }),
    buildFixtureCase(root, {
      id: 'positive-direct-controller',
      expected: 'impact',
      controllerSource: controllerSource('return 1;'),
      changedFile: 'project.controller.ts',
      expectedConfidence: ['direct'],
      expectedStatus: ['confirmed'],
      expectedEvidenceKinds: ['consumer', 'consumer', 'controller'],
      consumerFiles: {
        'project-scenario.ts':
          "const projectCreate = () => fetchImpl('/projects', { method: 'POST' });",
      },
    }),
    buildFixtureCase(root, {
      id: 'positive-di-service-method',
      expected: 'impact',
      controllerSource: diControllerSource(),
      changedFile: 'project.service.ts',
      extraFiles: { 'project.service.ts': 'export class ProjectService { create() {} }' },
      expectedConfidence: ['di'],
      expectedStatus: ['confirmed'],
      expectedEvidenceKinds: ['call', 'di'],
    }),
    buildFixtureCase(root, {
      id: 'positive-transitive-repository-method',
      expected: 'impact',
      controllerSource: diControllerSource(),
      changedFile: 'project.repository.ts',
      extraFiles: {
        'project.service.ts': [
          "import { ProjectRepository } from './project.repository.js';",
          'export class ProjectService {',
          '  constructor(@Inject(ProjectRepository) private readonly repository: ProjectRepository) {}',
          '  create() { return this.repository.save(); }',
          '}',
        ].join('\n'),
        'project.repository.ts': 'export class ProjectRepository { save() {} }',
      },
      expectedConfidence: ['transitive'],
      expectedStatus: ['confirmed'],
      expectedEvidenceKinds: ['call', 'call', 'di', 'di'],
    }),
  ];
}

interface FixtureOptions {
  id: string;
  expected: BaselineExpectation;
  controllerSource: string;
  changedFile: string;
  extraFiles?: Record<string, string>;
  consumerFiles?: Record<string, string>;
  expectedConfidence?: ImpactConfidence[];
  expectedStatus?: ImpactStatus[];
  expectedEvidenceKinds?: ApiImpactEvidence['kind'][];
}

function buildFixtureCase(root: string, options: FixtureOptions): ApiImpactBaselineCase {
  const caseRoot = join(root, options.id);
  mkdirSync(caseRoot, { recursive: true });
  const controllerPath = join(caseRoot, 'project.controller.ts');
  writeFileSync(controllerPath, options.controllerSource);
  for (const [fileName, source] of Object.entries(options.extraFiles ?? {})) {
    writeFileSync(join(caseRoot, fileName), source);
  }

  const endpointRoot = join(caseRoot, 'spec');
  const consumerRoot = join(caseRoot, 'consumers');
  mkdirSync(endpointRoot, { recursive: true });
  mkdirSync(consumerRoot, { recursive: true });
  for (const [fileName, source] of Object.entries(options.consumerFiles ?? {})) {
    writeFileSync(join(consumerRoot, fileName), source);
  }
  writeFileSync(
    join(endpointRoot, ENDPOINT.sourceFile),
    ['paths:', '  /projects:', '    post:', `      operationId: ${ENDPOINT.operationId}`].join(
      '\n',
    ),
  );
  const analysis = analyzeApiImpact(
    caseRoot,
    [
      {
        id: ENDPOINT.sourceProfileId,
        endpointRoot,
        implementationRoot: caseRoot,
        consumerRoot,
      },
    ],
    [options.changedFile],
  );

  return {
    id: options.id,
    expected: options.expected,
    findings: analysis.findings,
    ...(options.expectedConfidence ? { expectedConfidence: options.expectedConfidence } : {}),
    ...(options.expectedStatus ? { expectedStatus: options.expectedStatus } : {}),
    ...(options.expectedEvidenceKinds
      ? { expectedEvidenceKinds: options.expectedEvidenceKinds }
      : {}),
  };
}

function controllerSource(body: string, className = 'ProjectController'): string {
  return [
    "@Controller('projects')",
    `class ${className} {`,
    '  @Post()',
    `  create() { ${body} }`,
    '}',
  ].join('\n');
}

function diControllerSource(): string {
  return [
    "import { ProjectService } from './project.service.js';",
    "@Controller('projects')",
    'class ProjectController {',
    '  constructor(@Inject(ProjectService) private readonly service: ProjectService) {}',
    '  @Post()',
    '  create() { return this.service.create(); }',
    '}',
  ].join('\n');
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function ratio(numerator: number, denominator: number, emptyValue: number): number {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function printHumanReport(report: ApiImpactBaselineReport): void {
  console.log(`API impact baseline: ${report.passed ? 'passed' : 'failed'}`);
  console.log(
    `cases=${report.totalCases} TP=${report.truePositive} TN=${report.trueNegative} FP=${report.falsePositive} FN=${report.falseNegative}`,
  );
  console.log(
    `precision=${report.precision.toFixed(3)} recall=${report.recall.toFixed(3)} falsePositiveRate=${report.falsePositiveRate.toFixed(3)}`,
  );
  for (const baselineCase of report.cases) {
    const suffix = baselineCase.classificationErrors.join(', ');
    console.log(
      `- ${baselineCase.id}: ${baselineCase.passed ? 'pass' : 'fail'} (${baselineCase.predicted}, findings=${baselineCase.findingCount}, confirmed=${baselineCase.confirmedImpactCount}, warnings=${baselineCase.warningCount}${suffix ? `, ${suffix}` : ''})`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runApiImpactBaseline();
  if (process.argv.includes('--json') || process.argv.includes('--format=json')) {
    process.stdout.write(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }
  process.exitCode = report.passed ? 0 : 1;
}
