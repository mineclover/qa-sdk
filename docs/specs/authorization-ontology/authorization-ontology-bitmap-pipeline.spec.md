---
def:
  tier: component
  id: authorization-ontology-bitmap-pipeline
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  svc: authorization-ontology
  tags: [security, structural, lifecycle, permission]
  links:
    - target: authorization-ontology-system
      type: traces_to
    - target: authorization-ontology-permission-engine-bridge
      type: refines
    - target: authorization-ontology-resource-lifecycle
      type: refs
    - target: authorization-ontology-audit-layer
      type: traces_to
    - target: coordinate-storage
      type: refs
    - target: wi-disjoint-union-addressing
      type: depends_on
    - target: authorization-ontology-nested-audit-tracing
      type: refs
sources:
  - packages/permission-engine/src/versioned-bitmap/issuer.ts
  - packages/permission-engine/src/versioned-bitmap/issuer.test.ts
  - packages/authorization-ontology/src/permission-engine-bridge.test.ts
  - packages/permission-engine/src/resource-policy/state.ts
  - packages/permission-engine/src/resource-policy/state.test.ts
---

# Authorization Ontology Bitmap Pipeline — bitmap 발급·갱신·무효화 파이프라인

## 목적 ^purpose

permission-engine의 O(1) check는 **bitmap이 freshly trusted 상태**일 때만 의미가 있다. 본 스펙은 bitmap의 **발급(issuance)**, **갱신(refresh)**, **무효화(invalidation)** 파이프라인과 각 단계의 무결성·freshness·version binding 규약을 정의한다.

기존 `authorization-ontology-permission-engine-bridge`가 bitmap **투영 모델**(어떻게 graph로 보여줄 것인가)을 다룬다면, 본 스펙은 bitmap **수명주기**(언제 만들고 언제 버릴 것인가)를 다룬다.

## 구성 ^overview

bitmap 수명주기는 3단계:

```
발급 (Issuance)       — 로그인·권한 변경 시 생성
    ↓
갱신 (Refresh)        — TTL 만료 직전 재발급
    ↓
무효화 (Invalidation) — 권한 변경·취소 시 즉시 파기
```

각 단계는 **3축 무결성**을 만족해야 한다:

- **Integrity**: 서명·HMAC로 변조 방지
- **Freshness**: 권한 변경 반영 지연 허용 범위
- **Version binding**: shape 스냅샷(prefix, version)에 결합

## 정의 ^defines

### 1. VersionedBitmap 타입

```ts
interface VersionedBitmap {
  prefix: string;        // 좌표 네임스페이스 (예: "perm")
  v: string;             // shape 스냅샷 (예: "uv1") — union 전체를 하나로 바인딩
  mask: Uint8Array;      // ⌈DisjointUnionIndex.totalSize / 8⌉ 바이트
  issuedAt: string;      // ISO-8601
  expiresAt: string;     // ISO-8601
  /** 발급 주체 — 무결성 검증 대상. */
  issuer: string;
  /** HMAC 또는 JWT signature. */
  signature: string;
}
```

`VersionedIndex`의 bulk 버전. `coordinate-storage.rule`의 version binding 요건을 자동 만족.

### 1.1 Union-based 주소 공간

bitmap의 주소 공간은 **단일 `DisjointUnionIndex`**로 구성된다 (`wi-disjoint-union-addressing` 스펙 참조). 축 설계:

```
union variants:
  { kind: "resource",    shape: [role_n, action_n, resource_type_n] }
  { kind: "transaction", shape: [role_n, action_n, transition_id_n] }
  # 향후 추가 가능: admin, system, ... (append-only)

target_kind 축이 곱셈이 아니라 합산(sum)으로 처리됨 → 각 kind의 N 차이가 공간 낭비로 이어지지 않음.
```

**권한 체크 시 좌표**:
- resource CRUD: `encode("resource", [role, action, resource_type])` → address_A
- transaction 실행: `encode("transaction", [role, action, transition_id])` → address_B
- 두 address는 disjoint — 같은 bitmap에서 충돌 없음.

**version (v)는 union 전체에 unified**. 어느 kind든 shape 변경 시 전체 bitmap 재발급 (unified versioning 결정, Q1 합의).

### 2. 발급 (Issuance)

트리거:
- 로그인 성공 (ZITADEL token 검증 후)
- 권한 변경 (역할 부여/박탈, 리소스 owner 변경)
- bitmap schema 변경 (shape 또는 prefix 버전 bump)
- **새 kind 추가** (DisjointUnionIndex variants 확장) — §6 Version binding 참조

