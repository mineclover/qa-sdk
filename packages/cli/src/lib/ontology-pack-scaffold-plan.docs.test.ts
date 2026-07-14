// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { posix as pathPosix } from 'node:path';

import { parseDocument } from 'definition-catalog';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  createOntologyPackScaffoldPlan,
  createOntologyPackScaffoldPlanFromCliArgs,
  deriveOntologyPackScaffoldSymbols,
  isSafeKebabEntityId,
} from './ontology-pack-scaffold-plan.js';
import { KNOWN_ONTOLOGY_PACK_IDS, resolveKnownOntologyPack } from 'ontology-pack-validate';

describe('ontology pack scaffold plan', () => {
  it('derives a dry-run plan from a safe pack id without writing files', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });

    expect(plan.mode).toBe('dry-run');
    expect(plan.diagnostics).toEqual([]);
    expect(plan.identity).toMatchObject({
      packId: 'risk-model-ontology',
      safePackId: 'risk-model-ontology',
      definitionId: 'risk-model-ontology-system',
      defaultAxisId: 'risk_model_ontology_kind',
      defaultTaxonomyId: 'risk-model-ontology',
      defaultRelationCategory: 'risk_model_ontology_relation',
      defaultTraversalPurpose: 'risk_model_ontology_context',
      package: {
        implementationPackage: 'operational-ontology',
        packageRoot: 'packages/operational-ontology',
        sourceDir: 'packages/operational-ontology/src/internal',
      },
    });
    expect(plan.identity.symbols).toEqual({
      pascalName: 'RiskModelOntology',
      camelName: 'riskModelOntology',
      packIdConstantName: 'RISK_MODEL_ONTOLOGY_PACK_ID',
      axisIdConstantName: 'RISK_MODEL_ONTOLOGY_AXIS_ID',
      taxonomyIdConstantName: 'RISK_MODEL_ONTOLOGY_TAXONOMY_ID',
      relationCategoryConstantName: 'RISK_MODEL_ONTOLOGY_RELATION_CATEGORY',
      traversalPurposeConstantName: 'RISK_MODEL_ONTOLOGY_TRAVERSAL_PURPOSE',
      schemaConstantName: 'riskModelOntologySchema',
      blueprintsConstantName: 'riskModelOntologyBlueprints',
      packConstantName: 'riskModelOntologyPack',
      validateFunctionName: 'validateRiskModelOntologyPack',
    });
    expect(plan.identity.declarations.map((declaration) => declaration.kind)).toEqual([
      'pack-id',
      'definition-id',
      'axis-id',
      'taxonomy-id',
      'relation-category',
      'traversal-purpose',
    ]);
    expect(plan.componentLikeDeclarations.map((declaration) => declaration.kind)).toEqual([
      'axis',
      'taxonomy',
      'relation-category',
      'traversal',
    ]);
    expect(plan.systemLikeBindings.map((binding) => binding.kind)).toEqual([
      'blueprint',
      'pack-binding',
      'validation-helper',
    ]);
    expect(plan.componentSchemaFiles).toHaveLength(1);
    expect(plan.componentSchemaFiles[0]).toMatchObject({
      role: 'component-schema',
      path: 'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
    });
    expect(plan.systemBindingFiles).toHaveLength(1);
    expect(plan.systemBindingFiles[0]).toMatchObject({
      role: 'system-binding',
      path: 'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
    });
    expect(plan.testFiles).toHaveLength(1);
    expect(plan.testFiles[0]!.path).toBe(
      'packages/operational-ontology/src/risk-model-ontology.test.ts',
    );
    expect(plan.docs).toEqual({
      directory: 'docs/specs/operational-ontology',
      familyId: 'risk-model-ontology',
      spec: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
      plan: 'docs/specs/operational-ontology/risk-model-ontology-plan.plan.md',
      todo: 'docs/specs/operational-ontology/risk-model-ontology-todo.todo.md',
      rule: 'docs/specs/operational-ontology/risk-model-ontology.rule.md',
      cases: 'docs/specs/operational-ontology/risk-model-ontology.cases.md',
      test: 'docs/specs/operational-ontology/risk-model-ontology.test.md',
    });
    expect(plan.requestedOptionalDefinitionDocs).toEqual([]);
    expect(
      plan.definitionDocFiles.map((file) => ({
        docType: file.docType,
        required: file.required,
        path: file.path,
      })),
    ).toEqual([
      {
        docType: 'spec',
        required: true,
        path: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
      },
      {
        docType: 'todo',
        required: true,
        path: 'docs/specs/operational-ontology/risk-model-ontology-todo.todo.md',
      },
      {
        docType: 'plan',
        required: true,
        path: 'docs/specs/operational-ontology/risk-model-ontology-plan.plan.md',
      },
    ]);
    expect(
      plan.optionalDefinitionDocFiles.map((file) => ({
        docType: file.docType,
        required: file.required,
        path: file.path,
      })),
    ).toEqual([
      {
        docType: 'rule',
        required: false,
        path: 'docs/specs/operational-ontology/risk-model-ontology.rule.md',
      },
      {
        docType: 'cases',
        required: false,
        path: 'docs/specs/operational-ontology/risk-model-ontology.cases.md',
      },
      {
        docType: 'test',
        required: false,
        path: 'docs/specs/operational-ontology/risk-model-ontology.test.md',
      },
    ]);
    const specContent = plan.definitionDocFiles.find((file) => file.docType === 'spec')?.content;
    const todoContent = plan.definitionDocFiles.find((file) => file.docType === 'todo')?.content;
    expect(specContent).toContain('operational-ontology-pack-interface');
    expect(specContent).toContain('## Architecture-Neutral Separation');
    expect(specContent).toContain(
      'ECS is one possible modeled architecture, but it is not the only supported architecture.',
    );
    expect(specContent).toContain('### Identity declarations');
    expect(specContent).toContain('### Component schema');
    expect(specContent).toContain('### System bindings');
    expect(specContent).toContain(
      'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
    );
    expect(specContent).toContain(
      'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
    );
    expect(specContent).toContain('packages/operational-ontology/src/risk-model-ontology.test.ts');
    expect(todoContent).toContain('## Actionable');
    expect(todoContent).toBeDefined();
    expect(todoContent!.indexOf('## Actionable')).toBeLessThan(
      todoContent!.indexOf('## Completed'),
    );
    expect(todoContent).toContain('No completed work recorded yet.');
    expect(plan.sourceMapCandidates).toEqual([
      {
        docId: 'risk-model-ontology-system',
        docPath: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
        sourcePath: 'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
        sourceRole: 'component-schema',
        frontmatterKey: 'sources',
        sourceFileKind: 'generated-file',
        candidateKind: 'suggested-doc-edit',
        applyMode: 'candidate-only',
      },
      {
        docId: 'risk-model-ontology-system',
        docPath: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
        sourcePath: 'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
        sourceRole: 'system-binding',
        frontmatterKey: 'sources',
        sourceFileKind: 'generated-file',
        candidateKind: 'suggested-doc-edit',
        applyMode: 'candidate-only',
      },
      {
        docId: 'risk-model-ontology-system',
        docPath: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
        sourcePath: 'packages/operational-ontology/src/risk-model-ontology.test.ts',
        sourceRole: 'test',
        frontmatterKey: 'sources',
        sourceFileKind: 'generated-file',
        candidateKind: 'suggested-doc-edit',
        applyMode: 'candidate-only',
      },
    ]);
    expect(plan.sourceMapFrontmatterCandidates).toEqual([
      {
        docId: 'risk-model-ontology-system',
        docPath: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
        frontmatterKey: 'sources',
        candidateKind: 'suggested-doc-edit',
        targetKind: 'definition-doc-frontmatter',
        applyMode: 'candidate-only',
        sources: [
          'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
          'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
          'packages/operational-ontology/src/risk-model-ontology.test.ts',
        ],
        yaml: [
          'sources:',
          '  - packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
          '  - packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
          '  - packages/operational-ontology/src/risk-model-ontology.test.ts',
        ].join('\n'),
      },
    ]);
    expect(plan.knownPackCandidate).toEqual({
      targetPath: 'packages/cli/src/lib/known-ontology-packs.ts',
      packId: 'risk-model-ontology',
      importPath: 'operational-ontology',
      exportSymbolName: 'riskModelOntologyPack',
      importName: 'riskModelOntologyPack',
      moduleSpecifier: 'operational-ontology',
      registryEntry: '"risk-model-ontology": riskModelOntologyPack',
      registrationMode: 'manual',
      applyMode: 'candidate-only',
    });
    expect(plan.preview).toMatchObject({
      mode: 'dry-run',
      writesApplied: false,
      knownPackRegistrationCandidate: {
        targetPath: 'packages/cli/src/lib/known-ontology-packs.ts',
      },
      declarations: {
        identity: expect.any(Array),
        componentLike: expect.any(Array),
        systemLike: expect.any(Array),
      },
    });
    expect(plan.preview.implementationSkeleton.files.map((file) => file.path)).toEqual([
      'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
      'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
    ]);
    expect(plan.preview.testSkeleton.files.map((file) => file.path)).toEqual([
      'packages/operational-ontology/src/risk-model-ontology.test.ts',
    ]);
    expect(plan.preview.testSkeleton.files[0]?.content).toContain('validates the pack contract');
    expect(plan.preview.testSkeleton.files[0]?.content).toContain(
      'expect(validateRiskModelOntologyPack().valid).toBe(true);',
    );
    expect(plan.preview.testSkeleton.files[0]?.content).toContain(
      'TODO(pack-author): Replace scaffold expectations with domain-specific axis and taxonomy invariants.',
    );
    expect(plan.preview.testSkeleton.files[0]?.content).toContain(
      'TODO(pack-author): Replace scaffold expectations with domain-specific blueprint and system binding invariants.',
    );
    expect(plan.preview.definitionDocs.required.map((file) => file.docType)).toEqual([
      'spec',
      'todo',
      'plan',
    ]);
    expect(plan.preview.definitionDocs.optional.map((file) => file.docType)).toEqual([
      'rule',
      'cases',
      'test',
    ]);
    expect(plan.preview.definitionDocs.selectedOptional).toEqual([]);
    expect(plan.preview.definitionDocs.files.map((file) => file.docType)).toEqual([
      'spec',
      'todo',
      'plan',
    ]);
    expect(plan.preview.sourceMapCandidates.map((candidate) => candidate.sourcePath)).toEqual([
      'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
      'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
      'packages/operational-ontology/src/risk-model-ontology.test.ts',
    ]);
    expect(plan.preview.sourceMapFrontmatterCandidates[0]).toMatchObject({
      docPath: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
      candidateKind: 'suggested-doc-edit',
      targetKind: 'definition-doc-frontmatter',
      applyMode: 'candidate-only',
    });
    expect(plan.preview.sourceMapGuidance.findByFileCommands).toEqual([
      'qa-sdk def find-by-file packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
      'qa-sdk def find-by-file packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
      'qa-sdk def find-by-file packages/operational-ontology/src/risk-model-ontology.test.ts',
    ]);
    expect(plan.preview.sourceMapGuidance.docsGraphCommands).toContain(
      'qa-sdk docs graph risk-model-ontology-system --axis source',
    );
  });

  it('generates optional definition docs only when requested', () => {
    const defaultPlan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });
    const expandedPlan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
      includeOptionalDocs: ['rule', 'cases', 'test'],
    });

    expect(defaultPlan.definitionDocFiles.map((file) => file.docType)).toEqual([
      'spec',
      'todo',
      'plan',
    ]);
    expect(defaultPlan.preview.files.map((file) => file.path)).not.toContain(
      'docs/specs/operational-ontology/risk-model-ontology.rule.md',
    );
    expect(expandedPlan.requestedOptionalDefinitionDocs).toEqual(['rule', 'cases', 'test']);
    expect(expandedPlan.definitionDocFiles.map((file) => file.docType)).toEqual([
      'spec',
      'todo',
      'plan',
      'rule',
      'cases',
      'test',
    ]);
    expect(
      expandedPlan.preview.definitionDocs.selectedOptional.map((file) => file.docType),
    ).toEqual(['rule', 'cases', 'test']);
    expect(expandedPlan.preview.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'docs/specs/operational-ontology/risk-model-ontology.rule.md',
        'docs/specs/operational-ontology/risk-model-ontology.cases.md',
        'docs/specs/operational-ontology/risk-model-ontology.test.md',
      ]),
    );
    expect(expandedPlan.sourceMapCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          docId: 'risk-model-ontology-test',
          docPath: 'docs/specs/operational-ontology/risk-model-ontology.test.md',
          sourcePath: 'packages/operational-ontology/src/risk-model-ontology.test.ts',
        }),
      ]),
    );
    expect(expandedPlan.sourceMapFrontmatterCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          docId: 'risk-model-ontology-test',
          docPath: 'docs/specs/operational-ontology/risk-model-ontology.test.md',
        }),
      ]),
    );
  });

  it('generates manual known-pack candidates for kebab-case pack ids without registering them', () => {
    const supportedBefore = [...KNOWN_ONTOLOGY_PACK_IDS];
    const cases = [
      ['quality-signal-ontology', 'qualitySignalOntologyPack'],
      ['risk2-model-ontology', 'risk2ModelOntologyPack'],
    ] as const;

    for (const [packId, exportSymbolName] of cases) {
      const plan = createOntologyPackScaffoldPlan({
        packId,
        rootDir: '/repo',
      });

      expect(plan.diagnostics).toEqual([]);
      expect(plan.knownPackCandidate).toMatchObject({
        targetPath: 'packages/cli/src/lib/known-ontology-packs.ts',
        packId,
        importPath: 'operational-ontology',
        exportSymbolName,
        importName: exportSymbolName,
        moduleSpecifier: 'operational-ontology',
        registryEntry: `"${packId}": ${exportSymbolName}`,
        registrationMode: 'manual',
        applyMode: 'candidate-only',
      });
      expect(plan.preview.knownPackRegistrationCandidate).toEqual(plan.knownPackCandidate);
      expect(resolveKnownOntologyPack(packId).ok).toBe(false);
    }

    expect(KNOWN_ONTOLOGY_PACK_IDS).toEqual(supportedBefore);
  });

  it('emits valid definition frontmatter for required and requested optional docs', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
      includeOptionalDocs: ['test', 'rule', 'cases'],
    });

    const expected = new Map([
      [
        'spec',
        {
          id: 'risk-model-ontology-system',
          level: 'leaf',
          scope: 'interface',
          aspect: 'api_contract',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'todo',
        {
          id: 'risk-model-ontology-todo',
          level: 'leaf',
          scope: 'flow',
          aspect: 'process_flow',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'plan',
        {
          id: 'risk-model-ontology-plan',
          level: 'leaf',
          scope: 'flow',
          aspect: 'process_flow',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'rule',
        {
          id: 'risk-model-ontology-rule',
          level: 'leaf',
          scope: 'constraint',
          aspect: 'tech_constraint',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
      [
        'cases',
        {
          id: 'risk-model-ontology-cases',
          level: 'leaf',
          scope: 'flow',
          aspect: 'user_scenario',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
      [
        'test',
        {
          id: 'risk-model-ontology-test',
          level: 'leaf',
          scope: 'flow',
          aspect: 'user_scenario',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
    ]);

    for (const file of plan.definitionDocFiles) {
      const parsed = parseDocument(file.content, file.path);
      expect(parsed.def).toMatchObject(expected.get(file.docType)!);
    }
  });

  it('keeps component-like schema content separate from system-like bindings', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });

    const componentContent = plan.componentSchemaFiles[0]!.content;
    const systemContent = plan.systemBindingFiles[0]!.content;

    expect(componentContent).toContain('OperationalOntologySchema');
    expect(componentContent).toContain('// Identity constants');
    expect(componentContent).toContain('// Component-like schema: axes');
    expect(componentContent).toContain('// Component-like schema: taxonomies');
    expect(componentContent).toContain('// Component-like schema: relation categories');
    expect(componentContent).toContain('// Component-like schema: traversals');
    expect(componentContent).toContain('riskModelOntologyAxes');
    expect(componentContent).toContain('stable: true');
    expect(componentContent).toContain('capacity: 4');
    expect(componentContent).toContain('axisIds: [RISK_MODEL_ONTOLOGY_AXIS_ID]');
    expect(componentContent).toContain('riskModelOntologySchema');
    expect(componentContent).not.toContain('ImplementationBlueprint');
    expect(componentContent).not.toContain('validateOperationalOntologyPack');
    expect(systemContent).toContain('ImplementationBlueprint');
    expect(systemContent).toContain('validateOperationalOntologyPack');
    expect(systemContent).toContain('// System-like bindings: blueprints');
    expect(systemContent).toContain('// System-like bindings: pack contract');
    expect(systemContent).toContain('// System-like bindings: validation helper');
    expect(systemContent).toContain('verificationBinding');
    expect(systemContent).toContain(
      'ref: "packages/operational-ontology/src/risk-model-ontology.test.ts"',
    );
    expect(systemContent).toContain('riskModelOntologyBlueprints');
    expect(systemContent).toContain('riskModelOntologyPack');
    expect(componentContent.toLowerCase()).not.toContain('ecs');
    expect(systemContent.toLowerCase()).not.toContain('ecs');
  });

  it('generates deterministic TypeScript skeleton files that typecheck in a fixture context', () => {
    const first = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });
    const second = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });

    expect(first.preview.files.map((file) => [file.path, file.content])).toEqual(
      second.preview.files.map((file) => [file.path, file.content]),
    );
    expect(first.testFiles).toEqual(second.testFiles);
    const generatedSourceContent = [
      ...first.componentSchemaFiles,
      ...first.systemBindingFiles,
      ...first.testFiles,
    ]
      .map((file) => file.content)
      .join('\n');
    expect(generatedSourceContent).not.toMatch(/\/\/\s*@def\.(?:boundary|doc)/);
    expect(generatedSourceContent).not.toMatch(/\/\*\s*@def\.(?:boundary|doc)/);
    expect(generatedSourceContent).not.toMatch(/\/\/\s*source:/i);
    expect(typecheckGeneratedTypeScriptSkeleton(first)).toEqual([]);
  });

  it('normalizes source-map candidate paths as repository-relative paths', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
      implementationPackage: 'risk-ontology',
      packageRoot: 'packages/generated-risk/../custom-risk',
      docsDir: 'docs/specs/generated-risk/../custom-risk',
      testFilePath: 'packages/custom-risk/tests/../src/./risk-model-ontology.test.ts',
    });

    expect(plan.diagnostics).toEqual([]);
    expect(plan.componentSchemaFiles[0]?.path).toBe(
      'packages/custom-risk/src/internal/risk-model-ontology-schema.ts',
    );
    expect(plan.systemBindingFiles[0]?.path).toBe(
      'packages/custom-risk/src/internal/risk-model-ontology-pack.ts',
    );
    expect(plan.testFiles[0]?.path).toBe('packages/custom-risk/src/risk-model-ontology.test.ts');
    expect(plan.docs.spec).toBe('docs/specs/custom-risk/risk-model-ontology-system.spec.md');

    const candidatePaths = [
      ...plan.preview.sourceMapCandidates.map((candidate) => candidate.sourcePath),
      ...plan.preview.sourceMapCandidates.map((candidate) => candidate.docPath),
      ...plan.preview.sourceMapFrontmatterCandidates.flatMap((candidate) => [
        candidate.docPath,
        ...candidate.sources,
      ]),
    ];
    for (const path of candidatePaths) {
      expect(path.startsWith('/')).toBe(false);
      expect(path).not.toContain('\\');
      expect(path.split('/')).not.toContain('..');
      expect(path.split('/')).not.toContain('.');
      expect(path).not.toContain('//');
    }
    expect(plan.preview.sourceMapGuidance.findByFileCommands).toEqual([
      'qa-sdk def find-by-file packages/custom-risk/src/internal/risk-model-ontology-schema.ts',
      'qa-sdk def find-by-file packages/custom-risk/src/internal/risk-model-ontology-pack.ts',
      'qa-sdk def find-by-file packages/custom-risk/src/risk-model-ontology.test.ts',
    ]);
  });

  it('renders a deterministic pack validation test skeleton', () => {
    const first = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });
    const second = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
    });
    const testFile = first.testFiles[0]!;

    expect(testFile).toEqual(second.testFiles[0]);
    expect(testFile).toMatchObject({
      role: 'pack-validation-test',
      path: 'packages/operational-ontology/src/risk-model-ontology.test.ts',
    });
    expect(testFile.content).toContain(
      'import {\n  riskModelOntologyPack,\n  validateRiskModelOntologyPack,\n} from "./internal/risk-model-ontology-pack.js";',
    );
    expect(testFile.content).toContain('expect(validateRiskModelOntologyPack().valid).toBe(true);');
    expect(testFile.content).toContain('riskModelOntologyPack.schema.axes.map((axis) => axis.id)');
    expect(testFile.content).toContain(
      'riskModelOntologyPack.schema.taxonomies.map((taxonomy) => taxonomy.id)',
    );
    expect(testFile.content).toContain(
      'riskModelOntologyPack.blueprints?.map((blueprint) => blueprint.blueprintId)',
    );
    expect(testFile.content).toContain('blueprint.verificationBinding?.verificationRefs');
  });

  it('derives package, docs, test, and write-mode options from CLI args', () => {
    const plan = createOntologyPackScaffoldPlanFromCliArgs(
      [
        'risk-model-ontology',
        '--implementation-package',
        'risk-ontology',
        '--package-root',
        'packages/custom-risk',
        '--docs-dir',
        'docs/specs/risk',
        '--test',
        'packages/custom-risk/src/risk-model-ontology.test.ts',
        '--include-docs',
        'rule,test',
        '--write',
        '--json',
      ],
      { rootDir: '/repo' },
    );

    expect(plan.cli.json).toBe(true);
    expect(plan.mode).toBe('write');
    expect(plan.diagnostics).toEqual([]);
    expect(plan.identity.package).toEqual({
      implementationPackage: 'risk-ontology',
      packageRoot: 'packages/custom-risk',
      sourceDir: 'packages/custom-risk/src/internal',
    });
    expect(plan.docs.directory).toBe('docs/specs/risk');
    expect(plan.requestedOptionalDefinitionDocs).toEqual(['rule', 'test']);
    expect(plan.definitionDocFiles.map((file) => file.docType)).toEqual([
      'spec',
      'todo',
      'plan',
      'rule',
      'test',
    ]);
    expect(plan.testFiles[0]!.path).toBe('packages/custom-risk/src/risk-model-ontology.test.ts');
    expect(plan.testFiles[0]!.content).toContain('from "./internal/risk-model-ontology-pack.js"');
    expect(plan.componentSchemaFiles[0]!.path).toBe(
      'packages/custom-risk/src/internal/risk-model-ontology-schema.ts',
    );
    expect(plan.systemBindingFiles[0]!.content).toContain(
      'ref: "packages/custom-risk/src/risk-model-ontology.test.ts"',
    );
    expect(plan.knownPackCandidate.moduleSpecifier).toBe('risk-ontology');
    expect(plan.knownPackCandidate.importPath).toBe('risk-ontology');
    expect(plan.knownPackCandidate.exportSymbolName).toBe('riskModelOntologyPack');
    expect(plan.knownPackCandidate.registrationMode).toBe('manual');
  });

  it('computes generated test imports relative to custom package test paths', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
      implementationPackage: 'risk-ontology',
      packageRoot: 'packages/custom-risk',
      testFilePath: 'packages/custom-risk/test/risk-model-ontology.test.ts',
    });

    expect(plan.testFiles[0]!.content).toContain(
      'from "../src/internal/risk-model-ontology-pack.js"',
    );
    expect(plan.systemBindingFiles[0]!.content).toContain(
      'ref: "packages/custom-risk/test/risk-model-ontology.test.ts"',
    );
  });

  it('reports structured diagnostics for invalid ids and unsafe paths', () => {
    const plan = createOntologyPackScaffoldPlanFromCliArgs(
      [
        'Risk_Model',
        '--implementation-package',
        '@scope/risk',
        '--package-root',
        '../outside',
        '--docs-dir',
        '/tmp/outside-docs',
        '--test',
        '',
        '--include-docs',
        'memo',
      ],
      { rootDir: '/repo' },
    );

    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'invalid-pack-id',
          field: 'packId',
          value: 'Risk_Model',
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'invalid-implementation-package',
          field: 'implementationPackage',
          value: '@scope/risk',
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'unsafe-path',
          field: 'packageRoot',
          value: '../outside',
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'unsafe-path',
          field: 'docsDir',
          value: '/tmp/outside-docs',
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'unsafe-path',
          field: 'testFilePath',
          value: '',
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'invalid-optional-docs',
          field: 'includeDocs',
          value: 'memo',
        }),
      ]),
    );
  });

  it('reports conflicting output paths', () => {
    const plan = createOntologyPackScaffoldPlan({
      packId: 'risk-model-ontology',
      rootDir: '/repo',
      testFilePath: 'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
    });

    expect(plan.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'conflicting-output-path',
        message:
          'Output path "packages/operational-ontology/src/internal/risk-model-ontology-pack.ts" is planned for multiple scaffold artifacts.',
        path: 'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
        details: {
          roles: ['system-binding', 'pack-validation-test'],
        },
      },
    ]);
  });

  it('validates safe kebab-case entity ids and symbol derivation directly', () => {
    expect(isSafeKebabEntityId('risk-model-ontology')).toBe(true);
    expect(isSafeKebabEntityId('risk--model')).toBe(false);
    expect(isSafeKebabEntityId('RiskModel')).toBe(false);
    expect(isSafeKebabEntityId('risk_model')).toBe(false);
    expect(deriveOntologyPackScaffoldSymbols('quality-signal-ontology')).toMatchObject({
      pascalName: 'QualitySignalOntology',
      camelName: 'qualitySignalOntology',
      packConstantName: 'qualitySignalOntologyPack',
      validateFunctionName: 'validateQualitySignalOntologyPack',
    });
  });
});

