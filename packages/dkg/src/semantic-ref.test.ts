// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import {
  deriveRefEntries,
  validateRefEntries,
  recoverSemanticFromAddresses,
  findVersionForEntry,
  findRefAddress,
} from "./semantic-ref.js";
import { getAllSemanticRefs } from "./demo-semantic-refs.js";

describe("deriveRefEntries", () => {
  it("semantic 정의에서 정수 주소를 파생한다", () => {
    const semantics = getAllSemanticRefs();
    const permV1 = semantics.find(s => s.prefixId === "permission" && s.version === "v1")!;

    const derived = deriveRefEntries(DEMO_CATALOG, permV1);

    expect(derived.values.length).toBeGreaterThanOrEqual(1);
    // 모든 주소가 유효한 정수
    for (const addr of derived.values) {
      expect(typeof addr).toBe("number");
      expect(addr).toBeGreaterThanOrEqual(0);
    }
    // 첫 항목이 유효한 의미값을 가짐
    expect(derived.details[0].meaning.env).toBeDefined();
    expect(derived.details[0].meaning.svc_name).toBeDefined();
  });
});

describe("validateRefEntries — 전체 DEMO_CATALOG 정합성", () => {
  it("모든 semantic 정의가 현재 CATALOG과 일치한다", () => {
    const semantics = getAllSemanticRefs();

    console.log("\n══ RefEntries 정합성 검증 ══");

    let allValid = true;
    for (const semantic of semantics) {
      const result = validateRefEntries(DEMO_CATALOG, semantic);

      if (!result.valid) {
        allValid = false;
        console.log(`  ❌ ${result.prefixId}:${result.version}.${result.dimLabel}`);
        for (const m of result.mismatches) {
          console.log(`     [${m.index}] current=${m.current} derived=${m.derived} (${JSON.stringify(m.meaning)})`);
        }
      }
    }

    if (allValid) {
      console.log(`  ✅ ${semantics.length}개 refEntries 전부 일치`);
    }

    expect(allValid).toBe(true);
  });
});

describe("recoverSemanticFromAddresses", () => {
  it("정수 주소에서 의미값을 복원한다", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const recovered = recoverSemanticFromAddresses(DEMO_CATALOG, "service", "v1", refValues);

    expect(recovered.length).toBeGreaterThanOrEqual(1);
    // 첫 항목이 유효한 의미값을 가짐
    expect(recovered[0].values.env).toBeDefined();
    expect(recovered[0].values.svc_name).toBeDefined();
  });
});

describe("findVersionForEntry", () => {
  it("admin은 role의 모든 버전에 있다", () => {
    const versions = findVersionForEntry(DEMO_CATALOG, "role", "admin");
    expect(versions).toContain("v1");
    expect(versions).toContain("v4");
  });

  it("auditor는 role v4에만 있다", () => {
    const versions = findVersionForEntry(DEMO_CATALOG, "role", "auditor");
    expect(versions).toEqual(["v4"]);
  });

  it("customer는 role v2부터 있다", () => {
    const versions = findVersionForEntry(DEMO_CATALOG, "role", "customer");
    expect(versions).not.toContain("v1");
    expect(versions).toContain("v2");
  });

  it("존재하지 않는 entry → 빈 배열", () => {
    const versions = findVersionForEntry(DEMO_CATALOG, "role", "nonexistent");
    expect(versions).toHaveLength(0);
  });
});

describe("findRefAddress", () => {
  it("permission에서 특정 service 조합의 주소를 찾는다", () => {
    const result = findRefAddress(DEMO_CATALOG, "permission", "v1", "perm_svc", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThanOrEqual(0);
  });

  it("refEntries에 없는 조합 → null", () => {
    const result = findRefAddress(DEMO_CATALOG, "permission", "v1", "perm_svc", {
      env: "dev", region: "usa", svc_name: "auth", namespace: "shop",
    });
    expect(result).toBeNull();
  });
});
