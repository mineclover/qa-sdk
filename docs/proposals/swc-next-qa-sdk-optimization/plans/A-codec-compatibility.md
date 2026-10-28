# Track A — Codec 호환성·legacy-v1 Golden Corpus·Shape 정합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 catalog에서 core runtime·DecodeMap(registry/decode-service)·browser-codec이 같은 주소를 같은 값으로 해석하게 만들고, 현재 동작을 `legacy-v1` golden corpus로 고정한다.

**Architecture:** T0의 `PrefixLayout`을 유일한 shape 정본으로 삼는다(D-1 확정: capacity). DecodeMap은 `PrefixLayout`에서 파생하고 headroom 슬롯을 `(reserved:N)` entry로 채워 `validateDecodeMap`의 `shape === entries.length` 계약을 유지한다. 3-way parity 테스트가 먼저 실패하고(R-1 재현), 수정 후 통과한다. corpus는 JSON 파일로 저장해 Node·browser 양쪽 테스트가 같은 입력을 읽는다.

**Tech Stack:** TypeScript, vitest, `@qa-sdk/core` snapshot 모듈(T0), `index-meta` `PrefixDecoder`, `@qa-sdk/browser-codec`

**Spec:** [README](../README.md) R-1·R-11, D-1·D-8 / [01-tracks.md](../01-tracks.md) §3 / Drive 원본 Phase 0 "golden fixture", Phase 1 "검증", §8.2 differential

## Global Constraints

- 착수 조건: T0 머지, D-8 확정 (D-1은 2026-10-28 capacity로 확정). D-8 확정안이 권장안과 다르면 Task 2를 다시 쓴다
- T0 머지 후 `packages/core/src/catalog/snapshot/**` 소유권은 Track A로 넘어온다 ([01-tracks.md](../01-tracks.md) §3.1)
- 라이브러리(`index-meta`, `weighted-index`)는 `@qa-sdk/core`를 import하지 않는다 (의존 방향: 플랫폼 → 인코딩 라이브러리)
- 테스트의 prefix 목록·개수는 `DEMO_CATALOG`/snapshot에서 파생. 하드코딩 금지
- headroom 표기는 core runtime의 `(reserved:N)` 하나로 통일
- 신규 코드의 decode 실패는 `CodecContractError`로 표현. `null` 반환 API는 기존 공개 API 호환을 위해 유지하되 내부에서 판정 함수를 거친다
- `decode-map.service.test.ts`의 "uses actual entries length for shape" 테스트는 확정된 D-1(capacity)과 정면으로 충돌한다. 이 테스트를 바꾸는 것은 의도된 변경이며 PR 본문에 근거(R-1 재현 결과)를 적는다

## Review Focus