const GENERATED_SKELETON_TYPE_STUBS = `
declare module "operational-ontology/schema" {
  export interface AxisSchema {
    id: string;
    values: string[];
    extensible?: boolean;
    stable?: boolean;
    capacity?: number;
  }

  export interface TaxonomySchema {
    id: string;
    appliesTo: string[];
    axisIds: string[];
    identityAxisIds?: string[];
    space?: string;
  }

  export interface RelationCategorySchema {
    category: string;
    requiredAxes: string[];
    optionalAxes?: string[];
    forbiddenAxes?: string[];
    allowedStartKinds?: string[];
    allowedEndKinds?: string[];
  }

  export interface TraversalSchema {
    purpose: string;
    allowedRelationCategories?: string[];
    allowedEdgeKinds?: string[];
    canonicalizable?: boolean;
  }

  export interface OperationalOntologySchema {
    axes: AxisSchema[];
    taxonomies: TaxonomySchema[];
    relationCategories: RelationCategorySchema[];
    traversals?: TraversalSchema[];
  }
}

declare module "operational-ontology/governance" {
  export interface GovernanceSurfaceRef<TKind extends string = string> {
    kind: TKind;
    ref: string;
  }

  export interface ConsistencyConstraint {
    kind: string;
    severity?: string;
    requiredRefs?: readonly string[];
    allowedRefs?: readonly string[];
  }

  export interface ImplementationBinding {
    coordinateRef: string;
    implementationRefs: readonly GovernanceSurfaceRef[];
    facets?: readonly string[];
    relationCategories?: readonly string[];
  }

  export interface VerificationBinding {
    coordinateRef: string;
    verificationRefs: readonly GovernanceSurfaceRef[];
  }

  export interface ImplementationBlueprint {
    blueprintId: string;
    coordinateRef: string;
    unitKind: string;
    requiredSchemas?: readonly string[];
    implementationBinding?: ImplementationBinding;
    verificationBinding?: VerificationBinding;
    constraints?: readonly ConsistencyConstraint[];
    evolutionPolicy?: { kind: string };
  }
}

declare module "operational-ontology/pack" {
  import type { ImplementationBlueprint } from "operational-ontology/governance";
  import type { OperationalOntologySchema } from "operational-ontology/schema";

  export interface OperationalOntologyPack {
    packId: string;
    schema: OperationalOntologySchema;
    blueprints?: readonly ImplementationBlueprint[];
    metadata?: Record<string, unknown>;
  }

  export interface OperationalOntologyPackValidationResult {
    valid: boolean;
    issues: readonly { code: string; message: string }[];
  }

  export function validateOperationalOntologyPack(
    pack: OperationalOntologyPack,
  ): OperationalOntologyPackValidationResult;
}

declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
  };
}
`;

