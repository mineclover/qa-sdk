/**
 * Registry DSL — Git 버전 관리 체계 표현
 *
 * 이 모노레포의 실제 git 구조를 n차원 인덱스로 표현하는 DSL을 구성한다.
 * 목표: 레포지토리 단위의 서비스 관리를 위한 축 정의 + 인코딩 체계.
 *
 * ── Git 표현 체계의 축 ──
 *
 *   pkg:      패키지 식별자 (이 레포의 packages/* 디렉토리)
 *   semver:   버전 단계 (0.1.0, 0.2.0, ...)
 *   cc_type:  conventional commit 타입 (feat, fix, refactor, docs, test, chore)
 *   cc_scope: commit scope (패키지명 — pkg 축과 교차)
 *
 * ── 복합 인덱스 ──
 *
 *   pkg_version:  pkg × semver → "이 패키지의 이 버전" 주소
 *   commit_addr:  cc_type × cc_scope → "이 종류의 커밋이 이 패키지에" 주소
 *   change_map:   pkg × semver × cc_type → "이 패키지의 이 버전에서 이 종류의 변경" 주소
 *
 * ── 핵심 원리 ──
 *
 *   git의 텍스트 기반 식별 (commit hash, tag, branch)을
 *   정수 주소 공간으로 변환하여 O(1) lookup, 범위 질의, DAG 추적을 가능하게 한다.
 */

import { describe, it, expect } from "vitest";
import { WeightedIndex } from "weighted-index";
import type { Axis, Domain } from "demo-snapshot";

// ══════════════════════════════════════════════════════════════
//  §1. 축 정의 — 이 레포의 실제 데이터로 구성
// ══════════════════════════════════════════════════════════════

// ── pkg 축: 이 모노레포의 패키지 ─────────────────────────────

const pkg: Axis = {
  id: "pkg",
  name: "패키지",
  entries: [
    // foundation
    "weighted-index", "bit-index", "index-meta", "permission-engine",
    // platform
    "core", "engine", "sdk", "store", "registry-client", "event-catalog", "pino",
    // service
    "ingest-server", "registry-service", "decode-service", "gate-service", "query-service",
    // app
    "platform-demo", "browser-sdk", "viz-web",
    // data
    "demo-snapshot",
  ],
  capacity: 32,  // 현재 20개, headroom 12
  ko: {
    "weighted-index": "가중 인덱스", "bit-index": "비트 인덱스",
    "index-meta": "인덱스 메타", "permission-engine": "권한 엔진",
    "core": "코어", "engine": "엔진", "sdk": "SDK",
    "store": "스토어", "registry-client": "레지스트리 클라이언트",
    "event-catalog": "이벤트 카탈로그", "pino": "로거",
    "ingest-server": "수집 서버", "registry-service": "레지스트리 서비스",
    "decode-service": "디코드 서비스", "gate-service": "게이트 서비스",
    "query-service": "쿼리 서비스",
    "platform-demo": "플랫폼 데모", "browser-sdk": "브라우저 SDK",
    "viz-web": "시각화 웹",
    "demo-snapshot": "데모 스냅샷",
  },
};

// ── semver 축: 이 레포에서 사용하는 버전 단계 ─────────────────

const semver: Axis = {
  id: "semver",
  name: "시맨틱 버전",
  entries: ["0.1.0", "0.2.0"],
  capacity: 16,  // headroom 14 — minor 버전 16개까지 확장 가능
  ko: { "0.1.0": "초기", "0.2.0": "안정화" },
};

// ── cc_type 축: conventional commit 타입 ──────────────────────

const ccType: Axis = {
  id: "cc_type",
  name: "커밋 타입",
  entries: ["feat", "fix", "refactor", "docs", "test", "chore"],
  capacity: 8,  // headroom 2 (perf, ci 등 추가 여지)
  ko: {
    feat: "기능", fix: "수정", refactor: "리팩터",
    docs: "문서", test: "테스트", chore: "잡무",
  },
};

// ── tier 축: 아키텍처 계층 ────────────────────────────────────

const tier: Axis = {
  id: "tier",
  name: "계층",
  entries: ["foundation", "platform", "service", "app", "data"],
  capacity: 8,
  ko: {
    foundation: "기반", platform: "플랫폼",
    service: "서비스", app: "앱", data: "데이터",
  },
};

