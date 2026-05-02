---
def:
  id: doc-frontmatter-namespace
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [contract, structural]
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: doc-metadata-field-ownership
      type: depends_on
    - target: deterministic-label-stability-boundary
      type: traces_to
---

# Frontmatter Interpreter Namespace — 해석자 네임스페이스 계약

## 목적 ^purpose

한 문서 frontmatter에서 **여러 해석자가 서로의 필드를 침범하지 않고 공존**하도록 top-level 네임스페이스 계약을 고정한다. 현재 `def:` 한 블록에 `definition-catalog`가 소유한 필드들이 있고, 새 해석자(deterministic-label-registry 등)가 필드를 추가하려면 소유권 분리가 필요하다. 본 spec은 추가 해석자가 들어올 때의 선언 규칙과 파서 동작을 정의한다.

## 원칙

**수집과 해석의 분리**: 파서(수집 계층)는 네임스페이스의 의미를 모른다. 모든 top-level key를 차별 없이 읽고, 해석은 각 해석자(소비 계층)가 알아서 한다. 결과적으로:

- 파서는 네임스페이스 목록을 유지하지 않는다 — 중앙 registry 불필요
- 해석자는 자기 네임스페이스를 자기 spec에서 선언 — 분산 소유
- 검증은 **소비 시점**에 소비자가 수행 — 생산(파싱) 시점엔 검증 없음

## 형식 ^defines

### 1. Top-level 네임스페이스 = 해석자

Frontmatter는 YAML top-level key를 해석자 네임스페이스로 사용한다.

```yaml
---
# 기존
def:
  id: foo-spec
  scope: ui
  aspect: component
  # ...

# 새 해석자 추가 예시
dlr:            # deterministic-label-registry
  labelKind: definition-doc
  labelVersion: v1
---
```

각 네임스페이스:
- 해당 해석자가 소유하는 필드만 포함
- 독립 스키마 (해석자가 자체 검증)
- 다른 네임스페이스의 필드를 참조하지 않는다 (cross-read 금지)

### 2. 네임스페이스 선언은 분산된다

본 spec은 **중앙 네임스페이스 레지스트리를 유지하지 않는다**. 각 해석자가 자기 spec에서 "나는 X 네임스페이스를 쓴다"를 선언한다.

- `definition-catalog`의 네임스페이스: `def` — `packages/definition-catalog/src/frontmatter.ts` `extractDef()`가 소비 + 검증
- 새 해석자(예: `deterministic-label-registry`)는 자기 spec(예: `deterministic-label-coordinate-stability.spec.md`)에서 자기 네임스페이스 키를 선언

따라서 네임스페이스 충돌은 **글로벌 사전 조율이 아니라 소비 시점의 명시**로 방지된다. 동일 키를 두 해석자가 선언하면 먼저 읽는 쪽이 이기고, 이는 해당 해석자들 사이의 계약 위반이다(본 spec 범위 밖).

### 3. 파서 동작

`packages/definition-catalog/src/yaml-lite.ts`의 `parseYaml()`은 **모든 top-level key를 차별 없이 파싱**한다. `extractDef()`는 `parsed.def`만 꺼내 검증하고, 나머지 top-level key는 무시한다 (silent passthrough).

따라서:
- 등록되지 않은 네임스페이스가 문서에 있어도 **에러/경고 없음**
- 해석자는 자기 네임스페이스가 부재할 때 **자체 default 적용**
- 파서 변경 없이 새 해석자 추가 가능

### 4. 검증 소유권

네임스페이스 스키마 검증은 **각 해석자 자신의 책임**이다. `definition-catalog`는 `def:` 이외 네임스페이스의 필드에 관여하지 않는다.

- `def:` → `definition-catalog`의 `extractDef()` + 유효성 규칙
- 향후 `dlr:` → `deterministic-label-registry`의 자체 파서
- 기타 해석자 → 각자 구현

### 5. 네임스페이스 간 참조