function typecheckGeneratedTypeScriptSkeleton(
  plan: ReturnType<typeof createOntologyPackScaffoldPlan>,
): string[] {
  const fixtureRoot = '/fixture';
  const virtualFiles = new Map<string, string>([
    [`${fixtureRoot}/generated-stubs.d.ts`, GENERATED_SKELETON_TYPE_STUBS],
    ...[...plan.preview.implementationSkeleton.files, ...plan.preview.testSkeleton.files].map(
      (file) => [`${fixtureRoot}/${file.path}`, file.content] as const,
    ),
  ]);
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2023,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);

  host.resolveModuleNames = (moduleNames, containingFile) =>
    moduleNames.map((moduleName) => {
      const resolved = resolveVirtualModule(virtualFiles, moduleName, containingFile);
      if (resolved) return resolved;
      return ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;
    });
  host.fileExists = (fileName) =>
    getVirtualFile(virtualFiles, fileName) !== undefined || originalFileExists(fileName);
  host.readFile = (fileName) =>
    getVirtualFile(virtualFiles, fileName) ?? originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const content = getVirtualFile(virtualFiles, fileName);
    if (content !== undefined) {
      return ts.createSourceFile(fileName, content, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram([...virtualFiles.keys()], compilerOptions, host);
  return ts.getPreEmitDiagnostics(program).map(formatDiagnostic);
}

function resolveVirtualModule(
  virtualFiles: ReadonlyMap<string, string>,
  moduleName: string,
  containingFile: string,
): ts.ResolvedModule | undefined {
  if (
    moduleName === 'operational-ontology/schema' ||
    moduleName === 'operational-ontology/governance' ||
    moduleName === 'operational-ontology/pack' ||
    moduleName === 'vitest'
  ) {
    return {
      resolvedFileName: '/fixture/generated-stubs.d.ts',
      extension: ts.Extension.Dts,
      isExternalLibraryImport: true,
    };
  }

  if (!moduleName.startsWith('.')) return undefined;

  const candidate = pathPosix.normalize(
    pathPosix.join(pathPosix.dirname(normalizeVirtualPath(containingFile)), moduleName),
  );
  const candidates = [
    candidate,
    candidate.endsWith('.js') ? `${candidate.slice(0, -3)}.ts` : `${candidate}.ts`,
    candidate.endsWith('.js') ? `${candidate.slice(0, -3)}.d.ts` : `${candidate}.d.ts`,
  ];
  const resolvedFileName = candidates.find(
    (path) => getVirtualFile(virtualFiles, path) !== undefined,
  );
  if (!resolvedFileName) return undefined;

  return {
    resolvedFileName,
    extension: resolvedFileName.endsWith('.d.ts') ? ts.Extension.Dts : ts.Extension.Ts,
    isExternalLibraryImport: false,
  };
}

function getVirtualFile(
  virtualFiles: ReadonlyMap<string, string>,
  fileName: string,
): string | undefined {
  const normalized = normalizeVirtualPath(fileName);
  return (
    virtualFiles.get(normalized) ??
    (normalized.endsWith('.js') ? virtualFiles.get(`${normalized.slice(0, -3)}.ts`) : undefined)
  );
}

function normalizeVirtualPath(fileName: string): string {
  return fileName.replaceAll('\\', '/');
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`;
  }
  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${normalizeVirtualPath(diagnostic.file.fileName)}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`;
}
