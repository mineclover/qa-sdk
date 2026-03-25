---
def:
  id: decision-standard-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [decision]
  links:
    - target: decision-standard-process
      type: contains
    - target: decision-standard-checklist
      type: contains
---

# Decision Standard 그룹

## 목적 ^purpose

새 요구사항이 들어왔을 때 기존 prefix를 재사용할지 새 prefix를 만들지 판단하는 표준을 프로세스와 체크리스트 문서로 분리한다.

## 구성 ^overview

overview: 총 2개 멤버.
- `decision-standard-process`: 상황 분류와 표준 프로세스를 정리한 문서.
- `decision-standard-checklist`: 마이그레이션 단순함, 질문 리스트, skill 매핑을 정리한 문서.

원본: `docs/specs/spec-engine/decision-standard.md` (`decision-standard`)
