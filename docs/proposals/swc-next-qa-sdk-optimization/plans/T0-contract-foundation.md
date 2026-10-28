# T0 계약 기반 — CatalogSnapshot·Canonical Digest·Codec 실패 코드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주소를 만든 Catalog 문맥(snapshot·digest·codec version)을 표현하는 타입과, 그 문맥으로 decode 가능 여부를 판정하는 순수 함수를 `@qa-sdk/core`에 둔다.

**Architecture:** `packages/core/src/catalog/snapshot/`에 신규 모듈을 만든다. shape·entries는 기존 canonical runtime(`getPrefixShape`, `getPrefixEntries`)에서 파생하고, 새로 계산하지 않는다. digest는 RFC 8785(JCS) 부분집합 직렬화 + WebCrypto SHA-256이다. core는 `browser-sdk`의 의존성이므로 `node:crypto`를 쓰지 않는다. 판정 함수는 I/O 없이 snapshot 조회 함수(`SnapshotLookup`)를 인자로 받는다.

**Tech Stack:** TypeScript ES2023 (NodeNext), vitest, WebCrypto (`globalThis.crypto.subtle`, Node 20+ / 브라우저)

**Spec:** [README](../README.md) §1 R-1·R-10·R-11, §3 D-6 / Drive 원본 계획 Phase 1 "실패 타입", §8.1 계약 테스트

## Global Constraints

- TypeScript target ES2023, core 빌드는 `rm -rf dist && tsc` (ESM only)
- 주석·오류 메시지는 한국어
- `@qa-sdk/core`에서 `node:*` 모듈 import 금지 (browser-sdk 번들 대상)
- digest 표기: `sha256:` + 64 hex. 12자 축약은 `shortDigest()` 파생값으로만 사용 (D-6)
- object key 정렬은 UTF-16 code unit 순서 (`Array.prototype.sort()` 기본). `localeCompare` 금지
- 2^53을 넘을 수 있는 수(stride, totalSpace)는 10진 문자열로 저장 (CON-007)
- `"v1"` 하드코딩 금지 — version은 catalog 데이터에서 읽는다
- 테스트 fixture catalog는 `snapshot/__fixtures__/`의 주입 데이터로 둔다. core는 `demo-snapshot`에 의존할 수 없다(순환). DEMO_CATALOG 전수 검증은 Track A가 한다
- `packages/core/src/catalog/runtime.ts`는 수정하지 않는다 (Track A 소유)

## Review Focus

1. **같은 내용, 다른 key 순서의 catalog** → 같은 digest. 테스트: Task 2 Step 1 `key 순서가 달라도 같은 digest`.
2. **표시 이름(`ko`, `name`)만 바뀐 catalog** → catalog digest는 다르지만 `layoutDigest`는 같고 `classifyLayoutChange`는 `identical`. 테스트: Task 4 Step 1 `표시 이름 변경은 layout을 바꾸지 않는다`.
3. **같은 prefix version에서 축 entries가 중간 삽입·삭제된 경우** → `breaking`/`entries-rewritten` (append만 호환). 테스트: Task 4 Step 1.
4. **number 주소로 2^53 초과 layout을 검사** → `StrideOverflow` (정밀도 손실 상태로 range 검사를 통과시키지 않음). 테스트: Task 5 Step 1.
5. **v2에서 dim을 추가해 v1 `axisVersions`가 비어 있는 prefix (R-11)** → snapshot 빌드는 성공하되 해당 key가 `issues`에 나오고 `layouts`에는 없다. decode 요청은 `UnknownPrefix`. 테스트: Task 3 Step 1, Task 5 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/core/src/catalog/snapshot/canonical-json.ts` (신규) | JCS 부분집합 직렬화 |
| `packages/core/src/catalog/snapshot/digest.ts` (신규) | SHA-256(WebCrypto), `digestCanonical`, `computeCatalogDigest`, `shortDigest` |
| `packages/core/src/catalog/snapshot/codec-errors.ts` (신규) | 실패 코드 9종, `CodecContractError`, `isCodecContractError` |
| `packages/core/src/catalog/snapshot/catalog-snapshot.types.ts` (신규) | `CatalogSnapshot`, `PrefixLayout`, `DimensionLayout`, codec version 상수 |
| `packages/core/src/catalog/snapshot/build-snapshot.ts` (신규) | `buildCatalogSnapshot` — runtime 함수에서 layout 파생 |
| `packages/core/src/catalog/snapshot/compatibility.ts` (신규) | `classifyLayoutChange`, `findUnversionedBreakingChanges`, `resolveDecodeLayout`, `assertAddressInLayout` |
| `packages/core/src/catalog/snapshot/index.ts` (신규) | sub-barrel |
| `packages/core/src/catalog/snapshot/*.test.ts` (신규) | 단위 테스트 |
| `packages/core/src/catalog/index.ts` (수정) | snapshot re-export |
| `packages/core/src/index.ts` (수정) | root export |
| `docs/architecture-decisions.md` (수정) | ADR-010 Coordinate Context Binding |

**Interfaces — Produces (A·B·D가 소비):**

```ts
export type CodecErrorCode =
  | 'UnknownCatalogSnapshot' | 'CatalogMismatch' | 'UnsupportedCodecVersion' | 'UnknownPrefix'
  | 'AddressOutOfRange' | 'StrideOverflow' | 'InvalidDimensionValue' | 'MigrationRequired' | 'CorruptEnvelope';
export class CodecContractError extends Error { readonly code: CodecErrorCode; readonly details: Readonly<Record<string, unknown>> }
export function isCodecContractError(error: unknown, code?: CodecErrorCode): error is CodecContractError;

export const LEGACY_V1_CODEC: 'legacy-v1';
export type CodecVersion = 'legacy-v1';
export function isSupportedCodecVersion(value: string): value is CodecVersion;
export type PrefixLayoutKey = `${string}@${string}`;
export function prefixLayoutKey(prefixId: string, version: string): PrefixLayoutKey;
export interface DimensionLayout { label; kind: 'axis' | 'prefix_ref'; sourceId; sourceVersion: string | null; capacity: number; entries: readonly (string | number)[] }
export interface PrefixLayout { prefixId; version; addressModel: AddressModel; dims: readonly DimensionLayout[]; strides: readonly string[]; totalSpace: string; safePrecision: boolean; layoutDigest: string }
export interface CatalogSnapshotRef { catalogId: string; snapshotVersion: number; digest: string; codecVersion: CodecVersion }
export interface CatalogSnapshot extends CatalogSnapshotRef { schemaVersion: 1; digestAlgorithm: 'sha256-jcs'; parentDigest: string | null; layouts: Readonly<Record<PrefixLayoutKey, PrefixLayout>> }
export interface SnapshotLayoutIssue { key: PrefixLayoutKey; message: string }
export interface CatalogSnapshotBuildResult { snapshot: CatalogSnapshot; issues: readonly SnapshotLayoutIssue[] }

export function canonicalJson(value: unknown): string;
export function sha256Hex(text: string): Promise<string>;
export function digestCanonical(value: unknown): Promise<string>;
export function computeCatalogDigest(catalog: Catalog): Promise<string>;
export function shortDigest(digest: string): string;
export function buildCatalogSnapshot(catalog: Catalog, options: BuildCatalogSnapshotOptions): Promise<CatalogSnapshotBuildResult>;
export function classifyLayoutChange(prev: PrefixLayout, next: PrefixLayout): LayoutChange;
export function findUnversionedBreakingChanges(prev: CatalogSnapshot, next: CatalogSnapshot): UnversionedBreakingChange[];
export function resolveDecodeLayout(request: DecodeLayoutRequest, target: CatalogSnapshot, lookup: SnapshotLookup): PrefixLayout;
export function assertAddressInLayout(layout: PrefixLayout, address: number | bigint): void;
```

---

### Task 0: Baseline

**Files:** 없음 (확인만)

- [ ] **Step 1: core 테스트·빌드 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter @qa-sdk/core test 2>&1 | tail -5
```

Expected: build 성공, 모든 테스트 PASS. 실패하면 main이 깨진 상태이므로 중단하고 보고한다.

- [ ] **Step 2: 이름 충돌 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "CatalogSnapshot\b\|CodecContractError\|canonicalJson\|computeCatalogDigest" packages/*/src --include='*.ts' | grep -v node_modules | head
```

Expected: `packages/sim-identifier-grammar/src/schema-hash.ts`의 private `canonicalJSON`(대소문자 다름) 외 0건. 다른 결과가 있으면 이름을 바꾸기 전에 보고한다.

---

### Task 1: Canonical JSON

**Files:**
- Create: `packages/core/src/catalog/snapshot/canonical-json.ts`
- Test: `packages/core/src/catalog/snapshot/canonical-json.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json.js';

