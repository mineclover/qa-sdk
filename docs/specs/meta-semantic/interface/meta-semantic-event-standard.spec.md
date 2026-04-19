---
def:
  id: meta-semantic-event-standard
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: ms-concept-event
      type: refines
    - target: meta-semantic-scope
      type: depends_on
---

# 이벤트 표준 — CloudEvents 호환 + 서비스 버전 매니페스트

## 목적 ^purpose

meta-semantic의 이벤트 개념을 CloudEvents 정식 호환으로 구현하고,
서비스 단위로 하위 prefix 버전을 고정·조회할 수 있는
**서비스 버전 매니페스트(Service Version Manifest)**를 정의한다.

## 방법 ^method

**CloudEvents** 표준 필드로 이벤트 봉투의 호환성을 확보하고,
**qa-sdk 확장 속성**으로 prefix 좌표·버전을 태깅하고,
**서비스 버전 매니페스트**로 서비스의 하위 prefix 전체 버전을 고정한다.

---

## 1. CloudEvents 호환 매핑

### 표준 필드

| CloudEvents 필드 | 값 | qa-sdk 원천 |
|---|---|---|
| `specversion` | `"1.0"` | CloudEvents 스펙 버전 (고정) |
| `id` | ULID | 이벤트 고유 식별자 |
| `type` | `event_key` | 이벤트 유형 (예: `order_submitted`) |
| `source` | 서비스 URI | 이벤트 발생 서비스 (예: `//order-service`) |
| `time` | ISO-8601 | `timestamp` |
| `subject` | 좌표 주소 | `coordinate` (인코딩된 정수 또는 직렬화) |
| `data` | JSON | `payload` |
| `datacontenttype` | `"application/json"` | 페이로드 형식 |

### qa-sdk 확장 속성 (Extension Attributes)

CloudEvents는 커스텀 확장 속성을 허용한다.
qa-sdk는 다음 확장을 사용한다:

| 확장 속성 | 값 | 의미 |
|---|---|---|
| `qasdk_prefix` | prefix ID | 이벤트가 속한 좌표 공간 (예: `order_event`) |
| `qasdk_prefixversion` | prefix 버전 | 좌표 인코딩에 사용된 prefix 버전 (예: `v2`) |
| `qasdk_manifestversion` | 매니페스트 버전 | 서비스 레벨 버전 (예: `v3`) |
| `qasdk_traceid` | trace ID | 파이프 체인 추적용 |
| `qasdk_sessionid` | session ID | 세션 단위 그룹핑 |

### 예시

```json
{
  "specversion": "1.0",
  "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "type": "order_submitted",
  "source": "//order-service",
  "time": "2026-04-01T10:30:00Z",
  "subject": "order_event:v2:1345",
  "data": { "orderId": "ORD-123", "amount": 50000 },
  "datacontenttype": "application/json",

  "qasdk_prefix": "order_event",
  "qasdk_prefixversion": "v2",
  "qasdk_manifestversion": "v3",
  "qasdk_traceid": "trace_abc123",
  "qasdk_sessionid": "session_xyz789"
}
```

---

## 2. 서비스 버전 매니페스트 (Service Version Manifest)

### 개념

서비스는 여러 prefix를 소유한다.
매니페스트는 서비스의 **하위 prefix 전체 버전을 고정**하여,
특정 매니페스트 버전으로 서비스의 전체 좌표 체계를 복원할 수 있게 한다.

### 구조

```typescript
interface ServiceVersionManifest {
  /** 서비스 식별자 */
  serviceId: string;

  /** 매니페스트 버전 — 서비스 레벨 버전 */
  manifestVersion: string;

  /** 하위 prefix별 고정 버전 */
  prefixes: Record<string, string>;

  /** 생성 시각 */
  createdAt: string;

  /** 변경 사유 */
  changelog?: string;
}
```

### 예시

```typescript
const manifest: ServiceVersionManifest = {
  serviceId: "order-service",
  manifestVersion: "v3",
  prefixes: {
    "order_event": "v2",
    "payment_event": "v1",
    "cart_event": "v3",
    "order_action": "v1",
  },
  createdAt: "2026-04-01T00:00:00Z",
  changelog: "cart_event v2→v3: shipping_option 축 추가",
};
```

### 매니페스트 버전 규칙

| 상황 | 매니페스트 버전 변경 |
|------|-------------------|
| 하위 prefix 중 하나라도 버전 변경 | 매니페스트 버전 올림 |
| 새 prefix 추가 | 매니페스트 버전 올림 |
| prefix 제거 (deprecated) | 매니페스트 버전 올림 |
| 하위 prefix 내용 변경 없음 | 매니페스트 버전 유지 |

### 조회 API

```typescript
// 서비스의 현재(최신) 매니페스트 조회
getLatestManifest(serviceId: string): ServiceVersionManifest

// 서비스의 특정 버전 매니페스트 조회
getManifest(serviceId: string, manifestVersion: string): ServiceVersionManifest

// 특정 매니페스트에서 prefix 버전 조회
getPrefixVersion(serviceId: string, manifestVersion: string, prefixId: string): string

// 서비스의 매니페스트 이력 조회
listManifests(serviceId: string): ServiceVersionManifest[]
```

