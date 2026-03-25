---
def:
  id: sdk-scenarios
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  tags: [testing]
  links:
    - target: resolver-spec
      type: traces_to
    - target: index-meta-sdk-spec
      type: traces_to
---

# SDK 라이프사이클 유저 시나리오

## 목적 ^purpose

IndexSDK 기반 클라이언트·서버 운영 시나리오.
테스트: `sdk-lifecycle.e2e.test.ts`, `index-sdk.test.ts`
SDK 스펙: [sdk.spec.md](sdk.spec.md)
DX 라이프사이클: [dx-lifecycle.spec.md](dx-lifecycle.spec.md)
Core 시나리오: [scenarios.spec.md](scenarios.spec.md)

---

## 영역 구조

```
§20 SDK 소비 라이프사이클     — 스키마 → SDK → client → encode/decode → constants
§21 엔트리 제공 모드           — Client(entries) vs Full(dimFullView) 모드 운영
§22 스키마 진화 · SDK 동기화   — entry 추가 → headroom 변화 → SDK 재생성
§23 멀티 서비스 스키마 공유    — 프론트엔드·백엔드 독립 운용 + DecodeMap 전달
§24 CLI 시뮬레이션             — info, capacity, constants, diff를 SDK API로 재현
§25 inactive 항목 운영         — deprecated entry의 constants 제외 + decode 보존
§26 reservedTokens 오버라이드  — 테이블별 커스텀 예약 토큰 설정
```

---

## 20. SDK 소비 라이프사이클

> 목적: 스키마 정의 → SDK 생성 → client → encode/decode → constants 전체 경로의 정확성 보장
> 파일: `sdk-lifecycle.e2e.test.ts`

```
개발자 워크플로:
  1. MetaRegistryInput 작성 (dims, indices, capacity, 예약 토큰)
  2. createIndexSDK(input) → SDK 인스턴스
  3. sdk.client("perm", "v1") → IndexClient (version-pinned)
  4. client.constants("role") → { admin, editor, viewer } (IDE 자동완성)
  5. client.encode({ role: ROLE.admin, ... }) → VersionedValue
  6. client.decode(vv) → 원본 entity names
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| SDK-LIFE-1 | 전체 경로 | 스키마 → SDK → client → constants → encode → decode round-trip. 예약 토큰이 constants에서 제외됨 |
| SDK-LIFE-2 | 예약 토큰 encode | `"_"`로 의도적 비선택 encode → decode → `"_"` 복원. constants에는 없지만 entries에는 포함 |
| SDK-LIFE-3 | 결정적 인코딩 | 별도 SDK 인스턴스에서 동일 입력 → 동일 value 생성 |
| SDK-LIFE-4 | matchRanges 필터링 | 특정 role의 모든 action×resource 범위 조회. 범위 내 모든 decode → role 일치 |

---

## 21. 엔트리 제공 모드: Client vs Full

> 목적: 프론트엔드(Client 모드)와 백엔드(Full 모드) 간 엔트리 제공 방식의 명확한 분리
> 파일: `sdk-lifecycle.e2e.test.ts`

```
Client 모드 (프론트엔드)                Full 모드 (백엔드)
──────────────────────                ──────────────────────
entries("role")                       dimFullView("role")
→ ["_","~","admin","editor","viewer"] → { positions: [
constants("role")                         {pos:1, val:"_",     kind:"reserved"},
→ { admin, editor, viewer }               {pos:2, val:"~",     kind:"reserved"},
                                          {pos:3, val:"admin", kind:"normal"},
capacity 정보: 없음                       {pos:4, val:"editor",kind:"normal"},
headroom 정보: 없음                       {pos:5, val:"viewer",kind:"normal"},
                                          {pos:6, val:null,    kind:"empty"},
                                          ...
                                        ], capacity:10, headroom:5 }
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| ENTRY-MODE-1 | Client 모드 | entries() 반환 = 등록된 entries만. constants() = 예약 토큰 제외. capacity 정보 비노출 |
| ENTRY-MODE-2 | Full 모드 | dimFullView() = 전체 capacity 포함. reserved/normal/empty 3분류 정확. headroom 포함 |
| ENTRY-MODE-3 | 주소 공간 분석 | 모든 dim의 full view 수집 → 전체 주소 공간 크기 계산. headroom 최소 dim 식별 |
| ENTRY-MODE-4 | index-label 매핑 | full view에서 normal entries만 추출 → position ↔ label 매핑 구성 |

