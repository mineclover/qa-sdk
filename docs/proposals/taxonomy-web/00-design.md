---
status: draft
date: 2026-05-21
part_of: taxonomy-engine
role: overview
supersedes: -
superseded_by: -
---

# Taxonomy Web UI — 설계 초안 (T-I1)

> 브레인스토밍 초안. 사용자 검토 후 정제 예정. 모든 아키텍처 결정은 열려 있음.

## 1. 목적 ^purpose

### 1-1. 해결하는 문제

taxonomy-engine은 CLI(v0.4)로 `validate / show / codegen / diff`를 제공한다.
CLI는 터미널에서 특정 ref를 알고 있는 개발자에게는 충분하지만, 다음 상황에서는 한계가 있다:

| 한계 | 이유 |
|------|------|
| taxonomy 전체 구조를 한 눈에 파악하기 어렵다 | CLI는 단일 ref 단위 조회, 전체 그래프 시각화 불가 |
| cross-axis 흐름을 따라가기 어렵다 | `walkByCoordinate` 결과가 JSON 텍스트로 출력됨 |
| diff를 시각적으로 비교하기 어렵다 | 12가지 DiffEntry kind를 텍스트로 소비 |
| 비개발자(기획자, 데이터팀)가 접근 불가 | CLI 사용 진입 장벽 |

### 1-2. 사용자 비전과의 매핑

사용자 원문: "**탐색, 분석, 시각화, 편집 할 수 있는 cli, web 인터페이스**"

Web UI는 이 비전의 web 절반이다. CLI가 이미 탐색/분석의 read path를 커버하므로,
Web UI는 **시각화 + 탐색 UX**를 우선 목표로 하고 편집은 v1 out-of-scope.

### 1-3. OpenAPI 생태계 비유

OpenAPI 생태계에서 Swagger UI가 API spec을 탐색·테스트하는 창구이듯,
taxonomy-engine Web UI는 taxonomy YAML의 **interactive 탐색·분석 창구**다.
YAML SSOT는 건드리지 않고, 파생 뷰를 제공한다.

---

## 2. 사용 사례 ^defines

### UC-01: Registry 탐색

**누가**: qa-sdk 메인테이너, 도그푸딩 소비자 팀

**상황**: 여러 taxonomy yaml(qa-sdk-coordinate-system, dkg-schema, lesson-builder-content 등)을
한 registry에 로드한 후 전체 axis/entry 목록을 탐색하고 싶다.

**보여주는 것**:
- Registry에 로드된 taxonomy 목록 (이름, axis 수, entry 수, 검증 상태)
- 선택한 taxonomy의 axis 목록
- 선택한 axis의 entry 목록 (id, address, label, coordinate 문자열)

**인터랙션**:
- taxonomy → axis → entry 드릴다운 (3-tier 계층 내비게이션)
- ref 문자열 검색 (`qa-sdk-coordinate-system::event_type::page_view` 형식)

**활용 API**: `TaxonomyRegistry`, `slice(ir, axisName)`, `show(refStr, registry)`

---

### UC-02: contains 그래프 시각화

**누가**: qa-sdk 메인테이너, 시스템 설계자

**상황**: `walkRelation(ir, "contains", startId)` 결과를 그래프로 보고 싶다.
어떤 entry가 어떤 entry를 포함하는지 계층 구조를 시각적으로 파악.

**보여주는 것**:
- 트리 또는 방향 그래프 (SVG/Canvas)
- 노드: entry id + label + coordinate
- 엣지: relation kind (contains / depends_on / …)

**인터랙션**:
- 노드 클릭 → 해당 entry의 ref 상세 패널
- 루트 entry 선택 (드롭다운 또는 검색)
- relation kind 필터 (contains만 / 전체)

**활용 API**: `walkRelation(ir, relName, startId)`, `show(refStr, registry)`

---

### UC-03: cross-axis 흐름 추적

**누가**: qa-sdk 메인테이너, DKG 스키마 담당자

**상황**: `walkByCoordinate(ir, relName, startCoord)` — 좌표 기반 cross-axis 이동 경로를
시각화. 예: ingest-coords의 event → dimension → metric 흐름.

**보여주는 것**:
- Sankey 다이어그램 또는 layered 방향 그래프
- 노드: coordinate (axis::entry 형식)
- 레인: axis 단위 수평 레이어