describe('canonicalJson', () => {
  it('object key를 UTF-16 code unit 순서로 정렬한다 (localeCompare 아님)', () => {
    expect(canonicalJson({ é: 1, a: 2, _: 3, B: 4 })).toBe('{"B":4,"_":3,"a":2,"é":1}');
  });

  it('중첩 구조와 배열 순서를 보존한다', () => {
    expect(canonicalJson({ b: [3, 1, { d: true, c: null }], a: 'x' })).toBe(
      '{"a":"x","b":[3,1,{"c":null,"d":true}]}',
    );
  });

  it('undefined 값을 가진 key는 생략하고 배열의 undefined는 null로 쓴다', () => {
    expect(canonicalJson({ a: undefined, b: [undefined, 1] })).toBe('{"b":[null,1]}');
  });

  it('숫자는 ECMAScript 표준 표기를 쓴다', () => {
    expect(canonicalJson([1e21, 0.1, -0, 1.5])).toBe('[1e+21,0.1,0,1.5]');
  });

  it('JSON으로 표현할 수 없는 값은 조용히 버리지 않고 TypeError를 던진다', () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(TypeError);
  });

  it('오류 메시지에 값의 경로를 포함한다', () => {
    expect(() => canonicalJson({ a: [{ b: Number.NaN }] })).toThrow('$.a[0].b');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/canonical-json.test.ts`
Expected: FAIL — `Failed to resolve import "./canonical-json.js"`

- [ ] **Step 3: 구현**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * canonicalJson — RFC 8785(JCS) 부분집합 직렬화.
 *
 * - object key: UTF-16 code unit 오름차순 (Array.prototype.sort 기본 비교)
 * - undefined 값을 가진 key는 생략, 배열 안의 undefined는 null
 * - number/string 표기는 ECMAScript JSON.stringify (JCS가 채택한 규칙과 동일)
 * - NaN·Infinity·bigint·function·symbol은 TypeError — digest 입력에서 조용한 손실 금지
 */
export function canonicalJson(value: unknown): string {
  return serialize(value, '$');
}

function serialize(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: 유한하지 않은 숫자는 직렬화할 수 없습니다 (${path})`);
      }
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJson: ${typeof value} 값은 직렬화할 수 없습니다 (${path})`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item, i) =>
      item === undefined ? 'null' : serialize(item, `${path}[${i}]`),
    );
    return `[${items.join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`);
  return `{${members.join(',')}}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/canonical-json.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/snapshot/canonical-json.ts packages/core/src/catalog/snapshot/canonical-json.test.ts
git commit -m "feat(core): JCS 부분집합 canonicalJson 추가"
```

---

### Task 2: Digest

**Files:**
- Create: `packages/core/src/catalog/snapshot/digest.ts`
- Test: `packages/core/src/catalog/snapshot/digest.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { computeCatalogDigest, digestCanonical, sha256Hex, shortDigest } from './digest.js';

describe('digest', () => {
  it('SHA-256 표준 벡터와 일치한다', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('digestCanonical은 sha256: 접두사와 64 hex를 쓴다', async () => {
    expect(await digestCanonical({})).toBe(
      'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });

  it('key 순서가 달라도 같은 digest', async () => {
    const a: Catalog = { id: 'c', name: 'n', axes: {}, prefixes: {} };
    const b = { prefixes: {}, axes: {}, name: 'n', id: 'c' } as Catalog;
    expect(await computeCatalogDigest(a)).toBe(await computeCatalogDigest(b));
  });

  it('내용이 다르면 digest가 다르다', async () => {
    const a: Catalog = { id: 'c', name: 'n', axes: {}, prefixes: {} };
    const b: Catalog = { ...a, name: 'n2' };
    expect(await computeCatalogDigest(a)).not.toBe(await computeCatalogDigest(b));
  });

  it('shortDigest는 표시용 12 hex만 돌려준다', () => {
    expect(shortDigest(`sha256:${'ab'.repeat(32)}`)).toBe('abababababab');
  });

  it('형식이 다른 digest는 shortDigest에서 거부한다', () => {
    expect(() => shortDigest('abc')).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/digest.test.ts`
Expected: FAIL — `Failed to resolve import "./digest.js"`

- [ ] **Step 3: 구현**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog } from '../catalog.types.js';
import { canonicalJson } from './canonical-json.js';

/** digest 산출 규칙 식별자 — CatalogSnapshot.digestAlgorithm에 기록 */
export const CATALOG_DIGEST_ALGORITHM = 'sha256-jcs' as const;

const DIGEST_PREFIX = 'sha256:';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** UTF-8 문자열의 SHA-256 hex. 브라우저·Node 공통 WebCrypto만 사용한다. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('digest 계산에 WebCrypto(crypto.subtle)가 필요합니다');
  }
  const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** canonicalJson 직렬화 결과의 digest (`sha256:<64 hex>`) */
export async function digestCanonical(value: unknown): Promise<string> {
  return `${DIGEST_PREFIX}${await sha256Hex(canonicalJson(value))}`;
}

/** Catalog 전체 내용의 digest — 표시 이름 변경도 반영된다. layout 호환성은 layoutDigest로 판정한다. */
export function computeCatalogDigest(catalog: Catalog): Promise<string> {
  return digestCanonical(catalog);
}

/** 로그·UI 표시용 12 hex. 식별·비교에는 전체 digest를 쓴다. */
export function shortDigest(digest: string): string {
  if (!DIGEST_PATTERN.test(digest)) {
    throw new TypeError(`digest 형식이 아닙니다: ${digest}`);
  }
  return digest.slice(DIGEST_PREFIX.length, DIGEST_PREFIX.length + 12);
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/digest.test.ts`
Expected: PASS (6 tests). `crypto` 타입 오류가 나면 root tsconfig에 `lib`이 지정되지 않아 DOM lib가 포함되는지 확인한다(현재 미지정).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/snapshot/digest.ts packages/core/src/catalog/snapshot/digest.test.ts
git commit -m "feat(core): WebCrypto 기반 catalog digest 추가"
```

---

### Task 3: Snapshot 타입·실패 코드·빌더

**Files:**
- Create: `packages/core/src/catalog/snapshot/codec-errors.ts`
- Create: `packages/core/src/catalog/snapshot/catalog-snapshot.types.ts`
- Create: `packages/core/src/catalog/snapshot/build-snapshot.ts`
- Create: `packages/core/src/catalog/snapshot/__fixtures__/snapshot-fixture.ts` (테스트 주입 데이터, 기존 `core/src/pipe/__fixtures__` 관례)
- Test: `packages/core/src/catalog/snapshot/build-snapshot.test.ts`

**Interfaces:**
- Consumes: `getPrefixShape(catalog, prefixId, version): PrefixShape` (`dimCapacities: Record<label, number>`), `getPrefixEntries(catalog, prefixId, version): PrefixEntries` (`entries: Record<label, readonly (string|number)[]>`) — `../runtime.js`; `digestCanonical`, `computeCatalogDigest`, `CATALOG_DIGEST_ALGORITHM` — Task 2
- Produces: Interfaces 블록의 타입 전부, `buildCatalogSnapshot`

- [ ] **Step 1: fixture와 실패하는 테스트 작성**

`__fixtures__/snapshot-fixture.ts`:

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog } from '../../catalog.types.js';

/** snapshot 테스트 주입 데이터 — env는 v2에서 entry 1개 append, capacity 유지 */
export const SNAPSHOT_FIXTURE: Catalog = {
  id: 'fixture',
  name: 'fixture',
  axes: {
    env: {
      id: 'env',
      name: 'env',
      versions: {
        v1: { entries: ['dev', 'prod'], capacity: 4, ko: { dev: '개발', prod: '운영' } },
        v2: { entries: ['dev', 'prod', 'stage'], capacity: 4 },
      },
    },
    role: { id: 'role', name: 'role', versions: { v1: { entries: ['viewer', 'editor', 'admin'] } } },
    qa_module: { id: 'qa_module', name: 'qa_module', versions: { v1: { entries: ['m1'] } } },
  },
  prefixes: {
    svc: {
      id: 'svc',
      name: 'svc',
      labels: ['env', 'role'],
      dims: { env: { kind: 'axis', axisId: 'env' }, role: { kind: 'axis', axisId: 'role' } },
      versions: [
        { version: 'v1', axisVersions: { env: 'v1', role: 'v1' } },
        { version: 'v2', axisVersions: { env: 'v2', role: 'v1' } },
      ],
    },
    /** R-11 재현: v2에서 추가된 qa_module이 v1 axisVersions에 없다 */
    build_event: {
      id: 'build_event',
      name: 'build_event',
      labels: ['env', 'qa_module'],
      dims: { env: { kind: 'axis', axisId: 'env' }, qa_module: { kind: 'axis', axisId: 'qa_module' } },
      versions: [
        { version: 'v1', axisVersions: { env: 'v1' } },
        { version: 'v2', axisVersions: { env: 'v1', qa_module: 'v1' } },
      ],
    },
  },
};
```

`build-snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { LEGACY_V1_CODEC, prefixLayoutKey } from './catalog-snapshot.types.js';
import { computeCatalogDigest } from './digest.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;

describe('buildCatalogSnapshot', () => {
  it('snapshot ref 필드를 채우고 codec 기본값은 legacy-v1이다', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    expect(snapshot.catalogId).toBe(SNAPSHOT_FIXTURE.id);
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.codecVersion).toBe(LEGACY_V1_CODEC);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.digestAlgorithm).toBe('sha256-jcs');
    expect(snapshot.parentDigest).toBeNull();
    expect(snapshot.digest).toBe(await computeCatalogDigest(SNAPSHOT_FIXTURE));
  });

  it('layout은 capacity 기준 shape·stride를 기록한다 (core runtime과 같은 기준)', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const layout = snapshot.layouts[prefixLayoutKey('svc', 'v1')];
    expect(layout.dims.map((d) => [d.label, d.capacity])).toEqual([
      ['env', 4],
      ['role', 3],
    ]);
    expect(layout.strides).toEqual(['3', '1']);
    expect(layout.totalSpace).toBe('12');
    expect(layout.safePrecision).toBe(true);
    expect(layout.addressModel).toBe('product');
    expect(layout.dims[0]).toMatchObject({
      kind: 'axis',
      sourceId: 'env',
      sourceVersion: 'v1',
      entries: ['dev', 'prod'],
    });
    expect(layout.layoutDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('layout을 만들 수 없는 prefix version은 layouts에서 빼고 issues로 보고한다', async () => {
    const { snapshot, issues } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const broken = prefixLayoutKey('build_event', 'v1');
    expect(snapshot.layouts[broken]).toBeUndefined();
    expect(snapshot.layouts[prefixLayoutKey('build_event', 'v2')]).toBeDefined();
    expect(issues).toEqual([{ key: broken, message: expect.stringContaining('qa_module') }]);
  });

  it('같은 입력이면 같은 snapshot을 만든다 (시각·난수 미포함)', async () => {
    const a = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const b = await buildCatalogSnapshot(structuredClone(SNAPSHOT_FIXTURE), OPTIONS);
    expect(b).toEqual(a);
  });

  it('snapshotVersion은 1 이상의 정수여야 한다', async () => {
    await expect(
      buildCatalogSnapshot(SNAPSHOT_FIXTURE, { snapshotVersion: 0, parentDigest: null }),
    ).rejects.toThrow(RangeError);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/build-snapshot.test.ts`
Expected: FAIL — `Failed to resolve import "./build-snapshot.js"`

- [ ] **Step 3: 실패 코드 구현 (`codec-errors.ts`)**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** 좌표 주소 호환성 계약의 실패 코드 — Drive 원본 계획 Phase 1 */
export const CODEC_ERROR_CODES = [
  'UnknownCatalogSnapshot',
  'CatalogMismatch',
  'UnsupportedCodecVersion',
  'UnknownPrefix',
  'AddressOutOfRange',
  'StrideOverflow',
  'InvalidDimensionValue',
  'MigrationRequired',
  'CorruptEnvelope',
] as const;

export type CodecErrorCode = (typeof CODEC_ERROR_CODES)[number];

/** 정상 값처럼 보이는 잘못된 decode 대신 던지는 계약 오류 */
export class CodecContractError extends Error {
  readonly code: CodecErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: CodecErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(`[${code}] ${message}`);
    this.name = 'CodecContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

/** 번들이 둘로 나뉘어 instanceof가 실패해도 name·code로 판별한다 */
export function isCodecContractError(
  error: unknown,
  code?: CodecErrorCode,
): error is CodecContractError {
  if (!(error instanceof Error) || error.name !== 'CodecContractError') return false;
  const actual = (error as { code?: unknown }).code;
  if (!CODEC_ERROR_CODES.includes(actual as CodecErrorCode)) return false;
  return code === undefined || actual === code;
}
```

- [ ] **Step 4: 타입 구현 (`catalog-snapshot.types.ts`)**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { AddressModel } from '../catalog.types.js';
import type { CATALOG_DIGEST_ALGORITHM } from './digest.js';

export const CATALOG_SNAPSHOT_SCHEMA_VERSION = 1 as const;

/** 현재 `prefix:version:address` 형식과 capacity 기준 mixed-radix codec */
export const LEGACY_V1_CODEC = 'legacy-v1' as const;
export const SUPPORTED_CODEC_VERSIONS = [LEGACY_V1_CODEC] as const;
export type CodecVersion = (typeof SUPPORTED_CODEC_VERSIONS)[number];

export function isSupportedCodecVersion(value: string): value is CodecVersion {
  return (SUPPORTED_CODEC_VERSIONS as readonly string[]).includes(value);
}

export type PrefixLayoutKey = `${string}@${string}`;

export function prefixLayoutKey(prefixId: string, version: string): PrefixLayoutKey {
  return `${prefixId}@${version}`;
}

/** 주소 공간을 구성하는 고정 차원 1개 (table_ref는 주소 공간에 포함되지 않음) */
export interface DimensionLayout {
  readonly label: string;
  readonly kind: 'axis' | 'prefix_ref';
  /** axis: axisId, prefix_ref: 참조 prefixId */
  readonly sourceId: string;
  /** axis: 축 version, prefix_ref: refEntries.refVersion (미선언 시 null) */
  readonly sourceVersion: string | null;
  /** headroom 포함 capacity — stride 계산 기준 */
  readonly capacity: number;
  /** position 순서의 실제 entry (capacity보다 짧을 수 있음) */
  readonly entries: readonly (string | number)[];
}

export interface PrefixLayout {
  readonly prefixId: string;
  readonly version: string;
  readonly addressModel: AddressModel;
  readonly dims: readonly DimensionLayout[];
  /** dims와 같은 순서, 10진 문자열 (2^53 초과 대비) */
  readonly strides: readonly string[];
  readonly totalSpace: string;
  /** 최대 주소(totalSpace - 1)가 Number.MAX_SAFE_INTEGER 이하 */
  readonly safePrecision: boolean;
  /** prefixId·version·addressModel·dims의 canonical digest */
  readonly layoutDigest: string;
}

export interface CatalogSnapshotRef {
  readonly catalogId: string;
  /** registry가 발급하는 단조 증가 정수 (문서 version과 별개 축) */
  readonly snapshotVersion: number;
  readonly digest: string;
  readonly codecVersion: CodecVersion;
}

export interface CatalogSnapshot extends CatalogSnapshotRef {
  readonly schemaVersion: typeof CATALOG_SNAPSHOT_SCHEMA_VERSION;
  readonly digestAlgorithm: typeof CATALOG_DIGEST_ALGORITHM;
  readonly parentDigest: string | null;
  readonly layouts: Readonly<Record<PrefixLayoutKey, PrefixLayout>>;
}

export interface SnapshotLayoutIssue {
  readonly key: PrefixLayoutKey;
  readonly message: string;
}

export interface CatalogSnapshotBuildResult {
  readonly snapshot: CatalogSnapshot;
  /** layout을 만들 수 없어 layouts에서 제외한 prefix version */
  readonly issues: readonly SnapshotLayoutIssue[];
}

export interface BuildCatalogSnapshotOptions {
  readonly snapshotVersion: number;
  readonly parentDigest: string | null;
  readonly codecVersion?: CodecVersion;
}
```

- [ ] **Step 5: 빌더 구현 (`build-snapshot.ts`)**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog, PrefixDef, PrefixVersionDef } from '../catalog.types.js';
import { getPrefixEntries, getPrefixShape } from '../runtime.js';
import {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  LEGACY_V1_CODEC,
  prefixLayoutKey,
  type BuildCatalogSnapshotOptions,
  type CatalogSnapshotBuildResult,
  type DimensionLayout,
  type PrefixLayout,
  type PrefixLayoutKey,
  type SnapshotLayoutIssue,
} from './catalog-snapshot.types.js';
import { CATALOG_DIGEST_ALGORITHM, computeCatalogDigest, digestCanonical } from './digest.js';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Catalog → 불변 CatalogSnapshot.
 * shape·entries는 canonical runtime(getPrefixShape/getPrefixEntries)에서 파생한다.
 */
export async function buildCatalogSnapshot(
  catalog: Catalog,
  options: BuildCatalogSnapshotOptions,
): Promise<CatalogSnapshotBuildResult> {
  if (!Number.isSafeInteger(options.snapshotVersion) || options.snapshotVersion < 1) {
    throw new RangeError(`snapshotVersion은 1 이상의 정수여야 합니다: ${options.snapshotVersion}`);
  }

  const layouts: Record<PrefixLayoutKey, PrefixLayout> = {};
  const issues: SnapshotLayoutIssue[] = [];

  for (const prefixId of Object.keys(catalog.prefixes).sort()) {
    const prefix = catalog.prefixes[prefixId];
    for (const versionDef of prefix.versions) {
      const key = prefixLayoutKey(prefixId, versionDef.version);
      try {
        layouts[key] = await buildPrefixLayout(catalog, prefix, versionDef);
      } catch (error) {
        issues.push({ key, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    snapshot: {
      catalogId: catalog.id,
      snapshotVersion: options.snapshotVersion,
      digest: await computeCatalogDigest(catalog),
      codecVersion: options.codecVersion ?? LEGACY_V1_CODEC,
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      digestAlgorithm: CATALOG_DIGEST_ALGORITHM,
      parentDigest: options.parentDigest,
      layouts,
    },
    issues,
  };
}

async function buildPrefixLayout(
  catalog: Catalog,
  prefix: PrefixDef,
  versionDef: PrefixVersionDef,
): Promise<PrefixLayout> {
  const { dimCapacities } = getPrefixShape(catalog, prefix.id, versionDef.version);
  const { entries } = getPrefixEntries(catalog, prefix.id, versionDef.version);

  const dims: DimensionLayout[] = [];
  for (const label of prefix.labels) {
    const dim = prefix.dims[label];
    if (dim.kind === 'table_ref') continue;
    const base = { label, capacity: dimCapacities[label], entries: entries[label] ?? [] };
    dims.push(
      dim.kind === 'axis'
        ? { ...base, kind: 'axis', sourceId: dim.axisId, sourceVersion: versionDef.axisVersions[label] }
        : {
            ...base,
            kind: 'prefix_ref',
            sourceId: dim.prefixId,
            sourceVersion: versionDef.refEntries?.[label]?.refVersion ?? null,
          },
    );
  }

  const strides = new Array<bigint>(dims.length);
  let totalSpace = 1n;
  for (let i = dims.length - 1; i >= 0; i--) {
    strides[i] = totalSpace;
    totalSpace *= BigInt(dims[i].capacity);
  }

  const addressModel = prefix.addressModel ?? 'product';
  return {
    prefixId: prefix.id,
    version: versionDef.version,
    addressModel,
    dims,
    strides: strides.map(String),
    totalSpace: String(totalSpace),
    safePrecision: totalSpace - 1n <= MAX_SAFE,
    layoutDigest: await digestCanonical({
      prefixId: prefix.id,
      version: versionDef.version,
      addressModel,
      dims,
    }),
  };
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/build-snapshot.test.ts`
Expected: PASS (5 tests). `issues` 메시지는 runtime의 `Unknown axis version: qa_module@undefined`를 포함한다.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/catalog/snapshot/codec-errors.ts packages/core/src/catalog/snapshot/catalog-snapshot.types.ts packages/core/src/catalog/snapshot/build-snapshot.ts packages/core/src/catalog/snapshot/__fixtures__/snapshot-fixture.ts packages/core/src/catalog/snapshot/build-snapshot.test.ts
git commit -m "feat(core): CatalogSnapshot 타입과 빌더, codec 실패 코드 9종 추가"
```

---

### Task 4: Layout 변경 분류

**Files:**
- Create: `packages/core/src/catalog/snapshot/compatibility.ts`
- Test: `packages/core/src/catalog/snapshot/compatibility.test.ts`

**Interfaces:**
- Consumes: `PrefixLayout`, `CatalogSnapshot`, `PrefixLayoutKey` — Task 3
- Produces:

```ts
export type LayoutBreakingReason = 'address-model' | 'dim-order' | 'dim-kind' | 'dim-source' | 'capacity' | 'entries-rewritten';
export type LayoutChange =
  | { readonly kind: 'identical' }
  | { readonly kind: 'append-compatible'; readonly appended: Readonly<Record<string, number>> }
  | { readonly kind: 'breaking'; readonly reason: LayoutBreakingReason; readonly label?: string };
export interface UnversionedBreakingChange { readonly key: PrefixLayoutKey; readonly reason: LayoutBreakingReason | 'removed'; readonly label?: string }
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey } from './catalog-snapshot.types.js';
import { classifyLayoutChange, findUnversionedBreakingChanges } from './compatibility.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;
const SVC_V1 = prefixLayoutKey('svc', 'v1');

async function layoutOf(catalog: Catalog, key = SVC_V1) {
  return (await buildCatalogSnapshot(catalog, OPTIONS)).snapshot.layouts[key];
}

function withAxis(axisId: string, version: string, patch: object): Catalog {
  const catalog = structuredClone(SNAPSHOT_FIXTURE) as { axes: Record<string, { versions: Record<string, object> }> };
  Object.assign(catalog.axes[axisId].versions[version], patch);
  return catalog as unknown as Catalog;
}

describe('classifyLayoutChange', () => {
  it('같은 layout은 identical', async () => {
    const layout = await layoutOf(SNAPSHOT_FIXTURE);
    expect(classifyLayoutChange(layout, layout)).toEqual({ kind: 'identical' });
  });

  it('표시 이름 변경은 layout을 바꾸지 않는다', async () => {
    const renamed = withAxis('env', 'v1', { ko: { dev: 'DEV', prod: 'PROD' } });
    expect(classifyLayoutChange(await layoutOf(SNAPSHOT_FIXTURE), await layoutOf(renamed))).toEqual({
      kind: 'identical',
    });
    expect((await layoutOf(renamed)).layoutDigest).toBe((await layoutOf(SNAPSHOT_FIXTURE)).layoutDigest);
  });

  it('capacity 안에서 entry를 뒤에 추가하면 append-compatible', async () => {
    const v1 = await layoutOf(SNAPSHOT_FIXTURE, SVC_V1);
    const v2 = await layoutOf(SNAPSHOT_FIXTURE, prefixLayoutKey('svc', 'v2'));
    expect(classifyLayoutChange(v1, { ...v2, version: v1.version })).toEqual({
      kind: 'append-compatible',
      appended: { env: 1 },
    });
  });

  it('entry 삭제·순서 변경은 entries-rewritten', async () => {
    const removed = withAxis('env', 'v1', { entries: ['prod'] });
    const reordered = withAxis('env', 'v1', { entries: ['prod', 'dev'] });
    const base = await layoutOf(SNAPSHOT_FIXTURE);
    for (const next of [removed, reordered]) {
      expect(classifyLayoutChange(base, await layoutOf(next))).toEqual({
        kind: 'breaking',
        reason: 'entries-rewritten',
        label: 'env',
      });
    }
  });

  it('capacity 변경은 breaking', async () => {
    const widened = withAxis('env', 'v1', { capacity: 8 });
    expect(classifyLayoutChange(await layoutOf(SNAPSHOT_FIXTURE), await layoutOf(widened))).toEqual({
      kind: 'breaking',
      reason: 'capacity',
      label: 'env',
    });
  });

  it('dim 순서 변경은 breaking', async () => {
    const swapped = structuredClone(SNAPSHOT_FIXTURE) as unknown as { prefixes: { svc: { labels: string[] } } };
    swapped.prefixes.svc.labels = ['role', 'env'];
    expect(
      classifyLayoutChange(await layoutOf(SNAPSHOT_FIXTURE), await layoutOf(swapped as unknown as Catalog)),
    ).toEqual({ kind: 'breaking', reason: 'dim-order' });
  });

  it('addressModel 변경은 breaking', async () => {
    const base = await layoutOf(SNAPSHOT_FIXTURE);
    expect(classifyLayoutChange(base, { ...base, addressModel: 'sum' })).toEqual({
      kind: 'breaking',
      reason: 'address-model',
    });
  });
});

describe('findUnversionedBreakingChanges', () => {
  it('같은 prefix version에서 capacity가 바뀌면 보고한다 (version bump 강제)', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const next = (await buildCatalogSnapshot(withAxis('env', 'v1', { capacity: 8 }), OPTIONS)).snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toContainEqual({
      key: SVC_V1,
      reason: 'capacity',
      label: 'env',
    });
  });

  it('기존 prefix version이 사라지면 removed로 보고한다', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const dropped = structuredClone(SNAPSHOT_FIXTURE) as unknown as { prefixes: { svc: { versions: unknown[] } } };
    dropped.prefixes.svc.versions = dropped.prefixes.svc.versions.slice(1);
    const next = (await buildCatalogSnapshot(dropped as unknown as Catalog, OPTIONS)).snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toEqual([{ key: SVC_V1, reason: 'removed' }]);
  });

  it('capacity 안의 append-only 변경은 보고하지 않는다', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const next = (await buildCatalogSnapshot(withAxis('env', 'v1', { entries: ['dev', 'prod', 'qa'] }), OPTIONS)).snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toEqual([]);
  });
});
```

entry 수가 capacity를 넘는 catalog는 이 함수의 판정 대상이 아니다. 그 검사는 catalog lint(Track A Task 1의 DEMO_CATALOG 전수 테스트)가 맡는다.

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/compatibility.test.ts`
Expected: FAIL — `Failed to resolve import "./compatibility.js"`

- [ ] **Step 3: 구현 (`compatibility.ts` 앞부분)**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type {
  CatalogSnapshot,
  CatalogSnapshotRef,
  PrefixLayout,
  PrefixLayoutKey,
} from './catalog-snapshot.types.js';
import { isSupportedCodecVersion, prefixLayoutKey } from './catalog-snapshot.types.js';
import { CodecContractError } from './codec-errors.js';

export type LayoutBreakingReason =
  | 'address-model'
  | 'dim-order'
  | 'dim-kind'
  | 'dim-source'
  | 'capacity'
  | 'entries-rewritten';

export type LayoutChange =
  | { readonly kind: 'identical' }
  | { readonly kind: 'append-compatible'; readonly appended: Readonly<Record<string, number>> }
  | { readonly kind: 'breaking'; readonly reason: LayoutBreakingReason; readonly label?: string };

export interface UnversionedBreakingChange {
  readonly key: PrefixLayoutKey;
  readonly reason: LayoutBreakingReason | 'removed';
  readonly label?: string;
}

/**
 * prev layout으로 만든 주소를 next layout으로 decode해도 같은 의미인지 분류한다.
 * 같은 stride에서 entry를 뒤에 추가한 경우만 호환이다 (feedback: stride 순서 변경은 주소 공간을 바꾼다).
 */
export function classifyLayoutChange(prev: PrefixLayout, next: PrefixLayout): LayoutChange {
  if (prev.addressModel !== next.addressModel) return { kind: 'breaking', reason: 'address-model' };
  if (
    prev.dims.length !== next.dims.length ||
    prev.dims.some((dim, i) => dim.label !== next.dims[i].label)
  ) {
    return { kind: 'breaking', reason: 'dim-order' };
  }

  const appended: Record<string, number> = {};
  for (let i = 0; i < prev.dims.length; i++) {
    const before = prev.dims[i];
    const after = next.dims[i];
    const label = before.label;
    if (before.kind !== after.kind) return { kind: 'breaking', reason: 'dim-kind', label };
    if (before.sourceId !== after.sourceId) return { kind: 'breaking', reason: 'dim-source', label };
    if (before.capacity !== after.capacity) return { kind: 'breaking', reason: 'capacity', label };
    const isPrefix =
      before.entries.length <= after.entries.length &&
      before.entries.every((entry, pos) => after.entries[pos] === entry);
    if (!isPrefix) return { kind: 'breaking', reason: 'entries-rewritten', label };
    if (after.entries.length > before.entries.length) {
      appended[label] = after.entries.length - before.entries.length;
    }
  }

  return Object.keys(appended).length === 0
    ? { kind: 'identical' }
    : { kind: 'append-compatible', appended };
}

/** 같은 prefix version 안에서 일어난 breaking 변경 — 새 prefix version을 요구해야 하는 목록 */
export function findUnversionedBreakingChanges(
  prev: CatalogSnapshot,
  next: CatalogSnapshot,
): UnversionedBreakingChange[] {
  const changes: UnversionedBreakingChange[] = [];
  for (const key of Object.keys(prev.layouts).sort() as PrefixLayoutKey[]) {
    const after = next.layouts[key];
    if (!after) {
      changes.push({ key, reason: 'removed' });
      continue;
    }
    const change = classifyLayoutChange(prev.layouts[key], after);
    if (change.kind === 'breaking') {
      changes.push(
        change.label === undefined
          ? { key, reason: change.reason }
          : { key, reason: change.reason, label: change.label },
      );
    }
  }
  return changes;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/compatibility.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/snapshot/compatibility.ts packages/core/src/catalog/snapshot/compatibility.test.ts
git commit -m "feat(core): prefix layout 변경 분류와 미버전 breaking 변경 탐지 추가"
```

---

### Task 5: Decode 판정과 주소 범위 검사

**Files:**
- Modify: `packages/core/src/catalog/snapshot/compatibility.ts` (뒤에 추가)
- Test: `packages/core/src/catalog/snapshot/resolve-decode-layout.test.ts`

**Interfaces:**
- Produces:

```ts
export type SnapshotIdentity = Pick<CatalogSnapshotRef, 'catalogId' | 'digest' | 'codecVersion'>;
export interface DecodeLayoutRequest { readonly ref: SnapshotIdentity; readonly prefixId: string; readonly version: string }
export type SnapshotLookup = (digest: string) => CatalogSnapshot | undefined;
export function resolveDecodeLayout(request: DecodeLayoutRequest, target: CatalogSnapshot, lookup: SnapshotLookup): PrefixLayout;
export function assertAddressInLayout(layout: PrefixLayout, address: number | bigint): void;
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey, type CatalogSnapshot } from './catalog-snapshot.types.js';
import { isCodecContractError, type CodecErrorCode } from './codec-errors.js';
import { assertAddressInLayout, resolveDecodeLayout } from './compatibility.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

async function snapshotOf(catalog: Catalog, snapshotVersion = 1): Promise<CatalogSnapshot> {
  return (await buildCatalogSnapshot(catalog, { snapshotVersion, parentDigest: null })).snapshot;
}

function expectCode(fn: () => unknown, code: CodecErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(isCodecContractError(error, code)).toBe(true);
    return;
  }
  throw new Error(`${code}가 발생하지 않았습니다`);
}

function patched(mutate: (c: any) => void): Catalog {
  const catalog = structuredClone(SNAPSHOT_FIXTURE);
  mutate(catalog);
  return catalog;
}

describe('resolveDecodeLayout', () => {
  it('같은 digest면 target layout을 돌려준다', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const layout = resolveDecodeLayout({ ref: target, prefixId: 'svc', version: 'v1' }, target, () => undefined);
    expect(layout).toBe(target.layouts[prefixLayoutKey('svc', 'v1')]);
  });

  it('producer snapshot을 찾을 수 없으면 UnknownCatalogSnapshot', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, digest: `sha256:${'0'.repeat(64)}` };
    expectCode(() => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined), 'UnknownCatalogSnapshot');
  });

  it('catalogId가 다르면 CatalogMismatch', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, catalogId: 'other' };
    expectCode(() => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined), 'CatalogMismatch');
  });

  it('지원하지 않는 codec이면 UnsupportedCodecVersion (wire에서 온 임의 문자열 포함)', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, codecVersion: 'legacy-v2' as never };
    expectCode(() => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined), 'UnsupportedCodecVersion');
  });

  it('target에 없는 prefix version이면 UnknownPrefix (R-11 layout 포함)', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    expectCode(() => resolveDecodeLayout({ ref: target, prefixId: 'nope', version: 'v1' }, target, () => undefined), 'UnknownPrefix');
    expectCode(() => resolveDecodeLayout({ ref: target, prefixId: 'build_event', version: 'v1' }, target, () => undefined), 'UnknownPrefix');
  });

  it('producer와 target layout이 breaking이면 MigrationRequired', async () => {
    const producer = await snapshotOf(SNAPSHOT_FIXTURE, 1);
    const target = await snapshotOf(patched((c) => { c.axes.env.versions.v1.capacity = 8; }), 2);
    const lookup = (digest: string) => (digest === producer.digest ? producer : undefined);
    expectCode(() => resolveDecodeLayout({ ref: producer, prefixId: 'svc', version: 'v1' }, target, lookup), 'MigrationRequired');
  });

  it('producer → target이 append-only면 target layout으로 decode 허용', async () => {
    const producer = await snapshotOf(SNAPSHOT_FIXTURE, 1);
    const target = await snapshotOf(patched((c) => { c.axes.env.versions.v1.entries = ['dev', 'prod', 'qa']; }), 2);
    const lookup = (digest: string) => (digest === producer.digest ? producer : undefined);
    const layout = resolveDecodeLayout({ ref: producer, prefixId: 'svc', version: 'v1' }, target, lookup);
    expect(layout.dims[0].entries).toEqual(['dev', 'prod', 'qa']);
  });
});

describe('assertAddressInLayout', () => {
  it('[0, totalSpace) 안의 정수만 허용한다', async () => {
    const layout = (await snapshotOf(SNAPSHOT_FIXTURE)).layouts[prefixLayoutKey('svc', 'v1')];
    expect(() => assertAddressInLayout(layout, 11)).not.toThrow();
    expect(() => assertAddressInLayout(layout, 11n)).not.toThrow();
    for (const bad of [12, -1, 1.5, Number.NaN, 12n, -1n]) {
      expectCode(() => assertAddressInLayout(layout, bad), 'AddressOutOfRange');
    }
  });

  it('2^53 초과 layout을 number 주소로 검사하면 StrideOverflow', async () => {
    const wide = patched((c) => {
      c.axes.big = { id: 'big', name: 'big', versions: { v1: { entries: ['a'], capacity: 2 ** 20 } } };
      c.prefixes.huge = {
        id: 'huge',
        name: 'huge',
        labels: ['x', 'y', 'z'],
        dims: { x: { kind: 'axis', axisId: 'big' }, y: { kind: 'axis', axisId: 'big' }, z: { kind: 'axis', axisId: 'big' } },
        versions: [{ version: 'v1', axisVersions: { x: 'v1', y: 'v1', z: 'v1' } }],
      };
    });
    const layout = (await snapshotOf(wide)).layouts[prefixLayoutKey('huge', 'v1')];
    expect(layout.safePrecision).toBe(false);
    expect(layout.totalSpace).toBe(String(2n ** 60n));
    expectCode(() => assertAddressInLayout(layout, 1), 'StrideOverflow');
    expect(() => assertAddressInLayout(layout, 2n ** 59n)).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/resolve-decode-layout.test.ts`
Expected: FAIL — `resolveDecodeLayout is not a function` 계열 (export 없음)

- [ ] **Step 3: 구현 (`compatibility.ts` 뒤에 추가)**

```ts
/**
 * decode 판정에 필요한 생성 문맥. snapshotVersion은 registry가 발급하는 표시용 순번이라
 * codegen 시점에 알 수 없으므로 판정 입력에서 제외한다 (식별은 digest).
 */
export type SnapshotIdentity = Pick<CatalogSnapshotRef, 'catalogId' | 'digest' | 'codecVersion'>;

export interface DecodeLayoutRequest {
  /** 주소를 생성한 snapshot 문맥 (wire에서 받은 값이면 codecVersion은 임의 문자열일 수 있다) */
  readonly ref: SnapshotIdentity;
  readonly prefixId: string;
  readonly version: string;
}

/** digest → snapshot 조회 (registry read-through cache 등). 없으면 undefined */
export type SnapshotLookup = (digest: string) => CatalogSnapshot | undefined;

/**
 * 주소의 생성 문맥(ref)을 target snapshot으로 decode해도 되는지 판정하고 사용할 layout을 돌려준다.
 * migration map 없는 best-effort decode는 허용하지 않는다.
 */
export function resolveDecodeLayout(
  request: DecodeLayoutRequest,
  target: CatalogSnapshot,
  lookup: SnapshotLookup,
): PrefixLayout {
  const { ref, prefixId, version } = request;
  if (!isSupportedCodecVersion(ref.codecVersion) || ref.codecVersion !== target.codecVersion) {
    throw new CodecContractError('UnsupportedCodecVersion', `지원하지 않는 codec: ${ref.codecVersion}`, {
      codecVersion: ref.codecVersion,
      targetCodecVersion: target.codecVersion,
    });
  }
  if (ref.catalogId !== target.catalogId) {
    throw new CodecContractError('CatalogMismatch', `catalog가 다릅니다: ${ref.catalogId} ≠ ${target.catalogId}`, {
      catalogId: ref.catalogId,
      targetCatalogId: target.catalogId,
    });
  }

  const key = prefixLayoutKey(prefixId, version);
  const targetLayout = target.layouts[key];
  if (!targetLayout) {
    throw new CodecContractError('UnknownPrefix', `target snapshot에 layout이 없습니다: ${key}`, {
      key,
      digest: target.digest,
    });
  }
  if (ref.digest === target.digest) return targetLayout;

  const producer = lookup(ref.digest);
  if (!producer) {
    throw new CodecContractError('UnknownCatalogSnapshot', `생성 snapshot을 찾을 수 없습니다: ${ref.digest}`, {
      digest: ref.digest,
    });
  }
  if (producer.catalogId !== target.catalogId) {
    throw new CodecContractError('CatalogMismatch', `생성 snapshot의 catalog가 다릅니다: ${producer.catalogId}`, {
      catalogId: producer.catalogId,
      targetCatalogId: target.catalogId,
    });
  }
  const producerLayout = producer.layouts[key];
  if (!producerLayout) {
    throw new CodecContractError('UnknownPrefix', `생성 snapshot에 layout이 없습니다: ${key}`, {
      key,
      digest: producer.digest,
    });
  }

  const change = classifyLayoutChange(producerLayout, targetLayout);
  if (change.kind === 'breaking') {
    throw new CodecContractError('MigrationRequired', `${key} layout이 호환되지 않습니다 (${change.reason})`, {
      key,
      reason: change.reason,
      label: change.label,
      fromDigest: producer.digest,
      toDigest: target.digest,
    });
  }
  return targetLayout;
}

/** 주소가 layout 주소 공간 [0, totalSpace) 안의 정수인지 검사한다 */
export function assertAddressInLayout(layout: PrefixLayout, address: number | bigint): void {
  const key = prefixLayoutKey(layout.prefixId, layout.version);
  if (typeof address === 'number') {
    if (!Number.isSafeInteger(address) || address < 0) {
      throw new CodecContractError('AddressOutOfRange', `${key} 주소는 0 이상의 안전한 정수여야 합니다: ${address}`, {
        key,
        address,
      });
    }
    if (!layout.safePrecision) {
      throw new CodecContractError('StrideOverflow', `${key} 주소 공간이 2^53을 넘습니다 — bigint 주소를 사용하세요`, {
        key,
        totalSpace: layout.totalSpace,
      });
    }
  }
  const value = BigInt(address);
  if (value < 0n || value >= BigInt(layout.totalSpace)) {
    throw new CodecContractError('AddressOutOfRange', `${key} 주소는 [0, ${layout.totalSpace}) 범위여야 합니다: ${value}`, {
      key,
      address: String(value),
      totalSpace: layout.totalSpace,
    });
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/`
Expected: PASS (Task 1~5 전체)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/snapshot/compatibility.ts packages/core/src/catalog/snapshot/resolve-decode-layout.test.ts
git commit -m "feat(core): snapshot 기반 decode 판정과 주소 범위 검사 추가"
```

---

### Task 6: Export·빌드·ADR

**Files:**
- Create: `packages/core/src/catalog/snapshot/index.ts`
- Modify: `packages/core/src/catalog/index.ts` (파일 끝에 블록 추가)
- Modify: `packages/core/src/index.ts` (`./catalog/runtime.js` export 블록 다음)
- Modify: `docs/architecture-decisions.md` (파일 끝에 ADR-010)

- [ ] **Step 1: sub-barrel 작성**

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export { canonicalJson } from './canonical-json.js';
export {
  CATALOG_DIGEST_ALGORITHM,
  sha256Hex,
  digestCanonical,
  computeCatalogDigest,
  shortDigest,
} from './digest.js';
export {
  CODEC_ERROR_CODES,
  CodecContractError,
  isCodecContractError,
  type CodecErrorCode,
} from './codec-errors.js';
export {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  LEGACY_V1_CODEC,
  SUPPORTED_CODEC_VERSIONS,
  isSupportedCodecVersion,
  prefixLayoutKey,
  type CodecVersion,
  type PrefixLayoutKey,
  type DimensionLayout,
  type PrefixLayout,
  type CatalogSnapshotRef,
  type CatalogSnapshot,
  type SnapshotLayoutIssue,
  type CatalogSnapshotBuildResult,
  type BuildCatalogSnapshotOptions,
} from './catalog-snapshot.types.js';
export { buildCatalogSnapshot } from './build-snapshot.js';
export {
  classifyLayoutChange,
  findUnversionedBreakingChanges,
  resolveDecodeLayout,
  assertAddressInLayout,
  type LayoutBreakingReason,
  type LayoutChange,
  type UnversionedBreakingChange,
  type DecodeLayoutRequest,
  type SnapshotLookup,
  type SnapshotIdentity,
} from './compatibility.js';
```

`__fixtures__/`는 export하지 않는다.

- [ ] **Step 2: barrel 연결**

`packages/core/src/catalog/index.ts` 끝에:

```ts
// ── Catalog Snapshot (좌표 문맥 binding, ADR-010) ─────────────
export * from './snapshot/index.js';
```

`packages/core/src/index.ts`의 `} from './catalog/runtime.js';` 다음 줄에:

```ts
export * from './catalog/snapshot/index.js';
```

- [ ] **Step 3: 빌드·타입·전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter @qa-sdk/core typecheck && corepack pnpm --filter @qa-sdk/core test 2>&1 | tail -5
```

Expected: 모두 성공. root barrel에 같은 이름이 이미 있으면 tsc가 `Module ... has already exported a member` 오류를 낸다 — Task 0 Step 2에서 0건이었으므로 발생하면 보고한다.

- [ ] **Step 4: 소비자 smoke (browser 번들 안전성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "node:" packages/core/src/catalog/snapshot/ ; corepack pnpm --filter @qa-sdk/browser build 2>&1 | tail -3
```

Expected: grep 결과 0줄, browser-sdk 빌드 성공.

- [ ] **Step 5: ADR-010 추가**

`docs/architecture-decisions.md` 끝에 기존 ADR 형식(결정/배경/구조/규칙)으로 추가:

```markdown
## ADR-010: Coordinate Context Binding (CatalogSnapshot)

### 결정

정수 주소의 의미는 `(catalogId, snapshot digest, codecVersion, prefix, version)` 문맥으로만 해석한다. 문맥 없이 숫자만으로 decode하지 않는다.

### 배경

SDK(capacity 기준 stride)와 DecodeMap(entries 기준 stride)이 같은 주소를 서로 다른 값으로 해석했고, 실패 시 `null`·일반 `Error`·조용한 skip이 섞여 있었다. (`docs/proposals/swc-next-qa-sdk-optimization/` R-1)

### 구조

- `@qa-sdk/core` `catalog/snapshot/`: `CatalogSnapshot`, `PrefixLayout`, `buildCatalogSnapshot`, `resolveDecodeLayout`, `CodecContractError`
- digest: RFC 8785 부분집합 canonical JSON + SHA-256(WebCrypto), `sha256:<64 hex>`
- layout 호환: 같은 dim 순서·kind·source·capacity에서 entry append만 호환

### 규칙

- `documentVersion`(문서), `snapshotVersion`(catalog), `codecVersion`(wire ABI), `analyzerVersion`은 서로 다른 축이다
- 같은 prefix version 안의 breaking layout 변경은 금지 — `findUnversionedBreakingChanges`가 비어 있어야 snapshot을 발행한다
- 실패는 `CodecContractError.code` 9종으로만 표현한다. `null` 반환·조용한 skip은 신규 코드에서 금지
```

- [ ] **Step 6: def 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | tail -3
```

Expected: `검증 통과 (경고 0건)`

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/catalog/snapshot/index.ts packages/core/src/catalog/index.ts packages/core/src/index.ts docs/architecture-decisions.md
git commit -m "feat(core): CatalogSnapshot 계약 export와 ADR-010 추가"
```
