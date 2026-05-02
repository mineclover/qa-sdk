/**
 * 로컬 세션 이벤트 로그 — motion-content 에디터 전용.
 *
 * 전역 좌표계 prefix/axis가 아닌, 에디터 세션 내 행동 기록.
 * ring buffer로 메모리 제한, UI 패널에서 실시간 표시.
 */

/** 이벤트 카테고리 */
export type McLogCategory = "transport" | "edit" | "timeline" | "composition" | "system";

/** 로그 엔트리 */
export interface McLogEntry {
  readonly id: number;
  readonly timestamp: number;
  readonly category: McLogCategory;
  readonly action: string;
  readonly detail?: Record<string, unknown>;
}

/** 로컬 세션 이벤트 로그 인터페이스 */
export interface MotionEventLog {
  /** 이벤트 기록 */
  push(category: McLogCategory, action: string, detail?: Record<string, unknown>): void;
  /** 전체 엔트리 (최신순) */
  entries(): readonly McLogEntry[];
  /** 카테고리로 필터링 */
  entriesByCategory(category: McLogCategory): readonly McLogEntry[];
  /** 로그 초기화 */
  clear(): void;
  /** 현재 엔트리 수 */
  size(): number;
  /** 새 엔트리 추가 시 콜백 */
  onEntry: ((entry: McLogEntry) => void) | null;
}

/** ring buffer 기반 이벤트 로그 생성 */
export function createMotionEventLog(maxEntries = 200): MotionEventLog {
  let nextId = 1;
  const buffer: McLogEntry[] = [];

  const log: MotionEventLog = {
    onEntry: null,

    push(category, action, detail) {
      const entry: McLogEntry = {
        id: nextId++,
        timestamp: Date.now(),
        category,
        action,
        detail,
      };
      buffer.push(entry);
      if (buffer.length > maxEntries) {
        buffer.splice(0, buffer.length - maxEntries);
      }
      log.onEntry?.(entry);
    },

    entries() {
      return [...buffer].toReversed();
    },

    entriesByCategory(category) {
      return buffer.filter((e) => e.category === category).toReversed();
    },

    clear() {
      buffer.length = 0;
    },

    size() {
      return buffer.length;
    },
  };

  return log;
}
