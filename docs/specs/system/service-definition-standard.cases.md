---
def:
  id: service-definition-standard-cases
  type: spec
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [testing, structural, observability]
  links:
    - target: service-definition-standard
      type: refines
  sources:
    - docs/specs/system/service-definition-standard.rule.md
    - docs/specs/system/nest-service-kit.spec.md
    - docs/specs/definition-catalog/responsibility-closure-harness.spec.md
    - packages/cli/src/templates/nest-service-template.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/init.test.ts
    - packages/cli/src/commands/docs.ts
    - packages/cli/src/commands/docs.test.ts
    - packages/nest-service-kit/src/index.ts
    - packages/nest-service-kit/src/bootstrap.test.ts
    - packages/nest-service-kit/src/event-envelope.test.ts
---

# Service Definition Standard — Use Cases

## 목적 ^purpose

서비스 정의 표준이 실제 서비스 문서화에서 어떤 구조를 요구하는지 검증 시나리오로 고정한다.

## 시나리오 1: 새 backend service를 정의한다 ^overview

**전제**: 새 backend service가 API, DB state, event emission, insight query를 가진다.

**동작**: 작업자가 service system, interface, data/state component, event/payload, insight/read model, operations, test/cases 문서를 만든다.

**기대**:
- service system은 behavior/runtime boundary를 소유한다.
- interface는 API/CLI/event input만 소유한다.
- component는 schema/state/payload/evidence shape만 소유한다.
- event는 requester-aware semantic fact로 정의된다.
- insight는 event/payload stream에서 파생된 판단으로 분리된다.
- `docs closure <service-system>`이 source/rule/test/cases/evidence를 같은 책임으로 묶어 보여준다.

**실패 시 수정 대상**: `service-definition-standard`, 해당 service family, event intent rule, responsibility closure harness.

## 시나리오 2: frontend behavior와 backend data effect를 함께 정의한다

**전제**: frontend action이 backend mutation을 유발한다.

**동작**: frontend behavior unit은 cases/BDD에, backend data-effect event는 event vocabulary/mapping pack에, payload shape는 component에 둔다.

**기대**:
- frontend click/submit event를 persistence success로 해석하지 않는다.
- backend raw mutation만으로 add/delete/update intent를 정하지 않는다.
- alert rule은 requester-aware backend event와 payload를 소비한다.

**실패 시 수정 대상**: event-intent-definition-rule, payload guide, service BDD cases.

## 검증 ^consumes

```bash
corepack pnpm --filter @qa-sdk/cli test -- init.test.ts docs.test.ts
corepack pnpm --filter @qa-sdk/nest-service-kit test
node packages/cli/dist/index.js docs closure nest-service-kit
```