- **Cross-read는 금지하지 않는다** — 구현이 다른 네임스페이스 필드를 읽을 수 있게 두는 것은 각 해석자의 설계 재량.
- **권장은 독립**: 가능하면 자기 네임스페이스에서 완결. 다른 해석자 값이 필요하면 읽기 전에 복사해서 drift를 명시적으로 관리.
- **식별자는 공용 관행**: `def.id`는 문서 식별자이므로 다른 해석자가 자기 레코드의 parent/ref로 읽어도 된다 — 관행으로 받아들이는 예시.

소비 시점 검증 원칙(위 "원칙" 절)에 따라, 해석자가 다른 네임스페이스를 읽기로 **결정하면** 그 값의 유효성도 해당 해석자가 자기 검증 로직에서 다룬다.

## 규칙 ^consumes

### R-1. 네임스페이스 신설 절차

1. 해석자 spec에서 **자기 네임스페이스 키와 필드 스키마를 선언**
2. 해석자 구현에서 자기 네임스페이스의 파싱/검증 수행
3. 본 spec 수정 **불필요** — 중앙 레지스트리 없음

다른 해석자의 네임스페이스와 충돌할 가능성은 해석자들 사이의 조율로 해결 (같은 키를 쓰면 서로의 계약이 무너짐).

### R-2. 필드 추가 규칙

- `def:` 아래 필드 추가는 `definition-catalog` 소유 — 본 spec 범위 밖 (별도 PRD)
- 다른 네임스페이스 아래 필드 추가는 해당 해석자 소유 — 해석자 spec으로 관리
- **한 필드를 두 네임스페이스에 동시 선언 금지** — drift의 원인

### R-3. 네임스페이스 제거/rename

네임스페이스 키는 **공개 계약 surface** — 외부 문서 작성자가 쓸 수 있음. 제거/rename은 breaking change로 취급한다.

- Deprecation: 본 spec에서 상태를 `deprecated`로 표시하고, 해석자는 기존 키를 일정 기간 계속 읽는다
- Rename: 새 이름 활성화 + 기존 이름 deprecated → 두 이름 동시 인식 기간 → 기존 이름 제거
- 즉시 제거는 **repo 전체 문서의 해당 key를 같은 PR에서 정리**할 때만

### R-4. 파서 확장 제약

- `parseYaml`은 범용 파서 — 특정 네임스페이스 로직 주입 금지
- `extractDef`는 `def:` 전용 — 다른 네임스페이스 추가 시 **별도 extractor 함수** 신설
- 파서가 네임스페이스를 알 필요 없음 = 해석자 추가가 파서 변경 없이 가능

## 소비자

- **파서 (기존)**: `packages/definition-catalog/src/frontmatter.ts` + `yaml-lite.ts` — unknown key silent pass 동작 보존
- **검증 등록처**: 본 spec의 "등록된 네임스페이스" 표
- **새 해석자**: 자기 네임스페이스 스키마는 자기 spec에서 선언

## 비목표

- 본 spec은 **네임스페이스별 필드 스키마를 정의하지 않는다** — 각 해석자 spec의 역할
- 본 spec은 **JSON API 계약을 정의하지 않는다** — `docs status --json` 같은 surface는 별도 계약
- 본 spec은 **기존 `def:` 필드 재배치를 지시하지 않는다** — R-2와 R-3을 따를 뿐
- 본 spec은 **코드 변경을 요구하지 않는다** — 현재 파서가 이미 요건을 만족

## 예시 (2026-04-18 기준, 아직 미등록)

향후 deterministic-label-registry가 등록될 경우의 예상 구조:

```yaml
---
def:
  id: example-spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  level: leaf

# deterministic-label-registry 네임스페이스 (예시 — 등록 PR에서 확정)
dlr:
  labelKind: definition-doc
  labelVersion: v1
  gateEvidence:
    - gate: lint
      pass: true
    - gate: resolved
      pass: false
---
```

위 예시는 설명용이며, `dlr` 네임스페이스의 실제 스키마는 `deterministic-label-coordinate-stability.spec.md` (장래 작성)에서 고정한다.
