import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { createLogger } from "../../lib/logger.js";
import { DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import { SqlPrefixStore, type PrefixStore, type PrefixRecord } from "../../stores/prefix-store.js";
import { documents } from "../../db/schema.js";
import { env } from "../../config/env.js";

const logger = createLogger("definition-service");

/** registry-service /catalogs/:id 응답에서 prefix 구조 */
interface CatalogPrefixDef {
  id: string;
  name: string;
  description?: string;
  labels: string[];
  dims: Record<string, { kind: string; axisId?: string; prefixId?: string }>;
  versions: { version: string; axisVersions: Record<string, string> }[];
  meta?: { category?: string } & Record<string, unknown>;
}

@Injectable()
export class PrefixesService implements OnModuleInit {
  private readonly store: PrefixStore;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DefinitionServiceDatabase,
  ) {
    this.store = new SqlPrefixStore(db);
  }

  /**
   * 시작 시 registry-service에서 prefix 공급받아 seed.
   *
   * 흐름: registry-service:3300/catalogs/demo → JSON parse → prefix_registry DB seed
   * registry-service가 꺼져있으면 경고만 출력하고 기존 DB 데이터로 운영 (fail-open).
   */
  async onModuleInit() {
    try {
      const catalogUrl = `${env.REGISTRY_URL}/catalogs/${env.CATALOG_ID}`;
      const res = await fetch(catalogUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "registry-service 응답 실패 — prefix seed 건너뜀");
        return;
      }

      const record = await res.json() as { data: string };
      const catalog = JSON.parse(record.data) as {
        prefixes?: Record<string, CatalogPrefixDef>;
      };

      if (!catalog.prefixes) {
        logger.warn("카탈로그에 prefixes 없음");
        return;
      }

      const prefixes = Object.values(catalog.prefixes);
      let created = 0;
      let updated = 0;

      for (const p of prefixes) {
        const depPrefixIds = Object.values(p.dims)
          .filter((d): d is { kind: "prefix_ref"; prefixId: string } => d.kind === "prefix_ref")
          .map(d => d.prefixId);

        const versions = (p.versions ?? []).map(v => ({
          version: v.version,
          axisVersions: v.axisVersions,
        }));

        const { action } = this.store.upsert({
          prefixId: p.id,
          name: p.name,
          description: p.description,
          category: p.meta?.category,
          labels: [...p.labels],
          dims: p.dims as PrefixRecord["dims"],
          versions,
          meta: (p.meta ?? {}) as Record<string, unknown>,
          depPrefixIds,
          version: 0,
          registeredAt: "",
          updatedAt: "",
        });

        if (action === "created") created++;
        else if (action === "updated") updated++;
      }

      logger.info({ catalogId: env.CATALOG_ID, created, updated, total: prefixes.length }, "prefix seed 완료");
    } catch (err) {
      // registry 실패 → DB에 이미 데이터가 있으면 그대로 사용
      const existing = this.store.list();
      if (existing.length > 0) {
        logger.warn({ cached: existing.length }, "registry fetch 실패 — DB 캐시로 운영");
        return;
      }

      // DB도 비어있으면 에러 로그만 출력. fallback 없음.
      logger.error({ err, registryUrl: env.REGISTRY_URL }, "registry fetch 실패 + DB 캐시 없음 — prefix 0건");
    }
  }

  list(filter?: { category?: string }): PrefixRecord[] {
    return this.store.list(filter);
  }

  get(prefixId: string): PrefixRecord | null {
    return this.store.get(prefixId);
  }

  /** prefix의 의존 체인 (prefix_ref 재귀 해석) */
  getDependencyChain(prefixId: string): string[] {
    const visited = new Set<string>();
    const chain: string[] = [];
    const walk = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const p = this.store.get(id);
      if (!p) return;
      for (const dep of p.depPrefixIds) {
        chain.push(dep);
        walk(dep);
      }
    };
    walk(prefixId);
    return chain;
  }

  /** prefix를 의존하는 역방향 목록 */
  getDependents(prefixId: string): PrefixRecord[] {
    const all = this.store.list();
    return all.filter(p => p.depPrefixIds.includes(prefixId));
  }

  upsert(record: PrefixRecord): { action: string } {
    return this.store.upsert(record);
  }

  remove(prefixId: string): boolean {
    return this.store.remove(prefixId);
  }

  /** prefix에 연결된 definition 문서 확인 (target_prefix 컬럼) */
  getDocByPrefix(prefixId: string): boolean {
    const row = this.db
      .select({ docId: documents.docId })
      .from(documents)
      .where(
        and(
          eq(documents.targetPrefix, prefixId),
          eq(documents.lifecycle, "approved"),
        ),
      )
      .limit(1)
      .get();
    return !!row;
  }
}
