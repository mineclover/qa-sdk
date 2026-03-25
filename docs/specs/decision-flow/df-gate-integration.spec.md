---
def:
  id: df-gate-integration
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision, gate]
  links:
    - target: df-observation-space
      type: depends_on
    - target: df-constraint
      type: refines
    - target: df-system
      type: implements
---
# GateEngine 연동

## 목적 ^purpose

decision prefix에 GateEngine 4-state 모델(active/inactive/open/reserved)을 적용하여, 의사결정 좌표의 encode/decode 허용 여부를 관리한다. deprecated된 flow_type이나 비활성화된 좌표 영역을 차단한다.

## 구성 ^overview

- **decision_event는 leaf prefix**: 4축 직접 axis (prefix_ref 없음). GateEngine이 가장 단순하게 처리
- **상태 전환**: entry 비활성화 → buildDimStateSpecs → inactive spec → recompute → inactiveRanges
- **checkGate**: address가 active/inactive/open/reserved 중 어디에 속하는지 O(log n) 판정
- **gate-service 연결**: consumedPrefixes에 decision 5개 prefix 등록. 서버 기동 시 자동 처리
- **테스트**: demo-tests/gate-engine-decision.test.ts 6건 통과
