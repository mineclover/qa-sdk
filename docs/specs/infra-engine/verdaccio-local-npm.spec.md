---
def:
  id: verdaccio-local-npm
  scope: flow
  aspect: user_scenario
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, verdaccio, npm, local]
  links:
    - target: infra-service-operations
      type: refines
---
# Verdaccio 로컬 NPM 배포

## 목적 ^purpose

Verdaccio를 사용한 로컬 npm 레지스트리 배포 워크플로우를 정의한다.

## 워크플로우 ^overview

```bash
pnpm registry        # Verdaccio 시작 (localhost:4873)
pnpm publish:local   # 14개 패키지 배포
```

소비자:
```bash
echo "registry=http://localhost:4873" > .npmrc
pnpm install @qa-sdk/core
```
