---
def:
  id: tier-redesign-integration-system-linkage-map
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: integration-map
supersedes: -
superseded_by: -
---

# 문서 관리 체계 — 기존 시스템 연계 맵

> 근거: 4개 독립 에이전트 병렬 조사 (taxonomy / doc-structure / test / rule) — 2026-04-19. 문서 관리 체계 설계에 선행되는 시스템 실태 통합.

## 요약

qa-sdk에는 **4개 독립 시스템**(Taxonomy / Doc-Structure / Test / Rule)이 이미 존재하며 각자 SSOT와 집행 지점이 있다. 하지만 **시스템 간 연결 규칙**은 산재되거나 부재 — STC 도입 전에 이 연계부터 명시적으로 정리해야 함. 총 **7건의 연결 Gap**을 식별했고, 이 중 **3건이 문서 관리 체계의 구조적 전제**로 선행 해결 대상.

## A. 4 시스템 요약 카드

### 1. Taxonomy 시스템
- **12개 taxonomy 존재**: scope(7) / aspect(22) / layer(4) / depth(4) / level(3) / tier(4, STC 신규) / doc-type-ext(7) / knowledge_kind(8+) / lifecycle(5) / axis(동적85) / prefix(동적51) / DKG-node(16) / DKG-edge(18)
- **SSOT**: `packages/definition-catalog/src/taxonomy.ts:40-110` + `docs/specs/definition-catalog/definition-taxonomy.spec.md`
- **직교성 확정 5건**: tier⊥doc-type / tier⊥scope+aspect / depth⊥tier(D-6) / layer⊥scope / System⊥meta-semantic(D-17)

### 2. Doc-Structure 시스템
- **frontmatter SSOT** + `def:` block 스키마 (L1-270 `frontmatter.ts`)
- **파싱 → 등록 → 연결 3단계 파이프라인** (`scanAndBuild` L451-546)
- **LinkType 8종 정의, 6종 실사용** (contains/depends_on/implements/refines/constrains/traces_to + 정의만 evolves_from/supersedes)
- **저장소**: SQLite (definition-service, port 3700) — Drizzle ORM `documents` + `document_links` 테이블
- **검증**: `validate.ts` 6 diagnostic (broken-link/circular-ref/self-ref/orphan/multi-parent/contains-depth-violation)
- **좌표 인코딩**: scope×aspect×depth → WeightedIndex 정수 주소 (`def_document:v1:<address>`, L105-119, L162-210 v2 unique seq)

### 3. Test 시스템
- **.test.md 27개** — 27 파일 (rlsc 11 / scope-nesting 4 / gate 2 / 기타 10)
- **SSOT 방향**: 코드(test.ts)가 원본, .test.md는 시나리오 매핑 (frontmatter `source` 필드로 역링크)
- **testing-patterns 8종 표준** (`docs/specs/system/testing-patterns.spec.md`): SSOT 파생 + InMemory 주입 + `NodeSqliteDriver(":memory:")` + 라운드트립 증명
- **facet-test-isolation**: `@facet` 마커로 순수 로직 추출 후 별도 패키지 테스트 (rclone 동기화)
- **약점**: testName 토큰 자동화는 설계 문서만 / 양방향 추적 약함 / coverage 선언 부재

### 4. Rule 시스템
- **7계층 규칙 체계**: 문서(.rule.md 11개) / Zod(env/frontmatter) / validateGraph / DKG Constraints(CON-001~007) / Code Policy(taxonomy.ts) / Skills(7종) / Convention(CLAUDE.md+CONVENTIONS.md)
- **Cross-Loop Bridge**: Decision↔Definition↔Infra 6 loops (`definition-cross-loop-bridge.rule.md`)
- **Guard 순서**: Decision success → Doc approved → Gate complete → Convention compliant
- **약점**: CON-002/CON-005 구현 위치 불명 / Rule↔Taxonomy 바인딩 산재 / scope-aspect SSOT가 코드 중심(문서화 간극)

## B. 시스템 간 연결 맵

```
                   ┌────────────────────────────────┐
                   │  Taxonomy (12 축, 직교성 5건)  │
                   │    scope × aspect × layer ×    │
                   │    depth × [tier (STC 신규)]   │
                   └──────────┬─────────────────────┘
                              │ 축 값 제공
                              ↓
┌─────────────────────────────────────────────────────┐
│            Doc-Structure (frontmatter + graph)       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ frontmatter  │  │  LinkType 6  │  │ SQLite DB │  │
│  │   SSOT       │  │  (graph)     │  │ + CLI     │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                 │                │        │
│         └─────────────────┼────────────────┘        │
│                           │                         │
│                           ↓                         │
│              validate.ts (6 diagnostic)             │
└──────────────┬──────────────────────────┬───────────┘
               │                          │
    ┌──────────┴────────┐      ┌──────────┴───────────┐
    ↓                   ↓      ↓                      ↓
┌─────────────────┐  ┌─────────────────────────────────┐
│ Test 시스템     │  │  Rule 시스템 (7계층)            │
│ .test.md + .ts  │  │  .rule.md / Zod / validateGraph │
│ facet marker    │  │  DKG CON-001~007 / Skill / Conv │
│ coverage        │  │  Cross-Loop Bridge (6 loops)    │
└─────────────────┘  └─────────────────────────────────┘
         │                      │
         └──────────┬───────────┘
                    │ 문서 ↔ 실증
                    ↓
         [문서가 reality와 drift 없나?]
```