**인터랙션**:
- 시작 coordinate 입력
- 단계별 이동 경로 하이라이트 (step-through)

**활용 API**: `walkByCoordinate(ir, relName, startCoord)`, `indexAxis`

---

### UC-04: diff 시각화

**누가**: PR 리뷰어, taxonomy 메인테이너

**상황**: 두 버전의 taxonomy yaml(현재 브랜치 vs main, 또는 두 파일 업로드)을 비교.
12가지 DiffEntry kind(axis-added, axis-removed, entry-added, entry-removed,
label-changed, constraint-added, relation-added 등)를 시각적으로 표시.

**보여주는 것**:
- 좌우 분할 또는 통합 diff 뷰
- kind별 색상 구분 (추가=녹색, 제거=빨간, 변경=노란)
- 영향 받는 axis/entry count 요약

**인터랙션**:
- 파일 두 개 업로드 또는 텍스트 붙여넣기
- kind 필터 (axis 변경만 / entry 변경만)

**활용 API**: `diff(a, b)`, `parse(yamlText)`

---

### UC-05: doctor drift 시각화

**누가**: qa-sdk 메인테이너, CI 연동 담당자

**상황**: taxonomy yaml과 expected fixture(markdown table, JSON) 간의 drift를
시각적으로 확인. `doctor(ir, expected)` Diagnostic 목록을 패널로 표시.

**보여주는 것**:
- Diagnostic 목록 (severity 별 색상, message, axis/entry 위치)
- drift 항목 클릭 → 해당 entry 하이라이트

**인터랙션**:
- yaml 파일 + expected fixture 업로드
- severity 필터 (error only / warning 포함)

**활용 API**: `doctor(ir, expected)`, `validate(ir)`

---

### UC-06 (out of scope v1): 편집 모드

YAML 편집, entry 추가/삭제, relation 드래그는 v1에서 제외.
이유: 편집→저장 파이프라인이 서버 또는 파일 시스템 접근을 요구하며,
라이브러리의 순수성(파일 I/O 없음) 원칙과 충돌.
v2 이후 별도 설계 필요.

---

## 3. 아키텍처 옵션 + 추천

### 옵션 비교

| 항목 | (A) 정적 사이트 | (B) 클라이언트 SPA | (C) 별도 서버 |
|------|---------------|-----------------|--------------|
| 방식 | 빌드 시 yaml → JSON pre-process. Astro/Vite | React/Svelte + taxonomy-engine ESM 직접 import | Hono/Express REST API + 클라이언트 |
| 동적 갱신 | 빌드 재실행 필요 | 파일 업로드로 런타임 parse 가능 | API로 임의 yaml 전달 가능 |
| taxonomy-engine node 의존 | 빌드 시만 (node 환경) | **브라우저 호환 필요** (현재 node:fs/crypto 사용) | 서버에서만 실행 |
| 외부 사용자 host | GitHub Pages / Vercel 정적 배포 용이 | 위와 동일 (단, 라이브러리 호환 확보 후) | 별도 서버 필요 |
| 개발 비용 | 낮음 (pre-process 스크립트 추가) | 중간 (browser entry 추가 필요) | 높음 (API 설계 + 서버 운영) |
| UC 커버 | UC-01/02/03만 (고정 데이터) | UC-01~05 전부 (런타임 parse) | UC-01~05 + 편집 가능 |
| taxonomy-engine 수정 | 없음 | browser entry 추가 | 없음 |

### 결정 포인트: browser 호환

taxonomy-engine 현재 코드에서 브라우저 비호환 가능 요소:
- `node:crypto` — `contentHash` 계산 시 사용 가능성 (확인 필요)
- `node:fs` — CLI 레이어에만 있으므로 라이브러리 코어는 안전할 가능성 높음
- `js-yaml`, `zod` — 브라우저 호환

> **확인 필요**: `packages/taxonomy-engine/src/` 에서 `node:` 접두사 import 탐색

### 추천: (A) + 점진적 (B)

**v0.1 web**: 옵션 (A) — 정적 사이트
- 도그푸딩 yaml 5개를 빌드 시 pre-process → JSON 번들
- taxonomy-engine browser 호환 작업 없이 즉시 착수 가능
- GitHub Pages 배포로 외부 공개 용이

**v0.2 web**: 옵션 (B)로 전환 또는 병행
- browser entry point 추가 (`taxonomy-engine/browser` 서브경로)
- node: 의존 제거 또는 shim
- 파일 업로드로 임의 yaml 탐색 (UC-04 diff, UC-05 doctor)

