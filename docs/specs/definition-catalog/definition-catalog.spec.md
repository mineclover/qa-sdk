---
def:
  id: definition-catalog-spec
  intent_hierarchy: core
  type: design
  tier: system
  address: def_document:v2:342162
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-catalog
  owner_system: definition-service
  projection_plane: intent
  tags: [structural, entry-point]
  sources:
    - packages/cli/src/commands/def.ts:cmdAuditDb
    - packages/cli/src/commands/def.test.ts
  links:
    - target: system-concepts
      type: depends_on
    - target: definition-taxonomy
      type: refs
    - target: definition-concern
      type: refs
    - target: definition-extraction
      type: refs
    - target: definition-assembly
      type: refs
    - target: definition-contract
      type: refs
    - target: definition-state-model
      type: refs
    - target: definition-quality-gates
      type: refs
    - target: docs-control-plane
      type: refs
    - target: definition-harness
      type: refs
    - target: definition-management
      type: traces_to
    - target: definition-cross-loop-bridge
      type: refs
    - target: definition-data-source
      type: refs
    - target: definition-service
      type: refs
    - target: federated-architecture-governance
      type: constrains
---

# Definition Catalog — 소프트웨어 정의 좌표계

## 목적 ^purpose

비즈니스 로직 정의를 좌표 주소로 분류하고, contains 계층으로 조립하는 문서 메타데이터 시스템.

## 연결 시스템과의 경계 ^constraint

`definition-catalog`은 qa-sdk의 기존 중간 연결 방향에서 **정의 그래프와 정의 주소**를 담당한다. 원본 시스템의 local ID, source reference, connection identity, source 간 crosswalk를 소유하지 않는다.

- definition address는 문서·계약을 식별하는 qa-sdk 내부 좌표이며 source record의 canonical ID가 아니다.
- definition graph와 federation relation graph는 별도 그래프다. 필요한 연결은 reference, adapter, mapping evidence로 표현한다.
- `definition-service`와 `definition-data-source`는 definition metadata의 persistence/read bridge를 제공하지만 source 업무 데이터의 master store가 아니다.
- connection identity/crosswalk가 필요할 때 definition-catalog의 taxonomy나 graph model에 임의로 추가하지 않고, 별도 연결 시스템 계약을 통해 참조한다.

## 정의 ^defines

- 1문서=1좌표 정체성 원칙
- 좌표 동형 (DEFINITION_CATALOG ≡ DemoCatalog)
- Frontmatter SSOT 계약 (scanAndBuild)
- 운영 컨벤션 C1~C12

## 위임 ^delegates

- **taxonomy** → 분류 축 정의
- **concern** → 전파 규칙
- **extraction** → 마커 추출
- **assembly** → 문서 조립
- **contract** → 계약 조립
- **state-model** → FSM 엔진 + 머신
- **quality-gates** → 품질 게이트
- **docs-control-plane** → cross-document adapter/control-plane 경계
- **harness** → 상태 관리 자동화

## 구성 ^overview

하위 구성:

- **definition-taxonomy**: 분류 축(scope, aspect, depth, level, layer, link_type)
- **definition-concern**: concern 전파 규칙 (7종 × link 그래프 BFS)
- **definition-extraction**: ^purpose/^overview 마커 기반 요약 추출
- **definition-assembly**: assembleFeature() 그룹 멤버 조립
- **definition-contract**: 계약 조립 (8종 마커 + evidence 가역성 + 통계)
- **definition-state-model**: FSM 엔진 + 11개 상태 머신 정의
- **definition-quality-gates**: 품질 게이트 통합 (6단계 프로세스 + gate-fsm + gate-derivation)
- **docs-control-plane**: definition/PRD/session/evidence source를 read-only adapter로 모아 보는 CLI control plane
- **definition-harness**: 상태 모델 적용층 (의존/프로세스/SDK수집)

## 참조

관련 스펙: [df-system.md](../decision-flow/df-system.md)

## 관련 소스

- `packages/definition-catalog/src/` — 구현

## 상태

implemented — current model is owned by `packages/definition-catalog/src/`, `definition-data-source`, and `definition-service`.

## 현재 모델

### SSOT

- 문서 파일의 YAML frontmatter `def:` 블록이 SSOT다.
- registry, SQLite, search index, code reference map은 모두 파생물이다.
- `skills/`는 실행 정의 SSOT이고, `docs/skills/`와 `docs/specs/skill-catalog/`는 설명/카탈로그 레이어다.

### 핵심 흐름

```text
docs/*.md frontmatter
  → scanAndBuild()
  → MemoryDefinitionRegistry
  → syncDocsToLocalDb()
  → documents / document_links / code_references
  → DefDataSource(local|server|scan)
  → qa-sdk def ...
```

### Frontmatter 블록 3종

