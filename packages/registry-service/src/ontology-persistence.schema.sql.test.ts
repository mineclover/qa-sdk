// @def.boundary registry-system
// @def.doc registry-system

/**
 * Ontology persistence SQL schema tests.
 *
 * Drizzle schema metadata가 아니라 registry-service migration으로 초기화한
 * SQLite DB에서 테이블 생성과 natural key 충돌을 검증한다.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRegistryDatabaseDriver } from "./bootstrap/stores.js";

const ONTOLOGY_TABLES = [
  "ontology_address_allocation",
  "ontology_address_segment",
  "ontology_axis",
  "ontology_namespace",
  "ontology_taxonomy",
] as const;

const DUPLICATE_KEY_ERROR =
  /UNIQUE constraint failed|constraint failed|SQLITE_CONSTRAINT/;

type RegistrySqliteDriver = Awaited<
  ReturnType<typeof createRegistryDatabaseDriver>
>;

const drivers: RegistrySqliteDriver[] = [];

async function createMigratedDb(): Promise<RegistrySqliteDriver> {
  const driver = await createRegistryDatabaseDriver(":memory:");
  drivers.push(driver);
  return driver;
}

afterEach(() => {
  while (drivers.length > 0) {
    drivers.pop()!.close();
  }
});

async function expectDuplicateRejected(
  driver: RegistrySqliteDriver,
  sql: string,
  firstParams: unknown[],
  duplicateParams: unknown[],
): Promise<void> {
  await driver.execute(sql, firstParams);
  await expect(driver.execute(sql, duplicateParams)).rejects.toThrow(
    DUPLICATE_KEY_ERROR,
  );
}

describe("Ontology persistence SQL schema", () => {
  it("creates the five ontology persistence tables from migrations", async () => {
    const driver = await createMigratedDb();

    const rows = await driver.query<{ name: string }>(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name IN (${ONTOLOGY_TABLES.map(() => "?").join(", ")})
       ORDER BY name`,
      [...ONTOLOGY_TABLES],
    );

    expect(rows.map((row) => row.name)).toEqual([...ONTOLOGY_TABLES].sort());
  });

  it("rejects duplicate ontology namespace values", async () => {
    const driver = await createMigratedDb();
    const insertNamespace = `
      INSERT INTO ontology_namespace (
        ontology_id, namespace, owner, lifecycle, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await expectDuplicateRejected(
      driver,
      insertNamespace,
      [
        "ontology-a",
        "qa.runtime",
        "registry",
        "draft",
        "2026-04-14T00:00:00.000Z",
        "2026-04-14T00:00:00.000Z",
      ],
      [
        "ontology-b",
        "qa.runtime",
        "registry",
        "draft",
        "2026-04-14T00:00:00.000Z",
        "2026-04-14T00:00:00.000Z",
      ],
    );
  });

  it("rejects duplicate ontology axis keys for ontology_id, axis_id, version_id", async () => {
    const driver = await createMigratedDb();
    const insertAxis = `
      INSERT INTO ontology_axis (
        ontology_id, axis_id, version_id, values_json, values_hash,
        capacity, lifecycle
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await expectDuplicateRejected(
      driver,
      insertAxis,
      ["ontology-a", "region", "v1", `["us","eu"]`, "hash-a", 4, "draft"],
      [
        "ontology-a",
        "region",
        "v1",
        `["us","eu","apac"]`,
        "hash-b",
        8,
        "active",
      ],
    );
  });

  it(
    "rejects duplicate ontology taxonomy keys for ontology_id, taxonomy_id, version_id",
    async () => {
      const driver = await createMigratedDb();
      const insertTaxonomy = `
        INSERT INTO ontology_taxonomy (
          ontology_id, taxonomy_id, version_id, applies_to_json,
          axis_ids_json, identity_axis_ids_json, space, lifecycle
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await expectDuplicateRejected(
        driver,
        insertTaxonomy,
        [
          "ontology-a",
          "service",
          "v1",
          `["service"]`,
          `["region"]`,
          `["region"]`,
          "runtime",
          "draft",
        ],
        [
          "ontology-a",
          "service",
          "v1",
          `["service","endpoint"]`,
          `["region","env"]`,
          `["region"]`,
          "platform",
          "active",
        ],
      );
    },
  );

  it("rejects duplicate address allocation keys for prefix, version_id", async () => {
    const driver = await createMigratedDb();
    const insertAllocation = `
      INSERT INTO ontology_address_allocation (
        allocation_id, ontology_id, taxonomy_id, prefix, version_id,
        address_model, capacity, address_offset, address_size, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await expectDuplicateRejected(
      driver,
      insertAllocation,
      [
        "allocation-a",
        "ontology-a",
        "taxonomy-a",
        "runtime_prefix",
        "v1",
        "product",
        16,
        0,
        16,
        "reserved",
      ],
      [
        "allocation-b",
        "ontology-b",
        "taxonomy-b",
        "runtime_prefix",
        "v1",
        "sum",
        32,
        16,
        32,
        "active",
      ],
    );
  });

  it(
    "rejects duplicate address allocation keys for ontology_id, taxonomy_id, version_id",
    async () => {
      const driver = await createMigratedDb();
      const insertAllocation = `
        INSERT INTO ontology_address_allocation (
          allocation_id, ontology_id, taxonomy_id, prefix, version_id,
          address_model, capacity, address_offset, address_size, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await expectDuplicateRejected(
        driver,
        insertAllocation,
        [
          "allocation-a",
          "ontology-a",
          "taxonomy-a",
          "runtime_prefix",
          "v1",
          "product",
          16,
          0,
          16,
          "reserved",
        ],
        [
          "allocation-b",
          "ontology-a",
          "taxonomy-a",
          "other_runtime_prefix",
          "v1",
          "sum",
          32,
          16,
          32,
          "active",
        ],
      );
    },
  );

  it("rejects duplicate address segment keys for allocation_id, segment_id", async () => {
    const driver = await createMigratedDb();
    const insertSegment = `
      INSERT INTO ontology_address_segment (
        allocation_id, segment_id, consumes_json, address_offset, address_size
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await expectDuplicateRejected(
      driver,
      insertSegment,
      ["allocation-a", "segment-a", `["region"]`, 0, 4],
      ["allocation-a", "segment-a", `["region","env"]`, 4, 8],
    );
  });
});
