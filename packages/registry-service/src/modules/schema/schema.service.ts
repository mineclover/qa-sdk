import { Inject, Injectable } from "@nestjs/common";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import { RegistryService } from "../../lib/registry-service.js";
import { analyze } from "../../lib/draft-workspace.js";
import { badRequest } from "../../lib/errors.js";
import {
  importSchema,
  type SchemaSnapshot,
} from "../../schemas/schema-snapshot.js";

@Injectable()
export class SchemaService {
  constructor(
    @Inject(REGISTRY_SERVICE) private readonly registry: RegistryService,
  ) {}

  async importSchema(input: unknown) {
    const body = importSchema.parse(input);
    const { snapshot, versionId } = body;

    this.validateSnapshot(snapshot);

    for (const axis of snapshot.axes) {
      const existing = await this.registry.ownerStore.get(axis.id);
      if (!existing) {
        await this.registry.registerPrefix({
          prefix: axis.id,
          owner: "schema-import",
          kind: "leaf",
          numberType: "number",
        });
      }

      const version = await this.registry.versionStore.getVersion(axis.id, versionId);
      if (!version) {
        await this.registry.createDraft({
          prefix: axis.id,
          versionId,
          baseVersionId: null,
          capacity: axis.capacity,
        });
      }
    }

    for (const composite of snapshot.composites) {
      const existing = await this.registry.ownerStore.get(composite.id);
      if (!existing) {
        await this.registry.registerPrefix({
          prefix: composite.id,
          owner: composite.owner,
          kind: "composite",
          numberType: "number",
        });
      }

      const version = await this.registry.versionStore.getVersion(composite.id, versionId);
      if (!version) {
        await this.registry.createDraft({
          prefix: composite.id,
          versionId,
          baseVersionId: null,
          capacity: 0,
          refs: composite.dims.map((dim) => ({ prefix: dim, versionId })),
        });
      }
    }

    const analysis = await analyze(
      this.registry.prefixRegistry,
      this.registry.versionStore,
      this.registry.ownerStore,
      (prefix, currentVersionId) => this.registry.isLocked(prefix, currentVersionId),
    );

    return {
      imported: {
        axes: snapshot.axes.length,
        composites: snapshot.composites.length,
        versionId,
      },
      analysis,
    };
  }

  exportSchema(versionId?: string) {
    return this.buildSchemaSnapshot(versionId);
  }

  diff(fromVersionId: string, toVersionId: string) {
    return this.registry.diffVersions(fromVersionId, toVersionId);
  }

  private validateSnapshot(snapshot: SchemaSnapshot) {
    const axisIds = new Set(snapshot.axes.map((axis) => axis.id));
    const compositeIds = new Set(snapshot.composites.map((composite) => composite.id));
    const allIds = new Set([...axisIds, ...compositeIds]);

    if (axisIds.size + compositeIds.size !== allIds.size) {
      const overlap = [...axisIds].filter((id) => compositeIds.has(id));
      throw badRequest(`Axis와 composite 사이에 ID 중복: ${overlap.join(", ")}`);
    }

    for (const composite of snapshot.composites) {
      for (const dim of composite.dims) {
        if (!allIds.has(dim)) {
          throw badRequest(`Composite '${composite.id}'의 dim '${dim}'이 snapshot에 없음`);
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const compositeMap = new Map(snapshot.composites.map((composite) => [composite.id, composite]));

    const visit = (id: string, path: string[]) => {
      if (visited.has(id)) {
        return;
      }
      if (visiting.has(id)) {
        throw badRequest(`순환참조 감지: ${[...path, id].join(" → ")}`);
      }

      visiting.add(id);
      const composite = compositeMap.get(id);
      if (composite) {
        for (const dim of composite.dims) {
          visit(dim, [...path, id]);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const composite of snapshot.composites) {
      visit(composite.id, []);
    }
  }

  private async buildSchemaSnapshot(versionId?: string): Promise<SchemaSnapshot> {
    const prefixes = await this.registry.listPrefixes();
    const axes: SchemaSnapshot["axes"] = [];
    const composites: SchemaSnapshot["composites"] = [];

    for (const prefix of prefixes) {
      let version: { versionId: string; capacity: number } | null = null;

      if (versionId) {
        try {
          const current = await this.registry.getVersion(prefix.prefix, versionId);
          version = { versionId: current.versionId, capacity: current.capacity };
        } catch {
          version = null;
        }
      } else {
        const active = await this.registry.versionStore.getActive(prefix.prefix);
        if (active) {
          version = { versionId: active.versionId, capacity: active.capacity };
        }
      }

      if (!version) {
        continue;
      }

      if (prefix.kind === "leaf") {
        axes.push({ id: prefix.prefix, entries: [], capacity: version.capacity });
        continue;
      }

      const deps = await this.registry.getDeps(prefix.prefix, version.versionId);
      composites.push({
        id: prefix.prefix,
        dims: deps.map((dep) => dep.prefix),
        owner: prefix.owner,
      });
    }

    return {
      id: versionId ?? "active",
      axes,
      composites,
    };
  }
}