---

## 3. CloudEvents + 매니페스트 연동

### 이벤트 발행 시

```
서비스가 이벤트를 발행할 때:
1. 현재 매니페스트 버전 조회 → "v3"
2. 해당 prefix의 고정 버전 조회 → order_event: "v2"
3. CloudEvents 봉투 생성:
   - specversion: "1.0"
   - qasdk_prefixversion: "v2"
   - qasdk_manifestversion: "v3"
```

### 이벤트 수신 시

```
수신자가 이벤트를 처리할 때:
1. qasdk_manifestversion → "v3" 확인
2. getManifest("order-service", "v3") → 전체 prefix 버전 세트 복원
3. qasdk_prefix + qasdk_prefixversion → 좌표 공간 결정
4. subject(좌표 주소) 디코딩 → 원래 차원 값 복원
```

**매니페스트 버전 하나로 서비스의 전체 좌표 체계를 복원할 수 있다.**

---

## 4. scope×aspect와의 관계

CloudEvents의 `type`(event_key)은 scope로 분류된다:

```
type: "order_submitted"    → scope: feature, aspect: func_def
type: "page_viewed"        → scope: ui, aspect: interaction
type: "record_persisted"   → scope: data, aspect: domain_data
type: "api_called"         → scope: interface, aspect: api_contract
```

scope별 검증 전략이 이벤트에도 적용되어,
이벤트 유형에 따라 적합한 검증 방법이 결정된다.

---

## 5. 기존 EventRecord와의 관계

| 접근 | 전략 |
|------|------|
| **내부 저장** | 기존 EventRecord 구조 유지 (성능 최적화) |
| **외부 발행** | CloudEvents 봉투로 래핑 (표준 호환) |
| **변환** | `toCloudEvent(record, manifest)` → CloudEvents JSON |
| **역변환** | `fromCloudEvent(ce)` → EventRecord |

기존 코드 변경 최소화: 내부는 EventRecord, 외부 인터페이스만 CloudEvents.

---

## 6. AsyncAPI 명세 자동 생성

매니페스트 + event-catalog에서 AsyncAPI 명세를 자동 생성할 수 있다:

```
입력:
  ServiceVersionManifest (prefix 목록 + 버전)
  + event-catalog (이벤트 유형 + payload 스키마)

출력:
  asyncapi: '3.0.0'
  info:
    title: order-service Events
    version: v3  ← 매니페스트 버전
  channels:
    order_submitted:
      messages:
        orderSubmitted:
          payload:
            $ref: '#/components/schemas/OrderSubmittedPayload'
```

---

## 7. Prefix 관리 및 공급 라이프사이클

### Prefix 라이프사이클

```
draft → released → active → deprecated → archived
  │        │         │          │
  │        │         │          └── 이벤트 수신만 가능 (발행 금지)
  │        │         └── 이벤트 발행/수신 모두 가능
  │        └── 매니페스트에 포함 가능. 아직 active 아님
  └── 개발 중. 매니페스트에 포함 불가
```

| 상태 | 이벤트 발행 | 이벤트 수신 | 매니페스트 포함 | 변경 가능 |
|------|:---------:|:---------:|:------------:|:--------:|
| `draft` | ✗ | ✗ | ✗ | ✓ (자유) |
| `released` | ✗ | ✗ | ✓ (준비) | ✗ (고정) |
| `active` | ✓ | ✓ | ✓ | ✗ (고정) |
| `deprecated` | ✗ | ✓ | ✓ (하위 호환) | ✗ |
| `archived` | ✗ | ✗ | ✗ | ✗ |

**전이 규칙:**
- `draft → released`: 축/capacity 확정, 변경 불가 시작
- `released → active`: 매니페스트 publish 시 자동 전이
- `active → deprecated`: 새 prefix 버전이 active되면 이전 버전 deprecated
- `deprecated → archived`: 이 버전을 참조하는 매니페스트가 전부 superseded된 후

### 매니페스트 라이프사이클

```
draft → published → active → superseded → archived
  │        │          │          │
  │        │          │          └── 새 매니페스트가 active되면 이전 superseded
  │        │          └── 서비스가 이 매니페스트로 이벤트를 발행 중
  │        └── prefix 버전 조합이 확정됨. active 전환 대기
  └── prefix 조합 구성 중
```

| 상태 | 이벤트 발행 | 이력 조회 | prefix 변경 |
|------|:---------:|:--------:|:----------:|
| `draft` | ✗ | ✗ | ✓ (prefix 추가/제거) |
| `published` | ✗ | ✗ | ✗ (고정) |
| `active` | ✓ | ✓ | ✗ |
| `superseded` | ✗ | ✓ (과거 이벤트 디코딩용) | ✗ |
| `archived` | ✗ | ✗ | ✗ |

