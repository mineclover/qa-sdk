import type { PrefixRegistry } from "./prefix-registry.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import type { CrossVersionEntrySync } from "./cross-version-entry-sync.js";
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
 *
 * sync가 제공되면 CrossVersionEntrySync를 통해 모든 writable 버전에 전파한다.
 * 이 경우 payload의 position은 삽입 순서로만 사용되고,
 * 실제 position은 active 버전 기준으로 자동 할당된다.
 */
export async function applyEntryBatch(
  prefix: string,
  versionId: string,
  payload: EntryBatchPayload,
  registry: PrefixRegistry,
  store: IndexMetaStore,
  createdAt?: string,
  sync?: CrossVersionEntrySync,
): Promise<void> {
  const ts = createdAt ?? new Date().toISOString();
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
      prefix, versionId, capacity: payload.capacity, createdAt: ts,
    });
  }

  // position 오름차순 정렬
  const sorted = Object.entries(payload.entries)
    .map(([posStr, value]) => ({ position: Number(posStr), value }))
    .sort((a, b) => a.position - b.position);

  if (sync) {
    // CrossVersionEntrySync 경로: 모든 writable 버전에 전파
    for (const { value } of sorted) {
      await sync.addEntry(prefix, value);
    }
  } else {
    // 단일 버전 직접 삽입 (기존 동작)
    for (const { position, value } of sorted) {
      const entry = await store.getEntry(prefix, versionId, position);
      if (!entry) {
        await store.insertEntry({ prefix, versionId, position, value, createdAt: ts });
      }
    }
  }
}