1. **headroom position을 가진 주소** (`entries.length ≤ position < capacity`) → 모든 구현이 `(reserved:N)`으로 decode, 오류나 다른 entry가 아님. 테스트: Task 3 corpus에 headroom 케이스 포함.
2. **prefix_ref dim을 가진 prefix** → refEntries 값 position 기준으로 세 구현 일치. 테스트: Task 3 parity가 모든 layout을 순회.
3. **`"service:v1:"`, `"service:v1:1.5"`, `"service:v1:0x1f"`** → strict 파서가 거부 (`AddressOutOfRange`가 아닌 parse 실패). 테스트: Task 5 Step 1.
4. **4-part `catalogId:prefix:version:address`** → 세 파서가 같은 의미로 해석. 테스트: Task 5 Step 1.
5. **v1 주소가 저장된 dim-추가 prefix(R-11)** → D-8 적용 후 v1 layout 복원, 기존 v1 주소 decode 가능. 테스트: Task 2 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/demo-tests/src/codec-compat/catalog-snapshot.test.ts` (신규) | DEMO_CATALOG 전수 snapshot 빌드·catalog lint |
| `packages/demo-tests/src/codec-compat/three-way-parity.test.ts` (신규) | core ↔ DecodeMap ↔ browser-codec 동치 |
| `packages/demo-tests/src/codec-compat/legacy-v1-corpus.test.ts` (신규) | corpus 재생성·대조 |
| `packages/demo-tests/src/codec-compat/corpus.ts` (신규) | corpus 생성 함수 (결정론적) |
| `fixtures/coordinate-compatibility/legacy-v1/demo.json` (신규) | golden corpus |
| `packages/demo-tests/package.json` | devDependencies에 `@qa-sdk/core`, `@qa-sdk/browser-codec` 추가 |
| `packages/core/src/catalog/catalog.types.ts` | `PrefixVersionDef.labels?` (D-8) |
| `packages/core/src/catalog/runtime.ts` | version별 labels 사용, typed error 전환 |
| `packages/core/src/catalog/snapshot/build-snapshot.ts` | version별 labels 사용 |
| `packages/core/src/catalog/snapshot/decode-map.ts` (신규) | `layoutToDecodeMap(layout)` — DecodeMap 정본 빌더 |
| `packages/demo-snapshot/src/demo-catalog.ts` | R-11 prefix 3개의 v1 `labels` 선언 |
| `packages/registry-service/src/modules/catalog/decode-map.service.ts` (+test) | `layoutToDecodeMap` 사용 |
| `packages/decode-service/src/worker.ts` | `layoutToDecodeMap` 사용 |
| `packages/browser-codec/src/browser-codec.ts` | headroom 표기 통일, `BrowserCatalog` 타입 core import (D 머지 후) |
| `packages/core/src/lib/address-parser.ts` | strict 숫자 검증 |
| `packages/core/src/coordinates/address-context-schema.ts` | `parsePackedAddress`를 strict 파서에 위임 |
| `packages/context/src/catalog-provider.ts`, `packages/dkg/src/resolve.ts` | `latestPrefixVersion` 재구현 제거 |
| `docs/specs/system/coordinate-storage.rule.md` | snapshot binding·headroom 표기 규칙 추가 |

**Interfaces:**
- Consumes (T0): `buildCatalogSnapshot`, `PrefixLayout`, `prefixLayoutKey`, `CodecContractError`, `isCodecContractError`, `assertAddressInLayout`
- Produces:

```ts
// packages/core/src/catalog/snapshot/decode-map.ts
export interface LayoutDecodeMap {
  readonly indexId: string;
  readonly versionId: string;
  readonly dims: readonly {
    readonly dimId: string;
    readonly snapshotId: string;
    readonly kind: { readonly type: 'string_enum' } | { readonly type: 'index_ref'; readonly indexId: string };
    readonly entries: readonly string[];
  }[];
  readonly shape: readonly number[];
  readonly size: number;
}
export const RESERVED_ENTRY_PREFIX: '(reserved:';
export function reservedEntryLabel(position: number): string; // '(reserved:7)'
export function layoutToDecodeMap(layout: PrefixLayout): LayoutDecodeMap;
// corpus
export interface LegacyCorpusCase { readonly key: PrefixLayoutKey; readonly positions: Readonly<Record<string, number>>; readonly address: number; readonly serialized: string; readonly values: Readonly<Record<string, string | number>> }
export interface LegacyCorpus { readonly codecVersion: 'legacy-v1'; readonly catalogId: string; readonly catalogDigest: string; readonly cases: readonly LegacyCorpusCase[] }
export function buildLegacyCorpus(catalog: Catalog): Promise<LegacyCorpus>;
```

---

### Task 0: Baseline·전제 재확인

- [ ] **Step 1: 영향 패키지 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && for p in @qa-sdk/core @qa-sdk/browser-codec @qa-sdk/registry-service @qa-sdk/decode-service index-meta @qa-sdk/demo-tests; do echo "== $p"; corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL" | tail -2; done
```

Expected: 모두 PASS. 실패가 있으면 기록하고 이 트랙 변경과 무관함을 확인한 뒤 진행.

- [ ] **Step 2: R-1 재현 수치 기록**

`docs/proposals/swc-next-qa-sdk-optimization/00-code-inventory.md` §1.1의 `service` 재현값(`33825` → `env=528`)이 현재 HEAD에서도 같은지 Task 3의 parity 테스트(수정 전)로 확인한다. 별도 스크립트는 만들지 않는다.

---

### Task 1: DEMO_CATALOG 전수 snapshot 테스트 (실패로 시작)

**Files:**
- Modify: `packages/demo-tests/package.json`
- Create: `packages/demo-tests/src/codec-compat/catalog-snapshot.test.ts`

- [ ] **Step 1: devDependency 추가**

`packages/demo-tests/package.json` `devDependencies`에 `"@qa-sdk/core": "workspace:*"`, `"@qa-sdk/browser-codec": "workspace:*"`를 추가하고 `corepack pnpm install`.

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
import { buildCatalogSnapshot, findUnversionedBreakingChanges } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';

