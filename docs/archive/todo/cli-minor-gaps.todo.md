---
def:
  id: cli-minor-gaps-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: experience
  links:
    - target: cli-command-spec
      type: depends_on
status: completed
sources:
  - docs/specs/cli/cli-command-spec.spec.md
  - packages/cli-command/src/index.ts
  - packages/cli-command/__tests__/resolve.test.ts
  - packages/cli/src/command-spec.ts
  - packages/cli/src/index.ts
  - packages/cli/src/skills-workflows.test.ts
---

# CLI Minor Gaps — 잔여 TODO

## 목적 ^purpose

CLI 명령 표면에서 아직 구조적으로 남아 있는 작은 부채를 추적한다. 현재 열린 항목은 없고, 새 부채가 생기면 여기서 다시 연다. 완료 항목은 `cli-command-spec.spec.md`에 흡수.

## 잔여 항목 (0건)

현재 열려 있는 구조적 잔여 항목 없음.

## 검증 경로

```bash
corepack pnpm --filter cli-command test
corepack pnpm --filter @qa-sdk/cli test -- skills-workflows
node packages/cli/dist/index.js def validate
```
