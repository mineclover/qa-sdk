---
def:
  id: analysis-self-check
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [observability]
---
# Self-Check — 시스템 건강 상태

## 목적 ^purpose

좌표 시스템의 건강 상태를 자동 점검하는 기능. headroom 경고, capacity 위반, 직교성 의심, 미사용 축/prefix를 감지한다.