알고리즘:

```ts
async function issueBitmap(userId: string, prefix: string): Promise<VersionedBitmap> {
  // 1. 현재 prefix의 최신 version 조회
  const v = prefixCodec.getCurrentVersion(prefix);

  // 2. 유저의 권한 bit 집합 계산 (DB / role inheritance / override 반영)
  const bits = await computeUserBits(userId, prefix, v);

  // 3. bitmap 구축
  const mask = buildMask(WI.size, bits);

  // 4. 메타 + 서명
  const now = Date.now();
  const ttlMs = config.bitmapTtlMs;  // 예: 5분
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  const signature = hmac(secret, `${userId}:${prefix}:${v}:${mask}:${issuedAt}`);

  return {
    prefix, v, mask,
    issuedAt, expiresAt,
    issuer: "auth-service",
    signature,
  };
}
```

**성능 고려**:
- `computeUserBits`는 비용 큰 연산 (role inheritance 해석). 결과 캐시 필수 (Redis, `userId:prefix:v` 키).
- bitmap 자체는 수 KB → 128KB 범위. Redis 값으로 적합.

### 3. 저장·전달

| 저장소 | 용도 | 제약 |
|---|---|---|
| **Session/Redis** (서버 측) | 1차 저장 | TTL 관리, pub/sub invalidation |
| **JWT** (클라이언트) | 2차 — 무상태 API | 크기 제한 (< 8KB 권장), 짧은 TTL |
| **Cookie** | 웹 UI에서 JWT 대체 | httpOnly, Secure 필수 |

**JWT embed 판단**:
- bitmap <= 8KB → JWT body에 직접 (signed)
- bitmap > 8KB → Redis 저장 + JWT에는 `bitmap_id` 레퍼런스만

### 4. 갱신 (Refresh)

정책:
- `expiresAt - now < refreshWindow` (예: TTL의 20%) 이면 백그라운드 재발급
- 클라이언트는 expiresAt 임박 시 refresh 엔드포인트 호출
- 재발급 실패 시 기존 bitmap의 만료까지 유지 (graceful degradation)

Refresh는 **전체 재계산**. `computeUserBits`가 무겁다면 incremental update도 가능하지만, 정합성 감사 어려움. **전체 재계산 + cache가 권장**.

### 5. 무효화 (Invalidation)

즉시 파기가 필요한 상황:
- 사용자 권한 박탈
- 역할 재정의 (role definition 자체 변경)
- prefix version bump (shape 변경)
- 보안 인시던트

구현:

```ts
// pub/sub 채널 발행
await redis.publish("bitmap:invalidate", JSON.stringify({
  scope: "user" | "role" | "prefix",
  target: userId | roleId | prefix,
  reason: "permission_change",
}));

// 각 서버의 listener가 L1 LRU 제거
```

**무효화 지연 허용**: pub/sub 전파 지연 (~수백 ms) + JWT TTL (수 분). 이 범위 초과 시 다음 방어선(API 레이어의 Cerbos 호출)이 동작한다는 전제.

### 6. Version binding 규약 (Unified)

`(prefix, v)`는 bitmap의 의미 좌표. shape 변경 시 **새 v로 즉시 재발급**하며, 기존 bitmap은 해당 v가 유효한 동안만 유지된다.

**Unified versioning (Q1 결정)**: `DisjointUnionIndex`의 variant 구성·순서·각 variant의 shape이 **전체 union 수준에서 하나의 version**으로 관리된다. 어느 kind의 변경이든 동일하게 새 v 발급.

```ts
// variant 추가 또는 기존 shape 확장 → 새 union version
prefixCodec.addVersion("perm", "uv2", {
  variants: [
    { kind: "resource",    shape: [5, 5, 120] },  // role, action, resource_type
    { kind: "transaction", shape: [5, 5, 80]  },  // role, action, transition_id
    { kind: "admin",       shape: [5, 5, 10]  },  // 신규 kind 추가
  ],
});

// 모든 활성 사용자 bitmap 재발급 트리거
await invalidateAll({ scope: "prefix", target: "perm" });
```

**장점**: 재발급 단위가 명확(전체 한 번). 각 kind별 version 관리의 조합 폭발 회피.

**단점**: 특정 kind의 작은 변경도 전체 재발급 필요. 빈번한 변경 시 비용. 완화책:
- kind별 변경 빈도가 자주 엇갈리면 prefix 분리 검토 (`perm-core`, `perm-admin` 등)
- variant append는 비교적 저비용 (기존 address 유지, 구 bitmap은 새 kind 비트가 0일 뿐)

