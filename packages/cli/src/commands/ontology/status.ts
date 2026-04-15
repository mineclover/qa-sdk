import {
  diffLatestOperationalOntologySnapshotsByScope,
  listOperationalOntologySnapshotProjections,
  loadLatestOperationalOntologySnapshotViewByScope,
  loadOperationalOntologySnapshotView,
} from "operational-ontology/persistence";

import {
  getStorePath,
  loadStore,
  parseFlags,
  printJson,
  printTable,
} from "./support.js";

export async function cmdSnapshotList(rest: string[]): Promise<void> {
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

export async function cmdStatus(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const scope = flags["scope"];
  const snapshotId = flags["snapshot"];
  if (!scope && !snapshotId) {
    console.error(
      "Usage: qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = snapshotId
    ? await loadOperationalOntologySnapshotView(store, snapshotId)
    : await loadLatestOperationalOntologySnapshotViewByScope(store, scope!);

  if (!view) {
    console.error(`Ontology status 없음: ${snapshotId ?? scope}`);
    process.exitCode = 1;
    return;
  }

  const resolvedScope = scope ?? view.snapshotProjection.targetScope;
  const [latestDiff, projections] = resolvedScope
    ? await Promise.all([
        snapshotId
          ? Promise.resolve(null)
          : diffLatestOperationalOntologySnapshotsByScope(store, resolvedScope),
        listOperationalOntologySnapshotProjections(store, resolvedScope),
      ])
    : [null, []];

  const status = {
    scope: resolvedScope ?? null,
    snapshotId: view.snapshotProjection.projectionId,
    builtAt: view.snapshotProjection.builtAt,
    snapshotCount: projections.length,
    topologyValid: view.snapshot.topologyValidation?.valid ?? null,
    corridors: view.corridors.length,
    controlFlows: view.controlFlows.length,
    checkpointLattices: view.checkpointLattices.length,
    junctions: view.junctions.length,
    routeDecisions: view.routeDecisions.length,
    traversals: view.traversalBundles.length,
    latestDiff: latestDiff
      ? {
          fromSnapshotId: latestDiff.fromSnapshotId,
          toSnapshotId: latestDiff.toSnapshotId,
          summary: latestDiff.summary,
        }
      : null,
  };

  if (flags["json"] === "true") {
    printJson(status);
    return;
  }

  if (flags["table"] === "true") {
    printTable(
      [
        "scope",
        "snapshot",
        "builtAt",
        "snapshots",
        "topology",
        "corridors",
        "flows",
        "checkpoints",
        "junctions",
        "routes",
        "traversals",
      ],
      [
        status.scope ?? "-",
        status.snapshotId,
        status.builtAt,
        String(status.snapshotCount),
        String(status.topologyValid),
        String(status.corridors),
        String(status.controlFlows),
        String(status.checkpointLattices),
        String(status.junctions),
        String(status.routeDecisions),
        String(status.traversals),
      ],
    );

    if (status.latestDiff) {
      console.log("");
      printTable(
        ["diff_from", "diff_to", "added", "removed", "changed", "unchanged"],
        [
          status.latestDiff.fromSnapshotId,
          status.latestDiff.toSnapshotId,
          String(status.latestDiff.summary.added),
          String(status.latestDiff.summary.removed),
          String(status.latestDiff.summary.changed),
          String(status.latestDiff.summary.unchanged),
        ],
      );
    }
    return;
  }

  console.log(`Ontology status: ${status.scope ?? status.snapshotId}`);
  console.log(`  snapshot: ${status.snapshotId}`);
  console.log(`  builtAt: ${status.builtAt}`);
  console.log(`  snapshots: ${status.snapshotCount}`);
  console.log(`  topology valid: ${status.topologyValid}`);
  console.log(
    `  corridors=${status.corridors} controlFlows=${status.controlFlows} checkpointLattices=${status.checkpointLattices}`,
  );
  console.log(
    `  junctions=${status.junctions} routeDecisions=${status.routeDecisions} traversals=${status.traversals}`,
  );
  if (status.latestDiff) {
    console.log(
      `  latest diff: ${status.latestDiff.fromSnapshotId} -> ${status.latestDiff.toSnapshotId}`,
    );
    console.log(
      `    added=${status.latestDiff.summary.added} removed=${status.latestDiff.summary.removed} changed=${status.latestDiff.summary.changed} unchanged=${status.latestDiff.summary.unchanged}`,
    );
  }
}

export async function cmdSnapshotShow(rest: string[]): Promise<void> {
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