### Full 모드 사용 시점

| 시나리오 | 사용하는 API | 이유 |
|----------|------------|------|
| 프론트엔드 encode/decode | entries(), constants() | capacity 정보 불필요 |
| 백엔드 주소 추론 | dimFullView() | 전체 주소 공간 구조 파악 필요 |
| 관리 UI (entry 추가 판단) | dimFullView() + dimCapacity() | headroom, empty position 확인 |
| DB range scan 계획 | matchRanges() + dimFullView() | 주소 범위와 position 매핑 필요 |
| 코드젠 | constants() | 정규 도메인 값만 필요 |

---

## 22. 스키마 진화 · SDK 동기화

> 목적: entry 추가 → headroom 감소 → version 업그레이드 → 마이그레이션 전체 동선의 정확성
> 파일: `sdk-lifecycle.e2e.test.ts`

```
라이프사이클:
  ① dimCapacity("role").headroom = 5        ← v1 상태
  ② 관리 레이어에서 "moderator" 추가
  ③ 새 스키마 배포 (sv2 snapshot)
  ④ createIndexSDK(v2Schema) → 새 SDK      ← SDK 재생성
  ⑤ dimCapacity("role").headroom = 4        ← headroom 감소 확인
  ⑥ v2 client로 "moderator" encode 가능
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| SCHEMA-EVO-1 | headroom 변화 | v1(headroom=5) → v2(moderator 추가, headroom=4). capacity 유지 |
| SCHEMA-EVO-2 | capacity 불변 | headroom 내 추가 → capacity=10 유지. 새 entry가 올바른 position에 배치 |
| SCHEMA-EVO-3 | 마이그레이션 | v1 encode → v1 decode → v2 re-encode → v2 decode → 동일 entity |
| SCHEMA-EVO-4 | v2 전용 entry | v2 전용(moderator, approve)은 v1에서 EntryNotFoundError |
| SCHEMA-EVO-5 | constants 반영 | v1 constants에 moderator 없음, v2 constants에 moderator 포함 |
| SCHEMA-EVO-6 | SDK 재생성 | 스키마 변경 → 새 createIndexSDK() 호출로 동기화. 기존 SDK 인스턴스는 이전 상태 유지 |

### SDK는 immutable 스냅샷

SDK 인스턴스는 생성 시점의 스키마를 반영한다. 스키마가 변경되면 새 SDK를 생성해야 한다. 기존 SDK는 변경 전 상태를 계속 반환한다.

```
sdk1 = createIndexSDK(v1Schema)
  → sdk1.client("perm","v1").dimCapacity("role").headroom = 5  (불변)

[관리 레이어: moderator 추가]

sdk2 = createIndexSDK(v2Schema)
  → sdk2.client("perm","v2").dimCapacity("role").headroom = 4  (최신 반영)