// ── runtime 축: 실행 환경 ─────────────────────────────────────

const runtime: Axis = {
  id: "runtime",
  name: "런타임",
  entries: ["library", "server", "browser"],
  capacity: 4,
  ko: { library: "라이브러리", server: "서버", browser: "브라우저" },
};

// ── scope 축: 공개 범위 ──────────────────────────────────────

const scope: Axis = {
  id: "scope",
  name: "공개 범위",
  entries: ["public", "private"],
  capacity: 2,
  ko: { public: "공개", private: "비공개" },
};

// ══════════════════════════════════════════════════════════════
//  §2. 도메인 정의 — 축의 조합
// ══════════════════════════════════════════════════════════════

const GIT_REPO: Domain = {
  id: "git_repo",
  name: "Git 레포지토리 관리",
  description: "모노레포 패키지의 버전, 커밋, 아키텍처 위치를 n차원으로 관리",
  axes: { pkg, semver, ccType, tier, runtime, scope },
};

// ══════════════════════════════════════════════════════════════
//  §3. 인코딩 체계 — WeightedIndex 기반 주소 공간
// ══════════════════════════════════════════════════════════════

describe("§1 축 정의 검증", () => {
  it("pkg 축: 20개 패키지, capacity 32, headroom 12", () => {
    expect(pkg.entries).toHaveLength(20);
    expect(pkg.capacity).toBe(32);
    // headroom = capacity - entries.length
    expect(pkg.capacity! - pkg.entries.length).toBe(12);
  });

  it("모든 축이 Axis 인터페이스를 만족한다", () => {
    for (const axis of [pkg, semver, ccType, tier, runtime, scope]) {
      expect(axis.id).toBeDefined();
      expect(axis.name).toBeDefined();
      expect(axis.entries.length).toBeGreaterThan(0);
      expect(axis.capacity).toBeGreaterThanOrEqual(axis.entries.length);
      // 모든 엔트리에 ko 라벨이 있다
      for (const entry of axis.entries) {
        expect(axis.ko[entry]).toBeDefined();
      }
    }
  });
});

describe("§2 인덱스 구성 — 패키지 버전 추적", () => {
  // ── pkg_version: pkg × semver ─────────────────────────────
  // "이 패키지의 이 버전"을 정수 주소로
  it("pkg_version: pkg × semver → 정수 주소", () => {
    const shape = [pkg.capacity!, semver.capacity!];  // [32, 16]
    const wi = new WeightedIndex(shape);

    expect(wi.size).toBe(512);  // 32 × 16 = 512 주소 공간
    expect(wi.strides).toEqual([16, 1]);  // stride: [16, 1]

    // weighted-index v0.2.0 주소
    const wiPos = pkg.entries.indexOf("weighted-index") + 1;  // 1
    const verPos = semver.entries.indexOf("0.2.0") + 1;       // 2
    const addr = wi.encode([wiPos, verPos]);
    expect(addr).toBe(1); // (1-1)*16 + (2-1)*1 = 1

    // 디코딩 검증
    const [p, v] = wi.decode(addr);
    expect(pkg.entries[p - 1]).toBe("weighted-index");
    expect(semver.entries[v - 1]).toBe("0.2.0");
  });

  it("pkg_version: 패키지별 모든 버전이 연속 블록", () => {
    const shape = [pkg.capacity!, semver.capacity!];
    const wi = new WeightedIndex(shape);

    // index-meta (position 3)의 모든 버전 → 주소 [32, 47]
    const imPos = pkg.entries.indexOf("index-meta") + 1; // 3
    const base = (imPos - 1) * semver.capacity!;         // 32
    const end = base + semver.capacity! - 1;              // 47

    // 실제 버전 주소
    const v010 = wi.encode([imPos, 1]); // 0.1.0
    const v020 = wi.encode([imPos, 2]); // 0.2.0
    expect(v010).toBe(32);
    expect(v020).toBe(33);
    expect(v010).toBeGreaterThanOrEqual(base);
    expect(v020).toBeLessThanOrEqual(end);

    // headroom 영역: 34~47은 미래 버전용
    // semver entries가 2개이므로 position 3~16은 headroom
  });

  it("범위 질의: foundation tier 패키지들의 최신 버전", () => {
    const shape = [pkg.capacity!, semver.capacity!];
    const wi = new WeightedIndex(shape);

    // foundation 패키지: weighted-index(1), bit-index(2), index-meta(3), permission-engine(4)
    const foundationPkgs = [
      "weighted-index", "bit-index", "index-meta", "permission-engine",
    ];
    const latestVer = semver.entries.indexOf("0.2.0") + 1; // 2

    const addresses = foundationPkgs.map((name) => {
      const pos = pkg.entries.indexOf(name) + 1;
      return wi.encode([pos, latestVer]);
    });

    // v0.2.0 주소들: [1, 17, 33, 49]
    expect(addresses).toEqual([1, 17, 33, 49]);

    // 모든 주소가 stride(16) 간격으로 분포
    for (let i = 1; i < addresses.length; i++) {
      expect(addresses[i] - addresses[i - 1]).toBe(16);
    }
  });
});

