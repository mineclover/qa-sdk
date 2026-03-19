/**
 * 타입 안전성 E2E 테스트
 *
 * 클라이언트/서버에서 생성된 타입을 사용할 때:
 * 1. 축 값이 내부 인덱스(1, 2, 3)가 아닌 유니크 키("prod-east") 기반인지
 * 2. 스키마 버전 정보가 런타임에서 접근 가능한지
 * 3. prefix별 메타데이터(ID, dims)가 타입으로 제공되는지
 * 4. empty-entries 축이 string으로 적절히 폴백하는지
 */
import { describe, it, expect } from "vitest";
import { generateTypescript } from "./generators/typescript.js";
import type { SchemaSnapshot } from "./lib/types.js";

// ── 픽스처 ───────────────────────────────────────────

const K8S_DSL: SchemaSnapshot = {
  id: "k8s-dsl-v1",
  axes: [
    { id: "k8s_cluster", entries: ["prod-east", "prod-west", "staging"], capacity: 32 },
    { id: "k8s_namespace", entries: ["default", "production"], capacity: 128 },
    { id: "k8s_workload_type", entries: ["deployment", "statefulset", "daemonset"], capacity: 8 },
    { id: "k8s_service", entries: ["gateway", "auth-server"], capacity: 256 },
    { id: "k8s_node_pool", entries: ["general", "compute", "gpu"], capacity: 16 },
  ],
  composites: [
    { id: "k8s_workload_addr", dims: ["k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"], owner: "k8s-dsl-v1" },
    { id: "k8s_infra_addr", dims: ["k8s_cluster", "k8s_node_pool", "k8s_workload_type"], owner: "k8s-dsl-v1" },
  ],
};

const GIT_DSL: SchemaSnapshot = {
  id: "git-dsl-v1",
  axes: [
    { id: "git_repo", entries: ["qa-sdk", "frontend"], capacity: 64 },
    { id: "git_branch_type", entries: ["main", "feature", "release"], capacity: 8 },
    { id: "git_change_type", entries: ["feat", "fix", "refactor"], capacity: 8 },
    { id: "git_file_scope", entries: ["core", "engine"], capacity: 64 },
    { id: "git_author", entries: [], capacity: 256 }, // entries 비어있음
  ],
  composites: [
    { id: "git_commit_addr", dims: ["git_repo", "git_branch_type", "git_change_type", "git_file_scope"], owner: "git-dsl-v1" },
    { id: "git_author_addr", dims: ["git_repo", "git_author"], owner: "git-dsl-v1" }, // 빈 축 참조
  ],
};

// ── 유틸 ─────────────────────────────────────────────

/** 생성된 TS에서 const 선언만 추출하여 eval 후 런타임 값으로 가져온다 */
function evalGenerated(ts: string): Record<string, unknown> {
  const constNames = extractConstNames(ts);

  // const 블록만 추출: `const NAME = { ... };` 또는 `const NAME = "...";`
  const constBlocks: string[] = [];
  for (const name of constNames) {
    // "export const NAME = ...;" 패턴 매칭 (중첩 {} 지원)
    const re = new RegExp(`export const ${name} = `);
    const match = re.exec(ts);
    if (!match) continue;

    const start = match.index + match[0].length - `const ${name} = `.length;
    // ";" 까지 추출 — 중첩 brace counting
    let depth = 0;
    let end = match.index + match[0].length;
    let inString = false;
    for (; end < ts.length; end++) {
      const ch = ts[end];
      if (ch === '"' && ts[end - 1] !== "\\") inString = !inString;
      if (inString) continue;
      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") depth--;
      if (ch === ";" && depth === 0) { end++; break; }
    }

    let block = ts.slice(start, end)
      .replace(/ as const/g, "")
      .replace(/export /g, "");
    constBlocks.push(block);
  }

  const fn = new Function(`
    ${constBlocks.join("\n")}
    return { ${constNames.join(", ")} };
  `);
  return fn();
}

function extractConstNames(ts: string): string[] {
  return [...ts.matchAll(/export const (\w+) =/g)].map((m) => m[1]);
}

// ═══════════════════════════════════════════════════════
// T1. 축 값이 유니크 키(entry label)인지 확인
// ═══════════════════════════════════════════════════════

