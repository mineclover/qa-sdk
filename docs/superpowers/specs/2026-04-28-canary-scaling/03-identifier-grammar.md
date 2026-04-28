# Enterprise-PM Canary & Scaling — Identifier Grammar

> 시뮬에 등장하는 모든 합성 문자열을 typed builder로 좁히고, 원형(structured) 객체를 SSOT로 삼아 라운드트립을 보장한다. 시뮬이 자라도 의도가 끊기지 않게 만드는 기반 문법.

본 사이클은 카나리/스케일링을 다루면서 이미지 태그, 헤더 이름, outbox 이벤트명, schemaHash, decision id, label key, redis pub/sub channel, bitmap cache key, idempotency key, replication slot 등 합성 문자열을 대량으로 도입한다. 이를 임의 보간으로 두면 ① 누가 어떤 식별자를 만드는지 추적이 끊기고, ② 시뮬이 자라며 동일 개념이 두 가지 표기를 갖게 되며, ③ 변경 시 영향 범위 산정이 불가능해지고, ④ 검증 가능한 좌표계가 무너진다. 따라서 본 문서는 다음 4개 원칙을 강제한다 — (a) 모든 합성 문자열의 원형(structured) 객체를 SSOT로 관리한다. (b) 합성은 typed builder 함수만 사용한다. (c) 합성된 문자열은 항상 역분해(parse) 가능하다. (d) 자유 문자열 자리는 catalog에 등록된 식별자만 허용한다. 이 4개 원칙은 §1에서 명시하고, §2에서 본 사이클이 도입하는 15종 식별자를 표·소절로 정의하며, §3에서 신규 패키지 `sim-identifier-grammar` 구조를, §4에서 정적/런타임/CI 린팅 메커니즘을, §5에서 라운드트립 property test를, §6에서 catalog 등록 SSOT 매핑을 정의한다.

## 1. 원칙

1. **원형(structured)이 SSOT, 합성 문자열은 derived다.** `{ registry, servicePrefix, version }` 같은 객체가 SSOT이며, `qa-sdk/sim-approval-api:v3` 같은 문자열은 builder 함수의 출력일 뿐이다. 코드/문서/카탈로그의 어느 위치에서도 "원본"은 항상 객체이고, 문자열은 "이 객체로부터 합성된 형태"라는 사실이 명시되어야 한다. 비교·정렬·equality 검사는 원형 객체로 수행하며, 문자열 비교는 디버깅 출력에서만 허용한다.
2. **합성은 typed builder 함수만 사용한다.** raw `${a}/${b}:${c}` 보간은 금지된다. 모든 식별자는 `buildXxx(input): string` 시그니처의 builder를 통해서만 생산되며, 입력은 Zod schema로 검증된다. CI 린트가 template literal에서 식별자 합성으로 의심되는 패턴(`/`, `:`, `.`, `-` 결합 + 외부 변수 참조)을 검출하여 builder 사용을 강제한다.
3. **합성된 문자열은 항상 역분해 가능하다.** 모든 builder는 짝이 되는 `parseXxx(s): Original` 함수를 가지며, `parse(build(x)) ≡ x` 라운드트립이 property test로 강제된다. 역분해 불가능한 식별자는 본 사이클에서 도입을 금지한다 (예: 비결정적 hash 단독으로는 식별자가 될 수 없다 — 반드시 원형이 함께 catalog에 기록되어야 한다).
4. **카탈로그 등록 SSOT.** 자유 문자열 자리(prefix, version, event domain, decision category 등)는 모두 catalog에 등록된 값만 허용한다. 미등록 식별자를 builder에 입력하면 Zod 검증에서 실패하고, CI 린트도 catalog 미등록을 별도 에러로 보고한다. catalog ↔ 코드 ↔ compose ↔ env 4-way 정합성은 `pnpm sim:catalog:validate`로 검사한다.

## 2. 식별자 표 (15종)

