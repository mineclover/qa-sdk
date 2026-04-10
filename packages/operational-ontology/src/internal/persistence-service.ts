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
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  listOperationalOntologySnapshotProjections,
  loadOperationalOntologyTraversalBundles,
  loadOperationalOntologySnapshotView,
  type OperationalOntologyCorridorView,
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
  const latest = await loadLatestOperationalOntologySnapshotViewByScope(
    store,
    targetScope,
  );
  if (!latest) {
    return null;
  }

  return loadOperationalOntologyCorridorView(
    store,
    latest.snapshotProjection.projectionId,
    corridorId,
  );
}
