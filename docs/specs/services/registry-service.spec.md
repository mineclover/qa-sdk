---
def:
  id: registry-service-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: deprecated
---
# Registry Service 스펙

## 목적 ^purpose

Prefix DAG, 버전 라이프사이클, DraftWorkspace를 중앙에서 관리하는 서비스. (deprecated — registry-system/ 문서로 분할됨)

관련 문서: [../indexing/version-operations.md](../indexing/version-operations.md) · [../indexing/foundation.md](../indexing/foundation.md) §2–§3
관련 스펙: [../indexing/index-meta/registry.spec.md](../indexing/index-meta/registry.spec.md) · [gate-service.spec.md](gate-service.spec.md) · [query-service.spec.md](query-service.spec.md)
라이브러리: `packages/index-meta/src/prefix-registry.ts`, `version-lifecycle.ts`, `compile-schema.ts`, `schema-sync.ts`

## 상태

planned

---

## 1. 목적

### 문제

PrefixRegistry, VersionLifecycleStore, DraftWorkspace는 라이브러리로 구현되어 있다. 대규모 분산 시스템에서:

- 여러 서비스가 각자 prefix를 소유하지만, **참조 관계(DAG)는 서비스 경계를 넘는다**
- leaf prefix의 capacity 변경이 다른 서비스의 composite에 파급 효과를 준다 — 이를 사전에 계산할 중앙 지점이 없다
- 배포 시점에 "어떤 prefix가 어떤 버전이 active인가"를 조회할 SSOT가 없다
- draft 간 정합성 검증(Number overflow, stride 변경, 순환 참조)을 시스템 전체 범위에서 수행할 곳이 없다

### 해법

중앙 Registry Service가 prefix DAG + 버전 라이프사이클 + DraftWorkspace를 단일 서비스로 제공한다.

```
서비스 A (leaf 소유)           Registry Service              서비스 C (composite 소유)
  ├── register(role) ────────→ PrefixRegistry ←──────────── register(perm, refs=[role,action])
  ├── createDraft(role,v2) ──→ VersionLifecycle ←────────── createDraft(perm,v2)
  ├── updateDraft(cap=200) ──→ DraftWorkspace.simulate() ──→ diagnostics → 서비스 C 통보
  │                                    │
  │                           Readiness Gate
  │                           Release Coordinator
  │                                    │
  └── 배포 시 getActive("role") ───→ "v2" ←───── 배포 시 getActive("perm") ── 서비스 C
```

---

## 2. 데이터 모델

### Prefix 등록

```ts
interface PrefixRecord {
  prefix: string;            // 고유 식별자
  owner: string;             // 소유 서비스 식별자
  kind: "leaf" | "composite";
  numberType: "number" | "bigint";  // 주소 공간 정밀도
  createdAt: string;
}
```

### 버전 레코드

```ts
interface VersionRecord {
  prefix: string;
  versionId: string;
  status: "draft" | "locked" | "released" | "active" | "deprecated";
  baseVersionId: string | null;
  capacity: number;
  deactivationMode: "strict" | "flexible";
  refs?: DimRef[];           // composite만. 참조하는 leaf (prefix, versionId, capacity)
  shape?: number[];          // composite만. refs의 capacity 배열
  stride?: number[];         // composite만. shape으로 계산된 가중치
  product?: number;          // shape의 곱 (주소 공간 크기)
  createdAt: string;
  lockedAt?: string;         // draft lock 시점
  releasedAt?: string;
}
```

> **`locked` 상태 추가**: 기존 `draft → released` 사이에 `locked`를 삽입한다. locked는 capacity/entries 변경이 차단되지만 아직 stride가 최종 확정되지 않은 상태. Readiness Gate 통과 후 released로 전이한다.

### DAG 참조

```ts
interface DimRef {
  prefix: string;
  versionId: string;
  capacity: number;
}
```

---

## 3. API 계약

### 3.1 Prefix 관리

```
POST   /prefixes                           prefix 등록
GET    /prefixes                           전체 prefix 목록
GET    /prefixes/:prefix                   단일 prefix 조회 (모든 버전 포함)
DELETE /prefixes/:prefix                   prefix 제거 (deprecated 버전만 가능)
```

```ts
// POST /prefixes
{
  prefix: "role",
  owner: "service-a",
  kind: "leaf",
  numberType: "number"
}
```

### 3.2 버전 라이프사이클

```
POST   /prefixes/:prefix/versions                    draft 생성
GET    /prefixes/:prefix/versions                    버전 목록 (status 필터 가능)
GET    /prefixes/:prefix/versions/:versionId         단일 버전 조회
PATCH  /prefixes/:prefix/versions/:versionId         draft 수정 (capacity, refs 변경)
POST   /prefixes/:prefix/versions/:versionId/lock    draft → locked
POST   /prefixes/:prefix/versions/:versionId/release locked → released
POST   /prefixes/:prefix/versions/:versionId/activate released → active
POST   /prefixes/:prefix/versions/:versionId/deprecate active → deprecated
```

