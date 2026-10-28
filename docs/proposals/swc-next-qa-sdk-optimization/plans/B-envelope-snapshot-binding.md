# Track B — Envelope Snapshot Binding·Ingest 검증·Registry Snapshot Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 event batch가 어떤 CatalogSnapshot·codec으로 만들어졌는지 envelope에서 복원되고, ingest는 그 문맥이 허용된 snapshot과 호환될 때만 좌표를 정상값으로 취급한다.

**Architecture:** envelope에 `catalog_snapshot` 객체(catalog_id, snapshot_version, digest, codec_version)를 추가한다(D-2: `entry_snapshot`은 deprecated로 유지). registry는 catalog 등록·갱신 때 T0 `buildCatalogSnapshot`으로 불변 snapshot을 발행하고, 같은 prefix version 안의 breaking 변경이 있으면 발행을 거부한다. ingest는 `snapshot-gate`가 envelope 단위로 `resolveDecodeLayout`을 수행한다. 기존 SDK(필드 없음)는 fail-open으로 허용하고 경고 진단을 남긴다.

**Tech Stack:** TypeScript, zod, Hono(ingest-server), NestJS(registry-service), vitest, `@qa-sdk/core` snapshot 모듈(T0)

**Spec:** [README](../README.md) R-7, D-2 / [01-tracks.md](../01-tracks.md) §3, §3.1 / Drive 원본 Phase 1 "batch envelope", "인프라 업데이트"

## Global Constraints

- 착수 조건: T0 머지, D-2 확정
- wire 필드는 snake_case (기존 envelope 관례)
- 서비스 코드는 `createLogger("서비스명")`, `console.*` 금지, `logger.error({ err }, "설명")`
- 서버 시작 시 외부 fetch: `AbortSignal.timeout(5_000)` 필수. 외부 JSON은 `JSON.parse` try-catch
- 서비스 환경변수는 `config/env.ts` zod 스키마로만 읽는다. ingest-server `config/env.ts`는 Track E 소유 — B는 키 2개(`SNAPSHOT_GATE_MODE`, `SNAPSHOT_REGISTRY_URL`)만 additive로 추가하고 E PR과 순서를 맞춘다
- Fail-open: gate 조회 실패 → 허용 + warning 진단. 단 `enforce` 모드에서 판정이 확정된 계약 위반(`CatalogMismatch`, `MigrationRequired`, `UnsupportedCodecVersion`)은 거부
- `routes/ingest.ts`의 decode 실패 counter는 E가 제공하는 `metricsCollector.increment(name, labels)`를 호출만 한다

## Review Focus

1. **필드가 없는 구버전 SDK envelope** → 202 수락, `snapshot_gate_total{result="missing"}` 증가, 경고 1회(요청마다 로그 폭주 금지). 테스트: Task 5 Step 1.
2. **proto3 envelope** → JSON과 같은 zod 검증을 거친다(현재는 건너뜀). 테스트: Task 3 Step 1.
3. **잘린 proto 바이트** → `CorruptEnvelope`로 400, JSON fallback으로 조용히 통과하지 않음. 테스트: Task 3 Step 1.
4. **registry 장애 중 ingest** → fail-open 허용, readiness는 `snapshotRegistry: degraded` 표시. 테스트: Task 6 Step 1.
5. **같은 digest를 다른 내용으로 재발행** → registry가 409로 거부(불변성). 테스트: Task 4 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/core/src/types/envelope.ts` | `CatalogSnapshotWire` 타입, `catalog_snapshot?` 필드, `entry_snapshot` deprecated |
| `packages/core/src/schema/envelope.schema.ts` (+`schema.test.ts`) | zod 스키마 |
| `packages/logger/src/config.ts`, `packages/logger/src/logger.ts` | `catalogSnapshot` 설정 → `buildEnvelope` |
| `packages/browser-sdk/src/monitor.ts` | QaMonitor 옵션 전달 |
| `proto/transmission.proto`, `packages/codec-proto/src/codec.ts` (+test) | 필드 추가, reader bounds check |
| `packages/registry-service/src/stores/catalog-snapshot-store.ts` (신규, +test) | 불변 append-only snapshot store |
| `packages/registry-service/src/modules/catalog/catalog.controller.ts` | snapshot 조회 endpoint, 발행 연결 |
| `packages/registry-service/src/health.controller.ts` | `catalogHash` → T0 digest |
| `packages/ingest-server/src/lib/snapshot-gate.ts` (신규, +test) | envelope 문맥 판정 |
| `packages/ingest-server/src/routes/ingest.ts` | gate 호출, proto zod 검증 |
| `packages/ingest-server/src/routes/health.ts` | readiness에 snapshot registry 상태 |

**Interfaces:**
- Consumes (T0): `CatalogSnapshot`, `SnapshotIdentity`, `buildCatalogSnapshot`, `findUnversionedBreakingChanges`, `resolveDecodeLayout`, `isCodecContractError`, `CodecErrorCode`, `computeCatalogDigest`, `shortDigest`
- Consumes (E): `MetricsCollector.increment(name: string, labels?: Record<string, string>): void`
- Produces:

```ts
// @qa-sdk/core types/envelope.ts
export interface CatalogSnapshotWire {
  catalog_id: string;
  /** registry 발급 순번 — 표시용. 식별은 digest (codegen 시점에는 알 수 없어 선택) */
  snapshot_version?: number;
  digest: string;          // 'sha256:<64 hex>'
  codec_version: string;   // wire에서는 임의 문자열 — gate가 UnsupportedCodecVersion 판정
}
// TransmissionEnvelope.catalog_snapshot?: CatalogSnapshotWire
export function toSnapshotIdentity(wire: CatalogSnapshotWire): SnapshotIdentity; // codec_version은 그대로 전달

