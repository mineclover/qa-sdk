// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from "vitest";
import { InMemoryServiceComponentVersionStore } from "../../stores/in-memory-service-component-version-store.js";
import type { ManifestService } from "../manifests/manifest.service.js";
import { ServiceComponentService } from "./service-component.service.js";

describe("ServiceComponentService", () => {
  it("component version을 저장하고 조회한다", async () => {
    const service = ServiceComponentService.fromStore(new InMemoryServiceComponentVersionStore());

    await expect(service.upsert("demo", "service-unit", "gateway", "su-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
      tier: "system",
    })).resolves.toEqual({
      ok: true,
      kind: "service-unit",
      serviceId: "gateway",
      version: "su-v1",
      state: "draft",
    });

    await expect(service.get("demo", "service-unit", "gateway", "su-v1")).resolves.toMatchObject({
      kind: "service-unit",
      serviceId: "gateway",
      version: "su-v1",
      state: "draft",
      value: {
        serviceId: "gateway",
        namespace: "shop",
        name: "Gateway",
      },
    });
  });

  it("kind별 버전 목록을 반환한다", async () => {
    const service = ServiceComponentService.fromStore(new InMemoryServiceComponentVersionStore());

    await service.upsert("demo", "runtime-address", "gateway", "ra-v2", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
      env: "prod",
      region: "asia",
    });
    await service.upsert("demo", "runtime-address", "gateway", "ra-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
      env: "dev",
      region: "asia",
    });

    await expect(service.listVersions("demo", "runtime-address", "gateway")).resolves.toMatchObject([
      { version: "ra-v1", state: "draft" },
      { version: "ra-v2", state: "draft" },
    ]);
  });

  it("published component는 수정할 수 없고 transition으로만 상태를 바꾼다", async () => {
    const service = ServiceComponentService.fromStore(new InMemoryServiceComponentVersionStore());

    await service.upsert("demo", "service-unit", "gateway", "su-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
    });
    await expect(service.transition("demo", "service-unit", "gateway", "su-v1", "published")).resolves.toMatchObject({
      state: "published",
    });
    await expect(service.upsert("demo", "service-unit", "gateway", "su-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway 2",
    })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("active manifest가 참조 중인 component는 archived로 내릴 수 없다", async () => {
    const manifests = {
      findActiveManifestForComponent: async () => ({
        serviceId: "gateway",
        manifestVersion: "1.0.0",
      }),
    } as unknown as ManifestService;
    const service = ServiceComponentService.fromStore(
      new InMemoryServiceComponentVersionStore(),
      manifests,
    );

    await service.upsert("demo", "service-unit", "gateway", "su-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
    });
    await service.transition("demo", "service-unit", "gateway", "su-v1", "published");
    await service.transition("demo", "service-unit", "gateway", "su-v1", "deprecated");

    await expect(
      service.transition("demo", "service-unit", "gateway", "su-v1", "archived"),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("assembly candidates는 published와 제외 사유를 함께 반환한다", async () => {
    const service = ServiceComponentService.fromStore(new InMemoryServiceComponentVersionStore());

    await service.upsert("demo", "service-unit", "gateway", "su-v1", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
    });
    await service.upsert("demo", "service-unit", "gateway", "su-v2", {
      serviceId: "gateway",
      namespace: "shop",
      name: "Gateway",
    });
    await service.transition("demo", "service-unit", "gateway", "su-v2", "published");

    const candidates = await service.getAssemblyCandidates("demo", "gateway");
    expect(candidates).toMatchObject({
      serviceId: "gateway",
      required: {
        "service-unit": {
          published: [{ version: "su-v2", state: "published" }],
          excluded: [
            {
              version: "su-v1",
              state: "draft",
              reason: "Not assembly-ready: publish required",
            },
          ],
        },
      },
      readiness: {
        ready: false,
        missingRequired: ["ownership", "runtime-address"],
      },
      summary: {
        published: {
          required: 1,
          optional: 0,
        },
        excluded: {
          draft: 1,
          deprecated: 0,
          archived: 0,
        },
      },
    });
  });
});
