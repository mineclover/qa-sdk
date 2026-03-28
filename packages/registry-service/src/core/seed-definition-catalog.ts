/**
 * DEFINITION_CATALOG seed — definition-catalog의 축/prefix를 registry에 등록
 *
 * DEMO_CATALOG(demo)과 별도의 catalog ID("definition")로 등록한다.
 * 축 5개: def_scope, def_aspect, def_depth, def_lifecycle, link_type
 * prefix 2개: def_document, def_link
 */

import { createHash } from "node:crypto";
import type { DefinitionCatalog } from "definition-catalog";
import type { AxisProfileStore } from "../stores/axis-profile-store.js";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { SeedLogger } from "./types.js";

const CATALOG_ID = "definition";

const noopLogger: SeedLogger = { info() {}, warn() {}, debug() {} };

function contentHash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function seedDefinitionCatalog(
  catalogStore: CatalogStore,
  axisStore?: AxisProfileStore,
  logger: SeedLogger = noopLogger,
) {
  try {
    const { DEFINITION_CATALOG } = await import("definition-catalog") as { DEFINITION_CATALOG: DefinitionCatalog };

    const catalogJson = JSON.stringify(DEFINITION_CATALOG);
    const newHash = contentHash(catalogJson);
    const now = new Date().toISOString();

    const existing = await catalogStore.get(CATALOG_ID);

    if (existing) {
      const existingHash = contentHash(existing.data);
      if (existingHash === newHash) {
        logger.info("DEFINITION_CATALOG unchanged — skipping seed");
        return;
      }

      await catalogStore.update(CATALOG_ID, "소프트웨어 정의 카탈로그", catalogJson);
      logger.info(
        { oldHash: existingHash.slice(0, 8), newHash: newHash.slice(0, 8) },
        "DEFINITION_CATALOG updated (hash changed)",
      );
    } else {
      await catalogStore.register({
        id: CATALOG_ID,
        name: "소프트웨어 정의 카탈로그",
        data: catalogJson,
        createdAt: now,
        updatedAt: now,
      });
      logger.info("seeded DEFINITION_CATALOG to catalog store");
    }

    // 축 프로필 동기화
    if (axisStore) {
      for (const [id, axis] of Object.entries(DEFINITION_CATALOG.axes)) {
        const versions = Object.keys(axis.versions);
        const latest = versions[versions.length - 1];
        const snap = axis.versions[latest] as { entries?: readonly string[]; capacity?: number } | undefined;

        const existingAxis = await axisStore.get(id, CATALOG_ID);
        if (existingAxis) {
          await axisStore.patch(id, CATALOG_ID, {
            name: axis.name,
            currentVersion: latest ?? "v1",
            capacity: snap?.capacity ?? 32,
            entryCount: snap?.entries?.length ?? 0,
          });
        } else {
          try {
            await axisStore.register({
              id,
              catalogId: CATALOG_ID,
              name: axis.name,
              currentVersion: latest ?? "v1",
              capacity: snap?.capacity ?? 32,
              entryCount: snap?.entries?.length ?? 0,
              updatedAt: now,
            });
          } catch { /* 중복 무시 */ }
        }
      }
      logger.info(
        { axes: Object.keys(DEFINITION_CATALOG.axes).length, catalogId: CATALOG_ID },
        "seeded definition axis profiles",
      );
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to seed DEFINITION_CATALOG — skipped",
    );
  }
}