describe("§3 인덱스 구성 — 커밋 패턴 추적", () => {
  // ── commit_addr: cc_type × pkg ────────────────────────────
  // "이 종류의 커밋이 이 패키지에" → 커밋 패턴 분석 주소
  it("commit_addr: cc_type × pkg → 커밋 패턴 주소", () => {
    const shape = [ccType.capacity!, pkg.capacity!]; // [8, 32]
    const wi = new WeightedIndex(shape);

    expect(wi.size).toBe(256); // 8 × 32
    expect(wi.strides).toEqual([32, 1]);

    // feat(index-meta) 주소
    const featPos = ccType.entries.indexOf("feat") + 1;      // 1
    const imPos = pkg.entries.indexOf("index-meta") + 1;     // 3
    const addr = wi.encode([featPos, imPos]);
    expect(addr).toBe(2); // (1-1)*32 + (3-1) = 2

    // refactor(weighted-index) 주소
    const refPos = ccType.entries.indexOf("refactor") + 1;   // 3
    const wiPos = pkg.entries.indexOf("weighted-index") + 1; // 1
    const addr2 = wi.encode([refPos, wiPos]);
    expect(addr2).toBe(64); // (3-1)*32 + (1-1) = 64
  });

  it("범위 질의: feat 커밋이 발생한 모든 패키지", () => {
    const shape = [ccType.capacity!, pkg.capacity!];
    const wi = new WeightedIndex(shape);

    // feat(pos=1)의 전체 범위 = [(1-1)*32, (1-1)*32+31] = [0, 31]
    const featBase = 0;
    const featEnd = 31;

    // 이 범위 안의 모든 주소를 디코딩하면 cc_type=feat
    for (let addr = featBase; addr <= featEnd; addr++) {
      const [typePos] = wi.decode(addr);
      expect(ccType.entries[typePos - 1]).toBe("feat");
    }
  });

  it("실제 커밋 통계를 주소로 매핑", () => {
    // 이 레포의 실제 커밋 패턴 (git log에서 추출)
    const commitCounts: Record<string, Record<string, number>> = {
      "index-meta":     { feat: 23, docs: 13, refactor: 7, chore: 4, test: 2 },
      "weighted-index": { feat: 11, refactor: 5, docs: 2, test: 2 },
      "platform-demo":  { feat: 4, refactor: 3 },
      "viz-web":        { feat: 2 },
    };

    const shape = [ccType.capacity!, pkg.capacity!];
    const wi = new WeightedIndex(shape);

    // 커밋 수 → 주소 매핑 테이블 생성
    const addressMap: { addr: number; type: string; pkg: string; count: number }[] = [];
    for (const [pkgName, types] of Object.entries(commitCounts)) {
      for (const [typeName, count] of Object.entries(types)) {
        const typePos = ccType.entries.indexOf(typeName) + 1;
        const pkgPos = pkg.entries.indexOf(pkgName) + 1;
        if (typePos > 0 && pkgPos > 0) {
          addressMap.push({
            addr: wi.encode([typePos, pkgPos]),
            type: typeName,
            pkg: pkgName,
            count,
          });
        }
      }
    }

    // 가장 활발한 커밋 패턴: feat(index-meta) = 23건
    const topCommit = addressMap.toSorted((a, b) => b.count - a.count)[0];
    expect(topCommit.type).toBe("feat");
    expect(topCommit.pkg).toBe("index-meta");
    expect(topCommit.count).toBe(23);

    // 주소로부터 역추적
    const [typePos, pkgPos] = wi.decode(topCommit.addr);
    expect(ccType.entries[typePos - 1]).toBe("feat");
    expect(pkg.entries[pkgPos - 1]).toBe("index-meta");
  });
});

