#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSnapshot, readSnapshots, writeOutput } from "../dist/index.js";

const tempDir = await mkdtemp(join(tmpdir(), "snapshot-io-"));

try {
  const snapshot = {
    id: "demo-snapshot",
    axes: [
      { id: "role", entries: ["admin", "viewer"], capacity: 4 },
      { id: "action", entries: ["read", "write"], capacity: 4 },
    ],
    composites: [
      { id: "permission", dims: ["role", "action"], owner: "snapshot-io-smoke" },
    ],
  };

  const snapshotPath = join(tempDir, "nested", "demo.json");
  await writeOutput(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  assert.deepEqual(await readSnapshot(snapshotPath), snapshot);

  const sibling = {
    id: "service-snapshot",
    axes: [{ id: "env", entries: ["dev", "prod"], capacity: 4 }],
    composites: [{ id: "service", dims: ["env"], owner: "snapshot-io-smoke" }],
  };
  const siblingPath = join(tempDir, "nested", "service.json");
  await writeOutput(siblingPath, JSON.stringify(sibling));

  const snapshots = await readSnapshots(join(tempDir, "nested"));
  assert.deepEqual(
    snapshots.map((item) => item.id).sort(),
    ["demo-snapshot", "service-snapshot"],
  );

  await writeOutput(
    join(tempDir, "invalid-duplicate-axis.json"),
    JSON.stringify({
      id: "bad",
      axes: [
        { id: "role", entries: ["admin"], capacity: 2 },
        { id: "role", entries: ["viewer"], capacity: 2 },
      ],
      composites: [{ id: "permission", dims: ["role"], owner: "snapshot-io-smoke" }],
    }),
  );
  await assert.rejects(
    () => readSnapshot(join(tempDir, "invalid-duplicate-axis.json")),
    /axis ID 중복/,
  );

  await writeOutput(
    join(tempDir, "invalid-missing-dim.json"),
    JSON.stringify({
      id: "bad",
      axes: [{ id: "role", entries: ["admin"], capacity: 2 }],
      composites: [{ id: "permission", dims: ["missing"], owner: "snapshot-io-smoke" }],
    }),
  );
  await assert.rejects(
    () => readSnapshot(join(tempDir, "invalid-missing-dim.json")),
    /axes에 없음/,
  );

  console.log("snapshot-io smoke passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
