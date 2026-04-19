// @def.boundary registry-system
// @def.doc registry-system

import { createHash } from "node:crypto";
import type { AxisProfileStore } from "../stores/axis-profile-store.js";
import type { CatalogStore } from "../stores/catalog-store.js";
import type { SeedLogger } from "./types.js";

/** 콘텐츠의 SHA-256 해시를 구한다 */
function contentHash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

/** axis 프로필을 catalog 기준으로 upsert (register 또는 patch) */
async function seedAxisProfiles(
  axisStore: AxisProfileStore,
  catalog: { axes: Record<string, { name: string; versions: Record<string, { entries?: readonly string[]; capacity?: number }> }> },
  logger: SeedLogger = noopLogger,
) {
  const now = new Date().toISOString();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latest = versions[versions.length - 1];
    const snap = (axis.versions as Record<string, { entries?: readonly string[]; capacity?: number }>)[latest];
    const existing = await axisStore.get(id, "demo");
    if (existing) {
      await axisStore.patch(id, "demo", {
        name: axis.name,
        currentVersion: latest ?? "v1",
        capacity: snap?.capacity ?? 32,
        entryCount: snap?.entries?.length ?? 0,
      });
    } else {
      try {
        await axisStore.register({
          id,
          catalogId: "demo",
          name: axis.name,
          currentVersion: latest ?? "v1",
          capacity: snap?.capacity ?? 32,
          entryCount: snap?.entries?.length ?? 0,
          updatedAt: now,
        });
      } catch { /* 중복 무시 */ }
    }
  }
  logger.info({ axes: Object.keys(catalog.axes).length }, "seeded axis profiles");
}

/** DEMO_CATALOG seed — 해시 비교 후 변경 시 자동 업데이트 (auto-reseed) */
export async function seedDemoCatalog(
  catalogStore: CatalogStore,
  axisStore?: AxisProfileStore,
  logger: SeedLogger = noopLogger,
) {
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    const catalogJson = JSON.stringify(DEMO_CATALOG);
    const newHash = contentHash(catalogJson);
    const now = new Date().toISOString();

    const existing = await catalogStore.get("demo");

    if (existing) {
      const existingHash = contentHash(existing.data);
      if (existingHash === newHash) {
        logger.info("DEMO_CATALOG unchanged — skipping seed");
        return;
      }

      // 해시가 다르면 catalog blob 업데이트
      await catalogStore.update("demo", DEMO_CATALOG.name ?? "쇼핑 데모", catalogJson);
      logger.info({ oldHash: existingHash.slice(0, 8), newHash: newHash.slice(0, 8) }, "DEMO_CATALOG updated (hash changed)");

      // axis 프로필도 재동기화
      if (axisStore) {
        await seedAxisProfiles(axisStore, DEMO_CATALOG, logger);
      }
      return;
    }

    // 신규 등록
    await catalogStore.register({
      id: "demo",
      name: DEMO_CATALOG.name ?? "쇼핑 데모",
      data: catalogJson,
      createdAt: now,
      updatedAt: now,
    });

    if (axisStore) {
      await seedAxisProfiles(axisStore, DEMO_CATALOG, logger);
    }

    logger.info("seeded DEMO_CATALOG to catalog store");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to seed DEMO_CATALOG — skipped",
    );
  }
}
