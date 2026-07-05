#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isCatalog,
  isDkgConfig,
  loadCatalog,
  loadDkgConfig,
} from "../dist/index.js";

const originalCwd = process.cwd();
const tempDir = await mkdtemp(join(tmpdir(), "config-loader-"));

const catalog = {
  id: "smoke-catalog",
  name: "Smoke Catalog",
  axes: {
    role: { id: "role", name: "Role", versions: { v1: { entries: ["admin", "viewer"] } } },
  },
  prefixes: {
    permission: {
      id: "permission",
      name: "Permission",
      labels: ["role"],
      dims: { role: { kind: "axis", axisId: "role" } },
      versions: [{ version: "v1", axisVersions: { role: "v1" } }],
    },
  },
};

const dkgConfig = {
  domains: [],
  consumers: [],
  constraints: [],
  dslBundles: [],
  intentLinks: [],
  skills: [],
};

try {
  assert.equal(isCatalog(catalog), true);
  assert.equal(isCatalog({ id: "missing-shape" }), false);
  assert.equal(isDkgConfig(dkgConfig), true);
  assert.equal(isDkgConfig({ domains: [] }), false);

  await writeFile(join(tempDir, "catalog.json"), JSON.stringify(catalog), "utf8");
  await writeFile(join(tempDir, "dkg.json"), JSON.stringify(dkgConfig), "utf8");
  await writeFile(
    join(tempDir, "catalog.mjs"),
    `export const CUSTOM_CATALOG = ${JSON.stringify(catalog)};\n`,
    "utf8",
  );
  await writeFile(
    join(tempDir, "qa-sdk.config.mjs"),
    `export default { catalog: "./catalog.json", dkgConfig: "./dkg.json" };\n`,
    "utf8",
  );

  process.chdir(tempDir);

  assert.equal((await loadCatalog("catalog.json")).id, "smoke-catalog");
  assert.equal((await loadCatalog("catalog.mjs")).id, "smoke-catalog");
  assert.deepEqual(await loadDkgConfig("dkg.json"), dkgConfig);

  await writeFile(
    join(tempDir, "qa-sdk.config.js"),
    `export default { catalog: "./catalog.json", dkgConfig: "./dkg.json" };\n`,
    "utf8",
  );
  assert.equal((await loadCatalog()).id, "smoke-catalog");
  assert.deepEqual(await loadDkgConfig(), dkgConfig);

  await writeFile(join(tempDir, "bad-catalog.json"), JSON.stringify({ id: "bad" }), "utf8");
  await assert.rejects(
    () => loadCatalog("bad-catalog.json"),
    /카탈로그 JSON 형식이 올바르지 않습니다/,
  );

  await writeFile(join(tempDir, "bad-dkg.json"), JSON.stringify({ domains: [] }), "utf8");
  await assert.rejects(
    () => loadDkgConfig("bad-dkg.json"),
    /DkgConfig JSON 형식이 올바르지 않습니다/,
  );

  console.log("config-loader smoke passed");
} finally {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
}