| # | 식별자 | 원형 (structured) | 합성 규칙 | 린트 규칙 |
|---|---|---|---|---|
| 1 | service prefix | `{ namespace, category, name }` | `${namespace}.${category}.${name}` | namespace ∈ {sim}; category ∈ {svc, slice, evt, cache}; name = `[a-z][a-z0-9-]*` |
| 2 | version tag | `{ axis: version, value: int, state: stable\|candidate\|retired }` | stable: `v${n}` / candidate: `v${n}-candidate` | catalog `refEntries[]`에 등록된 것만 |
| 3 | image tag | `{ registry, servicePrefix, versionTag }` | `${registry}/${prefixToImageName(servicePrefix)}:${versionTag}` | registry ∈ allowlist; servicePrefix는 catalog 등록; versionTag는 #2 검증 |
| 4 | HTTP header (custom) | `{ kind: header, domain, attr }` | `x-${domain}-${attr}` (모두 kebab-case) | domain ∈ {service, canary, trace, sim}; allowlist 외 `x-*` 헤더 금지 |
| 5 | outbox event name | `{ domain, aggregate, verbPast }` | `${domain}.${aggregate}.${verbPast}` | domain ∈ catalog 등록 도메인; verbPast 어휘 사전(catalog) |
| 6 | outbox schemaHash | `{ eventName, payloadShape }` (deterministic content hash) | `sha256(canonicalJSON(shape))[:16]` | 빌드 시 코드 ↔ catalog 등록 hash 일치 검증 |
| 7 | decision id | `{ pass, cycleId }` | `${pass}-decision-${cycleId}` | pass ∈ {safety, resource}; cycleId = ULID |
| 8 | cycle id | `{ controllerId, cycleAt }` | ULID (controllerId 임베드) | ULID 표준 |
| 9 | label key (compose/k8s) | `{ namespace, key }` | `${namespace}.${key}` | namespace ∈ {sim}; key ∈ {role, version, replica-of} |
| 10 | redis pub/sub channel | `{ namespace, topic }` | `${namespace}:${topic}` | namespace = sim; topic ∈ {bitmap.invalidate, routing.update, controller.heartbeat} |
| 11 | bitmap cache key | `{ scope: user\|role, id, prefix, version }` | `bitmap:${scope}:${id}:${prefix}:${version}` | scope ∈ enum; prefix는 catalog 등록 |
| 12 | outbox idempotency key | `{ aggregateId, eventName, occurredAt }` | `${aggregateId}:${eventName}:${occurredAt.epoch}` | uniqueness 보장 + 결정성 |
| 13 | replication slot name (PG) | `{ purpose }` | `sim_${purpose}_slot` | purpose ∈ {read_replica, audit_stream}; PG 명명 규칙 |
| 14 | decision category | `{ pass, name }` | `${pass}.${name}` (e.g., `safety.compatibility`) | pass ∈ enum; name ∈ 본 사이클 8개 |
| 15 | decision signal | `{ category, signal }` | `${category}.${signal}` (e.g., `compatibility.schemaCompatRate`) | category 등록; signal은 controller-config metric registry 등록 |

### 2.1 service prefix

서비스/슬라이스/이벤트 도메인/캐시 영역을 식별하는 4-tier 좌표.

```ts
export interface ServicePrefix {
  namespace: "sim";
  category: "svc" | "slice" | "evt" | "cache";
  name: string; // [a-z][a-z0-9-]*
}

export const ServicePrefixSchema = z.object({
  namespace: z.literal("sim"),
  category: z.enum(["svc", "slice", "evt", "cache"]),
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

export function buildServicePrefix(p: ServicePrefix): string;
export function parseServicePrefix(s: string): ServicePrefix;
```

- 카탈로그 등록 위치: `simulations/enterprise-pm/contracts/service-version.catalog.ts` 의 `services[]`
- 사용: `buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" })` → `"sim.svc.approval"`
- 잘못된 사용: `` `sim.svc.${userInput}` `` — 직접 보간이며 Zod 우회. 린트가 검출.

### 2.2 version tag

축(version)에 대응하는 정수 + 상태 enum.

```ts
export interface VersionTag {
  axis: "version";
  value: number;          // 1..n
  state: "stable" | "candidate" | "retired";
}

export const VersionTagSchema = z.object({
  axis: z.literal("version"),
  value: z.number().int().min(1),
  state: z.enum(["stable", "candidate", "retired"]),
});

export function buildVersionTag(v: VersionTag): string;
// stable: "v3", candidate: "v3-candidate", retired: "v3-retired"
export function parseVersionTag(s: string): VersionTag;
```

- 카탈로그 등록 위치: 동일 catalog의 `versions.refEntries[]`. 등록되지 않은 (value, state) 조합은 builder 진입 시 거부.
- 사용: `buildVersionTag({ axis: "version", value: 3, state: "candidate" })` → `"v3-candidate"`
- 잘못된 사용: `` `v${n}_candidate` `` — separator가 다르며 catalog 어휘에도 없음.