```

entry 추가는 SDK가 수행하지 않는다. 관리 레이어(레지스트리/DB)에서 수행한 뒤 SDK를 재생성해 동기화한다.

---

## 23. 멀티 서비스 스키마 공유

> 목적: 프론트엔드·백엔드·분석 서비스가 동일 스키마로 독립 운용함을 보장
> 파일: `sdk-lifecycle.e2e.test.ts`

```
┌─────────────┐    VersionedValue    ┌─────────────┐
│  프론트엔드   │ ──── (JSON) ────→  │   백엔드     │
│  feSDK       │                     │  beSDK       │
│  encode()    │                     │  decode()    │
└─────────────┘                     └──────┬──────┘
                                           │ DecodeMap
                                           │ (JSON)
                                    ┌──────▼──────┐
                                    │  분석 서비스  │
                                    │  MetaCodec   │
                                    │  (SDK 없음)  │
                                    └─────────────┘
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| MULTI-SVC-1 | FE→BE round-trip | 프론트엔드 encode → JSON.stringify → 백엔드 JSON.parse → decode → 원본 entity |
| MULTI-SVC-2 | DecodeMap 독립 | toDecodeMap() → JSON → MetaCodec → decode. SDK 없이 완전한 decode |
| MULTI-SVC-3 | constants vs 문자열 | constants 사용과 문자열 직접 입력이 동일한 VersionedValue 생성 |
| MULTI-SVC-4 | matchRanges DB | matchRanges → BETWEEN 범위 생성 → 범위 내 모든 decode → 조건 일치 |
| MULTI-SVC-5 | 혼재 버전 라우팅 | v1+v2 payload 혼합 수신 → versionId 기반 client 선택 → 정확한 decode |

### DecodeMap 전달 vs SDK 공유

| 접근법 | 전달 데이터 | 수신 측 요구 | 기능 범위 |
|--------|-----------|-------------|----------|
| SDK 공유 | MetaRegistryInput | createIndexSDK | encode + decode + constants + matchRanges + dimCapacity |
| DecodeMap 전달 | DecodeMap (JSON) | new MetaCodec(map) | encode + decode만 |

DecodeMap 전달은 "SDK 없이 decode만 필요한" 서비스에 적합하다. constants, matchRanges, dimCapacity 같은 고급 기능이 필요하면 SDK를 직접 사용해야 한다.

---

## 24. CLI 시뮬레이션

> 목적: CLI 구현 시 기대하는 출력의 정확성을 SDK API로 사전 검증
> 파일: `sdk-lifecycle.e2e.test.ts`
>
> 참고: CLI는 아직 미구현. SDK API로 동일한 결과를 산출할 수 있음을 증명한다.

```
CLI 명령어               SDK API 대응
──────────              ──────────────────────────────────────
index-meta info role    MetaResolver.getDimRange("role")
index-meta capacity     client.dimCapacity("role") + shape + size
index-meta constants    client.constants("role") / entries("role")
index-meta diff v1 v2   v1.shape vs v2.shape + constants diff
index-meta fullview     client.dimFullView("role")
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| CLI-INFO-1 | dim info | getDimRange() → 스냅샷별 entries, capacity, headroom. sv1/sv2 모두 정확 |
| CLI-CAP-2 | capacity 보고서 | 모든 dim의 total, capacity, headroom + shape, size 정확 |
| CLI-CONST-3 | constants 추출 | constants() = 예약 토큰 제외, entries() = 전체 목록. 양쪽 모두 정확 |
| CLI-DIFF-4 | version diff | shape/size 변화 + dim별 추가된 entries 계산 (moderator, approve) |
| CLI-FULLVIEW-5 | full view 제공 | 모든 dim의 dimFullView() → reserved/normal/empty 분류 정확. 관리 UI 데이터 |

---

## 25. inactive 항목 운영

> 목적: deprecated entry가 constants에서 제외되면서도 기존 데이터의 decode가 보장됨
> 파일: `sdk-lifecycle.e2e.test.ts`

```
entryFlags: { 4: { status: "inactive", reason: "역할 폐지" } }

constants("role")  →  { admin, editor, viewer }        ← tester 제외
entries("role")    →  ["_", "admin", "editor", "tester", "viewer"]  ← tester 포함
encode({ role: "tester" })  →  정상 동작                ← 기존 데이터 보존
dimFullView("role").positions[3]  →  { kind: "normal" }  ← inactive도 normal
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| INACTIVE-1 | constants 제외 | inactive entry가 constants에서 제외됨. entries에는 포함 |
| INACTIVE-2 | decode 보존 | inactive entry로 encode/decode 정상 동작 (기존 데이터) |
| INACTIVE-3 | fullView 분류 | dimFullView에서 inactive는 kind="normal" (값이 존재하는 정규 위치) |

