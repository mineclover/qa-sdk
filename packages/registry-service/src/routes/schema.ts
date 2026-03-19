import { Hono } from "hono";
import type { RegistryService } from "../lib/registry-service.js";
import { analyze } from "../lib/draft-workspace.js";
import { importSchema, exportQuerySchema, diffQuerySchema, type SchemaSnapshot } from "../schemas/schema-snapshot.js";
import { badRequest } from "../lib/errors.js";

export interface SchemaRouteDeps {
  service: RegistryService;
}

export function createSchemaRoutes(deps: SchemaRouteDeps) {
  const routes = new Hono();
  const { service } = deps;

  // ── POST /schema/import ───────────────────────────────────
  routes.post("/schema/import", async (c) => {
    const body = importSchema.parse(await c.req.json());
    const { snapshot, versionId } = body;

    // 0. 사전 검증 — 변경 전에 구조적 무결성 확인
    validateSnapshot(snapshot);

    // 1. Leaf prefix 등록 + draft 생성
    for (const axis of snapshot.axes) {
      const existing = await service.ownerStore.get(axis.id);
      if (!existing) {
        await service.registerPrefix({
          prefix: axis.id,
          owner: "schema-import",
          kind: "leaf",
          numberType: "number",
        });
      }

      // draft가 없으면 생성
      const ver = await service.versionStore.getVersion(axis.id, versionId);
      if (!ver) {
        await service.createDraft({
          prefix: axis.id,
          versionId,
          baseVersionId: null,
          capacity: axis.capacity,
        });
      }
    }

    // 2. Composite prefix 등록 + draft 생성
    for (const comp of snapshot.composites) {
      const existing = await service.ownerStore.get(comp.id);
      if (!existing) {
        await service.registerPrefix({
          prefix: comp.id,
          owner: comp.owner,
          kind: "composite",
          numberType: "number",
        });
      }

      const ver = await service.versionStore.getVersion(comp.id, versionId);
      if (!ver) {
        const refs = comp.dims.map((dim) => ({ prefix: dim, versionId }));
        await service.createDraft({
          prefix: comp.id,
          versionId,
          baseVersionId: null,
          capacity: 0,
          refs,
        });
      }
    }

    // 3. Analyze
    const result = await analyze(
      service.prefixRegistry,
      service.versionStore,
      service.ownerStore,
      (p, v) => service.isLocked(p, v),
    );

    return c.json({
      imported: {
        axes: snapshot.axes.length,
        composites: snapshot.composites.length,
        versionId,
      },
      analysis: result,
    }, 201);
  });

  // ── GET /schema/export ────────────────────────────────────
  routes.get("/schema/export", async (c) => {
    const query = exportQuerySchema.parse(c.req.query());
    const snapshot = await exportSchema(service, query.versionId);
    return c.json(snapshot);
  });

  // ── GET /schema/diff ──────────────────────────────────────
  routes.get("/schema/diff", async (c) => {
    const query = diffQuerySchema.parse(c.req.query());
    const result = await service.diffVersions(query.from, query.to);
    return c.json(result);
  });

  return routes;
}

/** snapshot 구조 사전 검증 — 변경 없이 무결성만 확인 */
function validateSnapshot(snapshot: SchemaSnapshot): void {
  const axisIds = new Set(snapshot.axes.map((a) => a.id));
  const compIds = new Set(snapshot.composites.map((c) => c.id));
  const allIds = new Set([...axisIds, ...compIds]);

  // ID 중복 체크
  if (axisIds.size + compIds.size !== allIds.size) {
    const overlap = [...axisIds].filter((id) => compIds.has(id));
    throw badRequest(`Axis와 composite 사이에 ID 중복: ${overlap.join(", ")}`);
  }

  // composite dims가 snapshot 내 존재하는 ID를 참조하는지
  for (const comp of snapshot.composites) {
    for (const dim of comp.dims) {
      if (!allIds.has(dim)) {
        throw badRequest(`Composite '${comp.id}'의 dim '${dim}'이 snapshot에 없음`);
      }
    }
  }

  // 순환참조 사전 감지 (DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const compMap = new Map(snapshot.composites.map((c) => [c.id, c]));

  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw badRequest(`순환참조 감지: ${[...path, id].join(" → ")}`);
    }
    visiting.add(id);
    const comp = compMap.get(id);
    if (comp) {
      for (const dim of comp.dims) {
        visit(dim, [...path, id]);
      }
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const comp of snapshot.composites) {
    visit(comp.id, []);
  }
}

async function exportSchema(
  service: RegistryService,
  versionId?: string,
): Promise<SchemaSnapshot> {
  const prefixes = await service.listPrefixes();
  const axes: SchemaSnapshot["axes"] = [];
  const composites: SchemaSnapshot["composites"] = [];

  for (const p of prefixes) {
    let ver: { versionId: string; capacity: number } | null = null;

    if (versionId) {
      try {
        const v = await service.getVersion(p.prefix, versionId);
        ver = { versionId: v.versionId, capacity: v.capacity };
      } catch {
        // no such version for this prefix
      }
    } else {
      // active version fallback
      const active = await service.versionStore.getActive(p.prefix);
      if (active) ver = { versionId: active.versionId, capacity: active.capacity };
    }

    if (!ver) continue;

    if (p.kind === "leaf") {
      axes.push({ id: p.prefix, entries: [], capacity: ver.capacity });
    } else {
      const deps = await service.getDeps(p.prefix, ver.versionId);
      composites.push({
        id: p.prefix,
        dims: deps.map((d) => d.prefix),
        owner: p.owner,
      });
    }
  }

  return {
    id: versionId ?? "active",
    axes,
    composites,
  };
}