describe("§4 인덱스 구성 — 전체 변경 맵", () => {
  // ── change_map: pkg × semver × cc_type ────────────────────
  // "이 패키지의 이 버전에서 이 종류의 변경" → 3차원 변경 추적
  it("change_map: pkg × semver × cc_type → 3D 변경 맵", () => {
    const shape = [pkg.capacity!, semver.capacity!, ccType.capacity!]; // [32, 16, 8]
    const wi = new WeightedIndex(shape);

    expect(wi.size).toBe(4096);  // 32 × 16 × 8
    expect(wi.strides).toEqual([128, 8, 1]);

    // index-meta v0.2.0 feat 주소
    const imPos = pkg.entries.indexOf("index-meta") + 1;    // 3
    const v02Pos = semver.entries.indexOf("0.2.0") + 1;     // 2
    const featPos = ccType.entries.indexOf("feat") + 1;     // 1
    const addr = wi.encode([imPos, v02Pos, featPos]);
    expect(addr).toBe(264); // (3-1)*128 + (2-1)*8 + (1-1) = 264

    // 역 디코딩
    const [p, v, t] = wi.decode(addr);
    expect(pkg.entries[p - 1]).toBe("index-meta");
    expect(semver.entries[v - 1]).toBe("0.2.0");
    expect(ccType.entries[t - 1]).toBe("feat");
  });

  it("pkg를 첫 번째 축으로 배치 → 패키지 추가 시 stride 불변", () => {
    // shape = [32, 16, 8], stride = [128, 8, 1]
    // pkg capacity 32→64로 확장 시:
    // shape = [64, 16, 8], stride = [128, 8, 1] — 동일!
    //
    // pkg가 첫 번째 축이므로 stride는 뒤쪽 축의 곱으로만 결정됨
    // stride[0] = semver.cap × ccType.cap = 16 × 8 = 128 (불변)

    const shape1 = [32, 16, 8];
    const shape2 = [64, 16, 8];
    const wi1 = new WeightedIndex(shape1);
    const wi2 = new WeightedIndex(shape2);

    expect(wi1.strides).toEqual([128, 8, 1]);
    expect(wi2.strides).toEqual([128, 8, 1]); // stride 동일!

    // 기존 주소가 그대로 유효
    const addr = wi1.encode([3, 2, 1]); // index-meta, v0.2.0, feat
    const decoded1 = wi1.decode(addr);
    const decoded2 = wi2.decode(addr);
    expect(decoded1).toEqual(decoded2); // 동일 좌표
  });

  it("semver 축 확장은 stride를 변경한다 → 축 배치 주의", () => {
    // semver capacity 16→32 시:
    // shape = [32, 32, 8], stride = [256, 8, 1]
    //                              ↑ 128→256 변경!
    //
    // 기존 주소의 의미가 달라짐 → 마이그레이션 필요

    const shape1 = [32, 16, 8];
    const shape2 = [32, 32, 8];
    const wi1 = new WeightedIndex(shape1);
    const wi2 = new WeightedIndex(shape2);

    expect(wi1.strides).toEqual([128, 8, 1]);
    expect(wi2.strides).toEqual([256, 8, 1]); // stride[0] 변경됨

    // 같은 주소 264를 디코딩하면 다른 좌표
    const decoded1 = wi1.decode(264);
    const decoded2 = wi2.decode(264);
    expect(decoded1).toEqual([3, 2, 1]); // index-meta, v0.2.0, feat
    expect(decoded2).toEqual([2, 2, 1]); // bit-index(?!), v0.2.0, feat ← 오역!
    expect(decoded1).not.toEqual(decoded2);
  });
});