describe('DEMO_CATALOG snapshot', () => {
  it('모든 prefix version이 layout을 가진다', async () => {
    const { snapshot, issues } = await buildCatalogSnapshot(DEMO_CATALOG, { snapshotVersion: 1, parentDigest: null });
    expect(issues).toEqual([]);
    const versionCount = Object.values(DEMO_CATALOG.prefixes).reduce((n, p) => n + p.versions.length, 0);
    expect(Object.keys(snapshot.layouts)).toHaveLength(versionCount);
  });

  it('모든 축 version의 entries 수가 capacity 이하이다', () => {
    const over = Object.values(DEMO_CATALOG.axes).flatMap((axis) =>
      Object.entries(axis.versions)
        .filter(([, snap]) => snap.capacity !== undefined && snap.entries.length > snap.capacity)
        .map(([v]) => `${axis.id}@${v}`),
    );
    expect(over).toEqual([]);
  });

  it('같은 입력의 snapshot은 자기 자신과 breaking 변경이 없다', async () => {
    const { snapshot } = await buildCatalogSnapshot(DEMO_CATALOG, { snapshotVersion: 1, parentDigest: null });
    expect(findUnversionedBreakingChanges(snapshot, snapshot)).toEqual([]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/catalog-snapshot.test.ts`
Expected: 첫 테스트 FAIL — issues에 `build_event@v1`, `test_event@v1`, `pattern_anomaly@v1` (R-11). 나머지 PASS. 다른 key가 나오면 00-code-inventory R-11을 갱신한다.

- [ ] **Step 4: Commit (실패 테스트는 `it.fails`로 표시해 CI를 깨지 않는다)**

첫 테스트를 `it.fails('모든 prefix version이 layout을 가진다 (R-11, Task 2에서 해소)', …)`로 바꾸고 커밋한다.

```bash
git add packages/demo-tests/package.json packages/demo-tests/src/codec-compat/catalog-snapshot.test.ts pnpm-lock.yaml
git commit -m "test(demo-tests): DEMO_CATALOG 전수 snapshot 검증 추가 (R-11 재현)"
```

---

### Task 2: 버전별 dim 목록 (D-8)

**Files:**
- Modify: `packages/core/src/catalog/catalog.types.ts:71` (`PrefixVersionDef`)
- Modify: `packages/core/src/catalog/runtime.ts` (`getFixedLabels` 호출부 전부)
- Modify: `packages/core/src/catalog/snapshot/build-snapshot.ts`
- Modify: `packages/demo-snapshot/src/demo-catalog.ts` (`build_event`, `test_event`, `pattern_anomaly`)
- Test: `packages/core/src/catalog/runtime-boundary.test.ts`에 케이스 추가

- [ ] **Step 1: 실패하는 runtime 테스트 추가**

```ts
it('버전별 labels가 있으면 그 버전의 고정 차원만 사용한다 (D-8)', () => {
  const catalog = {
    id: 'c', name: 'c',
    axes: {
      env: { id: 'env', name: 'env', versions: { v1: { entries: ['dev', 'prod'] } } },
      mod: { id: 'mod', name: 'mod', versions: { v1: { entries: ['a', 'b', 'c'] } } },
    },
    prefixes: {
      p: {
        id: 'p', name: 'p', labels: ['env', 'mod'],
        dims: { env: { kind: 'axis', axisId: 'env' }, mod: { kind: 'axis', axisId: 'mod' } },
        versions: [
          { version: 'v1', labels: ['env'], axisVersions: { env: 'v1' } },
          { version: 'v2', axisVersions: { env: 'v1', mod: 'v1' } },
        ],
      },
    },
  } as const satisfies Catalog;
  expect(getPrefixShape(catalog, 'p', 'v1').shape).toEqual([2]);
  expect(getPrefixShape(catalog, 'p', 'v2').shape).toEqual([2, 3]);
  expect(decodePrefix(catalog, 'p', 'v1', 1)).toEqual({ env: { position: 1, value: 'prod' } });
});
```

Run: `corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/runtime-boundary.test.ts`
Expected: FAIL — `labels`가 타입에 없음 / `Unknown axis version: mod@undefined`

- [ ] **Step 2: 타입과 helper 구현**

`catalog.types.ts` `PrefixVersionDef`에 추가:

```ts
  /** 이 버전의 차원 목록. 미선언 시 PrefixDef.labels. 버전마다 dim 구성이 다를 때 선언한다 (D-8) */
  readonly labels?: readonly string[];
```

`runtime.ts`의 `getFixedLabels(prefix)`를 version 인자를 받는 형태로 바꾼다:

```ts
function getFixedLabels(
  prefix: { labels: readonly string[]; dims: Record<string, DimRef> },
  versionDef?: { labels?: readonly string[] },
): string[] {
  const labels = versionDef?.labels ?? prefix.labels;
  return labels.filter((l) => prefix.dims[l].kind !== 'table_ref');
}
```

`getFixedLabels`를 호출하는 모든 함수(`getPrefixShape`, `encodePrefix`, `decodePrefix`, `decodePrefixPartial`, `encodePrefixByValue`, `decomposeAddress`, `getPrefixProfile` 등)에서 이미 찾은 `vdef`를 두 번째 인자로 넘긴다. `getPrefixEntries`의 `for (const label of prefix.labels)`도 `vdef.labels ?? prefix.labels`로 바꾼다. `grep -n "prefix.labels\|getFixedLabels(" packages/core/src/catalog/runtime.ts`로 누락이 없는지 확인한다.

`build-snapshot.ts` `buildPrefixLayout`의 `for (const label of prefix.labels)`를 `for (const label of versionDef.labels ?? prefix.labels)`로 바꾼다.

- [ ] **Step 3: demo catalog 선언 보완**

`packages/demo-snapshot/src/demo-catalog.ts`에서 세 prefix의 v1 version 객체에 실제 v1 dim 목록을 선언한다. v1 `axisVersions`에 있는 label이 v1 dim이다:

- `build_event` v1: `labels: ['qa_pkg', 'build_result']`
- `test_event` v1: `labels: ['qa_pkg', 'test_result']`
- `pattern_anomaly` v1: `labels: ['svc_ref', 'behavior_pattern']` — `svc_ref`는 prefix_ref이므로 v1 `refEntries`에 `svc_ref`가 있는지 확인하고, 없으면 `labels: ['behavior_pattern']`로 두고 PR에 근거를 남긴다

- [ ] **Step 4: 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && corepack pnpm --filter demo-snapshot build && corepack pnpm --filter @qa-sdk/core test && corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/
```

Expected: runtime 테스트 PASS. Task 1의 `it.fails` 테스트가 이제 통과하므로 vitest가 "expected to fail"로 FAIL을 보고한다 → `it.fails`를 `it`으로 되돌린다. 다시 실행해 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/catalog.types.ts packages/core/src/catalog/runtime.ts packages/core/src/catalog/runtime-boundary.test.ts packages/core/src/catalog/snapshot/build-snapshot.ts packages/demo-snapshot/src/demo-catalog.ts packages/demo-tests/src/codec-compat/catalog-snapshot.test.ts
git commit -m "feat(core): prefix version별 dim 목록 지원 (D-8, R-11 해소)"
```

---

### Task 3: 3-way parity + DecodeMap 정본 빌더 (R-1 해소)

**Files:**
- Create: `packages/core/src/catalog/snapshot/decode-map.ts` (+ `decode-map.test.ts`)
- Create: `packages/demo-tests/src/codec-compat/three-way-parity.test.ts`
- Modify: `packages/registry-service/src/modules/catalog/decode-map.service.ts` (+test)
- Modify: `packages/decode-service/src/worker.ts`
- Modify: `packages/browser-codec/src/browser-codec.ts` (headroom 표기)

- [ ] **Step 1: 실패하는 parity 테스트 작성**

positions는 layout에서 파생한다: 각 dim에 대해 `0`, `entries.length - 1`(마지막 실제 entry), `capacity - 1`(headroom, `capacity > entries.length`일 때만).

```ts
import { buildCatalogSnapshot, decodePrefix, encodePrefix, flattenForBrowser, type PrefixLayout } from '@qa-sdk/core';
import { decode as browserDecode } from '@qa-sdk/browser-codec';
import { DecodeMapService } from '@qa-sdk/registry-service/src/modules/catalog/decode-map.service.js';
import { PrefixDecoder } from 'index-meta';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';

function samplePositions(layout: PrefixLayout): Record<string, number>[] {
  const pick = (f: (d: PrefixLayout['dims'][number]) => number) =>
    Object.fromEntries(layout.dims.map((d) => [d.label, Math.max(0, f(d))]));
  const samples = [pick(() => 0), pick((d) => d.entries.length - 1)];
  if (layout.dims.some((d) => d.capacity > d.entries.length)) samples.push(pick((d) => d.capacity - 1));
  return samples;
}

const DEMO_STORE = {
  register: async () => undefined,
  get: async () => ({
    id: DEMO_CATALOG.id,
    data: JSON.stringify(DEMO_CATALOG),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
  list: async () => [],
  update: async () => undefined,
  delete: async () => undefined,
};

describe('3-way parity: core runtime ↔ DecodeMap ↔ browser-codec', async () => {
  const { snapshot } = await buildCatalogSnapshot(DEMO_CATALOG, { snapshotVersion: 1, parentDigest: null });
  const product = Object.values(snapshot.layouts).filter((l) => l.addressModel === 'product' && l.safePrecision);
  const maps = await new DecodeMapService(DEMO_STORE).list(DEMO_CATALOG.id);
  const browserCatalog = flattenForBrowser(DEMO_CATALOG);

  it.each(product.map((l) => [`${l.prefixId}@${l.version}`, l] as const))('%s', (_key, layout) => {
    const map = maps.find((m) => m.indexId === layout.prefixId && m.versionId === layout.version);
    expect(map, 'DecodeMap 누락').toBeDefined();
    const decoder = new PrefixDecoder({ map: map! });
    for (const positions of samplePositions(layout)) {
      const address = encodePrefix(DEMO_CATALOG, layout.prefixId, layout.version, positions);
      const core = Object.fromEntries(
        Object.entries(decodePrefix(DEMO_CATALOG, layout.prefixId, layout.version, address)).map(([k, v]) => [k, String(v.value)]),
      );
      const viaMap = Object.fromEntries(Object.entries(decoder.decode(address)).map(([k, v]) => [k, String(v)]));
      expect(viaMap).toEqual(core);
      // browser catalog은 prefix마다 최신 version 하나만 담는다
      if (browserCatalog[layout.prefixId]?.version === layout.version) {
        const viaBrowser = browserDecode(browserCatalog, `${layout.prefixId}:${layout.version}:${address}`);
        expect(viaBrowser && Object.fromEntries(Object.entries(viaBrowser.values).map(([k, v]) => [k, String(v)]))).toEqual(core);
      }
    }
  });
});
```

`DEMO_STORE`는 `decode-map.service.test.ts`의 in-memory `CatalogStore` 패턴과 같다. `CatalogStore` record 필드가 더 있으면 그 테스트 파일의 `record`를 따른다. `PrefixDecoderConfig`에 `map` 외 필수 필드가 있으면 `packages/index-meta/src/prefix-decoder.ts`의 config 타입을 확인해 채운다. registry-service가 `DecodeMapService`를 root export하지 않으면 상대 경로 대신 `packages/registry-service/package.json` `exports`에 sub-path를 추가하지 말고, 테스트를 `packages/registry-service/src/modules/catalog/` 안의 parity 테스트로 옮긴다 (registry-service가 demo-snapshot을 devDependency로 갖는지 먼저 확인).

Run: `corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/three-way-parity.test.ts`
Expected: 대부분 FAIL — DecodeMap 경로 값 불일치(R-1). 예: `service@v1`에서 `env` 불일치.

- [ ] **Step 2: DecodeMap 정본 빌더 (core) — 테스트 먼저**

`decode-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey } from './catalog-snapshot.types.js';
import { layoutToDecodeMap, reservedEntryLabel } from './decode-map.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

describe('layoutToDecodeMap', () => {
  it('shape는 capacity이고 headroom은 reserved entry로 채운다', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, { snapshotVersion: 1, parentDigest: null });
    const map = layoutToDecodeMap(snapshot.layouts[prefixLayoutKey('svc', 'v1')]);
    expect(map.shape).toEqual([4, 3]);
    expect(map.size).toBe(12);
    expect(map.dims[0].entries).toEqual(['dev', 'prod', reservedEntryLabel(2), reservedEntryLabel(3)]);
    expect(reservedEntryLabel(2)).toBe('(reserved:2)');
    expect(map.dims.every((d, i) => d.entries.length === map.shape[i])).toBe(true);
  });
});
```

`decode-map.ts`:

```ts
// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { PrefixLayout } from './catalog-snapshot.types.js';
import { CodecContractError } from './codec-errors.js';

/** core runtime decodePrefix의 headroom 표기와 같은 형식 */
export const RESERVED_ENTRY_PREFIX = '(reserved:' as const;

export function reservedEntryLabel(position: number): string {
  return `${RESERVED_ENTRY_PREFIX}${position})`;
}

/** index-meta DecodeMap과 구조적으로 호환되는 입력 (core는 index-meta에 의존하지 않는다) */
export interface LayoutDecodeMap {
  readonly indexId: string;
  readonly versionId: string;
  readonly dims: readonly {
    readonly dimId: string;
    readonly snapshotId: string;
    readonly kind: { readonly type: 'string_enum' } | { readonly type: 'index_ref'; readonly indexId: string };
    readonly entries: readonly string[];
  }[];
  readonly shape: readonly number[];
  readonly size: number;
}

/** PrefixLayout → DecodeMap. shape는 capacity, headroom은 reserved entry (D-1) */
export function layoutToDecodeMap(layout: PrefixLayout): LayoutDecodeMap {
  if (!layout.safePrecision) {
    throw new CodecContractError('StrideOverflow', `${layout.prefixId}@${layout.version}는 number DecodeMap으로 표현할 수 없습니다`, {
      totalSpace: layout.totalSpace,
    });
  }
  const dims = layout.dims.map((dim) => {
    const entries = Array.from({ length: dim.capacity }, (_, pos) =>
      pos < dim.entries.length ? String(dim.entries[pos]) : reservedEntryLabel(pos),
    );
    return dim.kind === 'axis'
      ? { dimId: dim.label, snapshotId: `${dim.sourceId}_${dim.sourceVersion}`, kind: { type: 'string_enum' as const }, entries }
      : { dimId: dim.label, snapshotId: `ref_${dim.sourceId}`, kind: { type: 'index_ref' as const, indexId: dim.sourceId }, entries };
  });
  return {
    indexId: layout.prefixId,
    versionId: layout.version,
    dims,
    shape: layout.dims.map((d) => d.capacity),
    size: Number(layout.totalSpace),
  };
}
```

`snapshot/index.ts`에 `export { layoutToDecodeMap, reservedEntryLabel, RESERVED_ENTRY_PREFIX, type LayoutDecodeMap } from './decode-map.js';` 추가.

Run: `corepack pnpm --filter @qa-sdk/core exec vitest run src/catalog/snapshot/decode-map.test.ts` → PASS

- [ ] **Step 3: registry·decode-service를 정본 빌더로 교체**

- `DecodeMapService.buildDecodeMap`(:75)의 dim 루프 전체를 제거하고, `requireCatalog`로 읽은 catalog에서 `buildCatalogSnapshot`을 한 번 만든 뒤 `layoutToDecodeMap(snapshot.layouts[prefixLayoutKey(prefixId, versionId)])`를 반환한다. layout이 없으면 기존처럼 `null`을 반환하되 `logger.warn({ key, issue }, 'DecodeMap layout 없음')`으로 snapshot `issues`의 메시지를 남긴다.
- `decode-map.service.test.ts`의 "uses actual entries length…" 테스트를 "shape는 capacity, headroom은 reserved entry" 테스트로 교체한다 (D-1, Global Constraints 참고).
- `packages/decode-service/src/worker.ts` `buildDecodeMaps`(:124)의 dim 루프도 같은 방식으로 교체한다. 하드코딩된 catalog id `'demo'`(:74)는 이 Task에서 건드리지 않는다(B 범위의 registry snapshot 조회로 대체 예정).
- `browser-codec.ts` decode의 headroom 표기 `(pos)`(:155)를 `(reserved:pos)`로 바꾸고 `smoke.test.ts`의 고정값을 갱신한다.

- [ ] **Step 4: parity 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && for p in @qa-sdk/core @qa-sdk/registry-service @qa-sdk/decode-service @qa-sdk/browser-codec; do corepack pnpm --filter $p build; done && corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/ && for p in @qa-sdk/registry-service @qa-sdk/decode-service @qa-sdk/browser-codec; do corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL"; done
```

Expected: parity 전부 PASS, 세 패키지 테스트 PASS. decode-service `app.test.ts`에 entries 기준으로 계산된 고정 주소가 있으면 해당 기대값을 core `encodePrefix` 결과로 바꾼다(하드코딩 대신 파생).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/catalog/snapshot packages/registry-service/src/modules/catalog packages/decode-service/src packages/browser-codec/src packages/demo-tests/src/codec-compat/three-way-parity.test.ts
git commit -m "fix(codec): DecodeMap shape를 capacity 기준으로 통일하고 3-way parity 추가 (R-1)"
```

---

### Task 4: legacy-v1 golden corpus

**Files:**
- Create: `packages/demo-tests/src/codec-compat/corpus.ts`
- Create: `packages/demo-tests/src/codec-compat/legacy-v1-corpus.test.ts`
- Create: `fixtures/coordinate-compatibility/legacy-v1/demo.json`
- Create: `fixtures/coordinate-compatibility/README.md`

- [ ] **Step 1: 실패하는 corpus 테스트 작성**

```ts
import { readFileSync } from 'node:fs';
import { decodePrefix } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import { buildLegacyCorpus, type LegacyCorpus } from './corpus.js';

const CORPUS_URL = new URL('../../../../fixtures/coordinate-compatibility/legacy-v1/demo.json', import.meta.url);

describe('legacy-v1 golden corpus', () => {
  it('저장된 corpus의 모든 주소가 현재 runtime에서 같은 값으로 decode된다', () => {
    const corpus = JSON.parse(readFileSync(CORPUS_URL, 'utf8')) as LegacyCorpus;
    expect(corpus.codecVersion).toBe('legacy-v1');
    for (const c of corpus.cases) {
      const [prefixId, version] = c.key.split('@');
      const decoded = decodePrefix(DEMO_CATALOG, prefixId, version, c.address);
      expect(Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.value]))).toEqual(c.values);
    }
  });

  it('corpus 생성은 결정론적이다', async () => {
    expect(await buildLegacyCorpus(DEMO_CATALOG)).toEqual(await buildLegacyCorpus(structuredClone(DEMO_CATALOG)));
  });
});
```

Run: `corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/legacy-v1-corpus.test.ts`
Expected: FAIL — `./corpus.js` 없음

- [ ] **Step 2: corpus 생성 함수 구현**

```ts
import {
  buildCatalogSnapshot,
  decodePrefix,
  encodePrefix,
  type Catalog,
  type PrefixLayout,
  type PrefixLayoutKey,
} from '@qa-sdk/core';

export interface LegacyCorpusCase {
  readonly key: PrefixLayoutKey;
  readonly positions: Readonly<Record<string, number>>;
  readonly address: number;
  readonly serialized: string;
  readonly values: Readonly<Record<string, string | number>>;
}

export interface LegacyCorpus {
  readonly codecVersion: 'legacy-v1';
  readonly catalogId: string;
  readonly catalogDigest: string;
  readonly cases: readonly LegacyCorpusCase[];
}

/** 경계값(0, 마지막 entry, headroom)과 dim별 단독 이동을 포함하는 결정론적 표본 */
function samplePositions(layout: PrefixLayout): Record<string, number>[] {
  const zero = Object.fromEntries(layout.dims.map((d) => [d.label, 0]));
  const samples: Record<string, number>[] = [zero];
  samples.push(Object.fromEntries(layout.dims.map((d) => [d.label, Math.max(0, d.entries.length - 1)])));
  for (const dim of layout.dims) {
    if (dim.entries.length > 1) samples.push({ ...zero, [dim.label]: dim.entries.length - 1 });
    if (dim.capacity > dim.entries.length) samples.push({ ...zero, [dim.label]: dim.capacity - 1 });
  }
  return samples;
}

export async function buildLegacyCorpus(catalog: Catalog): Promise<LegacyCorpus> {
  const { snapshot } = await buildCatalogSnapshot(catalog, { snapshotVersion: 1, parentDigest: null });
  const cases: LegacyCorpusCase[] = [];
  for (const key of Object.keys(snapshot.layouts).sort() as PrefixLayoutKey[]) {
    const layout = snapshot.layouts[key];
    if (layout.addressModel !== 'product' || !layout.safePrecision) continue;
    for (const positions of samplePositions(layout)) {
      const address = encodePrefix(catalog, layout.prefixId, layout.version, positions);
      const decoded = decodePrefix(catalog, layout.prefixId, layout.version, address);
      cases.push({
        key,
        positions,
        address,
        serialized: `${layout.prefixId}:${layout.version}:${address}`,
        values: Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.value])),
      });
    }
  }
  return { codecVersion: 'legacy-v1', catalogId: catalog.id, catalogDigest: snapshot.digest, cases };
}
```

`sum` 모델 prefix는 corpus에서 제외하고 README에 이유를 적는다(별도 path-summation 테스트 소유).

- [ ] **Step 3: corpus 파일 생성 (테스트 코드로 1회 기록)**

`legacy-v1-corpus.test.ts`에 환경변수 가드 테스트를 추가한다:

```ts
it.runIf(process.env.UPDATE_CORPUS === '1')('corpus 파일을 갱신한다', async () => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(new URL('.', CORPUS_URL), { recursive: true });
  writeFileSync(CORPUS_URL, `${JSON.stringify(await buildLegacyCorpus(DEMO_CATALOG), null, 2)}\n`);
});
```

Run: `cd /Users/junwoobang/workflow/qa-sdk && UPDATE_CORPUS=1 corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/legacy-v1-corpus.test.ts && corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/`
Expected: 파일 생성 후 전체 PASS.

`fixtures/coordinate-compatibility/README.md`에 적을 내용: corpus는 **현재 동작의 기록**이며 기대값의 정본이 아니다; 갱신은 `UPDATE_CORPUS=1`로만 하고 PR에 diff 사유를 적는다; catalog의 append-only 변경은 기존 case를 바꾸지 않아야 한다(바뀌면 breaking).

- [ ] **Step 4: Commit**

```bash
git add packages/demo-tests/src/codec-compat/corpus.ts packages/demo-tests/src/codec-compat/legacy-v1-corpus.test.ts fixtures/coordinate-compatibility
git commit -m "test(codec): legacy-v1 golden corpus 고정"
```

---

### Task 5: Strict 주소 파서 단일화

**Files:**
- Modify: `packages/core/src/lib/address-parser.ts` (+ `address-parser.test.ts`)
- Modify: `packages/core/src/coordinates/address-context-schema.ts` (+test)
- Modify: `packages/context/src/catalog-provider.ts:82,119`, `packages/dkg/src/resolve.ts:48`

- [ ] **Step 1: 실패하는 테스트 추가 (`address-parser.test.ts`)**

```ts
describe('parseSerializedAddress strict 숫자', () => {
  it.each(['service:v1:', 'service:v1:1.5', 'service:v1:0x1f', 'service:v1:1e3', 'service:v1:-1', 'service:v1: 3'])(
    '%s 는 거부한다',
    (input) => {
      expect(() => parseSerializedAddress(input)).toThrow();
    },
  );

  it('4-part는 catalogId:prefix:version:address로 해석하고 parsePackedAddress와 같은 결과를 낸다', () => {
    const strict = parseSerializedAddress('demo:service:v1:42');
    expect(strict).toMatchObject({ catalogId: 'demo', prefix: 'service', version: 'v1', address: 42 });
    expect(parsePackedAddress('demo:service:v1:42')).toMatchObject({ catalogId: 'demo', prefix: 'service', version: 'v1', address: 42 });
  });
});
```

(`ParsedAddress`/`ParsedPackedAddress`의 실제 필드명은 각 파일의 타입 선언을 따른다. 다르면 이 테스트의 키 이름을 맞추고, 두 타입의 필드명 차이는 00-code-inventory §1.2에 기록돼 있다.)

Run: `corepack pnpm --filter @qa-sdk/core exec vitest run src/lib/address-parser.test.ts` → FAIL (빈 문자열·소수 통과)

- [ ] **Step 2: 구현**

`address-parser.ts`의 숫자 변환을 `/^(0|[1-9]\d*)$/` 검사 후 `Number()`로 바꾸고, `Number.isSafeInteger`가 아니면 throw한다. `address-context-schema.ts`의 `parsePackedAddress`는 regex 대신 `parseSerializedAddress`를 try/catch로 감싸 `null`을 반환하도록 위임한다(공개 시그니처 유지).

`context/src/catalog-provider.ts`, `dkg/src/resolve.ts`의 `versions[versions.length - 1].version` 인라인을 `latestPrefixVersion(catalog, prefixId)` import로 교체한다.

- [ ] **Step 3: 통과·소비자 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/core build && for p in @qa-sdk/core @qa-sdk/context dkg @qa-sdk/ingest-server @qa-sdk/convergence spec-transition; do echo "== $p"; corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL" | tail -2; done
```

