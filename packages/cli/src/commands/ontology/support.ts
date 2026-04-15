import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  InMemoryOperationalOntologyStore,
  type OperationalOntologyFacetRecord,
  type OperationalOntologyObjectRecord,
  type OperationalOntologyObservationRecord,
  type OperationalOntologyProjectionRecord,
} from "operational-ontology/persistence";

import { getQaSdkDir } from "../../lib/qa-dir.js";

interface PersistedOntologyStoreFile {
  objects: OperationalOntologyObjectRecord[];
  facets: OperationalOntologyFacetRecord[];
  observations: OperationalOntologyObservationRecord[];
  projections: OperationalOntologyProjectionRecord[];
}

export const DEFAULT_STORE_FILE = join(
  getQaSdkDir(),
  "operational-ontology-store.json",
);

export function parseFlags(args: string[]): {
  positional: string[];
  flags: Record<string, string>;
} {
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

export function getStorePath(flags: Record<string, string>): string {
  return resolve(flags["store"] ?? DEFAULT_STORE_FILE);
}

export async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function loadStore(
  storePath: string,
): Promise<InMemoryOperationalOntologyStore> {
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

export async function saveStore(
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

export function printJson(data: unknown): void {
  console.log(toPrettyJson(data));
}

export function toPrettyJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printTable(headers: string[], row: string[]): void {
  const widths = headers.map((header, index) =>
    Math.max(header.length, row[index]?.length ?? 0),
  );
  console.log(
    headers.map((header, index) => header.padEnd(widths[index]!)).join("  "),
  );
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  console.log(row.map((value, index) => value.padEnd(widths[index]!)).join("  "));
}