### 2.3 image tag (중점)

OCI 이미지 식별자. 본 사이클에서 canary 배포는 image tag로 유효 버전을 구분하므로 grammar의 정확성이 카나리 안전성에 직결된다.

```ts
export interface ImageTag {
  registry: "qa-sdk";          // allowlist
  servicePrefix: ServicePrefix;
  version: VersionTag;
}

export const ImageTagSchema = z.object({
  registry: z.literal("qa-sdk"),
  servicePrefix: ServicePrefixSchema,
  version: VersionTagSchema,
});

export function buildImageTag(i: ImageTag): string;
export function parseImageTag(s: string): ImageTag;
```

- 합성 절차: ① `prefixToImageName(servicePrefix)`로 `sim.svc.approval` → `sim-approval-api` 변환 (category가 `svc`이면 `-api` 접미). ② version tag 직렬화. ③ `${registry}/${imageName}:${versionTag}` 결합.
- 라운드트립: `parseImageTag("qa-sdk/sim-approval-api:v3")` → `{ registry: "qa-sdk", servicePrefix: { namespace, category: "svc", name: "approval" }, version: { axis, value: 3, state: "stable" } }`.
- 카탈로그 등록 위치: `imageRegistry.allowed[]`(registry) + service catalog(servicePrefix) + version refEntries(versionTag) — 3개 catalog 합집합으로 검증.
- 사용: docker-compose `image:` 필드, controller가 결정한 카나리 타겟, telemetry 이벤트의 `image` 속성 — 전부 builder 결과만 허용.
- 잘못된 사용: `image: qa-sdk/sim-approval-api:latest` — `latest`는 VersionTag 어휘에 없음. 린트가 거부.

### 2.4 HTTP header (custom)

시뮬이 발신/수신하는 모든 custom 헤더는 정해진 형태만 허용한다.

```ts
export interface CustomHeader {
  kind: "header";
  domain: "service" | "canary" | "trace" | "sim";
  attr: string; // kebab-case [a-z][a-z0-9-]*
}

export const CustomHeaderSchema = z.object({
  kind: z.literal("header"),
  domain: z.enum(["service", "canary", "trace", "sim"]),
  attr: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

export function buildHeaderName(h: CustomHeader): string; // "x-canary-stage"
export function parseHeaderName(s: string): CustomHeader;
```

- 카탈로그 등록 위치: `contracts/header-vocabulary.catalog.ts` (신규). 본 사이클에서 사용하는 헤더(`x-canary-stage`, `x-service-version`, `x-trace-decision-id`, …)를 미리 enum으로 등록.
- 사용: `buildHeaderName({ kind: "header", domain: "canary", attr: "stage" })` → `"x-canary-stage"`
- 잘못된 사용: `X-Canary-Stage` (PascalCase) 또는 미등록 attr. 린트가 거부.

### 2.5 outbox event name

`${domain}.${aggregate}.${verbPast}` — 행동을 동사 과거형으로 닫아 outbox semantic을 일관화.

```ts
export interface EventName {
  domain: string;     // catalog 등록 도메인
  aggregate: string;  // catalog 등록 aggregate
  verbPast: string;   // catalog 어휘 사전
}

export const EventNameSchema = z.object({
  domain: z.string(),
  aggregate: z.string(),
  verbPast: z.string(),
});

export function buildEventName(e: EventName): string;
export function parseEventName(s: string): EventName;
```

- 카탈로그 등록 위치: `contracts/event-vocabulary.catalog.ts` 의 `domains[]`, `aggregates[]`, `verbsPast[]`. 세 축을 직교로 등록하여 가능한 조합을 catalog에서 명시.
- 사용: `buildEventName({ domain: "approval", aggregate: "request", verbPast: "submitted" })` → `"approval.request.submitted"`
- 잘못된 사용: `"approval.request.submit"` (현재형) — verbPast 사전 미등록.

### 2.6 outbox schemaHash (중점)

이벤트 페이로드 형태에 대한 결정론적 content hash. 카나리에서 신/구 schema가 공존하는 동안 `schemaHash`로 호환성을 식별한다.

