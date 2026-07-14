// @def.doc definition-service

/**
 * stores/ 타입 — core/에서 re-export
 *
 * 기존 import 경로 호환을 위해 유지. 신규 코드는 core/에서 직접 import 권장.
 */
export type {
  DocRecord,
  DocHistoryRecord,
  SliceIntentRecord,
  ConsumptionSnapshot,
} from '../core/types.js';

export type { DocStore, IntentStore, ConsumptionStore } from '../core/interfaces.js';
