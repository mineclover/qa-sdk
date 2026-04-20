---
def:
  tier: component
  id: cq-policy-resolver
  address: def_document:v2:68752
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [query, runtime, structural]
  links:
    - target: wi-api
      type: depends_on
---
# Policy Resolver

## 목적 ^purpose

PolicyRule 집합에서 특정 좌표에 적용되는 정책을 해소하는 함수. resolvePolicy(codec, entities, rules, strategy)로 공개 API, resolvePatternPolicy로 내부 API.

## 구성 ^overview

Policy Resolver는 두 계층으로 구성된다.

1. **resolvePolicy** — 공개 API. entity name + 와일드카드(`"*"`) 매칭
2. **resolvePatternPolicy** — 내부 API. position 기반 CoordConstraint 매칭

세 가지 해소 전략을 지원한다: `first-match`, `highest-priority`, `most-specific`.

소스:
- `packages/query-service/src/lib/query-service.ts` — QueryService.resolvePolicy
- `packages/weighted-index/src/math/pattern-lattice.ts` — 패턴 포함 관계 + 구체성 점수
- `packages/weighted-index/src/math/calc.ts` — range 대수 연산

## 공개 API: resolvePolicy

QueryService를 통해 노출된다.

```typescript
async resolvePolicy<T>(
  coord: readonly number[],
  rules: readonly PatternRule<T>[],
  shape: readonly number[],
  strategy?: ConflictStrategy,
  options?: { indexId?: string; versionId?: string; withGate?: boolean },
): Promise<QueryResolveResult<T>>
```

### 입력

| 파라미터 | 설명 |
|----------|------|
| `coord` | 해소 대상 좌표 (1-based 정수 배열) |
| `rules` | 패턴 규칙 배열. 각 규칙은 `{ id, pattern, value, priority? }` |
| `shape` | 좌표 공간의 형상 (각 차원의 크기) |
| `strategy` | 충돌 해소 전략 (기본: `deps.defaultStrategy`) |
| `options.withGate` | gate 상태 필터 합성 여부 |

### 검증

- `coord.length !== shape.length` → `ValidationError`
- 각 rule의 `pattern.length !== shape.length` → `ValidationError`

### gate 통합

`withGate=true`일 때:
1. `indexId`/`versionId` 필수 (없으면 ValidationError)
2. shape과 registry shape 일치 검증
3. gate-service에서 `AddressStateCacheRecord` 조회
4. `gateAwareResolve(policyResult, address, gateRecord)` — gate 상태와 policy 결과 합성

## 내부 API: PatternRule 매칭

### CoordConstraint 패턴

각 규칙의 `pattern`은 `CoordConstraint[]`로 표현된다.

```typescript
type CoordConstraint = string | null;
// null   → 와일드카드 (모든 값)
// "3"    → 단일 값
// "2-5"  → 범위
// "1,3"  → 합집합
```

모든 dim을 명시해야 한다. dim 누락은 허용되지 않는다 (암묵적 와일드카드 금지).

### 패턴 포함 관계 (Lattice)

소스: `packages/weighted-index/src/math/pattern-lattice.ts`

| 함수 | 설명 |
|------|------|
| `patternContains(shape, a, b)` | 패턴 a ⊇ 패턴 b 판정 (각 차원 포함 관계의 AND) |
| `patternMeet(a, b, shape)` | 교집합 패턴 (greatest lower bound). 빈 차원 있으면 null |
| `patternJoin(a, b, shape)` | 합집합 패턴 (least upper bound) |
| `patternSpecificity(pattern, shape)` | 구체성 점수 (0~ndims). 와일드카드=0, 단일값≈1 |
| `coordMatchesPattern(coord, pattern, shape)` | 좌표가 패턴에 포함되는지 O(ndims) 판정 |

### 구체성 점수 계산

```
각 차원: 1 - (coveredValues / dimSize)
- 와일드카드 → 0
- 단일 값   → (dimSize-1) / dimSize (≈ 1)

총 점수: 0 (전체 와일드카드) ~ ndims (전체 고정)
```

## 해소 전략

| 전략 | 동작 |
|------|------|
| `first-match` | 매칭되는 첫 번째 규칙 반환 (규칙 순서 의존) |
| `highest-priority` | 매칭 규칙 중 priority가 가장 높은 것 반환 |
| `most-specific` | 매칭 규칙 중 `patternSpecificity` 점수가 가장 높은 것 반환 |

`most-specific`이 query-service의 기본 전략이다.

## Gate 실패 모드

소스: `packages/query-service/src/lib/gate-client.ts`

| 모드 | 동작 |
|------|------|
| `fail-open` (기본) | gate-service 불가 시 null 반환 + warn 로그. 정책 결과만 반환 |
| `fail-closed` | gate-service 불가 시 503 에러 발생 |

gate-service 클라이언트는 `HttpGateStateClient`로 HTTP GET 호출. 응답은 zod 스키마로 검증.

## HTTP 엔드포인트

소스: `packages/query-service/src/routes/query.ts`

```
POST /resolve          → resolvePolicy (패턴 규칙 해소)
POST /match-ranges     → matchRanges (부분 좌표 → 주소 범위)
POST /compose-query    → composeQuery (교차 질의)
POST /resolve-relation → resolveRelation (관계형 타입 해소)
```

모든 요청은 zod 스키마로 입력 검증 후 QueryService에 위임.
