---
def:
  id: doc-metadata-field-ownership
  type: spec
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [contract, structural]
  links:
    - target: docs-control-plane
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
    - target: deterministic-label-stability-boundary
      type: traces_to
---

# DocumentEnvelope Metadata — 필드 소유권 규칙

## 목적 ^purpose

`DocumentEnvelope.metadata`의 각 필드가 어떤 해석자에 의해 정의되고 어떤 소비자에 의해 읽히는지 고정한다. 현재 이 매핑은 암묵적이라 새 해석자가 추가될 때 "이 필드는 누가 쓰는가", "추가해도 되는가"를 판단할 근거가 없다. 본 rule은 소비자 매트릭스를 명시해 namespace 도입(B단계)의 기반이 된다.

## 소비자 분류 ^overview

필드는 다음 4종 소비자 중 하나 이상을 가진다:

| 분류 | 설명 | 예시 |
|------|------|------|
| **Decision** | 코드가 읽어 분기/필터/판단 | `if (metadata.lifecycle === "archived")` |
| **Round-trip** | frontmatter-writer가 yaml로 재직렬화 | `dbLines.push(\`  scope: ${metadata.scope}\`)` |
| **JSON API** | `docs status --json` 등 외부 노출 | `summarizeDocument()` 반환 객체 |
| **Dead** | 위 중 어느 것도 아님 | (현재 확인된 진짜 dead: 없음) |

한 필드가 여러 분류에 속할 수 있다. Decision 1건 이상 = "active", Decision 없음 + round-trip/JSON만 = "passthrough".

## 필드 매트릭스 (2026-04-18 기준)

### Active decision 필드

소비자가 의사결정에 사용. 변경 시 동작 영향.

| 필드 | Decision 소비자 | 용도 |
|------|--------------|------|
| `lifecycle` | `drift.ts`, `follow-ups.ts`, `graph-rank.ts`, `completed-records.ts`, `deterministic-label-fsm.ts`, `family-scope.ts`, `docs.ts` | archived/deprecated 필터, FSM 종료 상태 파생 |
| `level` | `drift.ts`, `family-scope.ts` | module vs leaf 기반 scope 판단 |
| `tags` | `docs.ts`, `graph-normalize.ts` | 역할 태그 감지, 표시 |
| `followUpCategory` | `follow-ups.ts` | TODO 분류 |
| `defId` | 다수 | 식별자 |

### Passthrough 필드 (API + round-trip만)

Decision 코드가 안 읽지만 JSON API와 frontmatter writer가 사용. **삭제 금지** — 외부 계약 surface.

| 필드 | 소비자 | 분류 |
|------|--------|------|
| `scope` | `frontmatter-writer.ts`, `summarizeDocument()` JSON | Round-trip + JSON API |
| `aspect` | 위와 동일 | Round-trip + JSON API |
| `depth` | 위와 동일 | Round-trip + JSON API |
| `layer` | 위와 동일 | Round-trip + JSON API |
| `svc` | 위와 동일 | Round-trip + JSON API |
| `address` | 위와 동일 | Round-trip + JSON API |
| `version` | 위와 동일 | Round-trip + JSON API |
| `revision` | 위와 동일 | Round-trip + JSON API |
| `type` | 위와 동일 | Round-trip + JSON API |
| `knowledgeKind` | 위와 동일 | Round-trip + JSON API |
| `documentKind` | (documentKind는 adapter 자체 생성) | JSON API |
| `sourcePath` | `graph-*`, `drift`, `docs.ts` | **Decision** — active |
| `purpose`, `overview` | `docs.ts` 표시 | JSON API |

### 해석자 소유 매핑

현재 암묵적이나 실측 가능한 매핑:

| 필드 | 정의자 (frontmatter에 쓰는 주체) | 1차 해석자 |
|------|-------------------------------|----------|
| `def.id/scope/aspect/depth/level/lifecycle/layer/svc/tags/address/version/revision` | 문서 작성자 | `definition-catalog` (validation + type 생성) |
| (derived) `followUpCategory` | `docs-control-plane/adapters/definition-markdown.ts` | `docs-control-plane/follow-ups.ts` |
| (derived) `documentKind` | 위와 동일 | 다수 |
| (derived) `purpose`, `overview` | 위와 동일 | `docs.ts` |

## 규칙 ^defines

### R-1. 필드 추가 규칙

`DocumentMetadata`에 새 필드를 추가할 때:

1. 본 rule 매트릭스에 **Decision / Round-trip / JSON API 분류를 먼저 기재**
2. Decision 소비자가 없으면 "passthrough"로 명시. 향후 회귀 시 소비자 유무를 쉽게 판단 가능
3. JSON API는 공개 계약이므로 필드 이름/타입 변경은 breaking change

### R-2. 필드 삭제 규칙

- Decision 소비자 0 + Round-trip 0 + JSON API 0 = 진짜 dead → 삭제 가능
- JSON API에 노출되어 있으면 삭제 = **breaking change** — 별도 deprecation PRD 필요
- Round-trip에만 쓰이면 frontmatter-writer 수정 + 필드 제거 가능 (내부 정리)

### R-3. 해석자 추가 규칙

새 해석자(예: `deterministic-label-registry`)가 필드를 추가하려면:

1. **기존 `def:` 네임스페이스에 직접 추가 금지** — `definition-catalog` 소유 네임스페이스
2. 본 rule이 공식화하는 해석자별 네임스페이스(B단계 산출물)를 사용
3. 해석자가 자기 필드를 본 매트릭스에 등록

### R-4. Passthrough 필드 취급

- 현재 passthrough 필드는 **변경 금지** — 외부 API 계약 surface
- 새 해석자가 값을 읽고 싶으면 자기 네임스페이스로 복사해 해석하는 것을 권장
- `def:` 네임스페이스 필드를 직접 decision 조건으로 쓰지 않기 (소유권 흐림)

## 현재 적용 범위 ^consumes

- `packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts:191-217` — `def.*` → metadata forward 지점
- `packages/definition-catalog/src/frontmatter-writer.ts:58-65` — round-trip writer
- `packages/cli/src/commands/docs.ts:2305-2315` — JSON API `summarizeDocument()`

## 의도적 비목표

- 본 rule은 **JSON API 계약을 고정하지 않는다**. 별도 API spec이 필요.
- 본 rule은 **새 해석자 네임스페이스 스키마를 선언하지 않는다**. B단계 (plan + spec).
- 본 rule은 **필드 제거를 지시하지 않는다**. 진짜 dead 필드가 발견되면 별도 PRD.