| 블록 | 파서 | 역할 |
|------|------|------|
| `def:` | `extractDef(parsed, filePath)` | 문서 메타데이터 (id, scope, aspect, lifecycle 등) |
| `gate:` | `extractGate(parsed, filePath)` | 품질 게이트 선언 (kind, workDomain, command) |
| `tests:` | `extractTests(parsed)` | 테스트 선언 (name, kind, scope, phase, intent) |

`FrontmatterTest` 인터페이스: `{ name, kind, scope, phase?, intent, module?, participants? }`.
`ParsedDocument.tests`로 반환. CLI `qa-sdk test scan`에서 소비.

### 검증 표면

- `def sync`
  docs SSOT를 SQLite datasource에 반영한다.
- `def validate`
  synced graph 기준의 구조 위반과 code reference boundary 정합성을 본다.
- `def scan-audit`
  raw frontmatter 기준 스캔 에러, 링크 에러, graph 규칙을 본다.
- `def audit-db`
  approved 문서의 purpose, 짧은 목적문, 고립, svc 부여 상태를 빠르게 점검한다. Layout/pack
  구성원의 incoming `refs`는 유효한 배치 연결로 인정하여 고립 false positive를 만들지 않는다.
- address-first 조회
  `def get --address`, `def incoming|outgoing --address`, `def impact --address`로 canonical address 기준 탐색을 지원한다.
- docs control plane
  `qa-sdk docs`는 definition markdown, PRD markdown/JSON, ralph session, evidence registry를 neutral envelope로 모아 status/collect/search/drift/PRD authoring context를 제공한다. source 파일은 계속 SSOT이고 adapter는 read-only다.

### 문서 그래프 규칙

- `contains`
  소속과 조립 구조를 표현한다.
- lateral links
  `depends_on`, `implements`, `refines`, `constrains`, `traces_to`, `evolves_from`, `supersedes`
- `cross-scope`
  의도적 다중 부모/공유 소속을 명시한다.

### 코드 매핑 규칙

- `qa-sdk def find-by-file`는 추정이 아니라 explicit mapping만 쓴다.
- 입력은 문서 frontmatter `source:`와 코드 주석 `@def.boundary`, `@def.doc`다.
- `def sync`가 `code_references`를 정규화한다.

## 운영 진입점

- taxonomy / coordinates / level
  분류 축과 주소 체계
- management
  좌표 부여, 링크, 상태, 피드백, 검증 루프
- quality-gates
  contract marker 기반 품질 게이트와 claim verdict
- docs-control-plane
  definition/PRD/session/evidence를 함께 읽는 CLI control plane
- harness
  문서 상태를 기계적으로 추적하는 실행 레이어

## 관련 소스

- `packages/definition-catalog/src/frontmatter.ts`
- `packages/definition-catalog/src/validate.ts`
- `packages/definition-data-source/src/sync-local-db.ts`
- `packages/definition-data-source/src/local-data-source.ts`
- `packages/definition-service/src/modules/docs/`
- `packages/definition-service/src/modules/graph/`

### 문서 작성 컨벤션

**C8. 모든 문서에 frontmatter + `## 목적 ^purpose` 필수**

```yaml
---
def:
  id: <고유 ID>
  scope: <scope>
  aspect: <aspect>
  depth: <depth>
  lifecycle: <lifecycle>
  tags: [<태그들>]          # 선택
  links:                    # 선택
    - target: <대상 ID>
      type: <관계 유형>
---
```

본문 첫 번째 `##` 섹션은 반드시 `## 목적 ^purpose`.

**C9. `## 목적 ^purpose` — 이 문서가 무엇인가를 서술**

섹션 분량으로 작성. 작성자가 요약에 포함할 내용을 통제한다.
assembleFeature()가 이 섹션을 수집하여 그룹 요약을 조립한다.

**C10. `## 방법 ^method` — 하위 구성요소로 목적을 어떻게 달성하는가** (module/group 권장)

하위 구성요소를 주어로 써서 목적 달성 경로를 서술한다.
`^delegates` 목록의 각 항목이 무엇을 하는지 흐름으로 연결.

**C11. `## 구성 ^overview` — 핵심 사실을 나열** (선택)

무엇이 있는가, 몇 개인가, 주요 항목 목록.
purpose보다 구체적이지만 상세 내용은 아닌 수준.

**C12. 마커 없는 섹션 = detail (full에서만 보임)**

`## 엔드포인트`, `## 상태 정의` 등 마커 없는 섹션은 full 추출에서만 보인다.

**C13. 그룹 문서는 overview depth + contains 링크**

```yaml
def:
  id: <시스템>-system
  scope: flow
  aspect: process_flow
  depth: overview
  links:
    - target: <멤버 ID>
      type: contains
```