```ts
export interface SchemaHashInput {
  eventName: EventName;
  payloadShape: CanonicalShape; // 정렬·정규화된 JSON Schema 표현
}

export function computeSchemaHash(input: SchemaHashInput): string;
// returns sha256(canonicalJSON(payloadShape))[:16]
export function verifySchemaHash(
  input: SchemaHashInput,
  expected: string,
): boolean;
```

- 결정론 보장: ① `canonicalJSON`은 키 정렬/공백 제거/숫자 정규화를 수행. ② `payloadShape`는 nullable/optional/required를 명시적으로 표기. ③ 동일 shape는 항상 동일 hash, 타이브레이커 없음.
- 카탈로그 등록 위치: 빌드 산출물 `dist/event-schemas.json` + `event-vocabulary.catalog.ts` 의 `event.schemaHash`. 빌드 시 둘이 일치하지 않으면 실패.
- 운영 의미: 발신 측 코드가 만든 hash가 catalog hash와 다르면 schema drift이며, 카나리가 활성이면 controller가 자동으로 차단(safety pass).
- 사용: `computeSchemaHash({ eventName: { domain: "approval", … }, payloadShape: {…} })` → `"7d1a4c9b8e2f0a31"`
- 잘못된 사용: hash를 사람이 임의로 catalog에 작성. content hash가 아니므로 빌드 게이트에서 거부.

### 2.7 decision id

controller가 cycle마다 발행하는 결정의 ID.

```ts
export interface DecisionId {
  pass: "safety" | "resource";
  cycleId: string; // ULID
}

export const DecisionIdSchema = z.object({
  pass: z.enum(["safety", "resource"]),
  cycleId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
});

export function buildDecisionId(d: DecisionId): string; // "safety-decision-01H...."
export function parseDecisionId(s: string): DecisionId;
```

- 카탈로그 등록 위치: `controller-config.yaml` 의 `passes[]`에 enum이 등록됨. 그 외 pass 값은 builder 거부.
- 사용: `buildDecisionId({ pass: "safety", cycleId: "01HVZ..." })` → `"safety-decision-01HVZ..."`
- 잘못된 사용: `"resource_decision_42"` (separator/숫자) — 패턴 불일치.

### 2.8 cycle id

controller 사이클 단위 ULID. controllerId가 시간 prefix 영역에 임베드되어 같은 컨트롤러의 사이클은 정렬 가능.

```ts
export interface CycleId {
  controllerId: string;     // 8 chars, [0-9A-Z]
  cycleAt: number;          // epoch ms
}

export function buildCycleId(c: CycleId): string; // ULID
export function parseCycleId(s: string): CycleId;
```

- 카탈로그 등록 위치: 없음 (런타임 발행). 단 `controllerId`는 controller boot 시 fleet catalog에 register.
- 사용: `buildCycleId({ controllerId: "CTRL0001", cycleAt: 1714291200000 })` → `"01HVZ...."`
- 잘못된 사용: 랜덤 UUIDv4 사용. ULID 패턴 불일치이며 정렬 보장도 깨짐.

### 2.9 label key (compose / k8s)

`docker-compose.yml`의 `labels:`, k8s manifest의 `metadata.labels`에 부여되는 key.

```ts
export interface LabelKey {
  namespace: "sim";
  key: "role" | "version" | "replica-of";
}

export const LabelKeySchema = z.object({
  namespace: z.literal("sim"),
  key: z.enum(["role", "version", "replica-of"]),
});

export function buildLabelKey(l: LabelKey): string; // "sim.version"
export function parseLabelKey(s: string): LabelKey;
```

- 카탈로그 등록 위치: `contracts/label-vocabulary.catalog.ts`. 본 사이클에서 사용 가능한 key 3종을 enum 고정.
- 사용: `buildLabelKey({ namespace: "sim", key: "version" })` → `"sim.version"`
- 잘못된 사용: `app.kubernetes.io/version` 사용. namespace 불일치 + 어휘 미등록.

### 2.10 redis pub/sub channel

bitmap invalidation/routing update/controller heartbeat 등 시뮬 내부 fan-out 채널.

```ts
export interface PubSubChannel {
  namespace: "sim";
  topic: "bitmap.invalidate" | "routing.update" | "controller.heartbeat";
}

export const PubSubChannelSchema = z.object({
  namespace: z.literal("sim"),
  topic: z.enum(["bitmap.invalidate", "routing.update", "controller.heartbeat"]),
});

export function buildChannel(c: PubSubChannel): string; // "sim:routing.update"
export function parseChannel(s: string): PubSubChannel;
```