// registry-service
export interface CatalogSnapshotStore {
  publish(snapshot: CatalogSnapshot): Promise<'created' | 'exists'>; // 같은 digest·다른 내용 → throw AppError CONFLICT
  get(digest: string): Promise<CatalogSnapshot | undefined>;
  latest(catalogId: string): Promise<CatalogSnapshot | undefined>;
}

// ingest-server lib/snapshot-gate.ts
export type SnapshotGateMode = 'off' | 'warn' | 'enforce';
export type SnapshotGateResult =
  | { readonly status: 'ok'; readonly digest: string }
  | { readonly status: 'missing' }
  | { readonly status: 'degraded'; readonly reason: string }
  | { readonly status: 'violation'; readonly code: CodecErrorCode; readonly message: string };
export interface SnapshotGate { check(envelope: TransmissionEnvelope): Promise<SnapshotGateResult>; readonly mode: SnapshotGateMode }
export function createSnapshotGate(options: {
  mode: SnapshotGateMode;
  loadTarget: () => Promise<CatalogSnapshot | undefined>;
  loadSnapshot: (digest: string) => Promise<CatalogSnapshot | undefined>;
}): SnapshotGate;
```

---

### Task 0: Baseline

- [ ] **Step 1:**

```bash
cd /Users/junwoobang/workflow/qa-sdk && for p in @qa-sdk/core @qa-sdk/logger @qa-sdk/browser @qa-sdk/codec-proto @qa-sdk/registry-service @qa-sdk/ingest-server; do echo "== $p"; corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL" | tail -2; done
```

Expected: 모두 PASS. `logger` 패키지 이름이 다르면 `packages/logger/package.json`의 `name`을 쓴다.

- [ ] **Step 2: envelope 필드 사용처 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "entry_snapshot\|entrySnapshot" packages/*/src --include='*.ts' | grep -v node_modules
```

기록: 사용처 목록. D-2에 따라 이 Task 이후 신규 사용처가 생기지 않아야 한다.

---

### Task 1: Envelope 타입·스키마

**Files:** `packages/core/src/types/envelope.ts`, `packages/core/src/schema/envelope.schema.ts`, `packages/core/src/schema/schema.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
describe('transmissionEnvelopeSchema catalog_snapshot', () => {
  const base = /* 이 파일의 기존 유효 envelope fixture를 재사용 */ validEnvelope();
  const snapshot = {
    catalog_id: 'demo',
    snapshot_version: 3,
    digest: `sha256:${'a'.repeat(64)}`,
    codec_version: 'legacy-v1',
  };

  it('catalog_snapshot이 있으면 그대로 통과한다', () => {
    expect(transmissionEnvelopeSchema.parse({ ...base, catalog_snapshot: snapshot }).catalog_snapshot).toEqual(snapshot);
  });

  it('없어도 통과한다 (구버전 SDK)', () => {
    expect(transmissionEnvelopeSchema.parse(base).catalog_snapshot).toBeUndefined();
  });

  it.each([
    ['digest 형식', { digest: 'abc' }],
    ['snapshot_version 0', { snapshot_version: 0 }],
    ['빈 catalog_id', { catalog_id: '' }],
  ])('%s 오류는 거부한다', (_n, patch) => {
    expect(() => transmissionEnvelopeSchema.parse({ ...base, catalog_snapshot: { ...snapshot, ...patch } })).toThrow();
  });

  it('미지원 codec_version은 스키마에서 거부하지 않는다 (gate가 UnsupportedCodecVersion으로 판정)', () => {
    expect(() => transmissionEnvelopeSchema.parse({ ...base, catalog_snapshot: { ...snapshot, codec_version: 'legacy-v9' } })).not.toThrow();
  });
});
```