describe("§5 패키지 의존성 그래프를 주소 공간에 반영", () => {
  // 패키지 간 의존성 정보
  const DEPS: Record<string, readonly string[]> = {
    "bit-index":         ["weighted-index"],
    "index-meta":        ["weighted-index"],
    "permission-engine": ["weighted-index", "bit-index"],
    "engine":            ["core"],
    "sdk":               ["core"],
    "store":             ["core"],
    "ingest-server":     ["core", "engine", "registry-client", "store"],
    "registry-service":  ["index-meta", "weighted-index"],
    "decode-service":    ["index-meta"],
    "gate-service":      ["index-meta"],
    "query-service":     ["index-meta"],
    "platform-demo":     ["demo-snapshot", "permission-engine", "weighted-index"],
    "browser-sdk":       ["core", "event-catalog", "sdk"],
    "viz-web":           ["core", "engine", "event-catalog"],
  };

  it("의존성 깊이 계산 → 위상정렬 순서", () => {
    // 의존성이 없는 패키지 = depth 0
    // 의존성이 있으면 max(dep depths) + 1
    const depth = new Map<string, number>();

    const calcDepth = (name: string): number => {
      if (depth.has(name)) return depth.get(name)!;
      const deps = DEPS[name] ?? [];
      if (deps.length === 0) {
        depth.set(name, 0);
        return 0;
      }
      const d = Math.max(...deps.map(calcDepth)) + 1;
      depth.set(name, d);
      return d;
    };

    for (const name of pkg.entries) calcDepth(name);

    // depth 0: weighted-index, core, registry-client, event-catalog, pino, demo-snapshot
    const depth0 = pkg.entries.filter((e) => depth.get(e) === 0);
    expect(depth0).toContain("weighted-index");
    expect(depth0).toContain("core");
    expect(depth0).toContain("demo-snapshot");

    // depth 1: bit-index, index-meta, engine, sdk, store
    expect(depth.get("bit-index")).toBe(1);
    expect(depth.get("index-meta")).toBe(1);
    expect(depth.get("engine")).toBe(1);

    // depth 2: permission-engine (← bit-index ← weighted-index)
    expect(depth.get("permission-engine")).toBe(2);

    // depth 2+: ingest-server (← engine ← core)
    expect(depth.get("ingest-server")).toBe(2);

    // depth 3: platform-demo (← permission-engine ← bit-index ← weighted-index)
    expect(depth.get("platform-demo")).toBe(3);

    // 위상정렬: depth 순서로 정렬하면 release 순서
    const sorted = [...depth.entries()].toSorted((a, b) => a[1] - b[1]);
    const releaseOrder = sorted.map(([name]) => name);

    // 첫 번째는 depth 0 패키지들
    expect(depth.get(releaseOrder[0])).toBe(0);
    // 마지막은 depth가 가장 깊은 패키지
    expect(releaseOrder[releaseOrder.length - 1]).toBe("platform-demo");
  });

  it("의존성 역참조: weighted-index 변경 시 영향 받는 패키지", () => {
    const affected = new Set<string>();

    const findAffected = (target: string) => {
      for (const [name, deps] of Object.entries(DEPS)) {
        if (deps.includes(target) && !affected.has(name)) {
          affected.add(name);
          findAffected(name); // 전이적 역참조
        }
      }
    };

    findAffected("weighted-index");

    // 직접 의존: bit-index, index-meta, permission-engine, registry-service, platform-demo
    expect(affected).toContain("bit-index");
    expect(affected).toContain("index-meta");
    expect(affected).toContain("permission-engine");
    expect(affected).toContain("registry-service");

    // 전이적 의존: decode-service ← index-meta ← weighted-index
    expect(affected).toContain("decode-service");
    expect(affected).toContain("gate-service");
    expect(affected).toContain("query-service");

    // platform-demo ← permission-engine ← weighted-index
    expect(affected).toContain("platform-demo");

    // 영향 없는 패키지: core, engine, sdk 등 (다른 의존 트리)
    expect(affected).not.toContain("core");
    expect(affected).not.toContain("engine");
    expect(affected).not.toContain("sdk");
  });
});

