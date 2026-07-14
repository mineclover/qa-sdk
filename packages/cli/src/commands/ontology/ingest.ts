// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { resolve } from 'node:path';

import {
  ingestEventRecordProjection,
  ingestOperationalOntologyProjection,
  ingestPipeGraphProjection,
  type IngestOperationalOntologyProjectionOptions,
} from 'operational-ontology/persistence';
import type {
  EventRecordObservationInput,
  PipeGraphProjectionInput,
} from 'operational-ontology/projectors';

import {
  getStorePath,
  loadJsonFile,
  loadStore,
  parseFlags,
  printJson,
  saveStore,
} from './support.js';

function toIngestOptions(
  flags: Record<string, string>,
): IngestOperationalOntologyProjectionOptions {
  return {
    snapshotId: flags['snapshot-id'],
    targetScope: flags['scope'],
    builtAt: flags['built-at'],
  };
}

export async function cmdSnapshotIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags['input'];
  if (!inputPath) {
    console.error(
      'Usage: qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]',
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

  if (flags['json'] === 'true') {
    printJson(result);
    return;
  }

  console.log(`Snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
  console.log(`  checkpoints: ${result.snapshot.checkpoints.length}`);
  console.log(`  traversals: ${result.snapshot.traversals.length}`);
}

export async function cmdEventIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags['input'];
  if (!inputPath) {
    console.error(
      'Usage: qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]',
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<EventRecordObservationInput>(resolve(inputPath));
  const result = await ingestEventRecordProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags['json'] === 'true') {
    printJson(result);
    return;
  }

  console.log(`Event snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}

export async function cmdPipeIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags['input'];
  if (!inputPath) {
    console.error(
      'Usage: qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]',
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<PipeGraphProjectionInput>(resolve(inputPath));
  const result = await ingestPipeGraphProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags['json'] === 'true') {
    printJson(result);
    return;
  }

  console.log(`Pipe snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}
