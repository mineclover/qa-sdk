# Query Service 스펙

> 관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스.
> RelationalEngine + policy-resolver + gate-aware-query를 네트워크 서비스로 노출한다.

관련 스펙: [../indexing/coordinate-query.spec.md](../indexing/coordinate-query.spec.md) · [../indexing/index-meta/gate-engine.spec.md](../indexing/index-meta/gate-engine.spec.md)
참조 구현: `packages/index-meta/src/relational-engine.ts`, `policy-resolver.ts`, `cross-index-query.ts`, `version-query.ts`, `packages/query-service/src/lib/query-service.ts`, `packages/query-service/src/lib/rule-service.ts`
운영 흐름: `[S2]` resolve · `[S2→S4]` 규칙 CRUD · `[A5]` match-ranges/compose-query — [runtime-flows.spec.md](../operations/runtime-flows.spec.md)

## 상태

implemented (`F-1~F-4`)

현재 구현 범위:

- PolicyRule 저장소 인터페이스 + Memory/SQL 어댑터 구현 완료
- 규칙 CRUD 5종 구현 완료
- 질의 엔드포인트 5종 구현 완료
- Gate Service 연동(`gateMode`, `withGate`, fail-open/fail-closed) 구현 완료
- `F-5` 규칙 버전 마이그레이션은 planned 유지

---

## 1. 목적

### 문제

좌표 질의 모듈(policy-resolver, cross-index-query, version-query, RelationalEngine)은 라이브러리로 구현되어 있다. 서비스 분리 시:

- 규칙(PolicyRule)의 영속화/버전 관리가 필요
- 여러 서비스가 동일 규칙 집합에 대해 질의해야 함
- gate 상태와 정책 해소를 원자적으로 합성해야 함

### 해법

질의 연산을 중앙 서비스로 노출하여 규칙 관리 + 질의 실행 + gate 통합을 단일 진입점으로 제공한다.

```
클라이언트 → Query Service → MetaRegistry (스키마)
                            → PolicyRule Store (규칙 영속화)
                            → Gate Service (상태 조회)
```

---

## 2. 규칙 영속화

### CRUD API

```
POST   /rules                    규칙 생성
GET    /rules?indexId=&versionId=   규칙 목록 조회 (`versionId` query parameter)
GET    /rules/:id                단일 규칙 조회
PUT    /rules/:id                규칙 수정
DELETE /rules/:id                규칙 삭제
```

### 규칙 레코드

```ts
interface StoredPolicyRule<T> {
  id: string;
  indexId: string;
  versionId: string;
  pattern: CoordConstraint[];
  value: T;
  priority?: number;
  createdAt: string;       // ISO 8601
  updatedAt: string;
  ruleSetId?: string;      // 규칙 그룹 식별자
}
```

### 버전 관리

- 규칙은 특정 (indexId, versionId)에 바인딩
- index version 변경 시 `translateConstraint`로 규칙 마이그레이션 가능
- 규칙 변경 이력은 append-only 로그로 보존

### detectConflicts 사전 검증

규칙 생성/수정 시 자동으로 충돌 검증:

```
POST /rules
→ detectConflicts(existingRules + newRule, shape)
→ 충돌 발견 시 409 Conflict + ConflictReport[] 반환
→ 충돌 없으면 201 Created
```

강제 삽입 옵션: `?force=true` → 충돌 경고만 반환, 생성은 진행.

현재 구현은 `PrefixRegistry.getShape()` + deep equality 기반 conflict preflight를 사용한다.

---

## 3. 질의 형식

### 단일 좌표 해소

현재 `POST /resolve`로 구현되어 있으며 `withGate=true`일 때 gate-aware 결과를 반환할 수 있다.

```
POST /resolve
{
  "indexId": "perm",
  "versionId": "v1",
  "coord": [1, 4, 7],
  "strategy": "most-specific",
  "ruleSetId": "rbac-rules"      // 선택
}

→ 200 OK
{
  "value": "allow",
  "matchedRules": [ ... ],
  "strategy": "most-specific"
}
```