**v1.0 web** (장기): 옵션 (C) 고려
- 편집 모드, 대용량 taxonomy, 팀 협업 기능이 필요할 때

---

## 4. v0.1 web 범위 (첫 출시)

### 목표

가장 작은 valuable 단위: **read-only 탐색** (UC-01 중심, UC-02 일부).

| 기능 | 포함 여부 |
|------|---------|
| 도그푸딩 taxonomy 목록 | ✅ |
| taxonomy 선택 → axis 목록 | ✅ |
| axis 선택 → entry 목록 (id, address, label, coordinate) | ✅ |
| ref 문자열 검색 | ✅ |
| contains 그래프 (트리 뷰) | ✅ 간단한 트리 — SVG 복잡 라이브러리 불필요 |
| cross-axis 흐름 (Sankey) | ❌ v0.2 web |
| diff viewer | ❌ v0.2 web |
| doctor drift 패널 | ❌ v0.2 web |
| 편집 모드 | ❌ out of scope v1 |

### v0.1 페이지 구성 (안)

```
/ (홈)
  └─ taxonomy 목록 카드 (이름, axis 수, entry 수, 검증 상태 배지)

/[taxonomy-id]
  └─ 좌측: axis 목록 사이드바
  └─ 우측: 선택한 axis의 entry 테이블

/[taxonomy-id]/[axis-id]
  └─ entry 상세 테이블 + coordinate 표시
  └─ "contains" 트리 패널 (collapsible)

/search
  └─ ref 문자열 검색 → show() 결과 패널
```

---

## 5. 데이터 흐름

### v0.1 정적 사이트 흐름

```
yaml 파일 (dogfooding 5개)
  ↓ 빌드 시 pre-process 스크립트 (Node.js + taxonomy-engine)
  ↓ parse() → validate() → 직렬화
JSON 번들 (public/data/*.json)
  ↓ 클라이언트 fetch
브라우저 → 렌더
```

**직렬화 대상 JSON 구조** (안):
```jsonc
{
  "id": "dkg-schema",
  "axes": [{ "id": "event_type", "entries": [...] }],
  "relations": [...],
  "diagnostics": [],    // validate() 결과
  "walkCache": {}       // walkRelation pre-computed (선택)
}
```

### v0.2 클라이언트 SPA 흐름

```
브라우저 파일 업로드 (또는 URL 입력)
  ↓ fetch yaml text
  ↓ parse() [browser entry]
  ↓ validate() / diff() / doctor()
렌더
```

`walkRelation`, `diff`, `doctor`는 계산 비용이 낮으므로 메인 스레드 실행 가능.
대용량 taxonomy의 경우 Web Worker 고려.

---

## 6. 라이브러리 의존성

### 핵심 결정

| 방식 | 장점 | 단점 |
|------|------|------|
| **JSON 전달만** (v0.1) | taxonomy-engine 수정 없음, 즉시 착수 | 런타임 parse 불가, 업로드 기능 없음 |
| **browser entry 추가** (v0.2+) | 전체 API 클라이언트 활용, UC-04/05 커버 | node: shim 작업 필요, 빌드 설정 추가 |
| **wasm 빌드** (장기) | 완전 호환 | 개발 비용 높음 |

### v0.1 의존성 목록

```
taxonomy-engine   — 빌드 시 Node.js 환경에서만 사용
vite or astro     — 정적 사이트 빌더
react or svelte   — UI (결정 필요 → §7)
tailwindcss       — 스타일 (결정 필요 → §7)
```

### v0.2 추가 작업

`packages/taxonomy-engine/package.json`에 `exports` 서브경로 추가:
```json
{
  "exports": {
    ".": { "import": "./dist/index.js" },
    "./browser": { "import": "./dist/browser.js" }
  }
}
```

`browser.js`에서 제외할 것:
- `node:crypto` → `SubtleCrypto` (Web Crypto API) shim
- `node:fs` — 이미 CLI 전용이므로 미포함 예상

---

## 7. 미결 사항 (사용자 결정 필요)

### 7-1. 첫 도그푸딩 대상

어떤 taxonomy가 Web UI v0.1의 쇼케이스인가?

