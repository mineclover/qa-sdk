---
status: draft
date: 2026-04-19
part_of: tier-redesign
role: scope-clarification
topic: primary-goal-and-legacy-deprecation
---

# STC 제안 — 범위·목적 재정의 + 레거시 처리 매트릭스

> 근거: [integration/system-linkage-map.md](./system-linkage-map.md) 분석 결과를 바탕으로 제안 범위를 1차/2차 목표로 재정리 + 레거시 판정.

## 요약

본 제안의 **주 목적(1순위)**은 모호한 `level: group | module | leaf` 체계를 **`tier: component/entry/system/layout`로 교체**하는 것. 그 외 변경은 **주 목적을 지원하기 위해 기존 체계 중 "같은 목적을 이중으로 수행하는" 부분을 레거시로 처리**하는 부차 범위. 공존 가능한 직교 축(scope / aspect / layer / depth / doc-type-ext 등)은 **건드리지 않음**.

## 1. 제안 범위 — 명시적 분리

### 1.1 주 목적 (Primary — 반드시 달성)

**`level` (group/module/leaf) → `tier` (component/entry/system/layout) 교체.**

근거:
- `level`의 3값은 "분해 깊이"를 의미하지만 실제 문서에서 **의미가 모호**(group이 System을 포함할 수도, Layout을 나타낼 수도 있음)
- Phase 1.A 조사: `level: group` 13개 중 **9개가 Layout 성격, 117개 module-contains-module이 System 독립성 위반**
- tier는 **"이 문서가 무엇인가"** (Component/Entry/System/Layout)를 명시해 모호성 제거

### 1.2 부차 범위 (Secondary — 주 목적 지원)

주 목적을 수행하기 위해 **반드시 조정해야 할** 기존 체계:

| 기존 체계 | 조정 사유 | 조정 방식 |
|---------|---------|---------|
| `contains` LinkType (Layout-like 용도) | Layout tier 도입 시 "System 포함"을 `contains`로 표현하면 System 독립성 위반 | **신규 `refs` LinkType으로 분리** — Layout→System은 `refs`, 문서-문서 계층은 `contains` 유지 |
| FSM tier (이전 설계) | meta-semantic `PipeTransitionScope`와 이중 소유 | **이미 D-17로 제거 완료** (레거시 처리 완료) |
| LinkType 6 ↔ DKG edge 18 중복 5건 | `def validate` 구현 시 같은 관계를 두 번 검증하면 diagnostic 중복/누락 | **정합 규칙 명시** (§3 매트릭스) |

### 1.3 범위 외 (Out of Scope — 공존)

기존 체계 중 **tier와 직교하거나 층위가 달라 공존 가능한 것**은 건드리지 않는다. 단, **D-19 결정(최상위 분류 체계 도입)**에 따라 이 축들의 필수 적용 여부가 `type` 필드에 의해 제어된다.

| 축 (Axis) | 설명 | `type: design` (설계) | `type: knowledge` (지식) |
|---|---|---|---|
| `scope` (7값) | 관심사 축 | **필수** (정밀 좌표) | 선택 (포괄적 부여 가능) |
| `aspect` (22값) | scope 내 세분화 | **필수** (정밀 좌표) | 선택 |
| `depth` (4값 enum) | 상세도 축 | **필수** (D-6 유지 확정) | 선택 |
| `layer` (4값) | 존재 이유 축 | 선택 | 선택 |
| `doc-type-ext` (7값+) | 파일 확장자 역할 축 | **`.spec`, `.rule` 등 필수** | `.md`, `.memo` 등 사용 |
| `knowledge_kind` | 지식의 성격 | **사용 금지** | **필수** |
| `tier` (4값) | STC 구조 축 (본 제안 신설) | **필수** | **면제** |
| `lifecycle` | 상태 축 (draft/approved) | 적용 | 적용 |

그 외 다음의 런타임 및 그래프 요소들도 본 제안의 범위 밖이며 그대로 유지된다:
- `axis` / `prefix` — 런타임 카탈로그, 메타데이터와 다른 층위
- DKG 16 노드 — 설계 그래프, tier보다 상위 추상화

이들에 대한 변경 제안은 **별도 proposal로 분리** (본 제안에 흡수하지 않음).

## 2. 레거시 판정 매트릭스

