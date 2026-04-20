---
def:
  id: axis-consumption-patterns
  type: knowledge
  knowledge_kind: concept
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [entry-point, structural]
  links:
    - target: axis-boundary-patterns
      type: depends_on
    - target: axis-decision-guide
      type: depends_on
---

# Axis 소비 패턴 — 개념 정의

## 목적 ^purpose

Axis가 시스템 전체에서 소비되는 10종 패턴과 원칙을 정의한다. Axis 자체의 정의(spec)가 아니라, "왜 이렇게 소비하는가"의 개념적 기반을 기술한다.

---

## Axis 원칙

**Axis = 비즈니스 로직에서 사용하는 정보의 유한 분류. 소비 방식은 소비자가 결정한다.**

- Axis는 정보의 **정의**. 소비 방식은 소비자의 **책임**
- 소비 방식은 고정이 아님 — 비즈니스 요구에 따라 늘어남
- Tag는 별도 개념이 아니라 Axis를 필터 모드로 소비하는 것
- 새 분류 추가 시: Axis로 정의 → 소비자가 어떻게 쓸지는 소비자가 결정

## 현재 관찰된 소비 패턴 (10종)

| 패턴 | 소비자 | Axis 사용 방식 | 예시 |
|------|--------|--------------|------|
| **좌표** | PrefixDef.dims | Axis × Axis → 1D 주소 (WeightedIndex) | `env × region × svc_name → service:v1:42` |
| **필터** | ServiceAttributes | 단독 값으로 필터/그룹핑 | `concerns: ["security"]`, `category: "core"` |
| **권한** | PolicyRule.match | 조건식으로 접근 제어 판정 | `{ field: "role", op: "eq", value: "admin" }` |
| **게이트** | GateEngine | entry별 active/inactive/open/reserved | `flow_type=custom → inactive (deprecated)` |
| **의사결정** | FlowSchema.gates | Gate=Axis, Branch=Entry, Path=Address | `scope=new, arch=layered → coordinateAddress` |
| **관측** | DKG ObservationNode | subjects/finding에서 축 값 참조 | `subjects: ["cart_event"], finding: "skew detected"` |
| **분류** | PatternClassification | 축 값 기반 패턴 분류 | `evidence_kind=data + freq≥5 → routine` |
| **계층** | LayerMap | 축 값으로 시각화 배치 | `svc_name=shopping-web → Layer 0 (UI)` |
| **전파** | ConcernDef (def-catalog) | 축 값이 link 그래프를 타고 상속 | `security → 의존 문서에 자동 전파` |
| **태깅** | ServiceAttributes, def frontmatter | 대상에 축 값을 다중 부여 (1:N) | `auth → concerns: [security, observability]` |

## 태깅 관리 규칙

태깅 = Axis를 1:N 다중 부여로 소비하는 패턴. 상세: `docs/specs/system/tag-management.spec.md`

- **저장**: 대상이 사는 곳에 함께. 별도 태그 store 없음
- **카디널리티**: 배타적이면 단일(category, criticality), 공존이면 다중(concerns, structural, def.tags). 배포 계층은 `layer` 필드가 담당 (tier 태그 제거됨)
- **전파**: ConcernTag만 depends_on 링크 따라 하위 전파. 나머지 불전파
- **제거**: 직접 태그만 제거. 전파된 것은 다음 계산에서 자동 소멸
- **SSOT**: `definition-catalog/src/taxonomy.ts` KNOWN_TAGS