describe("§6 DSL 구조 — 선언적 레포지토리 정의", () => {
  /**
   * 최종 DSL 형태:
   * 레포지토리를 선언적으로 정의하고, 주소 공간으로 변환한다.
   */
  interface RepoDef {
    readonly id: string;
    readonly axes: {
      readonly pkg: Axis;
      readonly semver: Axis;
      readonly ccType: Axis;
    };
    readonly packages: readonly PkgEntry[];
    readonly indices: Record<string, IndexDef>;
  }

  interface PkgEntry {
    readonly name: string;
    readonly tier: string;
    readonly runtime: string;
    readonly scope: "public" | "private";
    readonly version: string;
    readonly deps: readonly string[];
  }

  interface IndexDef {
    readonly dims: readonly string[];  // 축 ID 순서
    readonly description: string;
  }

  it("선언적 레포 정의 → 주소 공간 자동 생성", () => {
    const repo: RepoDef = {
      id: "qa-sdk",
      axes: { pkg, semver, ccType },
      packages: [
        { name: "weighted-index", tier: "foundation", runtime: "library", scope: "public",  version: "0.2.0", deps: [] },
        { name: "index-meta",     tier: "foundation", runtime: "library", scope: "public",  version: "0.2.0", deps: ["weighted-index"] },
        { name: "core",           tier: "platform",   runtime: "library", scope: "public",  version: "0.1.0", deps: [] },
        { name: "ingest-server",  tier: "service",    runtime: "server",  scope: "private", version: "0.1.0", deps: ["core"] },
      ],
      indices: {
        pkg_version: { dims: ["pkg", "semver"], description: "패키지 × 버전 → 릴리즈 주소" },
        change_map:  { dims: ["pkg", "semver", "ccType"], description: "변경 추적 주소" },
      },
    };

    // 인덱스 주소 공간 자동 계산
    for (const [name, idx] of Object.entries(repo.indices)) {
      const shape = idx.dims.map((dimId) => {
        const axis = repo.axes[dimId as keyof typeof repo.axes];
        return axis.capacity!;
      });
      const wi = new WeightedIndex(shape);

      if (name === "pkg_version") {
        expect(wi.size).toBe(512);        // 32 × 16
        expect(wi.strides).toEqual([16, 1]);
      }

      if (name === "change_map") {
        expect(wi.size).toBe(4096);       // 32 × 16 × 8
        expect(wi.strides).toEqual([128, 8, 1]);
      }
    }

    // 패키지 좌표 매핑
    for (const p of repo.packages) {
      const pkgPos = pkg.entries.indexOf(p.name) + 1;
      const verPos = semver.entries.indexOf(p.version) + 1;
      expect(pkgPos).toBeGreaterThan(0);
      expect(verPos).toBeGreaterThan(0);
    }
  });

  it("DSL에서 핵심 속성 추출: 축 배치 → stride 안정성 보장", () => {
    // 변경 빈도 높은 축을 앞에 배치하면 stride 불변
    //
    // 이 레포의 변경 빈도:
    //   pkg:    높음 (새 패키지 추가 빈번)
    //   semver: 중간 (마이너 릴리즈 주기적)
    //   ccType: 낮음 (커밋 타입은 고정적)
    //
    // → [pkg, semver, ccType] 순서가 최적
    //   pkg 추가 시:    stride 불변 ✓
    //   semver 추가 시: stride[0]만 변경 (pkg stride)
    //   ccType 추가 시: stride[0], stride[1] 모두 변경 (최악)

    const optimal = [pkg.capacity!, semver.capacity!, ccType.capacity!];
    const wi = new WeightedIndex(optimal);
    expect(wi.strides).toEqual([128, 8, 1]);

    // pkg 32→64: stride 불변
    const expanded = [64, semver.capacity!, ccType.capacity!];
    const wi2 = new WeightedIndex(expanded);
    expect(wi2.strides).toEqual([128, 8, 1]); // ✓ 동일

    // 역순 배치 [ccType, semver, pkg] — 최악
    const worst = [ccType.capacity!, semver.capacity!, pkg.capacity!];
    const wiWorst = new WeightedIndex(worst);
    expect(wiWorst.strides).toEqual([512, 32, 1]);
    // pkg 확장 시 → 이 경우는 stride 불변이지만...
    // ccType 확장 시 → stride[0], stride[1] 모두 변경 (치명적)
  });
});
