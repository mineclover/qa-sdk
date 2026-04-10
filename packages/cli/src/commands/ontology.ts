import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  ingestEventRecordProjection,
  ingestOperationalOntologyProjection,
  ingestPipeGraphProjection,
  InMemoryOperationalOntologyStore,
  listOperationalOntologyCheckpointLatticesByScope,
  listOperationalOntologyCorridorsByScope,
  listOperationalOntologyJunctionsByScope,
  listOperationalOntologyRouteDecisionsByScope,
  listOperationalOntologyTraversalBundlesByScope,
  loadLatestOperationalOntologyCorridorViewByScope,
  loadLatestOperationalOntologyCheckpointLatticeByScope,
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
  listOperationalOntologySnapshotProjections,
  loadOperationalOntologySnapshotView,
  type IngestOperationalOntologyProjectionOptions,
  type OperationalOntologyObjectRecord,
  type OperationalOntologyFacetRecord,
  type OperationalOntologyObservationRecord,
  type OperationalOntologyProjectionRecord,
  type EventRecordObservationInput,
  type PipeGraphProjectionInput,
} from "operational-ontology/persistence";
import { getQaSdkDir } from "../lib/qa-dir.js";

interface PersistedOntologyStoreFile {
  objects: OperationalOntologyObjectRecord[];
  facets: OperationalOntologyFacetRecord[];
  observations: OperationalOntologyObservationRecord[];
  projections: OperationalOntologyProjectionRecord[];
}

const DEFAULT_STORE_FILE = join(getQaSdkDir(), "operational-ontology-store.json");

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return { positional, flags };
}

function getStorePath(flags: Record<string, string>): string {
  return resolve(flags["store"] ?? DEFAULT_STORE_FILE);
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function loadStore(storePath: string): Promise<InMemoryOperationalOntologyStore> {
  const store = new InMemoryOperationalOntologyStore();
  if (!existsSync(storePath)) {
    return store;
  }

  const payload = await loadJsonFile<PersistedOntologyStoreFile>(storePath);
  for (const object of payload.objects ?? []) {
    await store.upsertObject(object);
  }
  for (const facet of payload.facets ?? []) {
    await store.putFacet(facet);
  }
  for (const observation of payload.observations ?? []) {
    await store.appendObservation(observation);
  }
  for (const projection of payload.projections ?? []) {
    await store.putProjection(projection);
  }
  return store;
}

async function saveStore(
  store: InMemoryOperationalOntologyStore,
  storePath: string,
): Promise<void> {
  const objects = await store.listObjects();
  const facets = (
    await Promise.all(objects.map((object) => store.listFacets(object.objectId)))
  ).flat();
  const observations = await store.listObservations();
  const projections = await store.listProjections();

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(
    storePath,
    JSON.stringify(
      {
        objects,
        facets,
        observations,
        projections,
      } satisfies PersistedOntologyStoreFile,
      null,
      2,
    ),
    "utf8",
  );
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function toIngestOptions(flags: Record<string, string>): IngestOperationalOntologyProjectionOptions {
  return {
    snapshotId: flags["snapshot-id"],
    targetScope: flags["scope"],
    builtAt: flags["built-at"],
  };
}

async function cmdSnapshotIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<Record<string, unknown>>(resolve(inputPath));
  const result = await ingestOperationalOntologyProjection(
    store,
    input as never,
    toIngestOptions(flags),
  );
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
  console.log(`  checkpoints: ${result.snapshot.checkpoints.length}`);
  console.log(`  traversals: ${result.snapshot.traversals.length}`);
}

async function cmdEventIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<EventRecordObservationInput>(resolve(inputPath));
  const result = await ingestEventRecordProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Event snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}

async function cmdPipeIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<PipeGraphProjectionInput>(resolve(inputPath));
  const result = await ingestPipeGraphProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Pipe snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}

async function cmdSnapshotList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const store = await loadStore(getStorePath(flags));
  const projections = await listOperationalOntologySnapshotProjections(
    store,
    flags["scope"],
  );

  if (flags["json"] === "true") {
    printJson(projections);
    return;
  }

  if (projections.length === 0) {
    console.log("Snapshot 없음");
    return;
  }

  for (const projection of projections) {
    console.log(`${projection.projectionId}  ${projection.targetScope}  ${projection.builtAt}`);
  }
}

async function cmdSnapshotShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const snapshotId = positional[0];
  if (!snapshotId) {
    console.error("Usage: qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]");
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadOperationalOntologySnapshotView(store, snapshotId);
  if (!view) {
    console.error(`Snapshot 없음: ${snapshotId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  scope: ${view.snapshotProjection.targetScope}`);
  console.log(`  corridors: ${view.corridors.length}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  traversals: ${view.traversalBundles.length}`);
}

async function cmdCorridorShow(rest: string[]): Promise<void> {
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

async function cmdCorridorList(rest: string[]): Promise<void> {
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

async function cmdCorridorShowLatest(rest: string[]): Promise<void> {
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

async function cmdCheckpointList(rest: string[]): Promise<void> {
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

async function cmdCheckpointShow(rest: string[]): Promise<void> {
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

async function cmdRouteList(rest: string[]): Promise<void> {
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

async function cmdRouteShow(rest: string[]): Promise<void> {
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

async function cmdTraversalList(rest: string[]): Promise<void> {
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

async function cmdTraversalShow(rest: string[]): Promise<void> {
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

async function cmdJunctionList(rest: string[]): Promise<void> {
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

async function cmdJunctionShow(rest: string[]): Promise<void> {
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

export async function cliOntology(args: string[]): Promise<void> {
  const [cmd, ...rest] = args;

  switch (cmd) {
    case "help":
      console.log(
        [
          "qa-sdk ontology",
          "",
          "  qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
          "  qa-sdk ontology snapshot list [--store <file>] [--scope <scope>] [--json]",
          "  qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology corridor show <corridor-id> --snapshot <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
          "  qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
        ].join("\n"),
      );
      return;
    case "snapshot.ingest":
      await cmdSnapshotIngest(rest);
      return;
    case "snapshot.list":
      await cmdSnapshotList(rest);
      return;
    case "snapshot.show":
      await cmdSnapshotShow(rest);
      return;
    case "corridor.show":
      await cmdCorridorShow(rest);
      return;
    case "corridor.list":
      await cmdCorridorList(rest);
      return;
    case "corridor.show-latest":
      await cmdCorridorShowLatest(rest);
      return;
    case "checkpoint.list":
      await cmdCheckpointList(rest);
      return;
    case "checkpoint.show":
      await cmdCheckpointShow(rest);
      return;
    case "junction.list":
      await cmdJunctionList(rest);
      return;
    case "junction.show":
      await cmdJunctionShow(rest);
      return;
    case "route.list":
      await cmdRouteList(rest);
      return;
    case "route.show":
      await cmdRouteShow(rest);
      return;
    case "traversal.list":
      await cmdTraversalList(rest);
      return;
    case "traversal.show":
      await cmdTraversalShow(rest);
      return;
    case "event.ingest":
      await cmdEventIngest(rest);
      return;
    case "pipe.ingest":
      await cmdPipeIngest(rest);
      return;
    default:
      console.error(`알 수 없는 ontology 명령: ${cmd ?? "(none)"}`);
      process.exitCode = 1;
  }
}
