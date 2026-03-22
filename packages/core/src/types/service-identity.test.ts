import { describe, expect, it } from "vitest";
import {
  toServiceDims,
  toTransmissionSource,
  toTransmissionBuild,
  catalogEnvToBuildEnv,
  buildEnvToCatalogEnv,
} from "./service-identity.js";
import type { ServiceBootConfig } from "./service-identity.js";

const boot: ServiceBootConfig = {
  namespace: "shop",
  name: "payment",
  env: "prod",
  region: "asia",
  build: "abc123",
  releaseVersion: "2026.03.22",
};

describe("toServiceDims", () => {
  it("name → svc_name 매핑", () => {
    expect(toServiceDims(boot)).toEqual({
      env: "prod",
      region: "asia",
      svc_name: "payment",
      namespace: "shop",
    });
  });
});

describe("toTransmissionSource", () => {
  it("service_name = namespace/name", () => {
    const src = toTransmissionSource(boot, "@qa-sdk/apm", "0.1.0");
    expect(src).toEqual({
      service_name: "shop/payment",
      sdk_name: "@qa-sdk/apm",
      sdk_version: "0.1.0",
    });
  });
});

describe("toTransmissionBuild", () => {
  it("env 정규화 + build/releaseVersion 전달", () => {
    const b = toTransmissionBuild(boot);
    expect(b).toEqual({
      env: "production",  // prod → production
      build_ref: "abc123",
      release_version: "2026.03.22",
    });
  });

  it("build/releaseVersion 미설정 시 생략", () => {
    const minimal: ServiceBootConfig = { namespace: "cms", name: "auth", env: "dev", region: "usa" };
    const b = toTransmissionBuild(minimal);
    expect(b).toEqual({ env: "dev" });
    expect(b).not.toHaveProperty("build_ref");
    expect(b).not.toHaveProperty("release_version");
  });
});

describe("catalogEnvToBuildEnv", () => {
  it("prod → production", () => expect(catalogEnvToBuildEnv("prod")).toBe("production"));
  it("stage → staging", () => expect(catalogEnvToBuildEnv("stage")).toBe("staging"));
  it("dev → dev (그대로)", () => expect(catalogEnvToBuildEnv("dev")).toBe("dev"));
  it("local → local (그대로)", () => expect(catalogEnvToBuildEnv("local")).toBe("local"));
  it("test → test (그대로)", () => expect(catalogEnvToBuildEnv("test")).toBe("test"));
});

describe("buildEnvToCatalogEnv", () => {
  it("production → prod", () => expect(buildEnvToCatalogEnv("production")).toBe("prod"));
  it("staging → stage", () => expect(buildEnvToCatalogEnv("staging")).toBe("stage"));
  it("dev → dev (그대로)", () => expect(buildEnvToCatalogEnv("dev")).toBe("dev"));
  it("local → local (그대로)", () => expect(buildEnvToCatalogEnv("local")).toBe("local"));
});

describe("ServiceBootConfig → ServiceRef 구조적 호환", () => {
  it("permission-engine ServiceRef로 사용 가능", () => {
    // ServiceRef = { namespace, name, env?, build?, region? }
    // ServiceBootConfig은 동일 필드를 포함하므로 구조적으로 호환
    const ref: { namespace: string; name: string; env?: string; region?: string; build?: string } = boot;
    expect(ref.namespace).toBe("shop");
    expect(ref.name).toBe("payment");
    expect(ref.env).toBe("prod");
    expect(ref.region).toBe("asia");
    expect(ref.build).toBe("abc123");
  });
});
