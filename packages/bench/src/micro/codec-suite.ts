import {
  decodePrefix,
  encodePrefix,
  flattenForBrowser,
  latestPrefixVersion,
  newLogId,
  newSpanId,
  newTraceId,
  parseSerializedAddress,
  serializeAddress,
} from '@qa-sdk/core';
import type { Catalog, EventRecord } from '@qa-sdk/core';
import { decode as browserDecode, encode as browserEncode } from '@qa-sdk/browser-codec';
import { DEFAULT_BATCH_SIZE } from '@qa-sdk/logger';

/**
 * codec·envelope hot path microbench case 정의.
 *
 * 측정 대상은 이미 공개된 함수만 호출한다 (baseline은 "변경 전" 상태여야 한다).
 * 입력은 전부 인자로 받은 catalog에서 파생한다. prefix 개수·version을 하드코딩하지 않는다.
 */

export interface MicroCase {
  readonly id: string;
  readonly run: () => unknown;
}

/** browser-codec 대표 prefix. catalog에 없으면 첫 prefix를 쓴다 */
const PREFERRED_REPRESENTATIVE_PREFIX = 'service';

/**
 * envelope 직렬화 record 수.
 * 1건(단건 전송)과 logger 기본 batch 크기. logger의 buffer 상한(maxBufferSize 기본값)은
 * `@qa-sdk/logger`가 공개 export하지 않아 이 suite에서 파생할 수 없다 (benchmarks/README.md 참조).
 */
export const ENVELOPE_RECORD_COUNTS: readonly number[] = [...new Set([1, DEFAULT_BATCH_SIZE])];

/** run 호출 시 suite 생성 단계의 실패를 다시 던진다 → measureCase가 skipped로 기록 */
function failing(error: unknown): () => never {
  return () => {
    throw error;
  };
}

/** encode 가능한 차원(table_ref 제외)의 position을 모두 0으로 둔다 */
function zeroPositions(catalog: Catalog, prefixId: string): Record<string, number> {
  const prefix = catalog.prefixes[prefixId];
  const positions: Record<string, number> = {};
  for (const label of prefix.labels) {
    if (prefix.dims[label]?.kind !== 'table_ref') positions[label] = 0;
  }
  return positions;
}

function tryEncode(
  catalog: Catalog,
  prefixId: string,
  version: string,
  positions: Record<string, number>,
): { ok: true; address: number } | { ok: false; error: unknown } {
  try {
    return { ok: true, address: encodePrefix(catalog, prefixId, version, positions) };
  } catch (error) {
    return { ok: false, error };
  }
}

function pickRepresentativePrefix(catalog: Catalog): string {
  if (catalog.prefixes[PREFERRED_REPRESENTATIVE_PREFIX]) return PREFERRED_REPRESENTATIVE_PREFIX;
  const first = Object.keys(catalog.prefixes)[0];
  if (first === undefined) throw new Error('createCodecSuite: catalog에 prefix가 없다');
  return first;
}

function createPrefixCases(catalog: Catalog): MicroCase[] {
  const cases: MicroCase[] = [];
  for (const prefixId of Object.keys(catalog.prefixes)) {
    const version = latestPrefixVersion(catalog, prefixId);
    const positions = zeroPositions(catalog, prefixId);
    const encoded = tryEncode(catalog, prefixId, version, positions);
    cases.push({
      id: `core.encodePrefix/${prefixId}@${version}`,
      run: () => encodePrefix(catalog, prefixId, version, positions),
    });
    cases.push({
      id: `core.decodePrefix/${prefixId}@${version}`,
      run: encoded.ok
        ? () => decodePrefix(catalog, prefixId, version, encoded.address)
        : failing(encoded.error),
    });
  }
  return cases;
}

function createAddressParseCase(catalog: Catalog, prefixId: string): MicroCase {
  const version = latestPrefixVersion(catalog, prefixId);
  const encoded = tryEncode(catalog, prefixId, version, zeroPositions(catalog, prefixId));
  if (!encoded.ok) return { id: 'core.parseSerializedAddress', run: failing(encoded.error) };
  const serialized = serializeAddress({ prefix: prefixId, version, address: encoded.address });
  return { id: 'core.parseSerializedAddress', run: () => parseSerializedAddress(serialized) };
}

function createBrowserCodecCases(catalog: Catalog, prefixId: string): MicroCase[] {
  const encodeId = `browser-codec.encode/${prefixId}`;
  const decodeId = `browser-codec.decode/${prefixId}`;
  const browserCatalog = flattenForBrowser(catalog);
  const def = browserCatalog[prefixId];
  if (!def) {
    const error = new Error(`flattenForBrowser 결과에 ${prefixId}가 없다`);
    return [
      { id: encodeId, run: failing(error) },
      { id: decodeId, run: failing(error) },
    ];
  }

  // 각 차원의 첫 값으로 encode 입력을 만든다
  const values: Record<string, string | number> = {};
  for (const label of def.labels) {
    const dim = def.dims[label];
    const first = dim?.kind === 'axis' ? dim.entries?.[0] : dim?.values?.[0];
    if (first !== undefined) values[label] = first;
  }

  // browser-codec은 실패 시 throw 대신 null을 반환한다. null 결과를 측정하지 않도록 한 번 확인한다
  const encoded = browserEncode(browserCatalog, prefixId, values);
  if (!encoded) {
    const error = new Error(`browser-codec.encode(${prefixId})가 null을 반환했다`);
    return [
      { id: encodeId, run: failing(error) },
      { id: decodeId, run: failing(error) },
    ];
  }
  const decodeCase: MicroCase =
    browserDecode(browserCatalog, encoded.serialized) === null
      ? { id: decodeId, run: failing(new Error(`browser-codec.decode(${encoded.serialized})가 null을 반환했다`)) }
      : { id: decodeId, run: () => browserDecode(browserCatalog, encoded.serialized) };

  return [{ id: encodeId, run: () => browserEncode(browserCatalog, prefixId, values) }, decodeCase];
}

function createEnvelopeRecords(count: number, addressContext: Record<string, string>): EventRecord[] {
  const traceId = newTraceId();
  const timestamp = new Date(0).toISOString();
  return Array.from({ length: count }, (_, i) => ({
    log_id: newLogId(),
    timestamp,
    record_kind: 'log',
    trace_id: traceId,
    span_id: newSpanId(),
    event_key: 'bench.micro.event',
    event_version: 'v1',
    payload_format: 'json',
    payload_encoding: 'raw',
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { index: i, message: 'bench payload' },
    address_context: addressContext,
  }));
}

function createEnvelopeCases(catalog: Catalog, prefixId: string): MicroCase[] {
  const version = latestPrefixVersion(catalog, prefixId);
  const encoded = tryEncode(catalog, prefixId, version, zeroPositions(catalog, prefixId));
  const addressContext: Record<string, string> = encoded.ok
    ? { [prefixId]: serializeAddress({ prefix: prefixId, version, address: encoded.address }) }
    : {};
  return ENVELOPE_RECORD_COUNTS.map((count) => {
    const records = createEnvelopeRecords(count, addressContext);
    return { id: `envelope.json/${count}`, run: () => JSON.parse(JSON.stringify(records)) };
  });
}

/** catalog에서 파생한 codec·envelope microbench case 목록 */
export function createCodecSuite(catalog: Catalog): readonly MicroCase[] {
  const representative = pickRepresentativePrefix(catalog);
  return [
    ...createPrefixCases(catalog),
    createAddressParseCase(catalog, representative),
    ...createBrowserCodecCases(catalog, representative),
    ...createEnvelopeCases(catalog, representative),
  ];
}
