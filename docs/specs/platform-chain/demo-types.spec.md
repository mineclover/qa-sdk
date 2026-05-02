---
def:
  id: demo-types
  type: spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: demo-types
  tags: [codegen, derived]
  links:
    - target: demo-snapshot
      type: depends_on
  source: packages/demo-types/src/index.ts
---

# demo-types — demo-snapshot 파생 타입

## 목적 ^purpose

`DEMO_CATALOG`에서 자동 생성된 prefix·axis·dims 타입과 SDK 팩토리 산출물. 직접 수정 금지 — codegen 결과물이며 `demo-snapshot` 변경 시 재생성된다. 소비자는 본 패키지의 타입만 import해 카탈로그 구조 변경을 컴파일 에러로 감지한다.
