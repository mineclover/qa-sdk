import type {
  EventRecordObservationInput,
  PipeGraphProjectionInput,
} from "./projector-core.js";
import type { OperationalOntologyStore } from "./persistence-memory.js";
import {
  ingestOperationalOntologyProjection,
  type IngestOperationalOntologyProjectionOptions,
  type IngestOperationalOntologyProjectionResult,
} from "./persistence-ingest.js";
import {
  loadOperationalOntologyCheckpointLattice,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  loadOperationalOntologyRouteDecision,
  loadOperationalOntologyJunctionView,
  loadOperationalOntologyJunctions,
  loadOperationalOntologyRouteDecisions,
  listOperationalOntologySnapshotProjections,
  loadOperationalOntologyTraversalBundle,
  loadOperationalOntologyTraversalBundles,
  loadOperationalOntologySnapshotView,
  type OperationalOntologyCorridorView,
  type OperationalOntologyJunctionView,
  type OperationalOntologySnapshotView,
} from "./persistence-query.js";

export async function ingestEventRecordProjection(
  store: OperationalOntologyStore,
  input: EventRecordObservationInput,
  options: IngestOperationalOntologyProjectionOptions = {},
): Promise<IngestOperationalOntologyProjectionResult> {
  return ingestOperationalOntologyProjection(
    store,
    {
      record: input.record,
      addressBindings: input.addressBindings,
      checkpointTemplateRegistry: input.checkpointTemplateRegistry,
      corridorTemplateRegistry: input.corridorTemplateRegistry,
    },
    options,
  );
}

export async function ingestPipeGraphProjection(
  store: OperationalOntologyStore,
  input: PipeGraphProjectionInput,
  options: IngestOperationalOntologyProjectionOptions = {},
): Promise<IngestOperationalOntologyProjectionResult> {
  return ingestOperationalOntologyProjection(
    store,
    {
      graph: input.graph,
      schemas: input.schemas,
      lineages: input.lineages,
      corridorTemplateRegistry: input.corridorTemplateRegistry,
      junctionTemplateRegistry: input.junctionTemplateRegistry,
    },
    options,
  );
}

export async function listOperationalOntologySnapshotViewsByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
): Promise<OperationalOntologySnapshotView[]> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const views = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologySnapshotView(store, projection.projectionId),
    ),
  );

  return views.filter((view): view is OperationalOntologySnapshotView => view !== null);
}

export async function loadLatestOperationalOntologySnapshotViewByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
): Promise<OperationalOntologySnapshotView | null> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const latest = projections.at(-1);
  if (!latest) {
    return null;
  }

  return loadOperationalOntologySnapshotView(store, latest.projectionId);
}

export async function listOperationalOntologyCorridorsByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
): Promise<ReturnType<typeof loadOperationalOntologyCorridors> extends Promise<infer T> ? T : never> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const corridors = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologyCorridors(store, projection.projectionId),
    ),
  );
  return corridors.flat();
}

export async function listOperationalOntologyCheckpointLatticesByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
): Promise<
  ReturnType<typeof loadOperationalOntologyCheckpointLattices> extends Promise<infer T>
    ? T
    : never
> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const lattices = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologyCheckpointLattices(store, projection.projectionId),
    ),
  );
  return lattices.flat();
}

export async function listOperationalOntologyRouteDecisionsByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
): Promise<
  ReturnType<typeof loadOperationalOntologyRouteDecisions> extends Promise<infer T>
    ? T
    : never
> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const routeDecisions = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologyRouteDecisions(store, projection.projectionId),
    ),
  );
  return routeDecisions.flat();
}

export async function listOperationalOntologyJunctionsByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
): Promise<
  ReturnType<typeof loadOperationalOntologyJunctions> extends Promise<infer T>
    ? T
    : never
> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const junctions = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologyJunctions(store, projection.projectionId),
    ),
  );
  return junctions.flat();
}

export async function listOperationalOntologyTraversalBundlesByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
): Promise<
  ReturnType<typeof loadOperationalOntologyTraversalBundles> extends Promise<infer T>
    ? T
    : never
> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  const bundles = await Promise.all(
    projections.map((projection) =>
      loadOperationalOntologyTraversalBundles(store, projection.projectionId),
    ),
  );
  return bundles.flat();
}

export async function listOperationalOntologyCorridorViewsByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
): Promise<OperationalOntologyCorridorView[]> {
  const snapshotViews = await listOperationalOntologySnapshotViewsByScope(store, targetScope);
  const corridorViews = await Promise.all(
    snapshotViews.flatMap((snapshotView) =>
      snapshotView.corridors.map((corridor) =>
        loadOperationalOntologyCorridorView(
          store,
          snapshotView.snapshotProjection.projectionId,
          corridor.flowId,
        ),
      ),
    ),
  );

  return corridorViews.filter(
    (view): view is OperationalOntologyCorridorView => view !== null,
  );
}

export async function loadLatestOperationalOntologyCorridorViewByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
  corridorId: string,
): Promise<OperationalOntologyCorridorView | null> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  for (const projection of [...projections].reverse()) {
    const view = await loadOperationalOntologyCorridorView(
      store,
      projection.projectionId,
      corridorId,
    );
    if (view) {
      return view;
    }
  }
  return null;
}

export async function loadLatestOperationalOntologyCheckpointLatticeByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
  rootCheckpointId: string,
): Promise<Awaited<ReturnType<typeof loadOperationalOntologyCheckpointLattice>>> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  for (const projection of [...projections].reverse()) {
    const lattice = await loadOperationalOntologyCheckpointLattice(
      store,
      projection.projectionId,
      rootCheckpointId,
    );
    if (lattice) {
      return lattice;
    }
  }
  return null;
}

export async function loadLatestOperationalOntologyJunctionViewByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
  junctionId: string,
): Promise<OperationalOntologyJunctionView | null> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  for (const projection of [...projections].reverse()) {
    const view = await loadOperationalOntologyJunctionView(
      store,
      projection.projectionId,
      junctionId,
    );
    if (view) {
      return view;
    }
  }
  return null;
}

export async function loadLatestOperationalOntologyRouteDecisionByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections"
  >,
  targetScope: string,
  branchNodeId: string,
): Promise<Awaited<ReturnType<typeof loadOperationalOntologyRouteDecision>>> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  for (const projection of [...projections].reverse()) {
    const route = await loadOperationalOntologyRouteDecision(
      store,
      projection.projectionId,
      branchNodeId,
    );
    if (route) {
      return route;
    }
  }
  return null;
}

export async function loadLatestOperationalOntologyTraversalBundleByScope(
  store: Pick<
    OperationalOntologyStore,
    "listProjections" | "getObjectBundle"
  >,
  targetScope: string,
  traversalKey: string,
): Promise<Awaited<ReturnType<typeof loadOperationalOntologyTraversalBundle>>> {
  const projections = await listOperationalOntologySnapshotProjections(store, targetScope);
  for (const projection of [...projections].reverse()) {
    const bundle = await loadOperationalOntologyTraversalBundle(
      store,
      projection.projectionId,
      traversalKey,
    );
    if (bundle) {
      return bundle;
    }
  }
  return null;
}