## C. 공통 SSOT 매트릭스

| SSOT 계층 | 위치 | 담당 범위 | 취약점 |
|---------|------|---------|-------|
| **frontmatter** | 각 .md 파일 `def:` block | 문서 메타데이터 | zod 없는 inline 검증 |
| **taxonomy code** | `packages/definition-catalog/src/taxonomy.ts` | scope/aspect 조합 정의 | 문서 SSOT와 이중화 |
| **validation code** | `packages/definition-catalog/src/validate.ts` | graph 무결성 | diagnostic 6종만 (CON-* 일부 미커버) |
| **runtime catalog** | `packages/index-meta/src/prefix-registry.ts` | axis/prefix 카탈로그 | 메타데이터 체계와 존재 층위 다름 |
| **DKG spec** | `docs/specs/dkg-system/dkg-*.spec.md` | 설계 그래프 노드/엣지 | STC tier 매핑 부재 |
| **policy doc** | `CLAUDE.md`, `CONVENTIONS.md`, `docs/specs/**/*.rule.md` | 프로젝트 규칙 | 위치 산재 |
| **skill** | `skills/**/SKILL.md` | 운영 워크플로우 | 7계층 중 운영 계층 |
| **test code** | `packages/*/src/**/*.test.ts` | 실증 | .test.md와 단방향 연결 |
| **test doc** | `docs/specs/**/*.test.md` | 시나리오 매핑 | 수동 동기화 |

## D. 연결 Gap 7건 (우선순위 분류)

### P0 — 문서 관리 체계 구조 전제 (선행 필수)

**Gap 1: Taxonomy Catalog 중앙화 부재**
- **현상**: 12개 taxonomy SSOT가 `taxonomy.ts` + `definition-taxonomy.spec.md` + `definition-system-philosophy.md` + `CONVENTIONS.md`에 분산. 신규 taxonomy(tier 등) 추가 시 어느 문서 갱신 필수인지 불명
- **영향**: Phase 1.B에서 `tier` 추가 시 스키마 동시 갱신 위치 추적 어려움
- **권고**: `docs/specs/system/taxonomy-catalog.spec.md` 신설 — 모든 taxonomy의 값 공간 + 생성 규칙 + 직교성 주장 단일 진입점

**Gap 2: SSOT Direction 명시 부재 (code ↔ doc)**
- **현상**: scope-aspect 22 조합은 `taxonomy.ts` 상수가 SSOT이나 문서에 반영 의무 규칙 없음. frontmatter `tier` 추가 시 zod ↔ spec 문서 중 누가 원본?
- **영향**: Phase 1.B에서 이중 소유 발생 위험
- **권고**: 각 taxonomy별 "code ↔ doc 중 어느 쪽이 SSOT인지" 명시 테이블

**Gap 3: LinkType 6 ↔ DKG edge 18 변환 테이블 부재**
- **현상**: 문서 LinkType(contains/depends_on/implements/refines/constrains/traces_to) vs DKG edge 18종(satisfies/implements/tests/traces-to/composes/...)의 매핑 규칙 미정
- **영향**: 문서 그래프와 설계 그래프가 동일 개념을 다르게 표현 — 이중 소유
- **권고**: 변환 매트릭스 + "문서 grafa = DKG 하위 projection" 같은 종속 관계 선언

### P1 — STC 도입 시 필수 (Phase 1.B 착수 전)

**Gap 4: Runtime(axis/prefix) ↔ Metadata(tier/scope) 층위 연결**
- **현상**: axis/prefix는 런타임 카탈로그, tier/scope는 문서 메타데이터. 두 층위의 매핑 규칙 없음 — "AxisNode → 어느 tier 문서?" 미정
- **영향**: STC Component tier의 axis 카탈로그 연결이 가설 상태
- **권고**: Phase 1.B에서 AxisNode/PrefixNode → Component(data-shape sub-type) 매핑 예시 문서화