### inactive vs empty vs reserved 구분

| 상태 | kind | constants 포함 | encode 가능 | 위치에 값 존재 |
|------|------|-------------|-----------|--------------|
| active normal | `normal` | ✓ | ✓ | ✓ |
| inactive normal | `normal` | ✗ | ✓ (기존 데이터) | ✓ |
| reserved | `reserved` | ✗ | ✓ | ✓ |
| empty (headroom) | `empty` | ✗ | ✗ | ✗ |

---

## 26. reservedTokens 오버라이드 운영

> 목적: 테이블마다 다른 예약 토큰 셋을 사용할 수 있음을 보장
> 파일: `sdk-lifecycle.e2e.test.ts`

```
기본 RESERVED_TOKENS = {"_", "~", "?"}

number_enum 테이블에서 NaN 추가 시:
  createIndexSDK(input, { reservedTokens: new Set(["_","~","?","NaN"]) })
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| RESERVED-OVERRIDE-1 | 기본 토큰 | 기본 RESERVED_TOKENS는 NaN 미포함 → constants에 NaN 포함됨 |
| RESERVED-OVERRIDE-2 | 커스텀 토큰 | NaN 포함 오버라이드 → constants에서 NaN 제외 |
| RESERVED-OVERRIDE-3 | fullView 연동 | 커스텀 reservedTokens가 dimFullView의 kind 분류에도 반영 |

---

## 테스트 매핑

| 시나리오 | 테스트 파일 | 테스트 수 |
|----------|-----------|----------|
| §20 SDK 소비 라이프사이클 | `sdk-lifecycle.e2e.test.ts` | 4 |
| §21 엔트리 제공 모드 | `sdk-lifecycle.e2e.test.ts` | 4 |
| §22 스키마 진화 | `sdk-lifecycle.e2e.test.ts` | 6 |
| §23 멀티 서비스 | `sdk-lifecycle.e2e.test.ts` | 5 |
| §24 CLI 시뮬레이션 | `sdk-lifecycle.e2e.test.ts` | 5 |
| §25 inactive 운영 | `sdk-lifecycle.e2e.test.ts` | 3 |
| §26 reservedTokens | `sdk-lifecycle.e2e.test.ts` | 3 |
| **합계** | | **30** |

추가 단위 테스트 (SDK core):

| 관심사 | 테스트 파일 | 테스트 수 |
|--------|-----------|----------|
| client encode/decode | `index-sdk.test.ts` | 7 |
| entries/constants | `index-sdk.test.ts` | 10 |
| 예약 토큰 제외 | `index-sdk.test.ts` | 6 |
| inactive 제외 | `index-sdk.test.ts` | 4 |
| reservedTokens 오버라이드 | `index-sdk.test.ts` | 5 |
| dimCapacity | `index-sdk.test.ts` | 3 |
| dimFullView | `index-sdk.test.ts` | 8 |
| entries vs dimFullView 대비 | `index-sdk.test.ts` | 4 |
| matchRanges | `index-sdk.test.ts` | 3 |
| toDecodeMap | `index-sdk.test.ts` | 2 |
| 멀티 인덱스 | `index-sdk.test.ts` | 1 |
| 에러 처리 | `index-sdk.test.ts` | 3 |
| 결정적 인코딩 | `index-sdk.test.ts` | 3 |
| VersionedValue 와이어 포맷 | `index-sdk.test.ts` | 3 |
| API 요청/응답 시뮬레이션 | `index-sdk.test.ts` | 3 |
| 버전 진화 | `index-sdk.test.ts` | 5 |
| 상수 기반 워크플로 | `index-sdk.test.ts` | 3 |
| DecodeMap 독립 소비 | `index-sdk.test.ts` | 2 |
| 멀티 인덱스 실전 | `index-sdk.test.ts` | 3 |
| **합계** | | **77** |
