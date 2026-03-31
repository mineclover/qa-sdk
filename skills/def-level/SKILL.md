---
name: def-level
description: "definition-catalog 분해 레벨 관리. 문서의 전체-부분 분해 구조에서의 위치(group/module/leaf)를 선언하고 검증한다."
---

# Definition Catalog — 분해 레벨 관리

문서가 시스템 분해 구조에서 어떤 단위인지 선언한다.

## 핵심 원칙

**"모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."**

level은 **scope보다 상위 개념**. 먼저 "어떤 단위인가"가 결정되고, 그 안에서 scope가 의미를 가진다.

```
분해 레벨: "이것은 전체에서 어떤 단위인가" — 부분-전체 관계의 위치
scope:     "이 단위는 어떤 종류인가" — 분해된 후의 성격 분류
```

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
| `leaf` | 150줄 초과 시 분할 경고 | warning |

## level은 좌표에 인코딩하지 않는다

level은 메타데이터 — lifecycle과 같은 위치.

이유: 문서가 분해되면 level이 바뀔 수 있다.
- leaf가 나중에 분해되면 → module로 변경
- module이 하위 모듈을 가지면 → module 유지 (재귀 가능)
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

level은 **바운더리에 어떤 5원이 존재하느냐**로 성격이 결정된다:

| 5원 조합 | level 성격 | 예시 |
|----------|-----------|------|
| 정의+생산+소비 (관리·저장 없음) | `leaf` — 순수 연산 | 순수 함수, 타입 변환 |
| 정의+관리+생산+소비+저장 | `module` — 계약 관리자 | 서비스 클래스 |
| 묶임의 이유 설명 | `group` — 구성 이유 | 시스템 그룹 |

children 유무는 구조적 검증이고, 5원 조합은 의미적 검증이다.
둘 다 일치해야 올바른 level이다.

## 검증

```bash
qa-sdk def audit    # level 분포 표시
```
