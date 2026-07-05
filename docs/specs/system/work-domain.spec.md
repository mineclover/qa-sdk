---
def:
  id: work-domain
  type: spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: work-domain
  tags: [classification, quality]
  links:
    - target: work-domain-quality-bundle
      type: traces_to
  sources:
    - packages/work-domain/src/index.ts
    - packages/work-domain/src/registry.ts
    - packages/work-domain/src/quality-gates.ts
    - packages/work-domain/src/mapping.ts
    - packages/work-domain/src/classify.ts
    - packages/work-domain/src/work-domain.test.ts
    - packages/test-types/src/work-domain-data.ts
---

# work-domain — 작업 유형 분류 체계

## 목적 ^purpose

모노레포 작업을 10개 대분류(productivity/infra/observability 등)로 체계화하고 각 도메인에 품질 게이트를 자동 매핑하는 classification 라이브러리. `work-domain:<id>` 태그와 `work-domain-quality-bundle`의 gate 계약이 본 패키지에서 파생된다.

## 현재 경계 ^boundary

- `work-domain` 패키지는 작업 도메인 분류, quality gate 매핑, definition query mapping, keyword 기반 story 분류를 소유한다.
- `work-lifecycle`의 plan/cases/todo/test/spec artifact authority를 소유하지 않는다.
- definition-catalog 타입은 문자열 리터럴로 재선언해 runtime dependency 없이 bridge query만 만든다.

## 검증 ^validation

```bash
corepack pnpm --filter work-domain test
corepack pnpm --filter work-domain typecheck
```
