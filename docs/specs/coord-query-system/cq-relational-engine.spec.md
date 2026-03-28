---
def:
  id: cq-relational-engine
  address: def_document:v2:68753
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [tier-infra]
  links:
    - target: cq-policy-resolver
      type: depends_on
    - target: cq-cross-index
      type: depends_on
    - target: cq-version-query
      type: depends_on
---
# RelationalEngine

## 목적 ^purpose

policy-resolver, cross-index-query, version-query를 통합하여 단일 질의 인터페이스를 제공하는 오케스트레이터. query-service의 핵심 런타임.

## 구성 ^overview

RelationalEngine은 다섯 가지 질의 타입을 단일 서비스로 통합한다.

1. **resolvePolicy** — 좌표에 매칭되는 정책 규칙 해소
2. **matchRanges** — 부분 좌표 제약에서 유효 주소 범위 계산 (+ gate 필터)
3. **composeQuery** — 공유 축 기반 교차 prefix 질의
4. **queryAcrossVersions** — 동일 prefix의 여러 버전 횡단 질의
5. **resolveRelation** — 관계형 타입 + 인스턴스 2단계 해소

소스:
- `packages/query-service/src/lib/query-service.ts` — QueryService (오케스트레이터)
- `packages/query-service/src/routes/query.ts` — HTTP 라우트
- `packages/query-service/src/app.ts` — 의존성 조립

## QueryService 아키텍처

```
QueryService
  ├── RelationalEngine (index-meta)   ← 핵심 질의 엔진
  ├── GateStateClient                 ← gate 상태 조회
  ├── MetaRegistry                    ← prefix/label 메타데이터
  └── ConflictStrategy                ← 기본 해소 전략
```

### 생성

```typescript
const service = new QueryService({
  metaRegistry: MetaRegistry,
  defaultStrategy: "most-specific",
  gateClient: HttpGateStateClient | NoopGateStateClient,
  gateFailureMode: "fail-open" | "fail-closed",
  logger,
});
```

`createQueryService(deps)` 팩토리 함수로 기본값이 적용된 인스턴스를 생성할 수 있다.

## 질의 타입별 상세

### 1. resolvePolicy

좌표에 매칭되는 정책 규칙을 해소한다.

- 입력: `coord`, `rules`, `shape`, `strategy`
- gate 통합: `withGate=true` 시 gate 상태와 합성
- 반환: `ResolveResult<T>` 또는 `GateAwareResult<T>`

### 2. matchRanges

부분 좌표 제약에서 유효한 주소 범위 목록을 계산한다.

```typescript
await service.matchRanges(
  "api_perm", "pv1",
  { role: "editor", action: null, resource: null },
  "active-only",  // gate 필터 모드
);
// → [[128, 255]]  (editor role에 해당하는 active 주소 범위)
```

gate 모드:
- `null` — gate 필터 없음 (전체 범위)
- `"active-only"` — active 상태 주소만
- `"include-inactive"` — inactive도 포함

### 3. composeQuery

공유 축을 통한 교차 prefix 질의.

```typescript
service.composeQuery(
  { indexId: "api_perm", versionId: "pv1" },
  "role",  // 공유 축
  { action: null, resource: "orders" },
);
```

### 4. queryAcrossVersions

동일 prefix의 여러 버전에 대해 동일 제약 조건으로 각각 주소 범위를 계산한다.

```typescript
service.queryAcrossVersions(
  "api_perm",
  ["pv1", "pv2"],
  { role: "editor", action: null },
);
// → Map { "pv1" => [[0, 63]], "pv2" => [[0, 127]] }
```

### 5. resolveRelation

관계형 타입 해소는 2단계로 동작한다.

1. **타입 레벨**: `relTypeCoord` + `typeRules` → 관계 타입 결정 (allow/deny)
2. **인스턴스 레벨**: 결정된 타입의 `instanceRules` → 구체 인스턴스의 정책 값

```typescript
service.resolveRelation(
  relTypeCoord,            // 관계 타입 좌표
  relShape,                // 관계 타입 형상
  typeRules,               // 타입 규칙 (effect: allow/deny + instanceRules)
  "most-specific",         // 타입 전략
  instanceCoord,           // 인스턴스 좌표 (선택)
);
```

## HTTP API 엔드포인트

| HTTP | 경로 | QueryService 메서드 |
|------|------|---------------------|
| POST | `/resolve` | `resolvePolicy()` |
| POST | `/match-ranges` | `matchRanges()` |
| POST | `/compose-query` | `composeQuery()` |
| POST | `/query-across-versions` | `queryAcrossVersions()` |
| POST | `/resolve-relation` | `resolveRelation()` |

모든 요청 본문은 zod 스키마로 검증된다.

## 의존성 구조

### MetaRegistry

`index-meta` 패키지의 MetaRegistry가 prefix/label 메타데이터를 제공한다. `metaRegistry.toInput()`으로 RelationalEngine에 전달.

### GateStateClient

gate-service(포트 3400)의 HTTP 클라이언트. `GET /gate/state/{prefix}/{versionId}`로 주소 상태를 조회한다.

응답 스키마: `{ prefix, versionId, specs[], reservedRanges[], inactiveRanges[], openRanges[], computedAt }`

### PolicyRuleStore

`SqlPolicyRuleStore` (SQLite 기반) 또는 `InMemoryPolicyRuleStore`에서 정책 규칙을 CRUD 관리한다. `/rules` 엔드포인트를 통해 규칙을 등록/조회/삭제.

## 에러 처리

| 상황 | 동작 |
|------|------|
| coord/shape 길이 불일치 | `ValidationError` (400) |
| rule pattern 길이 불일치 | `ValidationError` (400) |
| registry shape 불일치 | `ValidationError` (400) |
| gate-service 불가 (fail-open) | null 반환 + warn 로그 |
| gate-service 불가 (fail-closed) | `SERVICE_UNAVAILABLE` (503) |