`validEnvelope()`는 `schema.test.ts`에 이미 있는 유효 envelope 객체를 함수로 감싼 것이다. 없으면 같은 파일의 첫 성공 케이스 객체를 그대로 옮긴다.

Run: `corepack pnpm --filter @qa-sdk/core exec vitest run src/schema/schema.test.ts` → FAIL (`catalog_snapshot` 제거됨 — zod strip)

- [ ] **Step 2: 구현**

`envelope.ts`:

```ts
/** 이 batch의 좌표를 만든 CatalogSnapshot 문맥 (ADR-010) */
export interface CatalogSnapshotWire {
  catalog_id: string;
  /** registry 발급 순번 — 표시용. 식별은 digest (codegen 시점에는 알 수 없어 선택) */
  snapshot_version?: number;
  digest: string;
  /** wire 값 — 지원 여부는 ingest snapshot gate가 판정 */
  codec_version: string;
}
```

`TransmissionEnvelope`에 `catalog_snapshot?: CatalogSnapshotWire;`를 추가하고 `entry_snapshot` 주석 앞에 `/** @deprecated catalog_snapshot 사용 (D-2). 기존 SDK 호환을 위해 유지 */`를 단다. 같은 파일에 `toSnapshotIdentity(wire)`를 추가한다(`{ catalogId: wire.catalog_id, digest: wire.digest, codecVersion: wire.codec_version as CodecVersion }` — 지원 여부 판정은 `resolveDecodeLayout`이 한다는 주석 포함).

`envelope.schema.ts`:

```ts
export const catalogSnapshotWireSchema = z.object({
  catalog_id: z.string().min(1),
  snapshot_version: z.number().int().positive().optional(),
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  codec_version: z.string().min(1),
});
```

`transmissionEnvelopeSchema`에 `catalog_snapshot: catalogSnapshotWireSchema.optional(),` 추가.

- [ ] **Step 3: 통과 확인·Commit**

Run: `corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter @qa-sdk/core test` → PASS

```bash
git add packages/core/src/types/envelope.ts packages/core/src/schema
git commit -m "feat(core): envelope에 catalog_snapshot 문맥 필드 추가"
```

---

### Task 2: SDK 전달 (logger·browser-sdk)

**Files:** `packages/logger/src/config.ts`, `packages/logger/src/logger.ts` (+test), `packages/browser-sdk/src/monitor.ts` (+test)

- [ ] **Step 1: 실패하는 테스트 (logger)** — 기존 logger 테스트의 fake transport 패턴으로, `catalogSnapshot`을 설정한 logger가 flush한 envelope에 `catalog_snapshot`이 포함되고, 미설정이면 키 자체가 없음을 검증한다.
- [ ] **Step 2: 구현** — `config.ts`에 `catalogSnapshot?: CatalogSnapshotWire;`(설명 주석: "생성된 browser/demo catalog 메타에서 주입. D track이 digest를 생성물에 기록"). `buildEnvelope`에 `...(this.config.catalogSnapshot ? { catalog_snapshot: this.config.catalogSnapshot } : {}),`.
- [ ] **Step 3: browser-sdk** — `QaMonitor` 옵션에 `catalogSnapshot?: CatalogSnapshotWire`를 추가해 `QaLogger` 생성자로 넘긴다. 테스트: 옵션 전달 시 transport가 받은 body에 필드 존재.
- [ ] **Step 4: 통과·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/logger build && corepack pnpm --filter @qa-sdk/logger test && corepack pnpm --filter @qa-sdk/browser test
git add packages/logger/src packages/browser-sdk/src
git commit -m "feat(sdk): envelope에 catalog_snapshot 전달"
```

---

### Task 3: Proto 정합과 CorruptEnvelope

**Files:** `proto/transmission.proto`, `packages/codec-proto/src/codec.ts` (+`codec.test.ts`), `packages/ingest-server/src/routes/ingest.ts`

- [ ] **Step 1: 실패하는 테스트**

`codec.test.ts`:

```ts
it('catalog_snapshot을 round-trip한다', () => {
  const env = { ...sampleEnvelope(), catalog_snapshot: { catalog_id: 'demo', snapshot_version: 2, digest: `sha256:${'b'.repeat(64)}`, codec_version: 'legacy-v1' } };
  expect(decodeEnvelope(encodeEnvelope(env)).catalog_snapshot).toEqual(env.catalog_snapshot);
});

