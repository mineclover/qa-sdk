import { describe, expect, it } from "vitest";

import { operationalOntologyImplementationGovernancePlane } from "./governance.js";
import { InMemoryOperationalOntologySchemaRegistry } from "./schema.js";
import {
  diffOperationalOntologyCorridor,
  diffOperationalOntologySnapshots,
  ingestOperationalOntologyProjection,
  ingestEventRecordProjection,
  ingestPipeGraphProjection,
  InMemoryOperationalOntologyStore,
  listOperationalOntologyCheckpointLatticesByScope,
  listOperationalOntologyCorridorViewsByScope,
  listOperationalOntologyCorridorsByScope,
  listOperationalOntologySnapshotProjections,
  listOperationalOntologySnapshotViewsByScope,
  listOperationalOntologyTraversalBundlesByScope,
  loadLatestOperationalOntologyCorridorViewByScope,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  loadLatestOperationalOntologySnapshotViewByScope,
  loadOperationalOntologySnapshot,
  loadOperationalOntologySnapshotView,
  loadOperationalOntologyTraversalBundles,
  persistOperationalOntologySnapshot,
} from "./persistence.js";

describe("in-memory adapters", () => {
  it("validates schema replacement in the in-memory schema registry", () => {
    const registry = new InMemoryOperationalOntologySchemaRegistry();

    const validation = registry.replace({
      axes: [
        {
          id: "facet_role",
          values: ["definition", "production"],
          capacity: 4,
        },
      ],
      taxonomies: [
        {
          id: "information-role",
          appliesTo: ["node"],
          axisIds: ["facet_role"],
          identityAxisIds: ["facet_role"],
        },
      ],
      relationCategories: [
        {
          category: "flows_to",
          requiredAxes: ["facet_role"],
        },
      ],
      traversals: [
        {
          purpose: "observe",
          allowedRelationCategories: ["flows_to"],
          canonicalizable: true,
        },
      ],
    });

    expect(validation.valid).toBe(true);
    expect(registry.get("flows_to")).toEqual(
      expect.objectContaining({ category: "flows_to" }),
    );
    expect(registry.getAxis("facet_role")).toEqual(
      expect.objectContaining({ id: "facet_role" }),
    );

    expect(() =>
      registry.replace({
        axes: [],
        taxonomies: [
          {
            id: "broken",
            appliesTo: ["node"],
            axisIds: ["missing_axis"],
          },
        ],
        relationCategories: [],
      }),
    ).toThrow(/Operational ontology schema is invalid/);
  });

  it("stores validated objects/facets/observations in the in-memory persistence store", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await store.upsertObject({
      objectId: "node:checkout",
      objectKind: "node",
      canonicalKey: "node:software/delivery/checkout",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    });

    await store.putFacet({
      objectId: "node:checkout",
      facetKind: "identity",
      version: "v1",
      payloadJson: {
        realm: "software",
        space: "delivery",
        anchor: "checkout",
        canonicalKey: "node:software/delivery/checkout",
      },
      recordedAt: "2026-04-10T00:00:01.000Z",
    });

    await store.putFacet({
      objectId: "node:checkout",
      facetKind: "semantic",
      version: "v1",
      payloadJson: {
        summary: "Checkout delivery node",
      },
      recordedAt: "2026-04-10T00:00:02.000Z",
    });

    await store.appendObservation({
      observationId: "obs-1",
      targetObjectId: "node:checkout",
      observationKind: "node_observed",
      payloadJson: { seen: true },
      observedAt: "2026-04-10T00:00:03.000Z",
    });

    const bundle = await store.getObjectBundle("node:checkout");
    expect(bundle).not.toBeNull();
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(bundle?.payloadValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facetKind: "identity",
          validation: expect.objectContaining({ valid: true }),
        }),
      ]),
    );

    await expect(
      store.putFacet({
        objectId: "node:checkout",
        facetKind: "grammar",
        version: "v1",
        payloadJson: {},
        recordedAt: "2026-04-10T00:00:04.000Z",
      }),
    ).rejects.toThrow(/not allowed/);

    await expect(
      store.putFacet({
        objectId: "node:checkout",
        facetKind: "identity",
        version: "v2",
        payloadJson: {
          realm: "software",
          space: "delivery",
          anchor: "checkout",
        },
        recordedAt: "2026-04-10T00:00:05.000Z",
      }),
    ).rejects.toThrow(/Invalid payload shape/);
  });

  it("stores governance blueprints and run evidence as first-class bundles", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await store.upsertObject({
      objectId: "governance-blueprint:event-ingest",
      objectKind: "governance_blueprint",
      canonicalKey: "governance-blueprint:corridor:event-ingest",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    });

    await store.putFacet({
      objectId: "governance-blueprint:event-ingest",
      facetKind: "schema",
      version: "v1",
      payloadJson: {
        blueprint: {
          blueprintId: "event-ingest-governance",
          coordinateRef: "corridor:event-ingest",
          unitKind: "corridor_bundle",
        },
      },
      recordedAt: "2026-04-10T00:00:01.000Z",
    });

    await store.putFacet({
      objectId: "governance-blueprint:event-ingest",
      facetKind: "validation",
      version: "v1",
      payloadJson: { valid: true, issues: [] },
      recordedAt: "2026-04-10T00:00:02.000Z",
    });

    await store.upsertObject({
      objectId: "governance-run:event-ingest:1",
      objectKind: "governance_run",
      canonicalKey: "governance-run:corridor:event-ingest:1",
      schemaVersion: "v1",
      lifecycle: "active",
      createdAt: "2026-04-10T00:00:03.000Z",
      updatedAt: "2026-04-10T00:00:03.000Z",
    });

    await store.putFacet({
      objectId: "governance-run:event-ingest:1",
      facetKind: "evidence",
      version: "v1",
      payloadJson: {
        implementationRefs: ["src/event-projector.ts"],
        verificationRefs: ["src/event-projector.test.ts"],
        constraintVerdicts: [],
      },
      recordedAt: "2026-04-10T00:00:04.000Z",
    });

    await store.putFacet({
      objectId: "governance-run:event-ingest:1",
      facetKind: "status",
      version: "v1",
      payloadJson: { state: "passed" },
      recordedAt: "2026-04-10T00:00:05.000Z",
    });

    const blueprintBundle = await store.getObjectBundle("governance-blueprint:event-ingest");
    const runBundle = await store.getObjectBundle("governance-run:event-ingest:1");

    expect(blueprintBundle?.facetValidation.valid).toBe(true);
    expect(runBundle?.facetValidation.valid).toBe(true);
  });

  it("persists implementation governance blueprints through the governance helper", async () => {
    const store = new InMemoryOperationalOntologyStore();

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
      store,
      {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        constraints: [{ kind: "unit_boundary" }],
      },
      { now: "2026-04-10T00:00:06.000Z" },
    );

    const bundle = await store.getObjectBundle(persisted.objectId);

    expect(bundle?.object.objectKind).toBe("governance_blueprint");
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(bundle?.payloadValidations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facetKind: "schema",
          validation: expect.objectContaining({ valid: true }),
        }),
        expect.objectContaining({
          facetKind: "validation",
          validation: expect.objectContaining({ valid: true }),
        }),
      ]),
    );
  });

  it("rejects invalid governance blueprint persistence unless explicitly allowed", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const governanceSchema = {
      axes: [
        {
          id: "facet_role",
          values: ["definition", "production", "consumption"],
        },
      ],
      taxonomies: [
        {
          id: "information-role",
          appliesTo: ["node"],
          axisIds: ["facet_role"],
        },
      ],
      relationCategories: [
        {
          category: "flow",
          requiredAxes: ["facet_role"],
        },
      ],
    };
    const blueprint = {
      blueprintId: "schema-bound-governance",
      coordinateRef: "corridor:event-ingest",
      unitKind: "corridor_bundle",
      requiredSchemas: ["missing-schema"],
    };

    await expect(
      operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
        store,
        blueprint,
        { now: "2026-04-10T00:00:06.000Z", schema: governanceSchema },
      ),
    ).rejects.toThrow(/Cannot persist invalid implementation governance blueprint/);

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint(
      store,
      blueprint,
      { now: "2026-04-10T00:00:07.000Z", schema: governanceSchema, allowInvalid: true },
    );
    const object = await store.findObjectById(persisted.objectId);

    expect(object?.lifecycle).toBe("draft");
  });

  it("persists implementation governance run results through the governance helper", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const evaluation = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
        },
        constraints: [{ kind: "unit_boundary" }],
      },
      runId: "governance-run:event-ingest:helper",
    });

    const persisted = await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:06.000Z" },
    );

    const bundle = await store.getObjectBundle(persisted.objectId);
    const observations = await store.listObservations({
      observationKind: "governance_evaluated",
    });

    expect(bundle?.object.objectKind).toBe("governance_run");
    expect(bundle?.facetValidation.valid).toBe(true);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetObjectId: persisted.objectId,
          observationKind: "governance_evaluated",
        }),
      ]),
    );
  });

  it("preserves governance run createdAt when persisting the same run again", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const evaluation = operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance({
      blueprint: {
        blueprintId: "event-ingest-governance",
        coordinateRef: "corridor:event-ingest",
        unitKind: "corridor_bundle",
        implementationBinding: {
          coordinateRef: "corridor:event-ingest",
          implementationRefs: [{ kind: "code", ref: "src/event-projector.ts" }],
        },
        verificationBinding: {
          coordinateRef: "corridor:event-ingest",
          verificationRefs: [{ kind: "test", ref: "src/event-projector.test.ts" }],
        },
      },
      runId: "governance-run:event-ingest:stable-created-at",
    });

    await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:06.000Z" },
    );
    await operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun(
      store,
      evaluation.governanceRun,
      { now: "2026-04-10T00:00:07.000Z" },
    );

    const object = await store.findObjectById("governance-run:event-ingest:stable-created-at");
    const facets = await store.listFacets("governance-run:event-ingest:stable-created-at");

    expect(object?.createdAt).toBe("2026-04-10T00:00:06.000Z");
    expect(object?.updatedAt).toBe("2026-04-10T00:00:07.000Z");
    expect(facets.filter((facet) => facet.facetKind === "evidence")).toHaveLength(2);
    expect(facets.filter((facet) => facet.facetKind === "aggregate")).toHaveLength(2);
  });

  it("persists and reloads runtime snapshots through the persistence helper", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const snapshot = {
      topologyTemplateKind: "runtime_snapshot" as const,
      topologyTemplateDescription: "Snapshot topology",
      topologyValidation: {
        valid: true,
        corridorCount: 1,
        maxCheckpointLatticeDepth: 2,
        missingCorridorKinds: [],
        missingJunctionTemplateKinds: [],
        missingCheckpointTemplateKinds: [],
        missingCheckpointLattices: false,
        missingRouteDecisions: false,
        missingTraversals: false,
        tooFewCorridors: false,
        tooManyCorridors: false,
        checkpointDepthTooShallow: false,
        routeDecisionsMissingRefs: [],
        checkpointsMissingCorridor: [],
      },
      corridors: [
        {
          flowId: "corridor:checkout",
          templateKind: "pipe_graph" as const,
          entryNodeId: "collect-order",
          nodeIds: ["collect-order", "persist-order"],
          schemaIds: [],
          endpoints: [],
          contracts: [],
          links: [],
        },
      ],
      controlFlows: [],
      checkpoints: [
        {
          checkpointId: "checkpoint:checkout",
          templateKind: "root" as const,
          recordId: "log-1",
          traceId: "trace-1",
          eventKey: "order.submit",
          timestamp: "2026-04-10T00:00:00.000Z",
          corridorId: "corridor:checkout",
          observedNodeKeys: ["collect-order"],
          observedEdgeKeys: [],
          transmissions: [],
          dataFlow: {
            flowId: "corridor:checkout",
            templateKind: "pipe_graph" as const,
            entryNodeId: "collect-order",
            nodeIds: ["collect-order", "persist-order"],
            schemaIds: [],
            endpoints: [],
            contracts: [],
            links: [],
          },
        },
      ],
      checkpointLattices: [
        {
          corridorId: "corridor:checkout",
          rootCheckpointId: "checkpoint:checkout",
          definitions: [
            {
              checkpointId: "checkpoint:checkout",
              templateKind: "root" as const,
              nodeId: "collect-order",
              observedPrefixIds: [],
              observedFields: [],
            },
          ],
          observations: [
            {
              checkpointId: "checkpoint:checkout",
              templateKind: "root" as const,
              recordId: "log-1",
              traceId: "trace-1",
              eventKey: "order.submit",
              timestamp: "2026-04-10T00:00:00.000Z",
              corridorId: "corridor:checkout",
              observedNodeKeys: ["collect-order"],
              observedEdgeKeys: [],
              transmissions: [],
              dataFlow: {
                flowId: "corridor:checkout",
                templateKind: "pipe_graph" as const,
                entryNodeId: "collect-order",
                nodeIds: ["collect-order", "persist-order"],
                schemaIds: [],
                endpoints: [],
                contracts: [],
                links: [],
              },
            },
          ],
          links: [],
        },
      ],
      junctions: [],
      routeDecisions: [],
      traversals: [
        {
          traversal: {
            purpose: "observe",
            start: "collect-order",
            edges: ["edge:collect-order->pipe_connection:next->persist-order"],
            end: "persist-order",
            canonicalKey:
              "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
          },
          reachedGoalIds: ["persisted"],
          unreachableGoalIds: [],
          loopDetected: false,
          recoveryUsed: false,
          terminalNodeId: "persist-order",
          terminalReason: null,
        },
      ],
      transmissions: [],
      lineageLinks: [],
      observedNodeKeys: ["collect-order"],
      observedEdgeKeys: [],
    };

    const persisted = await persistOperationalOntologySnapshot(store, snapshot, {
      snapshotId: "snapshot:test",
      builtAt: "2026-04-10T00:00:10.000Z",
    });

    expect(persisted.snapshotProjection.projectionId).toBe("snapshot:test");
    expect(persisted.subProjectionIds).toEqual(
      expect.arrayContaining([
        "snapshot:test:corridor:corridor:checkout",
        "snapshot:test:checkpoint-lattice:checkpoint:checkout",
      ]),
    );
    expect(persisted.traversalObjectIds).toEqual([
      "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
    ]);

    const loaded = await loadOperationalOntologySnapshot(store, "snapshot:test");
    expect(loaded).toEqual(snapshot);

    const traversalBundle = await store.getObjectBundle(
      "traversal:observe:collect-order->edge:collect-order->pipe_connection:next->persist-order->persist-order",
    );
    expect(traversalBundle?.facetValidation.valid).toBe(true);
    expect(traversalBundle?.observations).toEqual([
      expect.objectContaining({
        observationKind: "traversal_observed",
      }),
    ]);
  });

  it("ingests projection input into snapshot + store in one step", async () => {
    const store = new InMemoryOperationalOntologyStore();
    const result = await ingestOperationalOntologyProjection(
      store,
      {
        graph: {
          graphId: "checkout",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
        record: {
          log_id: "log-2",
          timestamp: "2026-04-10T00:01:00.000Z",
          record_kind: "log",
          trace_id: "trace-2",
          span_id: "span-2",
          event_key: "order.submit",
          event_version: "v1",
          payload_format: "json",
          payload_encoding: "identity",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: {
            orderId: "ord_2",
          },
          address_context: {},
        },
      },
      {
        snapshotId: "snapshot:ingest",
        builtAt: "2026-04-10T00:01:10.000Z",
      },
    );

    expect(result.snapshot.corridors).toHaveLength(2);
    expect(result.persisted.snapshotProjection.projectionId).toBe("snapshot:ingest");

    const loaded = await loadOperationalOntologySnapshot(store, "snapshot:ingest");
    expect(loaded).toEqual(result.snapshot);

    const snapshotProjections = await listOperationalOntologySnapshotProjections(store);
    expect(snapshotProjections.map((projection) => projection.projectionId)).toContain(
      "snapshot:ingest",
    );

    const view = await loadOperationalOntologySnapshotView(store, "snapshot:ingest");
    expect(view).not.toBeNull();
    expect(view?.snapshot).toEqual(result.snapshot);
    expect(view?.corridors).toEqual(result.snapshot.corridors);
    expect(view?.checkpointLattices).toEqual(result.snapshot.checkpointLattices);
    expect(view?.traversalBundles).toEqual([]);

    const corridors = await loadOperationalOntologyCorridors(store, "snapshot:ingest");
    const lattices = await loadOperationalOntologyCheckpointLattices(
      store,
      "snapshot:ingest",
    );
    const traversalBundles = await loadOperationalOntologyTraversalBundles(
      store,
      "snapshot:ingest",
    );
    expect(corridors).toEqual(result.snapshot.corridors);
    expect(lattices).toEqual(result.snapshot.checkpointLattices);
    expect(traversalBundles).toEqual([]);
  });

  it("provides event/pipe ingest helpers and scope-based snapshot view queries", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await ingestEventRecordProjection(
      store,
      {
        record: {
          log_id: "log-svc",
          timestamp: "2026-04-10T00:02:00.000Z",
          record_kind: "log",
          trace_id: "trace-svc",
          span_id: "span-svc",
          event_key: "order.submit",
          event_version: "v1",
          payload_format: "json",
          payload_encoding: "identity",
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { orderId: "ord-svc" },
          address_context: {},
        },
      },
      {
        snapshotId: "snapshot:event-only",
        targetScope: "event-scope",
        builtAt: "2026-04-10T00:02:10.000Z",
      },
    );

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-only",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
      },
      {
        snapshotId: "snapshot:pipe-only",
        targetScope: "pipe-scope",
        builtAt: "2026-04-10T00:02:20.000Z",
      },
    );

    const eventScopeViews = await listOperationalOntologySnapshotViewsByScope(
      store,
      "event-scope",
    );
    expect(eventScopeViews).toHaveLength(1);
    expect(eventScopeViews[0]?.snapshotProjection.projectionId).toBe(
      "snapshot:event-only",
    );

    const latestPipeScopeView = await loadLatestOperationalOntologySnapshotViewByScope(
      store,
      "pipe-scope",
    );
    expect(latestPipeScopeView?.snapshotProjection.projectionId).toBe(
      "snapshot:pipe-only",
    );
    expect(latestPipeScopeView?.snapshot.corridors).toHaveLength(1);

    const eventScopeCorridors = await listOperationalOntologyCorridorsByScope(
      store,
      "event-scope",
    );
    const eventScopeLattices = await listOperationalOntologyCheckpointLatticesByScope(
      store,
      "event-scope",
    );
    const eventScopeTraversalBundles = await listOperationalOntologyTraversalBundlesByScope(
      store,
      "event-scope",
    );
    expect(eventScopeCorridors).toHaveLength(1);
    expect(eventScopeLattices).toHaveLength(1);
    expect(eventScopeTraversalBundles).toEqual([]);

    const eventCorridorView = await loadOperationalOntologyCorridorView(
      store,
      "snapshot:event-only",
      "event-record:log-svc",
    );
    expect(eventCorridorView?.corridor.flowId).toBe("event-record:log-svc");
    expect(eventCorridorView?.checkpointLattices).toHaveLength(1);
    expect(eventCorridorView?.controlFlow).toBeNull();

    const eventCorridorViewsByScope = await listOperationalOntologyCorridorViewsByScope(
      store,
      "event-scope",
    );
    expect(eventCorridorViewsByScope).toHaveLength(1);
    expect(eventCorridorViewsByScope[0]?.corridor.flowId).toBe("event-record:log-svc");

    const latestPipeCorridorView =
      await loadLatestOperationalOntologyCorridorViewByScope(
        store,
        "pipe-scope",
        "pipe-only",
      );
    expect(latestPipeCorridorView?.corridor.flowId).toBe("pipe-only");
    expect(latestPipeCorridorView?.controlFlow?.graphId).toBe("pipe-only");
  });

  it("diffs snapshots and corridors across persisted ontology snapshots", async () => {
    const store = new InMemoryOperationalOntologyStore();

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-diff",
          version: "v1",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v1",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
            },
          ],
          connections: [],
        },
      },
      {
        snapshotId: "snapshot:diff-a",
        targetScope: "diff-scope",
        builtAt: "2026-04-10T00:04:00.000Z",
      },
    );

    await ingestPipeGraphProjection(
      store,
      {
        graph: {
          graphId: "pipe-diff",
          version: "v2",
          entryPipeId: "collect-order",
          pipes: [
            {
              pipeId: "collect-order",
              version: "v2",
              trigger: { eventKey: "order.submit" },
              flow: { kind: "step", facet: "produced" },
              ports: [{ portId: "out", direction: "out", facetType: "produced" }],
            },
            {
              pipeId: "persist-order",
              version: "v2",
              trigger: { eventKey: "order.created" },
              flow: { kind: "step", facet: "consumed" },
              ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
            },
          ],
          connections: [
            {
              from: { pipeId: "collect-order", portId: "out" },
              to: { pipeId: "persist-order", portId: "in" },
              kind: "next",
            },
          ],
        },
      },
      {
        snapshotId: "snapshot:diff-b",
        targetScope: "diff-scope",
        builtAt: "2026-04-10T00:04:10.000Z",
      },
    );

    const corridorDiff = await diffOperationalOntologyCorridor(
      store,
      "pipe-diff",
      "snapshot:diff-a",
      "snapshot:diff-b",
    );
    expect(corridorDiff).toEqual(
      expect.objectContaining({
        corridorId: "pipe-diff",
        status: "changed",
      }),
    );
    expect(corridorDiff?.changedSections).toContain("corridor");
    expect(corridorDiff?.endpointCountDelta).toBeGreaterThan(0);

    const snapshotDiff = await diffOperationalOntologySnapshots(
      store,
      "snapshot:diff-a",
      "snapshot:diff-b",
    );
    expect(snapshotDiff?.summary.changed).toBe(1);
    expect(snapshotDiff?.corridorDiffs).toHaveLength(1);
  });
});