그룹 문서의 `## 목적 ^purpose`에 시스템 전체 목적,
`## 구성 ^overview`에 멤버 목록과 구성 요약.

---

## 5. 구현 현황

| 구현 | 파일 |
|------|------|
| 핵심 타입 (축, concern, entry, link, filter) | `types.ts` |
| 5축 정의 + AXIS_META | `vocabulary.ts` |
| 분류 체계 트리 + 제약 맵 + 컨벤션 + 태그 | `taxonomy.ts` |
| 카탈로그 (axes + 2 prefixes) | `catalog.ts` |
| 좌표 인코딩/디코딩 | `observe.ts` |
| 인메모리 레지스트리 | `registry.ts` |
| concern 전파 엔진 | `concern.ts` |
| 마커 기반 추출 | `extract.ts` |
| 문서 조립 | `assemble.ts` |
| frontmatter 파서 + 스캐너 | `frontmatter.ts` |
| decision-flow 브릿지 | `bridge.ts` |
| public exports | `index.ts` |

### 검증

| 테스트 | 검증 내용 |
|--------|----------|
| `taxonomy.test.ts` | scope-aspect 제약, 태그, 컨벤션, cross-scope 감지 |
| `observe.test.ts` | 라운드트립, capacity 규칙 |
| `registry.test.ts` | CRUD, 질의, 관계, 통계 |
| `address-collision.test.ts` | 같은 유형 문서 다수 등록/삭제 |
| `concern.test.ts` | 7종 concern 전파 규칙, 순환 안전 |
| `extract.test.ts` | ^purpose/^overview 마커 추출 |
| `hierarchy.test.ts` | contains 묶음, 교집합, 계층 상속 전파 |
| `assemble.test.ts` | assembleFeature 조립 + 마커 커버리지 100% |
| `sample.test.ts` | 결제 시나리오 9문서 × 10관계 |
| `real-docs.test.ts` | qa-sdk 20문서 수동 등록 질의 |
| `frontmatter.test.ts` | 파서 단위 + 스캔 통합 |
| `scan-real.test.ts` | docs/ 디렉토리 스캔 |
| `gate-docs.test.ts` | gate 7문서 scope 분리 + 그룹 + concern |
| `ingest-docs.test.ts` | ingest 12문서 분할 + 조립 + concern 전파 |

### 운영 문서 (24건)

| 그룹 | 문서 | scope | contains |
|------|------|-------|:--------:|
| — | system-overview | flow/overview | — |
| — | definition-catalog-spec | data/specification | — |
| — | df-state-model | state/specification | — |
| — | gate-api | interface/specification | — |
| **gate** | gate-system | flow/overview | **6 멤버** |
| | gate-api | interface/specification | — |
| | gate-state-model | state/specification | — |
| | gate-engine-func | feature/specification | — |
| | gate-flow | flow/specification | — |
| | gate-constraint | constraint/specification | — |
| | gate-scenario | feature/validation | — |
| **ingest** | ingest-system | flow/overview | **11 멤버** |
| | ingest-api-spec | interface/specification | — |
| | query-api-spec | interface/specification | — |
| | scenario-api-spec | interface/specification | — |
| | stream-api-spec | interface/event_contract | — |
| | verdict-api-spec | interface/specification | — |
| | admin-api-spec | interface/specification | — |
| | record-spec | data/specification | — |
| | trace-spec | data/specification | — |
| | session-spec | data/specification | — |
| | ingest-pipeline-flow | flow/specification | — |
| | ingest-infra-spec | constraint/specification | — |

---

## 6. Quality Gates

```
pnpm --filter definition-catalog typecheck   # 타입 체크
pnpm --filter definition-catalog test        # 248 tests (14 files)
pnpm --filter definition-catalog build       # ESM + CJS 빌드
```

---

## 7. 현재 범위와 경계

### 현재 범위

- 1개 비즈니스 로직 = 1개 좌표 = 1개 문서
- contains 계층으로 그룹 조립 (묶음/교집합/상속)
- ^purpose/^overview 마커로 요약 추출
- assembleFeature()로 그룹의 목적+멤버 요약 자동 조립
- frontmatter SSOT → scanAndBuild → registry 파생
- concern 전파: 7종 × 7개 link type (contains 포함)

### 후속 과제

| 과제 | 설명 |
|------|------|
| DEMO_CATALOG 통합 | definition 축/prefix를 DEMO_CATALOG에 추가 |
| CLI 연동 | `qa-sdk def sync/list/validate/audit` 등 DefDataSource 기반 명령 |
| 자동 link 추론 | 좌표 유형 간 구조적 관계에서 link를 자동 생성 |
| 커버리지 히트맵 | scope × aspect별 문서 존재/부재 시각화 |
| 나머지 문서 frontmatter 주입 | docs/specs/ 200+건에 점진적 frontmatter 추가 |
