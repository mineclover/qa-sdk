// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  diffOperationalOntologyCheckpoint,
  diffOperationalOntologyCorridor,
  diffOperationalOntologyJunction,
  diffOperationalOntologyRouteDecision,
  diffOperationalOntologyTraversal,
  diffLatestOperationalOntologyCheckpointByScope,
  diffLatestOperationalOntologyCorridorByScope,
  diffLatestOperationalOntologyJunctionByScope,
  diffLatestOperationalOntologyRouteDecisionByScope,
  diffLatestOperationalOntologyTraversalByScope,
  listOperationalOntologyCheckpointLatticesByScope,
  listOperationalOntologyCorridorsByScope,
  listOperationalOntologyJunctionsByScope,
  listOperationalOntologyRouteDecisionsByScope,
  listOperationalOntologyTraversalBundlesByScope,
  loadLatestOperationalOntologyCheckpointLatticeByScope,
  loadLatestOperationalOntologyCorridorViewByScope,
  loadLatestOperationalOntologyJunctionViewByScope,
  loadLatestOperationalOntologyRouteDecisionByScope,
  loadLatestOperationalOntologyTraversalBundleByScope,
  loadOperationalOntologyCheckpointLattice,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  loadOperationalOntologyJunctions,
  loadOperationalOntologyJunctionView,
  loadOperationalOntologyRouteDecision,
  loadOperationalOntologyRouteDecisions,
  loadOperationalOntologyTraversalBundle,
  loadOperationalOntologyTraversalBundles,
} from "operational-ontology/persistence";

import {
  getStorePath,
  loadStore,
  parseFlags,
  printJson,
} from "./support.js";

