import type { PrefixRegistry } from "./prefix-registry.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import { ValidationError } from "./errors.js";

// ── API 전송 포맷 ─────────────────────────────────────────

/**
 * versionId 단위 entry 일괄 전송 페이로드.
 *
 * POST /tables/{prefix}/versions/{versionId}/entries/batch
 *
 * entries:
 *   - key   = position (1-based) as string
 *   - value = entity value (정규 값 또는 예약 마커 "_" / "~" / "?" / "NaN")
 *   - 빈 position은 생략 (sparse)
 *   - composite 테이블은 entries 없이 capacity만 전송
 *
 * @example
 * {
 *   "capacity": 1000,
 *   "entries": {
 *     "1":   "action",
 *     "4":   "_",
 *     "140": "NaN",
 *     "500": "idle",
 *     "999": "~"
 *   }
 * }
 */
export interface EntryBatchPayload {
  capacity: number;
  entries: Record<string, string>; // position(string) → value
}

/**
 * EntryBatchPayload 유효성 검증.
 *
 * - capacity는 양의 정수
 * - entries의 각 key는 [1, capacity] 범위의 정수 문자열
 * - 중복 position 없음 (Record이므로 자동 보장)
 */
export function validateEntryBatchPayload(
  payload: EntryBatchPayload
): void {
  if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
    throw new ValidationError(
      `EntryBatchPayload: capacity must be a positive integer (got ${payload.capacity})`
    );
  }

  for (const [posStr, value] of Object.entries(payload.entries)) {
    const pos = Number(posStr);
    if (!Number.isInteger(pos) || pos < 1 || pos > payload.capacity) {
      throw new ValidationError(
        `EntryBatchPayload: position "${posStr}" is out of range [1, ${payload.capacity}]`
      );
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new ValidationError(
        `EntryBatchPayload: value at position ${pos} must be a non-empty string`
      );
    }
  }
}

/**
 * EntryBatchPayload를 수신해 PrefixRegistry + IndexMetaStore에 적재한다.
 *
 * PrefixRegistry에 이미 등록된 버전이면 capacity 일치 여부를 검증한다.
 * 미등록이면 새로 등록한다.
 */
export async function applyEntryBatch(
  prefix: string,
  versionId: string,
  payload: EntryBatchPayload,
  registry: PrefixRegistry,
  store: IndexMetaStore,
  createdAt = new Date().toISOString()
): Promise<void> {
  validateEntryBatchPayload(payload);

  // PrefixRegistry 동기화
  const existing = await registry.getCapacity(prefix, versionId);
  if (existing === null) {
    await registry.register({ prefix, versionId, capacity: payload.capacity });
  } else if (existing !== payload.capacity) {
    throw new ValidationError(
      `applyEntryBatch: capacity mismatch for "${prefix}/${versionId}" — ` +
      `registry has ${existing}, payload has ${payload.capacity}`
    );
  }

  // schema_version 동기화
  const sv = await store.getSchemaVersion(prefix, versionId);
  if (!sv) {
    await store.insertSchemaVersion({
      tableId: prefix, versionId, capacity: payload.capacity, createdAt,
    });
  }

  // entries 적재
  for (const [posStr, value] of Object.entries(payload.entries)) {
    const position = Number(posStr);
    const existing = await store.getEntry(prefix, versionId, position);
    if (!existing) {
      await store.insertEntry({ tableId: prefix, versionId, position, value, createdAt });
    }
  }
}
