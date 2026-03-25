---
def:
  id: decision-standard-checklist
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: decision-standard
      type: refines
---

# Decision Standard 체크리스트

## 목적 ^purpose

decision standard의 마이그레이션 단순함, 표준 질문 체크리스트, skill 매핑 규칙을 분리해 실제 검토 절차를 고정한다.

## 체크리스트

- 기존 prefix를 바꿀 때는 되돌리기 쉬운지, migration mapping이 단순한지 먼저 본다.
- 표준 질문은 prefix 추가가 아니라 사용 패턴 재설계로 닫히는지 검증하는 역할을 한다.
- skill 매핑은 분석, 설계, 구현 중 어느 층위에서 판단하는지 명확히 해 인간 결정을 늦추지 않게 한다.