**전이 규칙:**
- `draft → published`: 포함된 모든 prefix가 released 이상
- `published → active`: 서비스 배포 시. 이전 active 매니페스트는 superseded로
- `active → superseded`: 새 매니페스트가 active될 때 자동 전이
- `superseded → archived`: 이 매니페스트로 발행된 이벤트의 보존 기간 만료 후

### 가드 (전이 조건)

| 전이 | 가드 |
|------|------|
| prefix: draft → released | 축 정의 완료, capacity headroom ≥ 2 |
| prefix: active → deprecated | 대체 prefix 버전이 active 상태 |
| manifest: draft → published | 포함된 모든 prefix가 released 이상 |
| manifest: published → active | 서비스 배포 승인 |
| manifest: superseded → archived | 참조 이벤트 retention 기간 만료 |

### 공급 체인

```
① Prefix 정의 (draft)
   축, capacity, entries 설정
     ↓
② Prefix 릴리스 (released)
   축/capacity 고정, 매니페스트 포함 가능
     ↓
③ 매니페스트 구성 (draft)
   서비스가 사용할 prefix 버전 조합 선택
     ↓
④ 매니페스트 발행 (published)
   모든 prefix가 released 이상인지 검증
     ↓
⑤ 매니페스트 활성화 (active)
   서비스 배포. prefix도 active로 자동 전이
     ↓
⑥ 이벤트 발행
   CloudEvents + qasdk_manifestversion으로 발행
     ↓
⑦ 이벤트 수신/디코딩
   manifestversion으로 매니페스트 조회 → prefix 버전 세트 복원 → 좌표 디코딩
```

### 버전 전환 시나리오

```
시나리오: cart_event v2 → v3 (shipping_option 축 추가)

1. cart_event v3 생성 (draft)
   → shipping_option 축 추가, capacity 설정
2. cart_event v3 릴리스 (released)
   → 축/capacity 고정
3. order-service 매니페스트 v4 생성 (draft)
   → cart_event: v2 → v3 변경
4. 매니페스트 v4 발행 (published)
   → cart_event v3이 released 상태 확인
5. 매니페스트 v4 활성화 (active)
   → cart_event v3 active, cart_event v2 deprecated
   → 매니페스트 v3 superseded
6. 이후 이벤트
   → 새 이벤트: manifestversion=v4, cart_event v3으로 인코딩
   → 과거 이벤트: manifestversion=v3, cart_event v2로 디코딩 (superseded 매니페스트 조회 가능)
```

---

## 8. 최종 목적 — SDK 관측

이 스펙의 CloudEvents 호환, 매니페스트 라이프사이클, prefix 공급 체인은 하나의 목적을 향한다:

**이벤트 카탈로그 기반으로 실제 동작 로직에서 이벤트를 식별·수집하는 것.**

```
PipeGraph 정의 → collectGraphEvents()로 이벤트 카탈로그 수집
    ↓
이벤트 카탈로그 → CloudEvent 스키마 도출 + AsyncAPI 생성
    ↓
런타임 track API (event-catalog autoTrack) → 실제 이벤트 수집
    ↓
수집 데이터 → ingest-server → 분석·관측
    ↓
피드백: 실제 수집 데이터 vs 설계 의도 → compareWithSimulation()으로 드리프트 감지
```

현재 구현 상태:
- **구현됨**: 런타임 track API (event-catalog autoTrack), CloudEvent 변환, collectGraphEvents
- **미구현**: 이벤트 카탈로그에서 SDK track 코드 자동 생성 (현재는 수동 삽입)

---

## 9. 범위

### 현재 범위

- CloudEvents 표준 필드 매핑 + qa-sdk 확장 속성 정의
- 서비스 버전 매니페스트 구조 + 조회 API
- Prefix 라이프사이클 (draft→released→active→deprecated→archived)
- 매니페스트 라이프사이클 (draft→published→active→superseded→archived)
- 공급 체인 (prefix 정의 → 릴리스 → 매니페스트 구성 → 발행 → 활성화 → 이벤트)
- 전이 가드 규칙
- CloudEvents ↔ EventRecord 변환 전략
- AsyncAPI 자동 생성 가능성

### 구현 완료

| 구현 | 파일 | 테스트 |
|------|------|--------|
| toCloudEvent / fromCloudEvent | `core/src/cloud-events.ts` | 14 tests |
| serializeCloudEvent / deserializeCloudEvent | 같은 파일 | 포함 |
| toCloudEventBatch / fromCloudEventBatch | 같은 파일 | 포함 |
| generateAsyncApi / asyncApiToYaml / asyncApiToJson | `core/src/asyncapi-gen.ts` | 4 tests |
| ManifestRegistry (prefix + manifest 라이프사이클) | `definition-catalog/src/version-manifest.ts` | 16 tests |

### 후속 과제

| 과제 | 설명 |
|------|------|
| ManifestStore 영속화 | 인메모리 → SQLite/서비스 |
| registry-service 연동 | 매니페스트를 registry-service에서 관리 |
