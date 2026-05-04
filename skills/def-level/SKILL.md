---
name: def-level
description: "definition-catalog contains 검증용 level(group/module/leaf) 관리. 새 authoring 판단은 E/C/I/S + L/P를 우선한다."
---

# Definition Catalog — 분해 레벨 관리

문서가 contains 그래프에서 어떤 위치인지 선언한다. 새 문서 책임 판단은 E/C/I/S + L/P가 우선이고, `level`은 validator 보조 메타데이터다.

## 핵심 원칙

**"모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."**

level은 **좌표나 책임 분류가 아니라 contains 검증 신호**다. 먼저 E/C/I/S + L/P 책임이 결정되고, 그 뒤 `level`은 링크 구조가 그 책임과 모순되지 않는지 확인하는 데 쓰인다.

```
E/C/I/S + L/P: "이 문서가 무엇을 책임지는가" — authoring 기준
level:       "contains 그래프에서 어떤 위치인가" — 보조 검증
scope:       "이 단위는 어떤 종류인가" — 주제 분류
```

> **tier 우선 분기 (validate.ts:222)**: `entry.tier`가 있으면 레거시 level 검증은 모두 생략된다. 신규 문서는 STC tier(`system`/`layout`/`component`/`entry`)로 검증 경로가 결정되고, level은 tier 미선언 문서에만 적용된다. 아래 5-level 마이그레이션 표는 레거시 level만 쓰는 문서가 대상이다.

## level 3종

| level | 질문 | 의미 | 예시 |
|-------|------|------|------|
| `group` | "왜 이것들이 함께 있는가?" | 묶임의 이유를 설명한다 | system-root, system-infra, system-design-tools |
| `module` | "이 개념은 무엇인가?" | 단일 개념 + 구성 참조 | ingest-system, gate-engine-group, dkg-system |
| `leaf` | "이 구성 요소는 어떻게 동작하는가?" | 최종 명세. 자식 없음. 기본값 | record-spec, trace-spec, api-contract |

## contains 계층 규칙

```
group → group | module    # group은 재귀 가능
module → module | leaf    # module도 재귀 가능
leaf → (자식 없음)        # leaf는 종단
```

예시:
```
group → group → module → leaf       # 깊은 분해
group → module → leaf              # 일반적 분해
group → module → module → leaf     # module 중첩
module → leaf                      # 얕은 분해
```

## 검증 규칙

| level | 규칙 | 심각도 |
|-------|------|--------|
| `group` | contains 자식 1건 이상 필수 | error |
| `module` | contains 자식 1건 이상 필수 | error |
| `leaf` | contains 자식 금지 | error |

> **150줄 임계값**: validate.ts에는 leaf 길이 경고 규칙이 직접 존재하지 않는다. 150줄 기준은 `large-leaf-split.test.ts` (US-012/013) 회귀 테스트가 approved leaf의 누적 long-leaf 수를 추적하는 임계값이며, validator가 문서별로 warning을 발행하지는 않는다.

## tier별 검증 경로 (validate.ts:222-272)

tier가 있으면 level 분기는 건너뛴다. tier별 별도 규칙은 다음과 같다.

| tier | contains 사용 | refs 사용 | level 적용 | validator 동작 |
|------|---------------|-----------|------------|----------------|
| `system` | non-tier/component/entry 자식만 허용. system→system은 `system-contains-system` error | 보통 사용 안 함 | 무시 | system 독립성 강제 |
| `layout` | **금지** (`level-violation` error) | **필수** (`refs` 0건이면 error) | 무시 | layout = 카탈로그 묶음 |
| `component` | warning (data-shape 분리 권장) | 사용 안 함 | 무시 | 수동적(링크 대상) |
| `entry` | tier-specific 규칙 적용 (level 무시) | 사용 안 함 | 무시 | identity 단위 |
| (없음) | level 규칙 적용 | 사용 안 함 | **적용** | 레거시 group/module/leaf 검증 |

### tier:layout 절

layout은 **level을 사용하지 않으며 `refs`로만 자식을 묶는다**. 근거: `validate.ts:228-245`.

- `tier: layout` + `contains` → error (`level-violation`)
- `tier: layout` + `refs` 0건 + `contains` 0건 → error (배치된 시스템 없음)
- 따라서 layout 문서는 `level` 필드를 선언하지 않고, child 묶음은 `links: [{type: refs, target: ...}]`로 표현한다.

## level은 좌표에 인코딩하지 않는다

level은 메타데이터 — lifecycle과 같은 위치.

이유: 문서가 분해되면 level이 바뀔 수 있다.
- 종단 문서가 나중에 contains 자식을 갖게 되면 → `module` 또는 `group`으로 변경
- `module`이 하위 구성을 가지면 → `module` 유지 (재귀 가능)
- 좌표 주소는 불변이어야 하므로 level을 인코딩하면 안 됨

## frontmatter 선언

```yaml
def:
  id: ingest-system
  level: module           # 메타데이터 (좌표에 영향 없음)
  scope: flow
  aspect: process_flow
  depth: overview
```

level이 없으면 기본값 `leaf`.

## 언제 level을 선언하는가

| 조건 | level | 근거 |
|------|-------|------|
| 하위 항목들을 왜 묶었는지 설명하는 문서 | `group` | 묶임의 이유 |
| 하나의 개념을 정의하며 구성을 참조하는 문서 | `module` | 단일 개념 + 구성 |
| contains 자식이 없는 최종 명세 | `leaf` (생략 가능) | 종단 노드 |

## 마이그레이션 (5-level → 3-level)

| 이전 level | 새 level | 비고 |
|-----------|----------|------|
| `system` | `group` | 묶임의 이유 역할 |
| `area` | `group` | 묶임의 이유 역할 |
| `unit` | `module` | 단일 개념 + 구성 참조 |
| `module` | `module` | 변경 없음 |
| `leaf` | `leaf` | 변경 없음 |

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-boundary`, `ms-concept-five-roles` 참조

level은 **바운더리에 어떤 패싯이 존재하느냐**만으로 결정하지 않는다. 패싯 조합은 E/C/I/S + L/P 책임 판단에 먼저 쓰고, level은 contains 구조가 그 책임과 맞는지 확인한다:

| 신호 | 책임 판단 | level 힌트 |
|------|-----------|------------|
| 정의+생산+소비 (관리·저장 없음) | Component 또는 System 내부 behavior | contains 없으면 `leaf` |
| 정의+관리+생산+소비+저장 | System behavior boundary | 구성 문서가 있으면 `module` |
| 여러 System/Interface 조망 | Layout / Pack | 보통 `group` 또는 `module`, 링크는 `refs` 우선 |

children 유무는 구조적 검증이고, 패싯 조합은 의미적 검증이다.
둘 다 일치해야 올바른 level이다.

IR 자동 추론: `inferModuleLevel(relations): FoldLevel` (`core/src/meta-semantic/ir-types.ts`)
— parent/children 관계에서 group/module/leaf를 자동 판별. 반환 타입 `FoldLevel`은 `pipe/pipe-fold.ts`에 정의되며 DefLevel과 호환된다.
`auditIRGraph`가 `level-mismatch`로 불일치를 감지.

## 검증

```bash
qa-sdk def audit    # level 분포 표시
```