export async function cmdCorridorShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const snapshotId = flags["snapshot"];
  if (!corridorId || !snapshotId) {
    console.error(
      "Usage: qa-sdk ontology corridor show <corridor-id> --snapshot <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadOperationalOntologyCorridorView(store, snapshotId, corridorId);
  if (!view) {
    console.error(`Corridor view 없음: ${corridorId} @ ${snapshotId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Corridor: ${view.corridor.flowId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  controlFlow: ${view.controlFlow?.graphId ?? "-"}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
  console.log(`  traversal bundles: ${view.traversalBundles.length}`);
}

export async function cmdCorridorList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const corridors = snapshotId
    ? await loadOperationalOntologyCorridors(store, snapshotId)
    : await listOperationalOntologyCorridorsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(corridors);
    return;
  }

  if (corridors.length === 0) {
    console.log("Corridor 없음");
    return;
  }

  for (const corridor of corridors) {
    console.log(
      `${corridor.flowId}  template=${corridor.templateKind}  entry=${corridor.entryNodeId}`,
    );
  }
}

export async function cmdCorridorShowLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const scope = flags["scope"];
  if (!corridorId || !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadLatestOperationalOntologyCorridorViewByScope(
    store,
    scope,
    corridorId,
  );
  if (!view) {
    console.error(`최신 corridor view 없음: ${corridorId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Corridor: ${view.corridor.flowId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
}

export async function cmdCheckpointList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const lattices = snapshotId
    ? await loadOperationalOntologyCheckpointLattices(store, snapshotId)
    : await listOperationalOntologyCheckpointLatticesByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(lattices);
    return;
  }

  if (lattices.length === 0) {
    console.log("Checkpoint lattice 없음");
    return;
  }

  for (const lattice of lattices) {
    console.log(
      `${lattice.rootCheckpointId}  corridor=${lattice.corridorId}  checkpoints=${lattice.observations.length}`,
    );
  }
}

export async function cmdCheckpointShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!rootCheckpointId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const lattice = snapshotId
    ? await loadOperationalOntologyCheckpointLattice(
        store,
        snapshotId,
        rootCheckpointId,
      )
    : await loadLatestOperationalOntologyCheckpointLatticeByScope(
        store,
        scope!,
        rootCheckpointId,
      );

  if (!lattice) {
    console.error(`Checkpoint lattice 없음: ${rootCheckpointId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(lattice);
    return;
  }

  console.log(`Checkpoint lattice: ${lattice.rootCheckpointId}`);
  console.log(`  corridor: ${lattice.corridorId}`);
  console.log(`  definitions: ${lattice.definitions.length}`);
  console.log(`  observations: ${lattice.observations.length}`);
  console.log(`  links: ${lattice.links.length}`);
}

export async function cmdRouteList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const routes = snapshotId
    ? await loadOperationalOntologyRouteDecisions(store, snapshotId)
    : await listOperationalOntologyRouteDecisionsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(routes);
    return;
  }

  if (routes.length === 0) {
    console.log("Route decision 없음");
    return;
  }

  for (const route of routes) {
    console.log(
      `${route.branchNodeId}  mode=${route.mode}  selected=${route.selectedPathIds.join(",") || "-"}`,
    );
  }
}

export async function cmdRouteShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!branchNodeId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const route = snapshotId
    ? await loadOperationalOntologyRouteDecision(store, snapshotId, branchNodeId)
    : await loadLatestOperationalOntologyRouteDecisionByScope(
        store,
        scope!,
        branchNodeId,
      );

  if (!route) {
    console.error(`Route decision 없음: ${branchNodeId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(route);
    return;
  }

  console.log(`Route decision: ${route.branchNodeId}`);
  console.log(`  mode: ${route.mode}`);
  console.log(`  selected: ${route.selectedPathIds.join(",") || "-"}`);
  console.log(`  skipped: ${route.skippedPathIds.join(",") || "-"}`);
}

export async function cmdTraversalList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const bundles = snapshotId
    ? await loadOperationalOntologyTraversalBundles(store, snapshotId)
    : await listOperationalOntologyTraversalBundlesByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(bundles);
    return;
  }

  if (bundles.length === 0) {
    console.log("Traversal bundle 없음");
    return;
  }

  for (const bundle of bundles) {
    console.log(
      `${bundle.object.canonicalKey}  lifecycle=${bundle.object.lifecycle}  observations=${bundle.observations.length}`,
    );
  }
}

export async function cmdTraversalShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!traversalKey || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const bundle = snapshotId
    ? await loadOperationalOntologyTraversalBundle(store, snapshotId, traversalKey)
    : await loadLatestOperationalOntologyTraversalBundleByScope(
        store,
        scope!,
        traversalKey,
      );

  if (!bundle) {
    console.error(`Traversal bundle 없음: ${traversalKey}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(bundle);
    return;
  }

  console.log(`Traversal: ${bundle.object.canonicalKey}`);
  console.log(`  lifecycle: ${bundle.object.lifecycle}`);
  console.log(`  facets: ${bundle.facets.length}`);
  console.log(`  observations: ${bundle.observations.length}`);
}

export async function cmdRouteDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!branchNodeId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology route diff <branch-node-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyRouteDecision(
    store,
    branchNodeId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Route diff 없음: ${branchNodeId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Route diff: ${branchNodeId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  selected Δ=${diff.selectedPathCountDelta}  skipped Δ=${diff.skippedPathCountDelta}`,
  );
}

export async function cmdRouteDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const scope = flags["scope"];
  if (!branchNodeId || !scope) {
    console.error(
      "Usage: qa-sdk ontology route diff-latest <branch-node-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyRouteDecisionByScope(
    store,
    scope,
    branchNodeId,
  );
  if (!diff) {
    console.error(`Route diff-latest 없음: ${branchNodeId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Route diff-latest: ${branchNodeId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  selected Δ=${diff.selectedPathCountDelta}  skipped Δ=${diff.skippedPathCountDelta}`,
  );
}

export async function cmdTraversalDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!traversalKey || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology traversal diff <traversal-key> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyTraversal(
    store,
    traversalKey,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Traversal diff 없음: ${traversalKey}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Traversal diff: ${traversalKey}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  facets Δ=${diff.facetCountDelta}  observations Δ=${diff.observationCountDelta}`,
  );
}

export async function cmdTraversalDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const scope = flags["scope"];
  if (!traversalKey || !scope) {
    console.error(
      "Usage: qa-sdk ontology traversal diff-latest <traversal-key> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyTraversalByScope(
    store,
    scope,
    traversalKey,
  );
  if (!diff) {
    console.error(`Traversal diff-latest 없음: ${traversalKey} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Traversal diff-latest: ${traversalKey}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  facets Δ=${diff.facetCountDelta}  observations Δ=${diff.observationCountDelta}`,
  );
}

export async function cmdCorridorDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!corridorId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology corridor diff <corridor-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyCorridor(
    store,
    corridorId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Corridor diff 없음: ${corridorId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Corridor diff: ${corridorId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  endpoint Δ=${diff.endpointCountDelta}  contract Δ=${diff.contractCountDelta}  link Δ=${diff.linkCountDelta}`,
  );
  console.log(
    `  checkpoint lattice Δ=${diff.checkpointLatticeCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}  traversal bundle Δ=${diff.traversalBundleCountDelta}`,
  );
}

export async function cmdCorridorDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const scope = flags["scope"];
  if (!corridorId || !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor diff-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyCorridorByScope(
    store,
    scope,
    corridorId,
  );
  if (!diff) {
    console.error(`Corridor diff-latest 없음: ${corridorId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Corridor diff-latest: ${corridorId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  endpoint Δ=${diff.endpointCountDelta}  contract Δ=${diff.contractCountDelta}  link Δ=${diff.linkCountDelta}`,
  );
}

export async function cmdCheckpointDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!rootCheckpointId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology checkpoint diff <root-checkpoint-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyCheckpoint(
    store,
    rootCheckpointId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Checkpoint diff 없음: ${rootCheckpointId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Checkpoint diff: ${rootCheckpointId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  definitions Δ=${diff.definitionCountDelta}  observations Δ=${diff.observationCountDelta}  links Δ=${diff.linkCountDelta}`,
  );
}

export async function cmdCheckpointDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const scope = flags["scope"];
  if (!rootCheckpointId || !scope) {
    console.error(
      "Usage: qa-sdk ontology checkpoint diff-latest <root-checkpoint-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyCheckpointByScope(
    store,
    scope,
    rootCheckpointId,
  );
  if (!diff) {
    console.error(`Checkpoint diff-latest 없음: ${rootCheckpointId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Checkpoint diff-latest: ${rootCheckpointId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  definitions Δ=${diff.definitionCountDelta}  observations Δ=${diff.observationCountDelta}  links Δ=${diff.linkCountDelta}`,
  );
}

export async function cmdJunctionList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const junctions = snapshotId
    ? await loadOperationalOntologyJunctions(store, snapshotId)
    : await listOperationalOntologyJunctionsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(junctions);
    return;
  }

  if (junctions.length === 0) {
    console.log("Junction 없음");
    return;
  }

  for (const junction of junctions) {
    console.log(
      `${junction.branchNodeId}  mode=${junction.mode}  paths=${junction.paths.length}`,
    );
  }
}

export async function cmdJunctionShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!junctionId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = snapshotId
    ? await loadOperationalOntologyJunctionView(store, snapshotId, junctionId)
    : await loadLatestOperationalOntologyJunctionViewByScope(
        store,
        scope!,
        junctionId,
      );

  if (!view) {
    console.error(`Junction view 없음: ${junctionId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Junction: ${view.junction.branchNodeId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  mode: ${view.junction.mode}`);
  console.log(`  paths: ${view.junction.paths.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
  console.log(`  corridors: ${view.corridors.map((corridor) => corridor.flowId).join(",") || "-"}`);
}

export async function cmdJunctionDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!junctionId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology junction diff <junction-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyJunction(
    store,
    junctionId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Junction diff 없음: ${junctionId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Junction diff: ${junctionId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  path Δ=${diff.pathCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}`,
  );
}

export async function cmdJunctionDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const scope = flags["scope"];
  if (!junctionId || !scope) {
    console.error(
      "Usage: qa-sdk ontology junction diff-latest <junction-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyJunctionByScope(
    store,
    scope,
    junctionId,
  );
  if (!diff) {
    console.error(`Junction diff-latest 없음: ${junctionId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Junction diff-latest: ${junctionId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  path Δ=${diff.pathCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}`,
  );
}