it('잘린 바이트는 CorruptEnvelope로 거부한다', () => {
  const bytes = encodeEnvelope(sampleEnvelope());
  for (const cut of [1, Math.floor(bytes.length / 2), bytes.length - 1]) {
    try {
      decodeEnvelope(bytes.slice(0, cut));
      throw new Error(`cut=${cut}에서 오류가 나지 않음`);
    } catch (error) {
      expect(isCodecContractError(error, 'CorruptEnvelope')).toBe(true);
    }
  }
});
```

`sampleEnvelope()`는 기존 codec 테스트의 envelope fixture다.

Run: `corepack pnpm --filter @qa-sdk/codec-proto test` → FAIL

- [ ] **Step 2: proto 필드 번호 결정**

`proto/transmission.proto`가 필드 번호 정본이다. envelope은 1~8, 10을 쓰고, `packages/codegen-core/src/proto.ts`는 11을 다른 의미(`entry_snapshot`)로 쓴다(X-6). 충돌을 피해 **12**에 `CatalogSnapshot catalog_snapshot = 12;`를 추가하고 nested message `CatalogSnapshot { string catalog_id = 1; uint32 snapshot_version = 2; string digest = 3; string codec_version = 4; }`를 정의한다. codegen-core proto 정합은 Track D X-6 후속으로 남긴다고 proto 파일 주석에 적는다.

- [ ] **Step 3: 구현**

- `codec.ts` `encodeEnvelope`/`decodeEnvelope`에 field 12 처리.
- reader `R`(~:156-203)의 `varint`, `bytes`, `skip`에 bounds check: 읽기 위치가 `buf.length`를 넘거나 varint가 10바이트를 넘으면 `throw new CodecContractError('CorruptEnvelope', …, { offset, length })`.
- `routes/ingest.ts` `deserializeEnvelope`: codec-proto 결과도 `transmissionEnvelopeSchema.parse(...)`를 거친다. `catch {}` JSON fallback은 **모듈 import 실패**일 때만 수행하고(`await import` 부분만 try), decode 오류(`CorruptEnvelope`)는 400으로 응답한다. 응답 body에 `code: 'CorruptEnvelope'`.

- [ ] **Step 4: 통과·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/codec-proto build && corepack pnpm --filter @qa-sdk/codec-proto test && corepack pnpm --filter @qa-sdk/ingest-server test
git add proto/transmission.proto packages/codec-proto/src packages/ingest-server/src/routes/ingest.ts
git commit -m "feat(codec-proto): catalog_snapshot 필드와 CorruptEnvelope bounds check"
```

---

### Task 4: Registry 불변 snapshot store와 발행 게이트

**Files:** `packages/registry-service/src/stores/catalog-snapshot-store.ts` (+test), `packages/registry-service/src/modules/catalog/catalog.controller.ts`, `packages/registry-service/src/health.controller.ts`

- [ ] **Step 1: 실패하는 테스트 (`catalog-snapshot-store.test.ts`)**

```ts
import { buildCatalogSnapshot } from '@qa-sdk/core';
import { describe, expect, it } from 'vitest';
import { InMemoryCatalogSnapshotStore } from './catalog-snapshot-store.js';
import { SMALL_CATALOG } from './__fixtures__/small-catalog.js';

describe('InMemoryCatalogSnapshotStore', () => {
  it('같은 snapshot 재발행은 exists, 조회는 digest·latest 모두 가능', async () => {
    const store = new InMemoryCatalogSnapshotStore();
    const { snapshot } = await buildCatalogSnapshot(SMALL_CATALOG, { snapshotVersion: 1, parentDigest: null });
    expect(await store.publish(snapshot)).toBe('created');
    expect(await store.publish(structuredClone(snapshot))).toBe('exists');
    expect(await store.get(snapshot.digest)).toEqual(snapshot);
    expect((await store.latest(SMALL_CATALOG.id))?.digest).toBe(snapshot.digest);
  });

  it('같은 digest에 다른 내용은 CONFLICT로 거부한다', async () => {
    const store = new InMemoryCatalogSnapshotStore();
    const { snapshot } = await buildCatalogSnapshot(SMALL_CATALOG, { snapshotVersion: 1, parentDigest: null });
    await store.publish(snapshot);
    await expect(store.publish({ ...snapshot, snapshotVersion: 2 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('snapshotVersion은 catalog별 단조 증가여야 한다', async () => {
    const store = new InMemoryCatalogSnapshotStore();
    const { snapshot } = await buildCatalogSnapshot(SMALL_CATALOG, { snapshotVersion: 2, parentDigest: null });
    await store.publish(snapshot);
    const older = await buildCatalogSnapshot({ ...SMALL_CATALOG, name: 'renamed' }, { snapshotVersion: 1, parentDigest: snapshot.digest });
    await expect(store.publish(older.snapshot)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
```