본 제안이 accepted 되면 아래와 같이 처리:

| 기존 | 신규 | 판정 | 처리 단계 |
|------|------|------|---------|
| `level: group` (Layout 성격) | `tier: layout` | **대체** | Phase 4A warning → Phase 4B error → Phase 5 `level` 필드 제거 |
| `level: group` (다른 성격) | `tier: component` 또는 `tier: system` | **대체** | 동일 |
| `level: module` | `tier: system` 또는 `tier: component` | **대체** | 동일 |
| `level: leaf` | `tier: component` 또는 `tier: entry` | **대체** | 동일 |
| `level` 필드 자체 | `tier` 필드 | **제거 예정** | Phase 5에서 스키마에서 삭제 |
| `docs/specs/definition-catalog/definition-level.spec.md` | `docs/specs/system/doc-tier-convention.spec.md` (신설) | **대체 문서** | Phase 5에서 `superseded_by:` 마킹 |
| `contains` LinkType (Layout 용도) | `refs` LinkType | **대체** (용도 분리) | Phase 4B에서 Layout→System `contains` 금지 error |
| `contains` LinkType (문서 계층 용도) | 유지 | **공존** | depth-violation(>4) 경고는 유지 |
| FSM tier (이전 설계) | `lifecycle_ref` (state_component + pipe_refs) | **제거 완료** | D-17로 처리 완료 |
| `^gate:` 마커 (이전 FSM 용어) | `^guard:` 마커 | **제거 완료** | 이미 일괄 전환 |

**제거 예정 개수 (Phase 1.A 조사 결과)**:
- `level` 필드 사용 문서: 1,056건 → Phase 5에서 전수 제거
- System-contains-System 위반: 117건 → Phase 4B에서 `depends_on` 전환 error 강제
- Layout-like group: 9건 → Phase 3 Pilot에서 `tier: layout` + `refs` 전환

## 3. LinkType ↔ DKG edge 정합 규칙

### 3.1 원칙

**LinkType은 DKG edge의 "문서-문서 정적 관계 projection"**. 같은 관계를 두 체계에서 선언하면 **LinkType이 SSOT**, DKG는 동일 값을 자동 projection.

- 문서-문서 정적 관계 → **LinkType이 SSOT** (DKG는 mirror)
- 문서-비문서(코드/이벤트/런타임) 또는 dynamic 관계 → **DKG 단독 소유**

### 3.2 중복 5건 해소

| LinkType | DKG edge | 해소 |
|----------|---------|-----|
| `contains` | `contains` | LinkType이 SSOT. DKG `contains`는 LinkType값 그대로 projection |
| `depends_on` | `depends-on` | LinkType이 SSOT. DKG는 표기 정규화(`depends-on` → `depends_on`)하여 projection |
| `implements` | `implements` | LinkType이 SSOT |
| `constrains` | `constrains` | LinkType이 SSOT |
| `traces_to` | `traces-to` | LinkType이 SSOT. 표기 정규화 |

→ `def validate`는 **LinkType 기반**으로 검증. DKG edge 동명은 **별도 검증 없음** (projection이므로 LinkType이 통과하면 자동 통과).

### 3.3 LinkType 단독

| LinkType | DKG 대응 |
|----------|---------|
| `refines` | DKG에 직접 대응 없음 — 문서 전용 "상세화" 관계. DKG에 일반화 필요 시 `composes` 또는 `references`로 약화 projection |

### 3.4 DKG 단독 (LinkType에 추가 안 함)

dynamic 관계 또는 비문서 노드 관계 — **LinkType 확장 대상 아님**:

- `tests` (문서↔test 파일) — 문서의 `source` 필드로 부분 표현 (LinkType 불필요)
- `observes`, `prompts`, `bridges`, `consumes`, `binds`
- `satisfies`, `composes`, `references`, `governs`, `justifies`
- `evolves-from`, `supersedes` — 둘 다 양쪽 정의만 있고 실사용 낮음. **양쪽 레거시 처리 후보** (별도 제안)

### 3.5 정합 규칙 배포 위치

본 매트릭스는 P0-3 산출물 `docs/specs/dkg-system/linktype-dkg-edge-mapping.spec.md`로 이관 (제안 수락 후). 본 제안 단계에서는 **본 문서 §3**가 임시 SSOT.

