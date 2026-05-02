---
def:
  id: browser-codec
  type: spec
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: browser-codec
  tags: [browser, codec, runtime]
  links:
    - target: browser-runtime-system
      type: refines
  source: packages/browser-codec/src/index.ts
---

# @qa-sdk/browser-codec — 브라우저 encode/decode 보조층

## 목적 ^purpose

브라우저 환경에서 좌표 encode/decode와 catalog 로딩을 담당하는 보조 레이어. `@qa-sdk/browser`의 하위 구성원으로, catalog snapshot을 fetch → parse → runtime codec 초기화 경로를 캡슐화한다. 범용 SDK이며 특정 도메인 prefix를 소유하지 않는다.