`__fixtures__/small-catalog.ts`는 축 1개·prefix 1개짜리 주입 데이터다(T0 fixture와 같은 형태로 registry-service 안에 둔다).

- [ ] **Step 2: store 구현** — `Map<digest, snapshot>` + `Map<catalogId, digest[]>`. `publish`는 `canonicalJson` 비교로 동일성 판정, 다르면 `new AppError('CONFLICT', …, 409)`. 반환 객체는 `structuredClone`으로 외부 변경 차단.
- [ ] **Step 3: 발행 연결** — catalog register/update 경로에서: `latest = store.latest(id)`; `next = buildCatalogSnapshot(catalog, { snapshotVersion: (latest?.snapshotVersion ?? 0) + 1, parentDigest: latest?.digest ?? null })`; `issues`가 있거나 `latest`가 있고 `findUnversionedBreakingChanges(latest, next.snapshot)`가 비어 있지 않으면 422 + 목록 응답(catalog 저장도 하지 않음). 통과하면 catalog 저장 후 `publish`. 내용이 같으면(digest 동일) 새 version을 만들지 않는다.
- [ ] **Step 4: 조회 endpoint** — `GET /catalogs/:id/snapshots/latest`, `GET /catalogs/:id/snapshots/:digest` (404 시 `UnknownCatalogSnapshot` code). `health.controller.ts` `catalogHash`는 `shortDigest(snapshot.digest)`로 교체하고 전체 `catalogDigest` 필드를 함께 노출한다.
- [ ] **Step 5: 통과·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/registry-service test
git add packages/registry-service/src
git commit -m "feat(registry): 불변 CatalogSnapshot 발행과 미버전 breaking 변경 거부"
```

---

### Task 5: Ingest snapshot gate

**Files:** `packages/ingest-server/src/lib/snapshot-gate.ts` (+test), `packages/ingest-server/src/routes/ingest.ts`, `packages/ingest-server/src/config/env.ts` (키 2개, E와 조율)

- [ ] **Step 1: 실패하는 테스트 (`snapshot-gate.test.ts`)**

```ts
import { buildCatalogSnapshot, type CatalogSnapshot } from '@qa-sdk/core';
import { describe, expect, it } from 'vitest';
import { createSnapshotGate } from './snapshot-gate.js';
import { envelopeWith } from './__fixtures__/envelope.js';
import { SMALL_CATALOG } from './__fixtures__/small-catalog.js';

async function target(): Promise<CatalogSnapshot> {
  return (await buildCatalogSnapshot(SMALL_CATALOG, { snapshotVersion: 1, parentDigest: null })).snapshot;
}

