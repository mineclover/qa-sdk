---
def:
  id: cli-minor-gaps-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  links:
    - target: cli-command-spec
      type: depends_on
---

# CLI Minor Gaps — 잔여 TODO

## 목적 ^purpose

CLI 명령 표면에서 아직 구조적으로 남아 있는 작은 부채를 추적한다. 완료 항목은 `cli-command-spec.spec.md`에 흡수.

## 잔여 항목 (1건)

### smoke coverage

- [ ] `dkg audit-events` + ingest forwarding e2e smoke를 CLI 회귀 세트에 포함 (서비스 의존 — CI 셋업 필요)