- 카탈로그 등록 위치: `grammar-registry.ts` 내부 enum (정적). 신규 topic 추가는 PR로만 가능하며 별도 review checkpoint를 거친다.
- 사용: `buildChannel({ namespace: "sim", topic: "bitmap.invalidate" })` → `"sim:bitmap.invalidate"`
- 잘못된 사용: `"sim/bitmap-invalidate"` — separator 잘못 + 어휘 미등록.

### 2.11 bitmap cache key (중점)

권한 비트맵 캐시의 redis key. version을 key에 포함시켜 카나리 중 v3/v4가 공존하더라도 충돌하지 않게 한다.

```ts
export interface BitmapCacheKey {
  scope: "user" | "role";
  id: string;                   // [A-Za-z0-9_-]+
  prefix: ServicePrefix;        // catalog 등록
  version: VersionTag;          // catalog 등록
}

export const BitmapCacheKeySchema = z.object({
  scope: z.enum(["user", "role"]),
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  prefix: ServicePrefixSchema,
  version: VersionTagSchema,
});

export function buildBitmapCacheKey(k: BitmapCacheKey): string;
// "bitmap:user:U001:sim.svc.approval:v3"
export function parseBitmapCacheKey(s: string): BitmapCacheKey;
```

- 운영 의미: ① 카나리 카운트가 늘어 새 version이 active가 되면, controller는 invalidate 채널로 `bitmap.invalidate` 발행. ② 구독자는 key prefix `bitmap:*:*:<servicePrefix>:<oldVersion>`을 일괄 SCAN+DEL. ③ key가 grammar로 강제되므로 SCAN 패턴이 정확해진다.
- 카탈로그 등록 위치: prefix는 service catalog, version은 version refEntries. scope는 정적 enum.
- 사용: `buildBitmapCacheKey({ scope: "user", id: "U001", prefix: {…approval…}, version: {…v3…} })` → `"bitmap:user:U001:sim.svc.approval:v3"`
- 잘못된 사용: `bitmap:user:U001:approval-v3` — 구분자 합쳐 grammar 깨짐. SCAN 패턴이 부정확해져 invalidation 누락 위험.

### 2.12 outbox idempotency key (중점)

outbox publisher와 컨슈머 양쪽에서 중복 발행/처리를 방지하는 key. 결정론 + uniqueness가 동시에 필요.

```ts
export interface IdempotencyKey {
  aggregateId: string;          // [A-Za-z0-9_-]+
  eventName: EventName;
  occurredAt: { epoch: number };
}

export const IdempotencyKeySchema = z.object({
  aggregateId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  eventName: EventNameSchema,
  occurredAt: z.object({ epoch: z.number().int() }),
});

export function buildIdempotencyKey(k: IdempotencyKey): string;
// "REQ-001:approval.request.submitted:1714291200000"
export function parseIdempotencyKey(s: string): IdempotencyKey;
```

- 결정성: 같은 `(aggregateId, eventName, occurredAt.epoch)` → 항상 같은 key. publisher는 retry해도 동일 key를 만든다.
- uniqueness: epoch 포함으로 동일 aggregate의 서로 다른 발행은 시간이 다르면 키도 다르다. 같은 epoch 안에 두 번 발행이 일어나면 비즈니스 버그이며, key 충돌로 catch 된다.
- 카탈로그 등록 위치: 없음 (런타임 발행). eventName은 #2.5 검증을 통해 catalog에 종속.
- 사용: `buildIdempotencyKey({ aggregateId: "REQ-001", eventName: {…}, occurredAt: { epoch: 1714291200000 } })` → `"REQ-001:approval.request.submitted:1714291200000"`
- 잘못된 사용: `${aggregateId}-${Date.now()}` — eventName 누락 + 시간이 호출 시점에 결정되어 retry 시 새 key 생성.

### 2.13 replication slot name (PG)

PostgreSQL 논리 복제 슬롯 이름. PG 명명 규칙(소문자/언더스코어/≤63자)을 만족해야 함.

```ts
export interface ReplicationSlot {
  purpose: "read_replica" | "audit_stream";
}

export const ReplicationSlotSchema = z.object({
  purpose: z.enum(["read_replica", "audit_stream"]),
});

export function buildReplicationSlotName(r: ReplicationSlot): string;
// "sim_read_replica_slot"
export function parseReplicationSlotName(s: string): ReplicationSlot;
```