describe("[T1] 축 값 = entry label (유니크 키), 인덱스 아님", () => {
  it("K8S_CLUSTER 값이 문자열 entry label이다 (숫자 인덱스 아님)", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const cluster = exported.K8S_CLUSTER as Record<string, unknown>;

    // 값이 entry 문자열
    expect(cluster.PROD_EAST).toBe("prod-east");
    expect(cluster.PROD_WEST).toBe("prod-west");
    expect(cluster.STAGING).toBe("staging");

    // 숫자 인덱스가 아님
    expect(typeof cluster.PROD_EAST).toBe("string");
    expect(cluster.PROD_EAST).not.toBe(1);
    expect(cluster.PROD_WEST).not.toBe(2);
  });

  it("K8S_WORKLOAD_TYPE 값이 K8s 리소스 이름이다", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const wt = exported.K8S_WORKLOAD_TYPE as Record<string, unknown>;

    expect(wt.DEPLOYMENT).toBe("deployment");
    expect(wt.STATEFULSET).toBe("statefulset");
    expect(wt.DAEMONSET).toBe("daemonset");
  });

  it("모든 축 const의 값이 typeof string이다 (number가 단 하나도 없음)", () => {
    const ts = generateTypescript(K8S_DSL);
    const exported = evalGenerated(ts);

    // 축 const만 검사 (GENERATION, PREFIXES 제외)
    const axisConsts = K8S_DSL.axes.map((a) => a.id.toUpperCase());

    for (const constName of axisConsts) {
      const obj = exported[constName] as Record<string, unknown>;
      for (const [, value] of Object.entries(obj)) {
        expect(typeof value).toBe("string");
      }
    }
  });

  it("const 키와 값이 대응한다: 키=UPPER_SNAKE, 값=원본 entry", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const service = exported.K8S_SERVICE as Record<string, unknown>;

    // GATEWAY → "gateway", AUTH_SERVER → "auth-server"
    expect(service.GATEWAY).toBe("gateway");
    expect(service.AUTH_SERVER).toBe("auth-server");
  });
});

// ═══════════════════════════════════════════════════════
// T2. 스키마 버전 런타임 접근
// ═══════════════════════════════════════════════════════

describe("[T2] 세대(generation) 식별자가 런타임 상수로 제공된다", () => {
  it("GENERATION 상수가 존재하고 snapshot.id(세대)와 일치한다", () => {
    const ts = generateTypescript(K8S_DSL);
    expect(ts).toContain('export const GENERATION = "k8s-dsl-v1"');

    const exported = evalGenerated(ts);
    expect(exported.GENERATION).toBe("k8s-dsl-v1");
  });

  it("Git DSL도 고유 GENERATION을 가진다", () => {
    const ts = generateTypescript(GIT_DSL);
    const exported = evalGenerated(ts);
    expect(exported.GENERATION).toBe("git-dsl-v1");
  });
});

// ═══════════════════════════════════════════════════════
// T3. Prefix 메타데이터 (composite ID + dims)
// ═══════════════════════════════════════════════════════

describe("[T3] PREFIXES 메타데이터가 런타임에서 접근 가능하다", () => {
  it("PREFIXES에 composite별 id, dims, capacity, stride, snapshotSupply가 포함된다", () => {
    const ts = generateTypescript(K8S_DSL);
    expect(ts).toContain("export const PREFIXES =");

    const exported = evalGenerated(ts);
    const prefixes = exported.PREFIXES as Record<string, {
      id: string; dims: string[]; capacity: number[]; stride: number[]; snapshotSupply: string;
    }>;

    expect(prefixes.k8s_workload_addr).toBeDefined();
    expect(prefixes.k8s_workload_addr.id).toBe("k8s_workload_addr");
    expect(prefixes.k8s_workload_addr.dims).toEqual([
      "k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service",
    ]);
    expect(prefixes.k8s_workload_addr.capacity).toEqual([32, 128, 8, 256]);
    expect(prefixes.k8s_workload_addr.stride).toEqual([262144, 2048, 256, 1]);
    // snapshotSupply 미지정 → implicit
    expect(prefixes.k8s_workload_addr.snapshotSupply).toBe("implicit");

    expect(prefixes.k8s_infra_addr).toBeDefined();
    expect(prefixes.k8s_infra_addr.capacity).toEqual([32, 16, 8]);
    expect(prefixes.k8s_infra_addr.stride).toEqual([128, 8, 1]);
    expect(prefixes.k8s_infra_addr.snapshotSupply).toBe("implicit");
  });

  it("PREFIXES 키가 composite ID와 동일하다", () => {
    const ts = generateTypescript(K8S_DSL);
    const exported = evalGenerated(ts);
    const prefixes = exported.PREFIXES as Record<string, unknown>;

    for (const comp of K8S_DSL.composites) {
      expect(prefixes).toHaveProperty(comp.id);
    }
  });
});