Expected: 모두 PASS. ingest-server에서 실패하면 저장된 `packed_key`에 strict 규칙을 어기는 값이 있는지 확인하고, 있으면 그 값을 corpus에 추가한 뒤 사람에게 보고한다(조용히 완화하지 않는다).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib packages/core/src/coordinates packages/context/src/catalog-provider.ts packages/dkg/src/resolve.ts
git commit -m "fix(core): 주소 파서 strict 숫자 검증과 단일 구현 위임"
```

---

### Task 6: 규칙 문서 갱신

**Files:**
- Modify: `docs/specs/system/coordinate-storage.rule.md`
- Modify: `docs/proposals/swc-next-qa-sdk-optimization/00-code-inventory.md` (X-3·X-4·X-5 상태)

- [ ] **Step 1:** `coordinate-storage.rule.md`에 절 추가 — "주소 shape는 capacity 기준(ADR-010)", "headroom decode 표기 `(reserved:N)`", "DecodeMap은 `layoutToDecodeMap`에서만 생성", "golden corpus 위치와 갱신 절차".
- [ ] **Step 2:** `node packages/cli/dist/index.js def sync && node packages/cli/dist/index.js def validate` → 경고 0.
- [ ] **Step 3: Commit** — `docs(spec): coordinate-storage에 snapshot binding·headroom 규칙 추가`