```ts
// POST /prefixes/role/versions (draft 생성)
{
  versionId: "v2",
  baseVersionId: "v1",
  capacity: 200
}

// PATCH /prefixes/role/versions/v2 (draft 수정)
{
  capacity: 300
}

// POST /prefixes/perm/versions (composite draft)
{
  versionId: "v2",
  baseVersionId: "v1",
  refs: [
    { prefix: "role", versionId: "v2" },
    { prefix: "action", versionId: "v1" }
  ]
}
// → capacity, shape, stride, product 자동 계산
```

상태 전이:

```
draft → locked → released → active → deprecated
  ↑       │
  └───────┘ (unlock: locked → draft, Readiness Gate 실패 시)
```

### 3.3 DAG 조회

```
GET    /dag/:prefix/:versionId/deps          직접 참조 (refs)
GET    /dag/:prefix/:versionId/deps/transitive  재귀 참조 (전체 leaf까지)
GET    /dag/:prefix/:versionId/reverse-refs   역참조 (이 prefix를 참조하는 composite)
GET    /dag/graph                             전체 DAG 시각화 데이터
```

### 3.4 DraftWorkspace

```
GET    /workspace/drafts                     현재 모든 draft 목록
POST   /workspace/simulate                   capacity 변경 시뮬레이션
POST   /workspace/analyze                    전체 draft 정합성 분석 (Readiness Gate)
POST   /workspace/lock-all                   모든 draft 일괄 잠금
POST   /workspace/release-all                전체 release (위상정렬 순서)
```

```ts
// POST /workspace/simulate
{
  changes: {
    "role": { capacity: 200 },
    "action": { capacity: 20 }
  }
}
→ {
  impact: [
    {
      prefix: "perm",
      owner: "service-c",
      currentShape: [100, 15],
      newShape: [200, 20],
      currentStride: [15, 1],
      newStride: [20, 1],
      strideChanged: true,
      currentProduct: 1500,
      newProduct: 4000,
      numberType: "number",
      migrationRequired: true
    },
    ...
  ],
  ready: true,
  diagnostics: [...],
  releaseOrder: ["role", "action", "perm", "access_log"]
}
```

```ts
// POST /workspace/analyze (Readiness Gate)
→ {
  ready: boolean,
  drafts: [...],
  diagnostics: [
    { level: "error" | "warn" | "info", prefix: string, owner: string, message: string }
  ],
  releaseOrder: string[],       // 위상정렬
  migrationSummary: {
    prefixesAffected: number,
    strideChanges: number,      // 마이그레이션 필요한 prefix 수
    numberTypeSwitches: number,  // BigInt 전환 필요한 prefix 수
  }
}
```

### 3.5 배포 시점 조회

서비스가 배포 시 호출하여 버전 정보를 확정하는 엔드포인트.

```
GET    /resolve/active                       모든 prefix의 active 버전 일괄 조회
GET    /resolve/active/:prefix               특정 prefix의 active 버전
GET    /resolve/manifest                     배포 manifest (active 버전 + stride + DecodeMap)
```

```ts
// GET /resolve/active
→ {
  "role":     { versionId: "v2", capacity: 200, numberType: "number" },
  "action":   { versionId: "v1", capacity: 15,  numberType: "number" },
  "perm":     { versionId: "v2", capacity: 4000, shape: [200,20], stride: [20,1], numberType: "number" },
  ...
}

// GET /resolve/manifest (배포 아티팩트용)
→ {
  versions: { ... },    // 위와 동일
  decodeMaps: {         // DecodeMap 번들 (프론트엔드 빌드용)
    "perm:v2": { dims: [...], entries: [...] },
    ...
  },
  generatedAt: "2026-03-18T..."
}
```

### 3.6 에러 코드

| 코드 | 의미 |
|------|------|
| `PREFIX_NOT_FOUND` | prefix 미등록 |
| `VERSION_NOT_FOUND` | versionId 미등록 |
| `INVALID_TRANSITION` | 허용되지 않는 상태 전이 (예: active → draft) |
| `DRAFT_LOCKED` | locked 상태에서 수정 시도 |
| `REF_NOT_FOUND` | composite refs의 참조 대상이 존재하지 않음 |
| `CIRCULAR_REF` | DAG에 순환 참조 발생 |
| `NOT_READY` | Readiness Gate 미통과 상태에서 release 시도 |
| `OVERFLOW` | Number 정밀도 한계 초과 (product > 2^53) |
| `OWNER_MISMATCH` | prefix 소유자가 아닌 서비스의 수정 시도 |

---

## 4. 다른 서비스와의 관계

```
                    Registry Service (SSOT)
                    ┌──────────────────────┐
                    │ PrefixRegistry       │
                    │ VersionLifecycle     │
                    │ DraftWorkspace       │
                    └────────┬─────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    Gate Service      Query Service      Decode Service
    (주소 상태)        (정책 질의)        (주소 디코딩)
          │                  │                  │
          │ ← getReverseRefs │ ← getShape       │ ← getActive
          │ ← cascade trigger│ ← version info   │ ← DecodeMap
          │                  │                  │
```

### Gate Service 연동

