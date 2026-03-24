/**
 * platform-api-contract.test.ts — platform-demo-api 응답 contract 검증
 *
 * 실제 배포된 API에 요청하여 SSOT(demo-snapshot)과 응답 구조가 일치하는지 검증한다.
 * 초기화(reset) 후 기본 상태가 SSOT의 grantedRoles와 일치하는지도 확인한다.
 *
 * ── 시나리오 ──────────────────────────────────────────────────────────────
 *
 * [API-1] GET /api/features?ver=v2 — feature 목록, 순서, role 목록이 SSOT과 일치
 * [API-2] GET /api/features?ver=v1 — v1 feature 목록이 SSOT과 일치
 * [API-3] POST /api/grants/reset → GET /api/features?ver=v2 — 초기화 후 기본 grant 일치
 * [API-4] PATCH /api/grants — grant 변경 후 반영 확인
 * [API-5] POST /api/grants/reset — 변경 후 초기화하면 원래대로 복원
 * [API-6] GET /api/grant-table?ver=v2 — row 구조 + SSOT 정합성
 * [API-7] GET /api/scenario — 시나리오 응답 구조 검증
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  DEMO_FEATURES_V1, DEMO_FEATURES_V2,
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_FEATURE_KO, DEMO_KO,
} from "demo-snapshot";

// ── API Base ──────────────────────────────────────────────────────────────

const API_BASE = process.env.DEMO_API_BASE ?? "https://platform-demo-api.astralclover.workers.dev";
const describeDemoApi = process.env.DEMO_API_BASE ? describe : describe.skip;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Types (API 응답) ──────────────────────────────────────────────────────

interface FeaturesResponse {
  features: Array<{ id: string; name: string; grantedRoles: string[]; grantedRolesKo: string[] }>;
  roles: Array<{ id: string; ko: string }>;
  matrix: boolean[][];
}

interface GrantPatchResponse {
  featureId: string;
  grantedRoles: string[];
  grantedRolesKo: string[];
}

interface GrantTableResponse {
  rows: Array<{
    featureId: string; featureName: string;
    role: string; roleKo: string;
    granted: boolean;
    permAddr: string; permValue: number;
  }>;
}

interface ScenarioResponse {
  role: string; roleKo: string;
  features: Array<{ id: string; hasAccess: boolean; permAddr: string }>;
  simulation: Array<{ featureId: string; hasAccess: boolean }>;
}

// ── 초기화: 테스트 시작/종료 시 reset ──────────────────────────────────────

if (process.env.DEMO_API_BASE) {
  beforeAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });

  afterAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  [API-1] GET /api/features?ver=v2 — SSOT 일치
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-1] GET /api/features?ver=v2 — SSOT 정합성", () => {
  let data: FeaturesResponse;

  beforeAll(async () => {
    data = await api<FeaturesResponse>("/api/features?ver=v2");
  });

  it("feature 목록 순서가 DEMO_FEATURES_V2와 일치", () => {
    const apiIds = data.features.map(f => f.id);
    const ssotIds = DEMO_FEATURES_V2.map(f => f.id);
    expect(apiIds).toEqual(ssotIds);
  });

  it("feature name이 SSOT과 일치", () => {
    for (let i = 0; i < data.features.length; i++) {
      expect(data.features[i].name).toBe(DEMO_FEATURES_V2[i].name);
    }
  });

  it("role 목록이 DEMO_ROLES_V2와 일치", () => {
    const apiRoles = data.roles.map(r => r.id);
    expect(apiRoles).toEqual([...DEMO_ROLES_V2]);
  });

  it("role ko 라벨이 DEMO_KO.role과 일치", () => {
    for (const r of data.roles) {
      expect(r.ko).toBe(DEMO_KO.role[r.id]);
    }
  });

  it("matrix 크기: features × roles", () => {
    expect(data.matrix.length).toBe(DEMO_FEATURES_V2.length);
    for (const row of data.matrix) {
      expect(row.length).toBe(DEMO_ROLES_V2.length);
    }
  });

  it("기본 grant가 SSOT grantedRoles와 일치", () => {
    for (let fi = 0; fi < data.features.length; fi++) {
      const expected = new Set(DEMO_FEATURES_V2[fi].grantedRoles);
      const actual = new Set(data.features[fi].grantedRoles);
      expect(actual).toEqual(expected);

      // matrix도 일치
      for (let ri = 0; ri < data.roles.length; ri++) {
        const roleId = data.roles[ri].id;
        expect(data.matrix[fi][ri]).toBe(expected.has(roleId));
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-2] GET /api/features?ver=v1 — v1 SSOT 일치
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-2] GET /api/features?ver=v1 — v1 SSOT 정합성", () => {
  let data: FeaturesResponse;

  beforeAll(async () => {
    data = await api<FeaturesResponse>("/api/features?ver=v1");
  });

  it("feature 목록 순서가 DEMO_FEATURES_V1과 일치", () => {
    expect(data.features.map(f => f.id)).toEqual(DEMO_FEATURES_V1.map(f => f.id));
  });

  it("role 목록이 DEMO_ROLES_V1과 일치", () => {
    expect(data.roles.map(r => r.id)).toEqual([...DEMO_ROLES_V1]);
  });

  it("v1 grant가 SSOT grantedRoles와 일치", () => {
    for (let fi = 0; fi < data.features.length; fi++) {
      const expected = new Set(DEMO_FEATURES_V1[fi].grantedRoles);
      const actual = new Set(data.features[fi].grantedRoles);
      expect(actual).toEqual(expected);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-3] 초기화 후 기본 grant 일치
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-3] POST /api/grants/reset → 기본 상태 복원", () => {
  it("reset 후 v2 features의 grantedRoles가 SSOT과 일치", async () => {
    // 먼저 변경
    await api("/api/grants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: "product_list", role: "customer", granted: false }),
    });

    // reset
    await api("/api/grants/reset", { method: "POST" });

    // 확인
    const data = await api<FeaturesResponse>("/api/features?ver=v2");
    for (let fi = 0; fi < data.features.length; fi++) {
      const expected = new Set(DEMO_FEATURES_V2[fi].grantedRoles);
      const actual = new Set(data.features[fi].grantedRoles);
      expect(actual).toEqual(expected);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-4] PATCH /api/grants — 변경 반영
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-4] PATCH /api/grants — grant 변경", () => {
  beforeAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });

  it("grant 추가 → 반영 확인", async () => {
    // payment_history에 customer 추가
    const res = await api<GrantPatchResponse>("/api/grants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: "payment_history", role: "customer", granted: true }),
    });

    expect(res.featureId).toBe("payment_history");
    expect(res.grantedRoles).toContain("customer");

    // features API로 확인
    const data = await api<FeaturesResponse>("/api/features?ver=v2");
    const ph = data.features.find(f => f.id === "payment_history")!;
    expect(ph.grantedRoles).toContain("customer");
  });

  it("grant 제거 → 반영 확인", async () => {
    const res = await api<GrantPatchResponse>("/api/grants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: "payment_history", role: "customer", granted: false }),
    });

    expect(res.grantedRoles).not.toContain("customer");
  });

  afterAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-5] 변경 후 초기화 → 원래대로 복원
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-5] 변경 후 reset → 원래대로", () => {
  it("여러 건 변경 → reset → 모든 feature가 SSOT 기본으로 복원", async () => {
    // 여러 건 변경
    await api("/api/grants/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: [
          { featureId: "product_list", role: "admin", granted: false },
          { featureId: "user_mgmt", role: "customer", granted: true },
          { featureId: "config_change", role: "viewer", granted: true },
        ],
      }),
    });

    // 변경 확인
    const before = await api<FeaturesResponse>("/api/features?ver=v2");
    const pl = before.features.find(f => f.id === "product_list")!;
    expect(pl.grantedRoles).not.toContain("admin");

    // reset
    await api("/api/grants/reset", { method: "POST" });

    // 복원 확인
    const after = await api<FeaturesResponse>("/api/features?ver=v2");
    for (let fi = 0; fi < after.features.length; fi++) {
      expect(new Set(after.features[fi].grantedRoles))
        .toEqual(new Set(DEMO_FEATURES_V2[fi].grantedRoles));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-6] GET /api/grant-table — row 구조
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-6] GET /api/grant-table — row 구조 검증", () => {
  let data: GrantTableResponse;

  beforeAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
    data = await api<GrantTableResponse>("/api/grant-table?ver=v2");
  });

  it("총 row 수 = features × roles", () => {
    expect(data.rows.length).toBe(DEMO_FEATURES_V2.length * DEMO_ROLES_V2.length);
  });

  it("모든 row에 필수 필드 존재", () => {
    for (const row of data.rows) {
      expect(typeof row.featureId).toBe("string");
      expect(typeof row.role).toBe("string");
      expect(typeof row.granted).toBe("boolean");
      expect(typeof row.permValue).toBe("number");
      expect(typeof row.permAddr).toBe("string");
    }
  });

  it("granted 상태가 SSOT과 일치", () => {
    for (const row of data.rows) {
      const feat = DEMO_FEATURES_V2.find(f => f.id === row.featureId);
      if (!feat) continue;
      const expected = feat.grantedRoles.includes(row.role);
      expect(row.granted).toBe(expected);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-7] GET /api/scenario — 시나리오 응답 구조
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi("[API-7] GET /api/scenario — 구조 검증", () => {
  beforeAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });

  it("admin 시나리오: 모든 feature에 접근 가능", async () => {
    const data = await api<ScenarioResponse>("/api/scenario?role=admin&ver=v2");
    expect(data.role).toBe("admin");
    expect(data.roleKo).toBe(DEMO_KO.role["admin"]);

    // admin은 모든 feature에 grant되어 있음 (SSOT 확인)
    for (const feat of data.features) {
      const ssotFeat = DEMO_FEATURES_V2.find(f => f.id === feat.id);
      if (ssotFeat) {
        expect(feat.hasAccess).toBe(ssotFeat.grantedRoles.includes("admin"));
      }
    }
  });

  it("viewer 시나리오: 일부만 접근 가능", async () => {
    const data = await api<ScenarioResponse>("/api/scenario?role=viewer&ver=v2");
    expect(data.role).toBe("viewer");

    // viewer는 product_list, order_list에만 접근 (SSOT 기준)
    for (const feat of data.features) {
      const ssotFeat = DEMO_FEATURES_V2.find(f => f.id === feat.id);
      if (ssotFeat) {
        expect(feat.hasAccess).toBe(ssotFeat.grantedRoles.includes("viewer"));
      }
    }
  });

  it("feature 목록 순서가 SSOT과 일치", async () => {
    const data = await api<ScenarioResponse>("/api/scenario?role=admin&ver=v2");
    const apiIds = data.features.map(f => f.id);
    const ssotIds = DEMO_FEATURES_V2.map(f => f.id);
    expect(apiIds).toEqual(ssotIds);
  });

  it("simulation 항목이 features와 1:1 대응", async () => {
    const data = await api<ScenarioResponse>("/api/scenario?role=admin&ver=v2");
    expect(data.simulation.length).toBe(data.features.length);
    for (let i = 0; i < data.simulation.length; i++) {
      expect(data.simulation[i].featureId).toBe(data.features[i].id);
      expect(data.simulation[i].hasAccess).toBe(data.features[i].hasAccess);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [API-8] GET /api/permission/mask — mask API + hasBit 검증
// ═════════════════════════════════════════════════════════════════════════════

import { hasBit } from "weighted-index";
import { base64ToUint8 } from "bit-index";

interface MaskResponse {
  role: string;
  roleKo: string;
  ver: string;
  bits: number[];
  features: Array<{ id: string; name: string; granted: boolean }>;
  grantCount: number;
  totalSlots: number;
  density: number;
  maskBase64: string;
  maskBytes: number;
}

describeDemoApi("[API-8] GET /api/permission/mask — PermissionSet 기반 mask", () => {
  beforeAll(async () => {
    await api("/api/grants/reset", { method: "POST" });
  });

  it("viewer mask: bits가 SSOT grantedRoles와 일치", async () => {
    const mask = await api<MaskResponse>("/api/permission/mask?role=viewer&ver=v2");
    expect(mask.role).toBe("viewer");
    expect(mask.bits.length).toBe(DEMO_FEATURES_V2.length);

    for (let i = 0; i < mask.features.length; i++) {
      const ssotGranted = DEMO_FEATURES_V2[i].grantedRoles.includes("viewer");
      expect(mask.features[i].granted).toBe(ssotGranted);
      expect(mask.bits[i]).toBe(ssotGranted ? 1 : 0);
    }
  });

  it("admin mask: 모든 feature에 부여됨", async () => {
    const mask = await api<MaskResponse>("/api/permission/mask?role=admin&ver=v2");
    // admin은 모든 SSOT feature에 포함
    for (const feat of DEMO_FEATURES_V2) {
      expect(feat.grantedRoles).toContain("admin");
    }
    expect(mask.grantCount).toBe(DEMO_FEATURES_V2.length);
    expect(mask.bits.every(b => b === 1)).toBe(true);
  });

  it("maskBase64 → base64ToUint8 → hasBit 라운드트립", async () => {
    const mask = await api<MaskResponse>("/api/permission/mask?role=viewer&ver=v2");
    const bytes = base64ToUint8(mask.maskBase64);

    // hasBit으로 각 feature 체크 — API bits[]와 동일해야 함
    for (let i = 0; i < mask.bits.length; i++) {
      expect(hasBit(bytes, i)).toBe(mask.bits[i] === 1);
    }
  });

  it("grant 변경 후 mask 반영", async () => {
    // payment_history에 customer 추가
    await api("/api/grants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: "payment_history", role: "customer", granted: true }),
    });

    const mask = await api<MaskResponse>("/api/permission/mask?role=customer&ver=v2");
    const phIdx = mask.features.findIndex(f => f.id === "payment_history");
    expect(mask.features[phIdx].granted).toBe(true);
    expect(mask.bits[phIdx]).toBe(1);

    // hasBit으로도 확인
    const bytes = base64ToUint8(mask.maskBase64);
    expect(hasBit(bytes, phIdx)).toBe(true);
  });

  it("reset 후 mask가 SSOT 기본으로 복원", async () => {
    await api("/api/grants/reset", { method: "POST" });
    const mask = await api<MaskResponse>("/api/permission/mask?role=customer&ver=v2");

    for (let i = 0; i < mask.features.length; i++) {
      const ssotGranted = DEMO_FEATURES_V2[i].grantedRoles.includes("customer");
      expect(mask.features[i].granted).toBe(ssotGranted);
    }
  });

  it("grantCount, totalSlots, density 정합성", async () => {
    const mask = await api<MaskResponse>("/api/permission/mask?role=operator&ver=v2");
    const expectedCount = mask.bits.filter(b => b === 1).length;
    expect(mask.grantCount).toBe(expectedCount);
    expect(mask.totalSlots).toBe(DEMO_FEATURES_V2.length);
    expect(mask.density).toBeCloseTo(expectedCount / mask.totalSlots * 100, 0);
  });
});
