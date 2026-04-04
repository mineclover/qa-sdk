import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";
import { InMemoryServiceComponentVersionStore } from "../../stores/in-memory-service-component-version-store.js";
import type { SqliteManifestRegistry } from "pipe-store-sqlite";
import { ServiceComponentStore } from "../services/service-component-store.js";
import {
  createManifestAssemblyContract,
  normalizeAssembleManifestBody,
  toServiceManifestOptions,
  validateAssembleManifestBody,
} from "./manifest-assembly.js";
import { ManifestService } from "./manifest.service.js";

describe("manifest assembly helpers", () => {
  it("prefixes와 runtimeAddress를 복제해 normalize한다", () => {
    const prefixes = { tracking: "v1" };
    const runtimeAddress = {
      serviceId: "order-svc",
      namespace: "shop",
      name: "order",
      env: "prod",
      region: "asia",
    };

    const normalized = normalizeAssembleManifestBody({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes,
      runtimeAddress,
    });

    expect(normalized.prefixes).toEqual(prefixes);
    expect(normalized.prefixes).not.toBe(prefixes);
    expect(normalized.runtimeAddress).toEqual(runtimeAddress);
    expect(normalized.runtimeAddress).not.toBe(runtimeAddress);
  });

  it("runtimeAddress.serviceId mismatch를 거부한다", () => {
    expect(() => validateAssembleManifestBody({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
      runtimeAddress: {
        serviceId: "other-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    })).toThrow(AppError);
  });

  it("manifest store options로 변환한다", () => {
    expect(toServiceManifestOptions({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
      runtimeAddressVersion: "ra-1",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      exposureVersion: "exp-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    })).toEqual({
      runtimeAddressVersion: "ra-1",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      exposureVersion: "exp-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    });
  });

  it("동일 child version 조합 + 동일 prefix pin이면 동일 semanticsKey를 만든다", () => {
    const first = createManifestAssemblyContract({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      runtimeAddressVersion: "ra-1",
      prefixes: { tracking: "v1", endpoint: "v2" },
      changelog: "first",
    });
    const second = createManifestAssemblyContract({
      serviceId: "order-svc",
      manifestVersion: "2.0.0",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      runtimeAddressVersion: "ra-1",
      prefixes: { endpoint: "v2", tracking: "v1" },
      changelog: "second",
    });

    expect(first.semanticsKey).toBe(second.semanticsKey);
    expect(first.normalizedPrefixes).toEqual({
      endpoint: "v2",
      tracking: "v1",
    });
  });
});

describe("ManifestService assembleManifest", () => {
  it("validated metadata를 registry createManifest로 전달한다", async () => {
    const createManifest = vi.fn().mockReturnValue({ ok: true });
    const service = new ManifestService({
      createManifest,
      getPrefixRecord: vi.fn(),
    } as unknown as SqliteManifestRegistry);

    const result = await service.assembleManifest({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
      changelog: "assembled",
    });

    expect(result).toEqual({ ok: true });
    expect(createManifest).toHaveBeenCalledWith(
      "order-svc",
      "1.0.0",
      { tracking: "v1" },
      "assembled",
      {
        serviceUnitVersion: "su-1",
        ownershipVersion: "own-1",
        deploymentVersion: "dep-1",
        runtimeAddress: {
          serviceId: "order-svc",
          namespace: "shop",
          name: "order",
          env: "prod",
          region: "asia",
        },
      },
    );
  });

  it("runtimeAddressVersion이 있으면 component store에서 runtimeAddress를 resolve한다", async () => {
    const componentStore = new InMemoryServiceComponentVersionStore();
    const components = new ServiceComponentStore(componentStore);
    await components.upsert("demo", {
      kind: "service-unit",
      serviceId: "order-svc",
      version: "su-1",
      state: "published",
      value: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "Order",
      },
    });
    await components.upsert("demo", {
      kind: "ownership",
      serviceId: "order-svc",
      version: "own-1",
      state: "published",
      value: {
        serviceId: "order-svc",
        ownedPrefixes: ["tracking"],
      },
    });
    await components.upsert("demo", {
      kind: "runtime-address",
      serviceId: "order-svc",
      version: "ra-1",
      state: "published",
      value: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    });

    const createManifest = vi.fn().mockReturnValue({ ok: true });
    const service = new ManifestService(
      {
        createManifest,
        getPrefixRecord: vi.fn(),
      } as unknown as SqliteManifestRegistry,
      componentStore,
    );

    await expect(service.assembleManifest({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      runtimeAddressVersion: "ra-1",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      prefixes: { tracking: "v1" },
    })).resolves.toEqual({ ok: true });

    expect(createManifest).toHaveBeenCalledWith(
      "order-svc",
      "1.0.0",
      { tracking: "v1" },
      undefined,
      {
        runtimeAddressVersion: "ra-1",
        serviceUnitVersion: "su-1",
        ownershipVersion: "own-1",
        runtimeAddress: {
          serviceId: "order-svc",
          namespace: "shop",
          name: "order",
          env: "prod",
          region: "asia",
        },
      },
    );
  });

  it("draft component는 assembly에서 거부된다", async () => {
    const componentStore = new InMemoryServiceComponentVersionStore();
    const components = new ServiceComponentStore(componentStore);
    await components.upsert("demo", {
      kind: "service-unit",
      serviceId: "order-svc",
      version: "su-1",
      value: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "Order",
      },
    });

    const service = new ManifestService(
      {
        createManifest: vi.fn(),
        getPrefixRecord: vi.fn(),
      } as unknown as SqliteManifestRegistry,
      componentStore,
    );

    await expect(service.assembleManifest({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      serviceUnitVersion: "su-1",
      prefixes: { tracking: "v1" },
    })).rejects.toMatchObject({
      code: "ASSEMBLY_VALIDATION_FAILED",
    });
  });

  it("ownership-owned prefix가 pin되지 않으면 validation diagnostic을 반환한다", async () => {
    const componentStore = new InMemoryServiceComponentVersionStore();
    const components = new ServiceComponentStore(componentStore);
    await components.upsert("demo", {
      kind: "ownership",
      serviceId: "order-svc",
      version: "own-1",
      state: "published",
      value: {
        serviceId: "order-svc",
        ownedPrefixes: ["tracking"],
      },
    });

    const service = new ManifestService(
      {
        getPrefixRecord: vi.fn(),
      } as unknown as SqliteManifestRegistry,
      componentStore,
    );

    await expect(service.validateManifestAssembly({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      ownershipVersion: "own-1",
      prefixes: {},
    })).resolves.toMatchObject({
      ready: false,
      qualityGate: {
        id: "manifest-assembly-compatibility",
        passed: false,
      },
      diagnostics: [
        expect.objectContaining({
          code: "OWNED_PREFIX_NOT_PINNED",
        }),
      ],
    });
  });
});
