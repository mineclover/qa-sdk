---
def:
  id: decision-standard-checklist
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: decision-standard
      type: refines
---

# Decision Standard 체크리스트

## 목적 ^purpose

decision standard의 마이그레이션 단순함, 표준 질문 체크리스트, skill 매핑 규칙을 분리해 실제 검토 절차를 고정한다.

## 구성 ^overview

- `마이그레이션 단순함 체크`: prefix 변경 시 되돌리기 비용과 mapping 복잡도를 평가하는 기준을 정의한다.
- `표준 질문 체크리스트`: "이 문제가 기존 좌표계 안에서 닫히는가?"를 판단하는 질문 목록을 기술한다.
- `skill 매핑 규칙`: 분석/설계/구현 층위에서 어떤 decision-flow를 사용할지 매핑을 명시한다.
- `자동 판정 조건`: autoSelect()로 처리 가능한 결정의 조건과 정책을 정리한다.

## 마이그레이션 단순함 체크

기존 prefix를 변경할 때 먼저 확인해야 하는 사항:

| 항목 | 체크 | 위험 신호 |
|------|------|-----------|
| 되돌리기 비용 | one-way door인가 two-way door인가? | 비가역이면 spike(PoC) 먼저 |
| migration mapping | 기존 주소 → 새 주소 1:1 변환 가능한가? | N:1 또는 1:N이면 데이터 손실/분산 |
| 소비자 영향 | 이 prefix를 decode하는 곳이 어디인가? | decode-service, viz-web 등 확인 |
| capacity 영향 | 새 version의 headroom은 충분한가? | headroom ≤ 1이면 즉시 확장 필요 |

ARCHITECTURE_DECISION_FLOW의 `migration-cost` gate가 이 판단을 구조화한다: none / low (점진적 전환 가능) / high (빅뱅 전환 필요).

## 표준 질문 체크리스트

새 요구사항이 들어왔을 때 순서대로 확인하는 질문:

1. **기존 prefix로 표현 가능한가?** — entry 추가만으로 해결되면 prefix를 새로 만들지 않는다.
2. **기존 축을 공유할 수 있는가?** — 5Q Checklist로 기존 축 재사용 가능성을 평가한다.
3. **prefix_ref로 해결되는가?** — 계층 구조는 축 추가 대신 prefix_ref로 표현한다.
4. **crosscutting prefix에 해당하는가?** — 7종(version_state, metric_aggregate 등) 후보를 확인한다.
5. **도메인이 기존 카테고리에 속하는가?** — 6종 SchemaCategory 중 하나에 매핑한다.
6. **prefix 추가 시 DKG에 미치는 영향은?** — `cascadeFromPrefix()`로 domain/consumer 영향 범위를 분석한다.

질문 1-3에서 "예"가 나오면 신규 prefix 없이 해결된다. 4-6까지 진행해야 하면 신규 prefix 정의 프로세스로 넘어간다.

## skill 매핑 규칙

의사결정의 층위에 따라 적절한 decision-flow를 선택한다:

| 층위 | 대표 질문 | 사용할 Flow | 비고 |
|------|-----------|------------|------|
| 분석 | "테스트가 필요한가?" | TEST_NEEDED_FLOW | 변경 성격 → 영향 범위 → 커버리지 → 판정 |
| 분석 | "기획을 확장할까?" | SCOPE_EXPANSION_FLOW | 완성도 → 피드백 → 기술 부채 → 판정 |
| 설계 | "어떤 방식을 선택할까?" | ARCHITECTURE_DECISION_FLOW | 대안 → 트레이드오프 → 전환비용 → 판정 |
| 설계 | "안정화가 필요한가?" | STABILIZATION_FLOW | 버그빈도 → 성능 → 코드품질 → 판정 |
| 라우팅 | "무슨 종류의 결정이지?" | DECISION_ROUTER | 결정유형 → 긴급도 → 가역성 |

DECISION_ROUTER가 모든 일상 개발 의사결정의 진입점이다. decision-type gate에서 분류 후 해당 flow로 안내한다.

## 자동 판정 조건

DEV_DECISION_POLICIES (decision-flow/src/dev-decisions.ts)에 정의된 자동 정책:

| 조건 | 자동 판정 | confidence |
|------|-----------|-----------|
| 문서만 변경 | 테스트 불필요 | 0.95 |
| 리팩터 + 국소 + 커버리지 충분 | 테스트 불필요 | 0.90 |
| 신규 기능 + 시스템 영향 | E2E 테스트 추가 | 0.85 |
| 버그 빈도 높음 | 개선 필요 | 0.90 |
| 미완성 + 수요 없음 | 보류 | 0.85 |

자동 판정 불가(정책 미매칭) = 사람이 결정. confidence < 0.3이면 DecisionMonitor가 경고를 발행하여 근거 보강을 권고한다.
