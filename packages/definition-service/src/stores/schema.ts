// @def.doc definition-service

/**
 * definition-service DB 스키마 re-export
 *
 * 실제 스키마 정의는 src/db/schema.ts (drizzle ORM).
 * 마이그레이션은 drizzle-kit으로 관리 (drizzle/ 폴더).
 *
 * 이 파일은 하위 호환 + drizzle 스키마 접근 편의를 위해 유지.
 */

export {
  prefixRegistry,
  documents,
  documentLinks,
  documentHistory,
  sliceIntents,
  consumptionSnapshots,
  testRegistry,
  testResults,
} from "../db/schema.js";