- 카탈로그 등록 위치: `contracts/replication.catalog.ts`(신규). purpose enum 명시.
- 사용: `buildReplicationSlotName({ purpose: "audit_stream" })` → `"sim_audit_stream_slot"`
- 잘못된 사용: `simReadReplicaSlot` (camelCase) — PG가 자동 lowercase 변환하면서 의도와 달라짐.

### 2.14 decision category

controller pass × 결정 카테고리 좌표.

```ts
export interface DecisionCategory {
  pass: "safety" | "resource";
  name: string;   // 본 사이클 8개 카테고리 enum
}

export const DecisionCategorySchema = z.object({
  pass: z.enum(["safety", "resource"]),
  name: z.string(), // catalog 검증
});

export function buildDecisionCategory(c: DecisionCategory): string;
// "safety.compatibility"
export function parseDecisionCategory(s: string): DecisionCategory;
```

- 카탈로그 등록 위치: `controller-config.yaml` 의 `categories[]`. 본 사이클 8개 카테고리(safety: compatibility, errorBudget, latencyBudget, dataLoss / resource: cost, headroom, saturation, scaleVelocity)를 enum 고정.
- 사용: `buildDecisionCategory({ pass: "safety", name: "compatibility" })` → `"safety.compatibility"`
- 잘못된 사용: `"safety:compatibility"` — separator 불일치 + name 미등록.

### 2.15 decision signal (중점)

카테고리 안에서 측정되는 개별 신호. controller-config의 metric registry에 등록되어야 측정 가능.

```ts
export interface DecisionSignal {
  category: DecisionCategory;
  signal: string;   // metric registry 등록 이름
}

export const DecisionSignalSchema = z.object({
  category: DecisionCategorySchema,
  signal: z.string(),
});

export function buildDecisionSignal(s: DecisionSignal): string;
// "safety.compatibility.schemaCompatRate"
export function parseDecisionSignal(s: string): DecisionSignal;
```

- 운영 의미: ① controller boot 시 `controller-config.yaml`의 모든 signal을 grammar registry에 register. ② signal 발행 코드는 builder를 통해서만 이름 생성. ③ 미등록 signal은 builder에서 거부 + telemetry sink에서도 drop. 즉 metric leakage가 정의 시점에 차단.
- 합성: `${category.pass}.${category.name}.${signal}` 3-tier. 4-tier 변형 금지.
- 카탈로그 등록 위치: `controller-config.yaml`의 `categories[].signals[]`. 빌드 시 controller-config ↔ grammar registry 일치 검증.
- 사용: `buildDecisionSignal({ category: { pass: "safety", name: "compatibility" }, signal: "schemaCompatRate" })` → `"safety.compatibility.schemaCompatRate"`
- 잘못된 사용: `"compat.schemaRate"` — 카테고리 누락. parser가 3-tier로 분해 실패.

## 3. 신규 패키지 sim-identifier-grammar 구조

```
packages/sim-identifier-grammar/
├── package.json                # name: "@qa-sdk-sim/identifier-grammar"
├── src/
│   ├── service-prefix.ts       # build/parse + Zod
│   ├── version-tag.ts
│   ├── image-tag.ts
│   ├── http-header.ts
│   ├── event-name.ts
│   ├── schema-hash.ts
│   ├── decision-id.ts          # decision/cycle/category/signal
│   ├── pubsub-channel.ts
│   ├── cache-key.ts            # bitmap, idempotency
│   ├── replication-slot.ts
│   ├── label-key.ts
│   ├── grammar-registry.ts     # 모든 builder를 한 곳에 export + 정적 enum 보관
│   └── index.ts                # public surface
└── tests/
    ├── roundtrip.test.ts        # property test (build → parse → equal)
    └── catalog-binding.test.ts  # catalog 등록 값에 대한 builder 통과/거부 검증
```

`package.json` 메타:
- 의존: `zod`, `@qa-sdk/core` (catalog access), `ulid`, `fast-check` (devDep)
- 빌드: tsup dual format (ESM + CJS) — enterprise-pm 시뮬과 controller 양쪽에서 사용
- 위치: `packages/`(인코딩 라이브러리 계층) — 시뮬 도메인 패키지에서 의존, 역방향 금지

런타임 사용 예:

```ts
import {
  buildImageTag,
  parseImageTag,
} from "@qa-sdk-sim/identifier-grammar";

const tag = buildImageTag({
  registry: "qa-sdk",
  servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
  version: { axis: "version", value: 3, state: "stable" },
});
// tag === "qa-sdk/sim-approval-api:v3"

const decoded = parseImageTag(tag);
// {
//   registry: "qa-sdk",
//   servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
//   version: { axis: "version", value: 3, state: "stable" },
// }
```

`grammar-registry.ts`는 builder를 식별자 종류로 키잉한 객체로 export하여, 린트 도구가 reflection으로 builder 목록을 수집할 수 있게 한다:

```ts
export const grammarRegistry = {
  servicePrefix: { build: buildServicePrefix, parse: parseServicePrefix, schema: ServicePrefixSchema },
  versionTag:    { build: buildVersionTag,    parse: parseVersionTag,    schema: VersionTagSchema },
  imageTag:      { build: buildImageTag,      parse: parseImageTag,      schema: ImageTagSchema },
  // ... 15개 모두
} as const;
```

## 4. 린팅 메커니즘

### 4.1 정적 린트

`pnpm sim:lint:identifiers` (스크립트: `scripts/lint-identifiers.ts`) + ESLint custom rule 두 축을 운영한다.

| 검사 대상 | 규칙 |
|---|---|
| TS/JS 코드의 template literal | `` `${a}:${b}` ``, `` `${a}/${b}:${c}` ``, `` `x-${d}-${e}` `` 등 식별자 합성 의심 패턴 → builder 사용 강제. AST 분석으로 raw 보간을 감지하고, 동일 위치에 grammar import 없으면 에러. |
| `docker-compose*.yaml` | image / labels / environment / depends_on / networks 모든 문자열 → 정규식 + catalog 검증. yq로 추출 후 ImageTagSchema/LabelKeySchema 등으로 parse. 실패 시 라인 번호와 함께 보고. |
| `.env*` | `*_TAG`, `*_URL`, `*_PREFIX` 변수명 → 형식 검증. 예: `APPROVAL_IMAGE_TAG`는 `parseImageTag` 통과 필수, `APPROVAL_SERVICE_PREFIX`는 `parseServicePrefix` 통과 필수. |
| `*.controller.yaml` | category/signal 이름이 grammar registry 등록된 것만 허용. controller-config 로드 시 동일 검증을 런타임에서도 수행. |
| OpenAPI fragments | path/header 이름이 grammar registry 통과. `paths` 키, `parameters[].name`(in: header), response header 이름이 모두 검증 대상. |
| outbox event publish 호출 | 이벤트명이 catalog 등록 + schemaHash 일치. AST에서 `publish(eventName, payload)` 호출을 추출하여 eventName 인자가 builder 결과인지 + schemaHash가 build 산출물과 일치하는지 검증. |

위반 시 CI 실패. 기존 `def-gate.yml` 옆에 `identifier-gate.yml`을 신설한다.

### 4.2 런타임 가드 (Zod)

builder 함수가 Zod schema로 입력을 검증한다. 잘못된 원형은 컴파일 단계(TS 타입)와 런타임(Zod) 양쪽에서 실패한다.

```ts
const ImageTagInput = z.object({
  registry: z.literal("qa-sdk"),
  servicePrefix: ServicePrefixSchema,
  version: VersionTagSchema,
});

export function buildImageTag(input: z.input<typeof ImageTagInput>): string {
  const v = ImageTagInput.parse(input);
  const imageName = prefixToImageName(v.servicePrefix);
  const versionStr = buildVersionTag(v.version);
  return `${v.registry}/${imageName}:${versionStr}`;
}
```

런타임 가드의 효과:
- ① 잘못된 객체가 builder 진입점에서 거부됨 → 그 결과로 잘못된 문자열이 시스템에 유입될 수 없음.
- ② Zod 에러 메시지가 위반 위치(field path)와 기대값을 포함하므로 디버깅 비용이 낮음.
- ③ 런타임 가드가 catalog SSOT 참조(예: `ServicePrefixSchema`가 catalog 등록 prefix 목록을 superRefine으로 검증)와 결합되어, 정적 린트가 도달하지 못하는 동적 합성도 잡는다.

### 4.3 CI gate

`.github/workflows/identifier-gate.yml`:

