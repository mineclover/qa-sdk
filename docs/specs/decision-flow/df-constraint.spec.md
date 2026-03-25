---
def:
  id: df-constraint
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [decision]
---
# Decision Flow 구조적 제약

## 목적 ^purpose

게이트 무게(core/structural/tactical), 인과 그래프(GateDependency), 결정 계층(strategic→tactical→operational→execution)과 컨텍스트 바운더리를 정의한다.

## 게이트 무게 ^constraint

| weight | 의미 | 변경 영향 |
|--------|------|---------|
| core | 후속 모든 결정의 방향을 바꾼다 | 전체 재실행 |
| structural | 다수의 후속 결정에 영향 | 연쇄 변경 |
| tactical | 국소적 영향, 독립적 되돌림 가능 | 해당 gate만 |

## 계층 규칙 ^constraint

| 규칙 | 허용 | 위반 시 |
|------|------|--------|
| 하향 제약 | strategic → tactical | — |
| 상향 변경 | — | upward-mutation → 에스컬레이션 필요 |
| 계층 건너뛰기 | — | skip-layer → 중간 계층 경유 필요 |
| 스코프 상속 | 상위 결정 → 하위 context 자동 주입 | — |