**Gap 5: DKG 16 노드 ↔ STC 4 tier 매핑 부재**
- **현상**: DKG SpecNode/TransitionSpecNode/SchemaNode 등 16종 ↔ Component/Entry/System/Layout 4종 매핑 테이블 없음
- **영향**: 동일 문서가 DKG에서는 SpecNode, STC에서는 System tier로 이중 분류될 때 불일치 감지 불가
- **권고**: DKG 노드별 "권장 tier" + "tier로 표현 시 잃는 정보" 명시

### P2 — 개선 여지 (Phase 2~3)

**Gap 6: .test.md ↔ .test.ts 양방향 추적 자동화 부재**
- **현상**: source 필드 단방향만. testName 토큰 자동 생성 설계 문서만 존재
- **영향**: 테스트 추가/삭제 시 문서 drift 감지 불가
- **권고**: Phase 3 Pilot에서 testName 토큰 자동화 PoC

**Gap 7: CON-002/CON-005 집행 위치 불명**
- **현상**: DKG Constraints 7개 중 5개는 집행 지점 있으나 CON-002(action_dim 축), CON-005(critical anomaly auto observation)는 코드/skill 위치 불명
- **영향**: Rule 계층 1(DKG)이 Level 3(Document Rule)로만 존재 — 집행 공백
- **권고**: 2개 constraint의 구현 위치 명시 또는 집행 skill 추가

## E. 문서 관리 체계 설계 원칙 (5건)

### 원칙 1 — Taxonomy Catalog 단일 진입점
모든 분류 축은 `taxonomy-catalog.spec.md` 단일 문서에서 **열람 가능**해야 한다. 실제 SSOT는 code/doc 어느 쪽이든 가능하되, 카탈로그 문서가 **어느 쪽이 SSOT인지** 명시한다.

### 원칙 2 — LinkType은 DKG edge의 문서 레벨 projection
LinkType 6종은 DKG 18 edge 중 "문서-문서 관계"에 해당하는 부분집합. LinkType → DKG edge 변환 테이블로 projection 관계를 박제.

### 원칙 3 — Runtime 카탈로그와 Metadata 체계는 **다른 층위**
axis/prefix(런타임)와 tier/scope(메타데이터)는 직접 연결하지 않고, **중간 문서**(Component tier data-shape sub-type 등)를 경유한다. 두 층위를 직접 엮으면 이중 소유 발생.

### 원칙 4 — 실증(테스트) ↔ 명세(spec) 방향 고정
코드가 SSOT, .test.md는 파생. 문서에서 `source: path/to/test.ts` 선언이 의무. `def validate`가 source 경로 존재 검증 (Phase 1.B 확장 대상).

### 원칙 5 — Rule 계층 7종은 Guard 순서로 연쇄
Decision → Doc approved → Gate complete → Convention compliant (Cross-Loop Bridge 순서). 상위 Guard 실패 시 하위 검사 skip. `def validate` 실패 시 DKG constraint 재검사 자동 제안.

## F. 실행 우선순위

| 우선순위 | 작업 | 의존 | 산출물 |
|--------|------|------|-------|
| **P0-1** | `taxonomy-catalog.spec.md` 신설 | — | 12 taxonomy 단일 진입점 |
| **P0-2** | SSOT Direction 테이블 (code ↔ doc) | P0-1 | 이중 소유 방지 |
| **P0-3** | LinkType ↔ DKG edge 변환 매트릭스 | P0-1 | 문서 ↔ 설계 grafa 정합 |
| **P1-1** | Runtime/Metadata 연결 경유 문서 | P0-1 | Phase 1.B `tier classify`의 기반 |
| **P1-2** | DKG 노드 ↔ STC tier 매핑 | P0-3 | ECS 적응 범위 명시 |
| **P2-1** | .test.md testName 자동화 PoC | — | 테스트 drift 감지 |
| **P2-2** | CON-002/CON-005 집행 명시 | — | Rule 계층 공백 해소 |

**권고**: P0 3건은 **Phase 1.B 착수 전 선행 완료**. P1 2건은 Phase 1.B와 병행. P2 2건은 Pilot 이후.

## G. 연결 다음 산출물 (미작성)

- `docs/specs/system/taxonomy-catalog.spec.md` (P0-1)
- `docs/specs/system/ssot-direction-table.spec.md` (P0-2, taxonomy-catalog의 subsection일 수 있음)
- `docs/specs/dkg-system/linktype-dkg-edge-mapping.spec.md` (P0-3)
- `docs/specs/meta-semantic/runtime-metadata-bridge.spec.md` (P1-1)
- `docs/specs/dkg-system/dkg-node-to-stc-tier.spec.md` (P1-2)

모두 **정규 `docs/specs/` 트리에 배치 대상** — STC 제안 수락 이후 정규 spec으로 이식되는 시점에 함께 정리.