describe('snapshot gate', () => {
  it('필드가 없으면 missing', async () => {
    const t = await target();
    const gate = createSnapshotGate({ mode: 'warn', loadTarget: async () => t, loadSnapshot: async () => undefined });
    expect(await gate.check(envelopeWith(undefined))).toEqual({ status: 'missing' });
  });

  it('target과 같은 digest면 ok', async () => {
    const t = await target();
    const gate = createSnapshotGate({ mode: 'enforce', loadTarget: async () => t, loadSnapshot: async () => undefined });
    const wire = { catalog_id: t.catalogId, snapshot_version: t.snapshotVersion, digest: t.digest, codec_version: t.codecVersion };
    expect(await gate.check(envelopeWith(wire))).toEqual({ status: 'ok', digest: t.digest });
  });

  it('catalog가 다르면 CatalogMismatch violation', async () => {
    const t = await target();
    const gate = createSnapshotGate({ mode: 'enforce', loadTarget: async () => t, loadSnapshot: async () => undefined });
    const wire = { catalog_id: 'other', snapshot_version: 1, digest: t.digest, codec_version: 'legacy-v1' };
    expect(await gate.check(envelopeWith(wire))).toMatchObject({ status: 'violation', code: 'CatalogMismatch' });
  });

  it('registry 조회가 실패하면 degraded (fail-open)', async () => {
    const gate = createSnapshotGate({
      mode: 'enforce',
      loadTarget: async () => { throw new Error('registry down'); },
      loadSnapshot: async () => undefined,
    });
    const wire = { catalog_id: 'x', snapshot_version: 1, digest: `sha256:${'c'.repeat(64)}`, codec_version: 'legacy-v1' };
    expect(await gate.check(envelopeWith(wire))).toMatchObject({ status: 'degraded' });
  });
});
```

- [ ] **Step 2: 구현** — envelope의 각 record `address_context` 값에서 사용된 `prefix@version` 집합을 `parsePackedAddress`로 모은 뒤, 각각 `resolveDecodeLayout({ ref: toSnapshotIdentity(wire), prefixId, version }, target, lookup)`을 호출한다. `lookup`은 동기 함수이므로 gate는 판정 전에 `loadSnapshot(wire.digest)`를 await해 1-entry Map을 만든다. `CodecContractError`는 `violation`, 그 외 예외는 `degraded`. `loadTarget`/`loadSnapshot`은 서버에서 registry `GET /catalogs/:id/snapshots/...`를 `AbortSignal.timeout(5_000)`으로 호출하는 read-through cache(digest는 불변이므로 TTL 없음, latest만 60s TTL)로 주입한다.
- [ ] **Step 3: 라우트 연결** — `storeEnvelope` 시작부에서 `gate.check`. `mode=enforce`이고 `violation`이면 422 `{ code, message }`, 나머지는 진행. 결과별로 `metricsCollector.increment('snapshot_gate_total', { result: status, code })`. `missing`/`degraded` 경고 로그는 프로세스당 `(status, source.sdk_name)` 조합별 1회만 남긴다.
- [ ] **Step 4: env** — `SNAPSHOT_GATE_MODE: z.enum(['off','warn','enforce']).default('warn')`, `SNAPSHOT_REGISTRY_URL: z.string().url().optional()` (미설정 시 기존 registry URL 해석 순서를 따른다).
- [ ] **Step 5: 통과·Commit**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/ingest-server test
git add packages/ingest-server/src/lib/snapshot-gate.ts packages/ingest-server/src/lib/snapshot-gate.test.ts packages/ingest-server/src/lib/__fixtures__ packages/ingest-server/src/routes/ingest.ts packages/ingest-server/src/config/env.ts
git commit -m "feat(ingest): envelope CatalogSnapshot gate (warn 기본, enforce 선택)"
```

선택: Track A Task 4 머지 후 corpus의 serialized 주소로 envelope을 만들어 gate가 모두 `ok`인지 검증하는 테스트를 추가한다.

---

### Task 6: Readiness

**Files:** `packages/ingest-server/src/routes/health.ts` (+test)

- [ ] **Step 1: 실패하는 테스트** — `createHealthRoutes({ …, checkSnapshotRegistry })`에서 checker가 `{ ok: false }`를 반환하면 `/health/ready`가 200을 유지하되 body에 `snapshotRegistry: 'degraded'`, 성공하면 `snapshotRegistry: 'ok'`와 `catalogDigest`(short)를 포함.
- [ ] **Step 2: 구현** — `HealthRoutesOptions`에 `checkSnapshotRegistry?: () => Promise<{ ok: boolean; digest?: string }>`. `/health/live`는 변경하지 않는다.
- [ ] **Step 3: Commit** — `feat(ingest): readiness에 snapshot registry 상태 노출`

---

### Task 7: 문서

- [ ] **Step 1:** ingest envelope 계약 문서(`grep -rl "TransmissionEnvelope" docs/specs`로 찾는다)에 `catalog_snapshot` 필드, gate 모드 3종, 응답 코드(400 `CorruptEnvelope`, 422 계약 위반)를 추가한다.
- [ ] **Step 2:** `docs/specs/system/system-support/error-handling-convention.spec.md`에 `CodecContractError` 9종과 HTTP 매핑 표를 추가한다.
- [ ] **Step 3:** `def sync` + `def validate` 경고 0 → Commit `docs(spec): envelope snapshot binding 계약 반영`