// ═══════════════════════════════════════════════════════
// T4. Empty-entries 축 처리
// ═══════════════════════════════════════════════════════

describe("[T4] entries 비어있는 축의 타입이 string으로 폴백된다", () => {
  it("GIT_AUTHOR const가 빈 객체로 생성된다", () => {
    const ts = generateTypescript(GIT_DSL);
    const exported = evalGenerated(ts);
    const author = exported.GIT_AUTHOR as Record<string, unknown>;

    expect(Object.keys(author)).toHaveLength(0);
  });

  it("GitAuthor 타입이 string이다 (never가 아님)", () => {
    const ts = generateTypescript(GIT_DSL);
    // entries가 비어있으면 typeof {}[keyof typeof {}] = never
    // 이를 string으로 폴백해야 한다
    expect(ts).not.toMatch(/export type GitAuthor = typeof GIT_AUTHOR\[keyof typeof GIT_AUTHOR\]/);
    expect(ts).toContain("export type GitAuthor = string;");
  });

  it("git_author_addr composite에서 git_author 차원이 string 타입이다", () => {
    const ts = generateTypescript(GIT_DSL);
    const authorAddrBlock = ts.match(
      /export interface GitAuthorAddrDims \{[\s\S]*?\}/,
    )?.[0] ?? "";

    expect(authorAddrBlock).toContain("git_author: string;");
  });
});

// ═══════════════════════════════════════════════════════
// T5. 클라이언트 SDK 사용 시나리오
// ═══════════════════════════════════════════════════════

describe("[T5] 클라이언트 SDK 사용 — PartialBinder 연동 시뮬레이션", () => {
  it("boot-time: K8s 환경변수 → const로 타입 안전하게 고정", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const cluster = exported.K8S_CLUSTER as Record<string, string>;
    const prefixes = exported.PREFIXES as Record<string, { id: string; dims: string[] }>;
    const version = exported.GENERATION as string;

    // 시뮬레이션: K8s Downward API → 환경변수 → const 참조
    const envCluster = "prod-east"; // process.env.K8S_CLUSTER
    expect(Object.values(cluster)).toContain(envCluster);

    // PartialBinder 생성 시 prefix 메타데이터 사용
    const prefix = prefixes.k8s_workload_addr;
    expect(prefix.id).toBe("k8s_workload_addr");
    expect(prefix.dims).toContain("k8s_cluster");
    expect(version).toBeTruthy();
  });

  it("runtime: binder.resolve 호출 시 entry label로 차원 지정", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const wt = exported.K8S_WORKLOAD_TYPE as Record<string, string>;

    // binder.resolve({ k8s_workload_type: K8S_WORKLOAD_TYPE.DEPLOYMENT })
    // → entry label "deployment"이 전달되어야 함, 인덱스 1이 아님
    expect(wt.DEPLOYMENT).toBe("deployment");
    expect(typeof wt.DEPLOYMENT).toBe("string");
  });

  it("address_context 조립: prefix:generation:address 형식", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const prefixes = exported.PREFIXES as Record<string, { id: string }>;
    const gen = exported.GENERATION as string;

    // SDK가 resolve 후 address string 조립
    const prefixId = prefixes.k8s_workload_addr.id;
    const resolvedAddr = 42; // binder.resolveId() 결과 (schema_version 축 포함)

    const addressString = `${prefixId}:${gen}:${resolvedAddr}`;
    expect(addressString).toBe("k8s_workload_addr:k8s-dsl-v1:42");
  });
});