| 후보 | 시각적 매력 | 구조 복잡도 | 비고 |
|------|------------|------------|------|
| `dkg-schema` | 높음 — 노드/엣지 풍부 | 높음 | 시각화 가장 볼만 |
| `qa-sdk-coordinate-system` | 중간 | 중간 | 메인테이너에게 친숙 |
| `lesson-builder-content` | 중간 | 낮음 | cross-axis 흐름 명확 |
| `ingest-coords` | 낮음 | 낮음 | 간단 |
| `qa-sdk-def-catalog` | 중간 | 높음 | definition 시스템 연동 |

**추천**: `dkg-schema` (시각적으로 가장 매력적, 외부 사용자 설득력)

### 7-2. 배포 대상

| 옵션 | 특징 |
|------|------|
| GitHub Pages | 무료, 정적만 가능, 자동 배포 용이 |
| Vercel | 무료 tier, 정적+함수, 자동 PR 미리보기 |
| self-host | 내부 전용, 외부 공개 불가 |

결정 필요: 외부 공개 여부.

### 7-3. UI 프레임워크

| 옵션 | 트레이드오프 |
|------|------------|
| React + Vite | 생태계 넓음, shadcn/ui 활용 가능 |
| Svelte + SvelteKit | 번들 작음, 러닝커브 있음 |
| Astro (정적 first) | v0.1에 최적, 동적 기능 추가 시 섬 아키텍처 |

**추천**: React + Vite (팀 친숙도 우선, 전환 비용 낮음)

### 7-4. 디자인 시스템

| 옵션 | 트레이드오프 |
|------|------------|
| shadcn/ui + Tailwind | 컴포넌트 제어권, 최신 생태계 |
| Tailwind만 | 컴포넌트 직접 작성 |
| CSS Modules | 의존성 최소 |

**추천**: shadcn/ui + Tailwind (빠른 프로토타이핑)

### 7-5. 그래프 시각화 라이브러리

| 옵션 | 트레이드오프 |
|------|------------|
| `@xyflow/react` (React Flow) | 인터랙티브, 노드 편집 가능, MIT |
| `d3` + SVG | 유연, 낮은 추상화, 학습 비용 |
| `cytoscape.js` | 그래프 특화, 대규모 노드 처리 |
| CSS tree 컴포넌트 (v0.1) | 라이브러리 불필요, 간단한 트리만 |

**v0.1 추천**: CSS tree 컴포넌트 (의존성 최소).  
**v0.2 추천**: `@xyflow/react` (contains 그래프 + cross-axis 흐름 동시 지원).

### 7-6. 편집 모드 v1 포함 여부

현재 스펙: out of scope v1.
포함하려면: 서버 레이어 또는 로컬 파일 시스템 접근(Tauri/Electron) 결정 선행 필요.
사용자 확인: **v0.2 대상으로 격상할지 여부?**

### 7-7. taxonomy-engine browser 호환 확인 시점

v0.2 착수 전에 `packages/taxonomy-engine/src/` 전체에서 `node:` import 탐색 필요:
```bash
grep -r "node:" packages/taxonomy-engine/src/
```
결과에 따라 shim 작업 범위 결정.

---

## 8. 구현 경로 (안)

```
T-I1 (현재): 이 설계 초안 작성
T-I2: React + Vite 프로젝트 스캐폴딩 (apps/taxonomy-web/)
T-I3: pre-process 스크립트 + JSON 번들 (도그푸딩 5개)
T-I4: 탐색 UI — taxonomy/axis/entry 3-tier 내비게이션
T-I5: contains 트리 패널 (CSS tree)
T-I6: ref 검색 패널
T-I7: 배포 설정 (GitHub Pages / Vercel)
--- (사용자 검토 후 v0.2 계획) ---
T-I8: browser entry point 추가 (taxonomy-engine)
T-I9: 파일 업로드 → 런타임 parse
T-I10: diff viewer (UC-04)
T-I11: doctor drift 패널 (UC-05)
T-I12: cross-axis 흐름 시각화 (UC-03, @xyflow/react)
```

---

## 참조

- taxonomy-engine 설계 개요: `docs/proposals/taxonomy-engine/00-design.md`
- taxonomy-engine API: `packages/taxonomy-engine/src/index.ts`
- v0.5 plan (Web UI brainstorm 포함): `docs/proposals/taxonomy-engine/05-plan-v5.md`
- 도그푸딩 목록: `packages/taxonomy-engine/dogfooding/`
