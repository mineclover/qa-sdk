---
def:
  id: dkg-skill-version-event
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# VersionEvent.fromDiff — 버전 이벤트 자동 파생

## 목적 ^purpose

두 버전 간 diff에서 VersionEvent를 자동 생성하는 skill. entry 추가/제거, capacity 변경, ref 변경을 이벤트로 변환하여 DKG 그래프에 기록한다.