구 버전 bitmap은 API 미들웨어에서 `VERSION_MISMATCH`로 거절되어 클라이언트가 refresh하도록 유도 (permission-middleware의 기존 동작과 일치).

### 7. 무결성 (Integrity)

- HMAC secret rotation: 90일 주기 교체, dual-accept 기간 24시간
- JWT signing key: asymmetric (RS256) 권장, KID 회전 지원
- 서명 실패 bitmap: 즉시 거절 + 감사 로그

## 소비 ^consumes

- `permission-engine` — `PermissionMiddleware`에서 bitmap integrity/version 검증
- `authorization-ontology-resource-lifecycle` — 2-pass check의 Pass 1 입력
- `authorization-ontology-cerbos-mapping` — bitmap 미포함 인스턴스 권한은 Cerbos로 위임
- `authorization-ontology-rls-enforcement` — DB session에 주입되는 bitmap 원본

## 위임 ^delegates

- **Cerbos 정책 판정**: 인스턴스·데이터 의존 권한은 bitmap 범위 밖
- **역할·entity 관리**: `role-registry`, `org-role-registry` 패키지
- **Shape/version 관리**: weighted-index `PrefixCodec`

## 방법 ^method

### 구현 순서

1. **Phase 1 — 발급·서명 경로**
   - `BitmapIssuer` 서비스 (computeUserBits + HMAC)
   - Redis 캐시 레이어
   - JWT embed / reference 판단 로직

2. **Phase 2 — 갱신**
   - expiresAt 임박 시 background refresh
   - 클라이언트 refresh endpoint
   - 실패 시 graceful degradation

3. **Phase 3 — 무효화**
   - Redis pub/sub 채널
   - 각 서버의 L1 LRU listener
   - 권한 변경 API에서 publish 훅

4. **Phase 4 — Version migration**
   - shape 변경 시 새 v 등록
   - 모든 사용자 bitmap 재발급 트리거
   - 구 v와 새 v의 dual-accept 기간 (grace period)

### 테스트 전략

- **발급 정확성**: 주어진 권한 grants → 올바른 bit 집합
- **서명 검증**: 변조된 bitmap 거절, 만료된 bitmap 거절
- **갱신 타이밍**: expiresAt 임박 감지, refresh 실패 graceful
- **무효화 전파**: pub/sub 지연 측정, false negative 감사
- **Version migration**: 새 v 발급 시 구 v 클라이언트의 VERSION_MISMATCH 동작
- **스케일**: N 사용자 × M prefix × bitmap 크기 시나리오 부하 테스트

## 주의사항

- **freshness ≠ 0**: 권한 변경이 즉시 반영되지 않는다. pub/sub 전파 + 캐시 TTL 만큼의 지연은 본질. 이를 감안해 중요한 거절은 Cerbos 호출로 double-check.
- **bitmap은 캐시, 권위 아님**: authority는 `computeUserBits`의 원본 데이터(DB, Cerbos). bitmap은 O(1) 접근을 위한 투영일 뿐.
- **JWT size inflation**: bitmap이 JWT에 embed되면 매 요청 payload 증가. 큰 bitmap은 Redis reference 패턴 강제.
- **Secret rotation 일정 준수**: HMAC secret rotation이 누락되면 장기 유효 bitmap이 risk. 자동화된 rotation 파이프라인 필수.
- **권한 변경 이벤트 누락**: role definition 변경이 pub/sub invalidation 트리거를 놓치면 정합성 구멍. audit-layer에서 주기 감사 필수.
- **구 version grace period**: dual-accept 기간이 너무 길면 구 shape으로의 write가 섞임. 이행 완료 후 즉시 구 v 거절 전환.
- **shape 매우 큰 경우 (> 2^20 bit)**: raw bitmap 대신 Roaring bitmap 같은 압축 저장 검토. 단 `hasBit` 성능 저하 측정 후 결정.

## 용어

- **VersionedBitmap**: `{ prefix, v, mask, issuedAt, expiresAt, issuer, signature }` — bitmap의 version-bound 저장 형식.
- **Issuance**: 사용자 로그인·권한 변경 시점의 bitmap 최초 생성.
- **Refresh**: TTL 임박 시 동일 권한으로 새 bitmap 발급.
- **Invalidation**: 권한 변경·인시던트로 인한 즉시 파기.
- **dual-accept window**: 구 HMAC secret 또는 구 version을 임시로 허용하는 이행 기간.