### 범위 질의

현재 `POST /match-ranges`로 구현되어 있으며 `gateMode`가 주어지면 gate-service 조회 결과를 합성한다.

```
POST /match-ranges
{
  "indexId": "perm",
  "versionId": "v1",
  "partial": { "role": "admin", "action": null, "resource": null }
}

→ 200 OK
{
  "ranges": [[0, 63]]
}
```

### cross-index 합성 질의

현재 `POST /compose-query`로 구현되어 있다.

```
POST /compose-query
{
  "source": { "indexId": "article", "versionId": "v1" },
  "through": "quality_tier",
  "targetConstraint": { "format": "PDF", "lang": "ko" }
}

→ 200 OK
{
  "ranges": [[20, 39]]
}
```

### version 횡단 질의

현재 `POST /query-across-versions`로 구현되어 있다.

```
POST /query-across-versions
{
  "indexId": "perm",
  "versionIds": ["v1", "v2", "v3"],
  "constraint": { "role": "admin" }
}

→ 200 OK
{
  "results": {
    "v1": [[0, 8]],
    "v2": [[0, 8]],
    "v3": [[0, 11]]
  }
}
```

### 2-level relation 해소

현재 `POST /resolve-relation`으로 구현되어 있다.

```
POST /resolve-relation
{
  "relTypeCoord": [1, 2, 3],
  "relShape": [5, 4, 6],
  "typeRules": [ ... ],
  "typeStrategy": "most-specific",
  "instanceCoord": [2, 3, 1]      // 선택
}

→ 200 OK
{
  "value": "allow",
  "typeLevel": { ... },
  "instanceLevel": { ... }
}
```

---

## 4. 충돌 전략

### 요청별 지정

모든 해소 요청에 `strategy` 필드로 전략 지정:

| 전략 | 의미 |
|---|---|
| `most-specific` | patternSpecificity 최고값 승리 |
| `priority` | 명시적 priority 내림차순 |
| `collect` | 모든 매칭 값 수집 |
| `first-match` | 규칙 입력 순서 첫 매칭 |

### 기본 전략

서비스 설정으로 기본 전략 지정 가능:

```yaml
query-service:
  defaultStrategy: "most-specific"
```

요청에 strategy가 없으면 기본 전략 적용.

### 서버 제한

특정 전략을 서버 수준에서 금지할 수 있음:

```yaml
query-service:
  disabledStrategies: ["first-match"]  # 결정론적이지 않은 전략 차단
```

금지된 전략 요청 시 400 Bad Request.

---

## 5. Gate 통합

### gateFilterRanges 흐름

범위 질의 결과에 gate 상태를 자동 적용:

```
POST /match-ranges
{
  ...
  "gateMode": "active"    // "encodable" | "decodable" | "active" | null
}
```

1. `matchRanges` → 범위 계산
2. `gateMode`가 null이 아니면:
   - Gate Service에서 `getStateRanges(prefix, versionId)` 조회
   - `gateFilterRanges(ranges, gateRecord, mode)` 적용
3. gate 적용 후 범위 반환

### gateAwareResolve 흐름

단일 좌표 해소에 gate 합성:

```
POST /resolve
{
  ...
  "withGate": true         // 기본 false
}
```

1. `resolvePolicy` → 정책 해소
2. `withGate: true`이면:
   - Gate Service에서 `getStateRanges` 조회
   - `gateAwareResolve(policyResult, address, gateRecord)` 합성
3. `GateAwareResult` 반환:
   - `permitted`: 정책 allow AND gate active
   - `gateBlocked`: gate 차단 여부
   - `gateState`: 주소의 gate 상태

### Gate Service 연동 실패 시

| 전략 | 동작 |
|---|---|
| fail-open (기본) | gate 조회 실패 시 전체 active 가정 → 정책 결과만 반환 |
| fail-closed | gate 조회 실패 시 503 반환 |

서비스 설정으로 선택:

```yaml
query-service:
  gateFailureMode: "fail-open"
```