- Gate Service가 cascade recompute 시 `getReverseRefs` 호출 → Registry Service에서 DAG 조회
- version release 이벤트 → Registry Service가 Gate Service에 recompute 트리거

### Query Service 연동

- 규칙(PolicyRule)이 특정 (prefix, versionId)에 바인딩 → Registry Service에서 active version 조회
- version 변경 시 `translateConstraint`로 규칙 마이그레이션 → Registry Service의 migration mapping 참조

### Decode Service 연동

- DecoderPool이 prefix별 DecodeMap을 캐시 → Registry Service의 manifest에서 일괄 획득
- 배포 시 `/resolve/manifest` 호출로 전체 DecodeMap 번들 다운로드

### 각 서비스의 배포 시 조회

- 프론트엔드 빌드: `/resolve/manifest` → stride + DecodeMap을 번들에 포함
- 백엔드 서비스: `/resolve/active` → 대상 prefix의 active version 확인 → 설정 주입
- 서비스 간 통신: 송신 서비스가 배포 시 수신 서비스의 active version을 확정

---

## 5. 저장소

### 필수 테이블

```sql
-- prefix 등록
CREATE TABLE prefix (
  prefix       TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('leaf', 'composite')),
  number_type  TEXT NOT NULL DEFAULT 'number' CHECK (number_type IN ('number', 'bigint')),
  created_at   TEXT NOT NULL
);

-- 버전 라이프사이클
CREATE TABLE version (
  prefix         TEXT NOT NULL REFERENCES prefix(prefix),
  version_id     TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('draft', 'locked', 'released', 'active', 'deprecated')),
  base_version_id TEXT,
  capacity       INTEGER NOT NULL,
  deactivation_mode TEXT NOT NULL DEFAULT 'strict',
  product        REAL,             -- shape product (composite만)
  created_at     TEXT NOT NULL,
  locked_at      TEXT,
  released_at    TEXT,
  PRIMARY KEY (prefix, version_id)
);

-- DAG 참조 (composite → leaf)
CREATE TABLE version_ref (
  parent_prefix     TEXT NOT NULL,
  parent_version_id TEXT NOT NULL,
  dim_order         INTEGER NOT NULL,
  ref_prefix        TEXT NOT NULL,
  ref_version_id    TEXT NOT NULL,
  ref_capacity      INTEGER NOT NULL,
  PRIMARY KEY (parent_prefix, parent_version_id, dim_order),
  FOREIGN KEY (parent_prefix, parent_version_id) REFERENCES version(prefix, version_id),
  FOREIGN KEY (ref_prefix, ref_version_id) REFERENCES version(prefix, version_id)
);
```

### 인덱스

```sql
-- 역참조 조회 (getReverseRefs) 최적화
CREATE INDEX idx_version_ref_target ON version_ref(ref_prefix, ref_version_id);

-- active 버전 빠른 조회
CREATE INDEX idx_version_active ON version(prefix, status) WHERE status = 'active';

-- draft 전체 조회 (DraftWorkspace)
CREATE INDEX idx_version_draft ON version(status) WHERE status IN ('draft', 'locked');
```

---

## 6. 분산 전략

### 단일 인스턴스 (권장 시작점)

```
모든 서비스 → Registry Service (단일) → DB
```

- Registry Service는 쓰기 빈도가 낮다 (draft cycle은 드물게 발생)
- 읽기 부하도 낮다 (배포 시점에만 조회, 런타임에는 조회 없음)
- 대부분의 배포 규모에서 단일 인스턴스로 충분

### Read Replica (대규모)

```
배포 파이프라인 → Registry Primary ←sync→ Registry Replica ← 서비스 배포
                        ↓                        ↓
                   DB (Primary)            DB (Read)
```

- 쓰기(draft/release): Primary만
- 읽기(resolve/manifest): Replica 분산
- 적합: 동시 배포하는 서비스가 수백 개 이상

### 정합성

- **강한 일관성**: draft 수정, simulate, release는 Primary에서 직렬 처리
- **최종 일관성**: resolve/manifest는 Replica에서 제공 가능 (배포 시점 조회이므로 수초 지연 허용)

---

## 7. 작업 계획

| ID | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| R-1 | **패키지 스캐폴딩** | 높 | 중 | Hono.js, prefix/version CRUD, DB 스키마 |
| R-2 | **DAG 관리 + 역참조** | 높 | 중 | composite refs 등록, getReverseRefs, 순환 참조 감지 |
| R-3 | **DraftWorkspace 구현** | 높 | 높 | simulate, analyze(Readiness Gate), diagnostics 엔진 |
| R-4 | **Release Coordinator** | 중 | 중 | 위상정렬 release, migration mapping 계산, lock/unlock |
| R-5 | **배포 시점 조회 API** | 중 | 낮 | /resolve/active, /resolve/manifest |
| R-6 | **Gate Service 연동** | 중 | 중 | release 이벤트 → Gate Service recompute 트리거 |
| R-7 | **소유자 인증** | 낮 | 중 | prefix 소유자 검증, OWNER_MISMATCH 에러 |
