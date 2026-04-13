import { describe, expect, it } from "vitest";

import { operationalOntologyPromptArtifactPlane } from "./prompt-artifacts.js";

describe("prompt artifact generator", () => {
  const workArea = {
    workAreaId: "operational-ontology.prompt-rules",
    displayName: "Operational ontology prompt rules",
    rootRef: "packages/operational-ontology",
    purpose: "Generate code editing and self reflection rules from ontology evidence",
    paths: ["packages/operational-ontology/src"],
    stack: ["TypeScript", "Vitest"],
    constraints: ["Do not cross work area boundaries without traversal evidence"],
  };

  const sources = {
    corridors: [
      {
        flowId: "corridor:prompt-artifact",
        templateKind: "pipe_graph" as const,
        entryNodeId: "work-area-definition",
        nodeIds: ["work-area-definition", "prompt-artifact"],
        schemaIds: ["prompt-artifact-schema"],
        endpoints: [],
        contracts: [],
        links: [],
      },
    ],
    checkpointLattices: [
      {
        corridorId: "corridor:prompt-artifact",
        rootCheckpointId: "checkpoint:root",
        definitions: [],
        observations: [],
        links: [],
      },
    ],
    blueprints: [
      {
        blueprintId: "prompt-artifact-governance",
        coordinateRef: "corridor:prompt-artifact",
        unitKind: "corridor_bundle",
      },
    ],
    governanceRuns: [
      {
        runId: "governance:prompt-artifact:1",
        blueprintId: "prompt-artifact-governance",
        implementationRefs: ["packages/operational-ontology/src/internal/prompt-artifact-core.ts"],
        verificationRefs: ["packages/operational-ontology/src/prompt-artifacts.test.ts"],
        familyKey: "governance:corridor:prompt-artifact:corridor_bundle",
        constraintVerdicts: [],
        adjustmentRecords: [],
      },
    ],
  };
  const richSources = {
    corridors: [
      {
        flowId: "prompt-artifact",
        templateKind: "pipe_graph" as const,
        entryNodeId: "work-area-definition",
        nodeIds: ["work-area-definition", "prompt-artifact"],
        schemaIds: ["prompt-artifact-schema"],
        endpoints: [
          {
            endpointId: "endpoint:work-area",
            templateKind: "port" as const,
            nodeId: "work-area-definition",
            direction: "in" as const,
            facetKind: "definition" as const,
            sourceKind: "port" as const,
          },
          {
            endpointId: "endpoint:artifact",
            templateKind: "port" as const,
            nodeId: "prompt-artifact",
            direction: "out" as const,
            facetKind: "production" as const,
            sourceKind: "port" as const,
          },
        ],
        contracts: [
          {
            contractId: "contract:prompt-artifact",
            templateKind: "pipe_contract" as const,
            nodeId: "prompt-artifact",
            consumes: [{ field: "workArea", type: "PromptArtifactWorkArea", required: true }],
            produces: [{ field: "content", type: "string", required: true }],
          },
        ],
        links: [
          {
            linkId: "link:prompt-artifact",
            templateKind: "pipe_connection" as const,
            fromEndpointId: "endpoint:work-area",
            toEndpointId: "endpoint:artifact",
            semantic: "contract_descent" as const,
            medium: "direct" as const,
            sourceKind: "connection" as const,
          },
        ],
      },
    ],
    checkpointLattices: [
      {
        corridorId: "prompt-artifact",
        rootCheckpointId: "checkpoint:prompt-artifact",
        definitions: [
          {
            checkpointId: "checkpoint:prompt-artifact",
            templateKind: "root" as const,
            nodeId: "prompt-artifact",
            observedPrefixIds: ["prompt_artifact"],
            observedFields: ["content"],
          },
        ],
        observations: [
          {
            checkpointId: "checkpoint:prompt-artifact",
            templateKind: "root" as const,
            recordId: "record:prompt-artifact",
            traceId: "trace:prompt-artifact",
            eventKey: "prompt-artifact.generated",
            timestamp: "2026-04-12T00:00:00.000Z",
            observedNodeKeys: ["prompt-artifact"],
            observedEdgeKeys: ["edge:prompt-artifact"],
            transmissions: [],
            dataFlow: {
              flowId: "prompt-artifact",
              templateKind: "pipe_graph" as const,
              entryNodeId: "work-area-definition",
              nodeIds: ["work-area-definition", "prompt-artifact"],
              schemaIds: ["prompt-artifact-schema"],
              endpoints: [],
              contracts: [],
              links: [],
            },
          },
        ],
        links: [
          {
            fromCheckpointId: "checkpoint:prompt-artifact",
            toCheckpointId: "checkpoint:prompt-artifact",
            relation: "observes" as const,
          },
        ],
      },
    ],
    traversals: [
      {
        traversal: {
          purpose: "implement",
          start: "operational-ontology-production-factory",
          edges: ["refines"],
          end: "operational-ontology-prompt-artifact-generation",
          canonicalKey: "implement:prompt-artifact",
        },
        reachedGoalIds: ["operational-ontology-prompt-artifact-generation"],
        unreachableGoalIds: [],
        loopDetected: false,
        recoveryUsed: false,
        terminalNodeId: "operational-ontology-prompt-artifact-generation",
        terminalReason: "goal",
      },
    ],
    blueprints: [
      {
        blueprintId: "prompt-artifact-governance",
        coordinateRef: "corridor:prompt-artifact",
        unitKind: "corridor_bundle",
        verificationBinding: {
          coordinateRef: "corridor:prompt-artifact",
          verificationRefs: [
            { kind: "test" as const, ref: "packages/operational-ontology/src/prompt-artifacts.test.ts" },
          ],
        },
      },
    ],
    governanceRuns: [
      {
        runId: "governance:prompt-artifact:1",
        blueprintId: "prompt-artifact-governance",
        implementationRefs: ["packages/operational-ontology/src/internal/prompt-artifact-core.ts"],
        verificationRefs: ["packages/operational-ontology/src/prompt-artifacts.test.ts"],
        familyKey: "governance:corridor:prompt-artifact:corridor_bundle",
        constraintVerdicts: [],
        adjustmentRecords: [],
      },
    ],
  };

  it("generates GPT-5 style self reflection with ontology source refs", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      workArea,
      sources,
    });

    expect(artifact.validation.valid).toBe(true);
    expect(artifact.content).toContain("<self_reflection>");
    expect(artifact.content.split("\n").slice(0, 3)).toEqual([
      "<self_reflection>",
      "<artifact_metadata>",
      "- Artifact id: prompt-artifact:operational-ontology.prompt-rules:self_reflection",
    ]);
    expect(artifact.content).toContain("<source_evidence>");
    expect(artifact.content).toContain("<context_collection_contract>");
    expect(artifact.content).toContain("<context_gathering>");
    expect(artifact.content).toContain("<quality_gate>");
    expect(artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "work-area:operational-ontology.prompt-rules",
        "corridor:prompt-artifact",
        "checkpoint-lattice:corridor:prompt-artifact",
        "governance-run:governance:prompt-artifact:1",
      ]),
    );
  });

  it("generates code editing rules bound to governance evidence", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      workArea,
      sources,
    });

    expect(artifact.validation.valid).toBe(true);
    expect(artifact.content).toContain("<code_editing_rules>");
    expect(artifact.content).toContain("<ontology_binding>");
    expect(artifact.content).toContain(
      "Blueprint prompt-artifact-governance binds corridor_bundle at corridor:prompt-artifact.",
    );
  });

  it("warns when artifact generation has no ontology source beyond the work area", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      workArea,
    });

    expect(artifact.validation.valid).toBe(true);
    expect(artifact.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "prompt-ontology-source-missing" }),
      ]),
    );
  });

  it("rates fully grounded artifacts as ready", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: richSources,
    });
    const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: richSources,
    });

    expect(quality.grade).toBe("ready");
    expect(quality.score).toBe(100);
    expect(quality.ontologyManagementRequired).toBe(false);
    expect(quality.recommendedManagementActions).toEqual([]);
  });

  it("uses verified quality-status evidence as an additive governance closure signal", () => {
    const syntheticSources = {
      ...richSources,
      governanceRuns: [
        {
          ...richSources.governanceRuns[0]!,
          runId: "governance:artifact:managed-prompt:definition-context",
        },
      ],
    };
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: syntheticSources,
    });

    const withoutEvidence =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: syntheticSources,
      });
    const withEvidence =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: syntheticSources,
        qualityStatusEvidence: [
          {
            evidenceId: "quality-status:managed-prompt",
            outcome: "verified",
            verifiesTarget: true,
            targetRefs: [artifact.workAreaId],
            sourceRefs: ["artifacts/quality-status-managed-prompt.json"],
            verifiedBundleRefs: ["quality-bundle:managed-prompt"],
            verifiedGateCount: 2,
            totalGateCount: 2,
          },
        ],
      });

    const withoutGovernance = withoutEvidence.metrics.find(
      (item) => item.dimension === "governance_closure",
    );
    const withGovernance = withEvidence.metrics.find(
      (item) => item.dimension === "governance_closure",
    );

    expect(withoutEvidence.grade).toBe("ready");
    expect(withoutGovernance?.score).toBe(80);
    expect(withoutEvidence.recommendedManagementActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "close_governance_evidence" }),
      ]),
    );
    expect(withEvidence.grade).toBe("ready");
    expect(withEvidence.score).toBeGreaterThan(withoutEvidence.score);
    expect(withGovernance?.score).toBe(100);
    expect(withEvidence.recommendedManagementActions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "close_governance_evidence" }),
      ]),
    );
  });

  it("keeps usable and degraded bands while verified quality-status evidence improves governance closure", () => {
    const syntheticRun = {
      ...richSources.governanceRuns[0]!,
      runId: "governance:artifact:partial-prompt:definition-context",
    };
    const cases = [
      {
        expectedGrade: "usable",
        sources: {
          traversals: richSources.traversals,
          blueprints: richSources.blueprints,
          governanceRuns: [syntheticRun],
        },
      },
      {
        expectedGrade: "degraded",
        sources: {
          blueprints: richSources.blueprints,
          governanceRuns: [syntheticRun],
        },
      },
    ] as const;

    for (const scenario of cases) {
      const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
        kind: "code_editing_rules",
        useCase: "feature_modification",
        workArea,
        sources: scenario.sources,
      });
      const withoutEvidence =
        operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
          artifact,
          workArea,
          sources: scenario.sources,
        });
      const withEvidence =
        operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
          artifact,
          workArea,
          sources: scenario.sources,
          qualityStatusEvidence: [
            {
              evidenceId: `quality-status:${scenario.expectedGrade}`,
              outcome: "verified",
              verifiesTarget: true,
              targetRefs: [artifact.workAreaId],
              verifiedBundleRefs: [`quality-bundle:${scenario.expectedGrade}`],
            },
          ],
        });

      expect(withoutEvidence.grade).toBe(scenario.expectedGrade);
      expect(withEvidence.grade).toBe(scenario.expectedGrade);
      expect(withEvidence.score).toBeGreaterThan(withoutEvidence.score);
    }
  });

  it("warns instead of improving governance closure for failed stale invalid or incomplete quality-status evidence", () => {
    const syntheticSources = {
      ...richSources,
      governanceRuns: [
        {
          ...richSources.governanceRuns[0]!,
          runId: "governance:artifact:warning-prompt:definition-context",
        },
      ],
    };
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: syntheticSources,
    });

    for (const outcome of ["failed", "stale", "invalid", "incomplete"] as const) {
      const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: syntheticSources,
        qualityStatusEvidence: [
          {
            evidenceId: `quality-status:${outcome}`,
            outcome,
            verifiesTarget: true,
            targetRefs: [artifact.workAreaId],
            sourceRefs: [`artifacts/quality-status-${outcome}.json`],
            message: `Quality status is ${outcome}.`,
          },
        ],
      });
      const governance = quality.metrics.find(
        (item) => item.dimension === "governance_closure",
      );

      expect(governance?.score).toBe(80);
      expect(quality.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: "warning",
            code: `prompt-quality-status-evidence-${outcome}`,
          }),
        ]),
      );
    }
  });

  it("keeps governance closure open when verified and invalid quality-status evidence are mixed", () => {
    const syntheticSources = {
      ...richSources,
      governanceRuns: [
        {
          ...richSources.governanceRuns[0]!,
          runId: "governance:artifact:mixed-quality-prompt:definition-context",
        },
      ],
    };
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: syntheticSources,
    });

    const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: syntheticSources,
      qualityStatusEvidence: [
        {
          evidenceId: "quality-status:verified",
          outcome: "verified",
          verifiesTarget: true,
          targetRefs: [artifact.workAreaId],
          verifiedBundleRefs: ["quality-bundle:verified"],
          verifiedGateCount: 2,
          totalGateCount: 2,
        },
        {
          evidenceId: "quality-status:invalid",
          outcome: "invalid",
          verifiesTarget: true,
          targetRefs: [artifact.workAreaId],
          sourceRefs: ["artifacts/quality-status-invalid.json"],
        },
      ],
    });
    const governance = quality.metrics.find(
      (item) => item.dimension === "governance_closure",
    );

    expect(governance?.score).toBe(80);
    expect(quality.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-invalid",
        }),
      ]),
    );
    expect(quality.recommendedManagementActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "close_governance_evidence" }),
      ]),
    );
  });

  it("requires target verification and complete quality-status surface before closing governance", () => {
    const syntheticSources = {
      ...richSources,
      governanceRuns: [
        {
          ...richSources.governanceRuns[0]!,
          runId: "governance:artifact:partial-quality-prompt:definition-context",
        },
      ],
    };
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: syntheticSources,
    });

    const targetMismatch =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: syntheticSources,
        qualityStatusEvidence: [
          {
            evidenceId: "quality-status:target-mismatch",
            outcome: "verified",
            verifiesTarget: false,
            targetRefs: ["other-artifact"],
            verifiedBundleRefs: ["quality-bundle:other"],
          },
        ],
      });
    const partialGateSurface =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: syntheticSources,
        qualityStatusEvidence: [
          {
            evidenceId: "quality-status:partial-ledger",
            outcome: "verified",
            verifiesTarget: true,
            targetRefs: [artifact.workAreaId],
            gateRefs: ["gate-a", "gate-b"],
            verifiedGateRefs: ["gate-a"],
            verifiedGateCount: 1,
            totalGateCount: 2,
            message: "Quality ledger fallback has unresolved gates.",
          },
        ],
      });

    expect(
      targetMismatch.metrics.find((item) => item.dimension === "governance_closure")?.score,
    ).toBe(75);
    expect(targetMismatch.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-target-missing",
        }),
      ]),
    );
    expect(
      partialGateSurface.metrics.find((item) => item.dimension === "governance_closure")?.score,
    ).toBe(80);
    expect(partialGateSurface.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-incomplete",
        }),
      ]),
    );
  });

  it("caps governance closure when artifact extraction expected quality-status evidence but none was found", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      workArea,
      sources: richSources,
    });
    const withoutExpectedEvidence =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: richSources,
      });
    const withMissingEvidence =
      operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
        artifact,
        workArea,
        sources: richSources,
        qualityStatusEvidence: [],
      });

    const withoutGovernance = withoutExpectedEvidence.metrics.find(
      (item) => item.dimension === "governance_closure",
    );
    const withGovernance = withMissingEvidence.metrics.find(
      (item) => item.dimension === "governance_closure",
    );

    expect(withoutGovernance?.score).toBe(100);
    expect(withGovernance?.score).toBe(75);
    expect(withMissingEvidence.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prompt-quality-status-evidence-missing",
        }),
      ]),
    );
  });

  it("separates context collection instructions by use case", () => {
    const testArtifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      useCase: "test_exploration_and_edit",
      workArea,
      sources,
    });
    const featureArtifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      useCase: "feature_modification",
      workArea,
      sources,
    });
    const eventArtifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      useCase: "event_inventory",
      workArea,
      sources,
    });

    expect(testArtifact.content).toContain("Collect test files, fixtures, scenario docs");
    expect(featureArtifact.content).toContain("Collect implementation entrypoints");
    expect(eventArtifact.content).toContain("Collect event keys, payload fields");
  });

  it("does not require governance or traversal evidence for event inventory quality", () => {
    const eventSources = {
      corridors: richSources.corridors,
      checkpointLattices: richSources.checkpointLattices,
    };
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      useCase: "event_inventory",
      workArea,
      sources: eventSources,
    });
    const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: eventSources,
    });

    expect(artifact.useCase).toBe("event_inventory");
    expect(quality.grade).toBe("ready");
    expect(
      quality.metrics.find((item) => item.dimension === "governance_closure")?.applicable,
    ).toBe(false);
    expect(
      quality.metrics.find((item) => item.dimension === "traversal_grounding")?.applicable,
    ).toBe(false);
    expect(quality.recommendedManagementActions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "close_governance_evidence" }),
        expect.objectContaining({ kind: "record_traversal_grounding" }),
      ]),
    );
  });

  it("extracts prompt sources from definition context", () => {
    const extracted =
      operationalOntologyPromptArtifactPlane.extractPromptArtifactSourcesFromDefinitionContext({
        useCase: "feature_modification",
        root: {
          docId: "authorization-ontology-system",
          title: "Authorization Ontology System",
          purpose: "Define Cerbos-centered authorization ontology",
          tags: ["security", "entry-point"],
          sourcePath: "docs/specs/authorization-ontology/authorization-ontology-system.spec.md",
          lifecycle: "draft",
        },
        children: [
          {
            docId: "authorization-management-usecases",
            purpose: "List implemented authorization management use cases",
            sourcePath: "docs/specs/authorization-ontology/authorization-management-usecases.spec.md",
            body: "`packages/authorization-ontology/src/index.test.ts`",
            lifecycle: "approved",
          },
        ],
        outgoingLinks: [
          {
            source: "authorization-ontology-system",
            target: "operational-ontology-system",
            type: "depends_on",
          },
        ],
      });
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "code_editing_rules",
      useCase: "feature_modification",
      ...extracted,
    });
    const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
      artifact,
      ...extracted,
    });

    expect(extracted.workArea.workAreaId).toBe("authorization-ontology-system");
    expect(extracted.sources.corridors?.[0]?.flowId).toBe(
      "authorization-ontology-system-definition-context",
    );
    expect(extracted.sources.governanceRuns?.[0]?.verificationRefs).toEqual([
      "packages/authorization-ontology/src/index.test.ts",
    ]);
    expect(artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        "corridor:authorization-ontology-system-definition-context",
        "checkpoint-lattice:authorization-ontology-system-definition-context",
        "governance-run:governance:authorization-ontology-system:definition-context",
      ]),
    );
    expect(quality.grade).toBe("ready");
    expect(quality.ontologyManagementRequired).toBe(true);
    expect(quality.recommendedManagementActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "close_governance_evidence" }),
      ]),
    );
  });

  it("allows external context providers to resolve artifact targets", () => {
    const registry =
      new operationalOntologyPromptArtifactPlane.InMemoryPromptArtifactContextProviderRegistry([
        {
          providerId: "programming-artifact-test-provider",
          targetKinds: ["artifact"],
          canResolve: (request) => request.targetRef === "dist/index.js",
          resolve: (request) =>
            operationalOntologyPromptArtifactPlane.extractPromptArtifactSourcesFromDefinitionContext({
              useCase: request.useCase,
              root: {
                docId: "build-artifact",
                title: "Build Artifact",
                purpose: "Resolve build artifact context",
                sourcePath: "dist/index.js",
                body: "`packages/operational-ontology/src/facades.test.ts`",
              },
            }),
        },
      ]);

    const resolved = registry.resolve({
      targetKind: "artifact",
      targetRef: "dist/index.js",
      useCase: "release_verification",
    });

    expect(resolved?.workArea.workAreaId).toBe("build-artifact");
    expect(resolved?.sources.governanceRuns?.[0]?.verificationRefs).toEqual([
      "packages/operational-ontology/src/facades.test.ts",
    ]);
  });

  it("flags low quality artifacts as operational ontology management work", () => {
    const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
      kind: "self_reflection",
      workArea,
    });
    const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
      artifact,
      workArea,
    });

    expect(quality.grade).toBe("blocked");
    expect(quality.ontologyManagementRequired).toBe(true);
    expect(quality.recommendedManagementActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "add_ontology_source_refs" }),
        expect.objectContaining({ kind: "enrich_corridor_contracts" }),
        expect.objectContaining({ kind: "add_checkpoint_observability" }),
        expect.objectContaining({ kind: "record_traversal_grounding" }),
        expect.objectContaining({ kind: "close_governance_evidence" }),
        expect.objectContaining({ kind: "bind_verification_surface" }),
      ]),
    );
  });

  it("rejects artifacts missing required sections", () => {
    const result = operationalOntologyPromptArtifactPlane.validatePromptArtifact({
      artifactId: "broken",
      kind: "code_editing_rules",
      workAreaId: workArea.workAreaId,
      sourceRefs: ["work-area:operational-ontology.prompt-rules"],
      sections: [{ tag: "work_area_boundary", lines: ["Only one section"] }],
      content: "<code_editing_rules>\n</code_editing_rules>",
      guidanceSource: {
        label: "OpenAI GPT-5 prompting guide",
        url: "https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide",
        publishedAt: "2025-08-07",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "prompt-section-missing" }),
      ]),
    );
  });

  it("rejects artifacts whose content omits structured sections", () => {
    const result = operationalOntologyPromptArtifactPlane.validatePromptArtifact({
      artifactId: "content-drift",
      kind: "code_editing_rules",
      workAreaId: workArea.workAreaId,
      sourceRefs: [
        "work-area:operational-ontology.prompt-rules",
        "corridor:prompt-artifact",
      ],
      sections: [
        { tag: "work_area_boundary", lines: ["Stay inside the work area"] },
        { tag: "editing_principles", lines: ["Reuse local patterns"] },
        { tag: "ontology_binding", lines: ["Preserve blueprint coordinates"] },
        { tag: "verification", lines: ["Run the verification surface"] },
      ],
      content: "<code_editing_rules>\n</code_editing_rules>",
      guidanceSource: {
        label: "OpenAI GPT-5 prompting guide",
        url: "https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide",
        publishedAt: "2025-08-07",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "prompt-content-section-mismatch" }),
      ]),
    );
  });
});