// ═══════════════════════════════════════════════════════
// T6. 서버 쿼리 시나리오
// ═══════════════════════════════════════════════════════

describe("[T6] 서버 Range Query — prefix 메타데이터로 쿼리 조립", () => {
  it("constraints에 entry label을 사용한다 (인덱스 아님)", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const cluster = exported.K8S_CLUSTER as Record<string, string>;
    const prefixes = exported.PREFIXES as Record<string, { id: string; dims: string[] }>;
    const gen = exported.GENERATION as string;

    // Range Query 요청 조립 — generation은 stride 세대 식별자
    const query = {
      prefix_id: prefixes.k8s_workload_addr.id,
      generation: gen,
      constraints: {
        k8s_cluster: cluster.PROD_EAST, // "prod-east" — entry label
        k8s_namespace: null,            // wildcard
      },
    };

    expect(query.prefix_id).toBe("k8s_workload_addr");
    expect(query.generation).toBe("k8s-dsl-v1");
    expect(query.constraints.k8s_cluster).toBe("prod-east");
    expect(typeof query.constraints.k8s_cluster).toBe("string");
  });

  it("PREFIXES.dims로 어떤 축이 필터 가능한지 알 수 있다", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const prefixes = exported.PREFIXES as Record<string, { id: string; dims: string[] }>;

    const workloadDims = prefixes.k8s_workload_addr.dims;
    const infraDims = prefixes.k8s_infra_addr.dims;

    // workload_addr에서 필터 가능한 축
    expect(workloadDims).toContain("k8s_cluster");
    expect(workloadDims).toContain("k8s_namespace");
    expect(workloadDims).toContain("k8s_service");

    // infra_addr에는 namespace가 없음 — 필터 불가
    expect(infraDims).not.toContain("k8s_namespace");
    expect(infraDims).not.toContain("k8s_service");
    expect(infraDims).toContain("k8s_node_pool");
  });

  it("SSE 구독: prefix + generation + constraint로 구독 파라미터 조립", () => {
    const exported = evalGenerated(generateTypescript(K8S_DSL));
    const ns = exported.K8S_NAMESPACE as Record<string, string>;
    const prefixes = exported.PREFIXES as Record<string, { id: string }>;
    const gen = exported.GENERATION as string;

    // GET /v1/apm/streams?prefix_id=...&generation=...&constraints=...
    const params = new URLSearchParams({
      prefix_id: prefixes.k8s_workload_addr.id,
      generation: gen,
      constraints: `k8s_namespace:${ns.PRODUCTION}`,
    });

    expect(params.get("prefix_id")).toBe("k8s_workload_addr");
    expect(params.get("generation")).toBe("k8s-dsl-v1");
    expect(params.get("constraints")).toBe("k8s_namespace:production");
  });
});

// ═══════════════════════════════════════════════════════
// T7. 멀티 DSL 타입 격리
// ═══════════════════════════════════════════════════════

describe("[T7] 멀티 DSL — 각 스냅샷의 타입이 독립적이다", () => {
  it("K8s와 Git의 GENERATION이 다르다", () => {
    const k8s = evalGenerated(generateTypescript(K8S_DSL));
    const git = evalGenerated(generateTypescript(GIT_DSL));

    expect(k8s.GENERATION).toBe("k8s-dsl-v1");
    expect(git.GENERATION).toBe("git-dsl-v1");
    expect(k8s.GENERATION).not.toBe(git.GENERATION);
  });

  it("K8s PREFIXES에 git composite가 없다 (격리)", () => {
    const k8s = evalGenerated(generateTypescript(K8S_DSL));
    const prefixes = k8s.PREFIXES as Record<string, unknown>;

    expect(prefixes).toHaveProperty("k8s_workload_addr");
    expect(prefixes).not.toHaveProperty("git_commit_addr");
  });

  it("Git PREFIXES에 k8s composite가 없다 (격리)", () => {
    const git = evalGenerated(generateTypescript(GIT_DSL));
    const prefixes = git.PREFIXES as Record<string, unknown>;

    expect(prefixes).toHaveProperty("git_commit_addr");
    expect(prefixes).not.toHaveProperty("k8s_workload_addr");
  });
});