## 4. 본 제안이 "하지 않는" 것 (Non-Goals 재확인)

주 목적(level → tier)과 부차 범위(`refs` LinkType, LinkType↔DKG 정합) 외 **모두 out of scope**:

- ❌ scope / aspect 카탈로그 변경
- ❌ layer / depth 체계 변경 (depth는 D-6 유지 확정)
- ❌ doc-type-ext 체계 변경 (.spec/.rule/.todo 등)
- ❌ knowledge_kind 체계 변경
- ❌ axis / prefix 런타임 카탈로그 변경
- ❌ DKG 16 노드 구조 변경
- ❌ DKG edge 18 이름 변경 (`depends-on` → `depends_on` 표기 정규화는 mapping spec에서만 권고)
- ❌ meta-semantic 체계 변경 (D-17 위임만, 내부 구조는 그대로)
- ❌ testing-patterns 체계 변경
- ❌ Rule 7계층 구조 변경
- ❌ PRD 형식 / .claude/ / tasks/ 체계 변경

**공통 원칙**: 건드리지 않는 체계가 **tier 도입 후에도 그대로 동작해야 함**을 Phase 1.B validate에서 확인 (회귀 방지).

## 5. 본 제안이 갱신할 정규 문서 (Phase 5)

accepted 이후 `docs/specs/` 정규 트리로 이식되는 스펙:

**신설** (5건):
1. `docs/specs/system/doc-tier-convention.spec.md` — tier 필드 스키마 + 판단 기준
2. `docs/specs/system/doc-tier-layout-rule.spec.md` — Layout tier의 `refs` 규칙
3. `docs/specs/system/doc-tier-lifecycle-ref.spec.md` — System의 `lifecycle_ref` 사양
4. `docs/specs/system/doc-tier-migration.spec.md` — level → tier 전환 가이드 (Phase 1~5 압축)
5. `docs/specs/dkg-system/linktype-dkg-edge-mapping.spec.md` — LinkType ↔ DKG edge 정합 (P0-3)

**갱신** (superseded_by 또는 본문 수정):
1. `docs/specs/definition-catalog/definition-level.spec.md` — `superseded_by: doc-tier-convention.spec.md` + 레거시 마킹
2. `docs/specs/definition-catalog/definition-taxonomy.spec.md` — tier 축 추가 반영
3. `docs/definition-system-philosophy.md` — level 설명 삭제, tier 반영

**레거시 처리** (Phase 5 삭제 또는 historical 전환):
1. `level` 필드 (스키마 + 모든 frontmatter)
2. System-contains-System 링크 117건 (Phase 4B에서 자동 전환)

## 6. 레거시 판정 기준 (향후 재사용)

본 제안이 **"공존 vs 대체" 판정**에 사용한 기준 (향후 새 제안에서도 참고 가능):

| 질문 | 판정 |
|------|-----|
| 동일 개념을 두 체계가 표현하는가? | 예 → 한쪽을 **대체 후보** (SSOT 일원화) |
| 축이 직교적인가 (서로 다른 질문에 답하는가)? | 예 → **공존** |
| 존재 층위가 다른가 (metadata vs runtime 등)? | 예 → **공존 + 경유 문서** (P1-1 방식) |
| 한쪽이 다른 쪽의 projection인가? | 예 → SSOT 명시 후 projection 자동화 |
| 실사용 0건 + 정의만 있는가? | **양쪽 레거시 처리 후보** |

## 7. 독자 빠른 참고

- **"이 제안이 뭘 바꾸는가?"** → level → tier 교체 + Layout용 `refs` 신설 + LinkType↔DKG 정합
- **"기존 X 체계는 그대로인가?"** → §1.3 공존 목록 확인 (scope/aspect/layer/depth/doc-type-ext/knowledge_kind 등 전부 유지)
- **"내 문서에서 뭘 해야 하나?"** → Phase 4A에서 `level` → `tier` 전환 (도구가 제안, 수동 확정). 나머지 필드 그대로
- **"FSM은?"** → D-17로 이미 제거. meta-semantic `lifecycle_ref` 참조로 대체
- **"DKG와 LinkType 둘 다 있는 관계는?"** → LinkType이 SSOT, DKG는 자동 projection (§3.2)
