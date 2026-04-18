---
status: draft
date: 2026-04-18
part_of: tier-redesign
role: tier-definition
tier-name: layout
---

# STC Tier — Layout (ECS 외 확장 축)

> **⚠️ ECS 정석 외 확장**: Layout은 ECS 원전 3축(Entity/Component/System)에 **없는 확장 개념**이다. 문서 조직 단위로서 "어떤 System들이 함께 이 도메인을 구성하는가"를 서술하기 위해 STC가 추가한 4번째 tier. 일부 ECS 프레임워크의 **archetype / scene / world** 개념과 유사한 위치. 변형 근거: [../mental-models.md § ECS 정석 vs STC 적응](../mental-models.md).

## 핵심 원칙 (§1.3)

**Layout은 생성적 소비 컨텍스트다.**

Layout은 수동적 뷰가 아니다. Layout 안에서 System을 소비하고, 새로 필요한 Entry / Component / System을 **발견**할 수 있다. 이 재귀가 깊이 제한 없는 계층을 만든다.

단, **생성한다 ≠ inline 정의한다**. 발견된 정의는 독립 tier 문서로 promote — Layout 내부에 inline 정의 금지.

상세: [../rules/system-independence.md](../rules/system-independence.md) § "Inline 정의 금지"

## 정의

System을 도메인 / 서비스 / 목적에 맞게 배치하는 **소비 컨텍스트**.

- System을 `refs`로 참조 — 조직적 배치 관계
- 참조 과정에서 새로 필요한 System / Component를 발견할 수 있음 (단, 정의는 별도 문서로 promote)

```
예: QA-SDK Services Layout
  refs: ingest-system, decode-system, gate-system, registry-system

예: Definition Catalog Layout
  refs: deterministic-label-system, ontology-pack-system
  → derives: harness-instance-entry   ← Layout은 필요성만 선언,
                                         실제 정의는 독립 Entry 문서로
```

## Layout의 성격

Layout은 STC의 **유일한 composition tier** (D-17 Pivot 후). 역할은 **카탈로그**:

| 성격 | 독자 | 대표 질문 |
|------|------|-----------|
| **카탈로그** (조직적 배치) | Operator / Architect | "이 도메인에 어떤 Systems가 있나?" |

> **Pivot 전 (5 tier)**: FSM이 또 다른 composition tier(API 명세 성격)였으나 D-17로 제거. 상태 관리는 meta-semantic에 위임됨. 이제 Layout이 유일한 composition.

## Layout 재귀성

Layout이 새 System을 발견하면 그 System은 다시 독립적으로 존재한다. 다른 Layout이 그 System을 소비할 수 있다.

```
Layout[QA-SDK]
  refs: ingest-system, decode-system
  defines: monitoring-entry      ← 새 Entry 필요성 선언 (inline 정의 금지)
  → derives: monitoring-system   ← 새 System 필요성 선언

monitoring-system  ← 독립 System으로 존재 (별도 문서)
  ← Layout[Ops] refs monitoring-system   ← 다른 Layout이 소비
```

## LinkType

- Layout → System: `refs` (신규 LinkType, D-4)
- Layout → Layout: `refs` (재귀)
- Layout은 `contains` 사용 금지 — System 독립성 위반

## 구조 제안 (heading mirror — 선택)

Layout도 heading mirror 패턴 적용 가능 (권장, 필수 아님):

```markdown
---
tier: layout
refs:
  - ingest-system
  - decode-system
---

# QA-SDK Services Layout

## Systems

### ingest-system ^ref:ingest-system
- **역할**: raw event 수집
- **왜 이 Layout에?**: 인프라 서비스 그룹의 진입점
- **상세**: [[ingest-system]]

### decode-system ^ref:decode-system
- **역할**: 인코딩된 이벤트 해석
- **왜 이 Layout에?**: ingest 뒤 단계
```

## 좌표 권장값

| 축 | 권장 |
|----|------|
| `tier` | `layout` |
| `scope` | 상황에 따라 (`flow` / `architecture` 역할) |
| `aspect` | 상황에 따라 |
| `layer` | 상황에 따라 |

## 전환 힌트 (level → tier)

- `group` + 여러 system을 나열/배치 → `layout`

우선순위 4 (System 다음). 상세 판단: [../rules/classification.md](../rules/classification.md)

## 예시

- **Pilot**: [../examples/docs-control-plane-layout.md](../examples/docs-control-plane-layout.md) — docs-control-plane을 Layout으로 재해석
- 실제 qa-sdk: `system-root` (전체 Layout), `system-infra-layout` (인프라 서비스 그룹)
