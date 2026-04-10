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
  loadLatestOperationalOntologyCorridorViewByScope,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  listOperationalOntologySnapshotProjections,
  loadOperationalOntologySnapshotView,
  type IngestOperationalOntologyProjectionOptions,
  type OperationalOntologyObjectRecord,
  type OperationalOntologyFacetRecord,
  type OperationalOntologyObservationRecord,
  type OperationalOntologyProjectionRecord,
  type EventRecordObservationInput,
  type PipeGraphProjectionInput,
} from "operational-ontology";
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