- trigger: `simulations/**`, `packages/sim-identifier-grammar/**`, `contracts/**` 변경
- step 1: `pnpm sim:lint:identifiers` — 정적 린트(§4.1)
- step 2: `pnpm --filter @qa-sdk-sim/identifier-grammar test` — 라운드트립 property test(§5)
- step 3: `pnpm sim:catalog:validate` — catalog ↔ 코드 ↔ compose ↔ env 4-way 정합성. catalog에 등록된 값이 코드/compose/env 어딘가에서 사용되는지(역참조), 코드/compose/env에 등장하는 값이 catalog에 있는지(정참조) 양방향 검증.
- 실패 시 PR merge 차단. fail-open 정책 적용 안 함 — 식별자 grammar는 정합성 그 자체이므로 fail-closed.

## 5. 라운드트립 보장 (property test)

모든 builder/parser 쌍에 대해 다음 properties를 vitest + fast-check로 자동 검증한다.

```
∀ original ∈ valid inputs.
  parse(build(original)) ≡ original                 (역분해 일관성)

∀ string s ∈ valid grammar.
  build(parse(s)) ≡ s                                (정규화 일관성)

∀ original ∈ valid inputs.
  lint(build(original)) = OK                         (출력은 항상 린트 통과)
```

- "valid inputs"는 Zod schema의 `arbitrary()` (fast-check 통합)으로 자동 생성. catalog 등록 값에 대한 추가 fixture를 함께 enumerate하여 실제 사용 사례까지 커버.
- "valid grammar"는 builder 출력 집합. 즉 정규화 일관성은 "임의 문자열"이 아니라 "valid 문자열"에서만 요구된다.
- 식별자 종류가 늘어도 builder + parser + Zod schema 3종을 추가하고 grammarRegistry에 등록하면, 공통 property test가 자동으로 신규 식별자에도 적용된다 — 테스트 코드를 식별자마다 복제할 필요가 없다.
- 추가 invariant: ① `build`는 항상 `[!-~]+` (printable ASCII) 만 출력. ② `parse`는 trailing whitespace를 거부. ③ `build → parse → build` 결과가 첫 `build`와 byte-equal.

## 6. 카탈로그 등록 SSOT

이 문서는 식별자의 *합성 규칙*만 정의한다. *어떤 값들이 허용되는가*(allowlist)는 catalog SSOT가 결정한다.

| 식별자 | catalog 위치 |
|---|---|
| service prefix | `simulations/enterprise-pm/contracts/service-version.catalog.ts` |
| version tag refEntries | 같은 catalog (`versions.refEntries[]`) |
| image registry allowlist | 같은 catalog (`imageRegistry.allowed[]`) |
| HTTP header vocabulary | `contracts/header-vocabulary.catalog.ts` (신규) |
| event name domain/aggregate/verbPast 사전 | `contracts/event-vocabulary.catalog.ts` (신규) |
| schemaHash 등록 | 빌드 산출물 `dist/event-schemas.json` + catalog `event.schemaHash` |
| decision pass enum | `controller-config.yaml` `passes[]` |
| decision category | `controller-config.yaml` `categories[]` |
| decision signal | `controller-config.yaml` `categories[].signals[]` |
| pubsub topic | `grammar-registry.ts` 안에 enum (정적, PR-only) |
| label key vocabulary | `contracts/label-vocabulary.catalog.ts` (신규) |
| replication slot purpose | `contracts/replication.catalog.ts` (신규) |
| bitmap cache scope | `grammar-registry.ts` 안에 enum (정적) |
| idempotency key | 등록 없음 (런타임 발행, eventName이 catalog 종속) |
| cycle id / decision id | 등록 없음 (런타임 발행, controllerId/pass가 catalog 종속) |

운영 원칙:
- catalog 추가/삭제는 PR에서 별도 reviewer를 요구한다(어휘 확장은 시뮬 좌표계 확장).
- catalog 변경은 `pnpm sim:catalog:validate`를 통과해야 머지 가능. 즉 코드/compose/env에서 사용되지 않는 등록은 dead vocabulary로 거부.
- 본 grammar 문서는 "구조"를, catalog는 "어휘"를 담당한다. 두 SSOT가 직교하므로, 어휘 확장이 grammar를 흔들지 않고 grammar 변경이 어휘를 흔들지 않는다 — 이것이 시뮬이 자라도 정합성이 유지되는 이유다.
