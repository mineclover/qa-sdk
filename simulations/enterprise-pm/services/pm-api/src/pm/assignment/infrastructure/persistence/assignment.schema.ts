// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export — Phase 1 spec 의 슬라이스 트리에는
 * `assignment.schema.ts` 가 명시되어 있다. simulations 환경은 sqlite + pg
 * 두 dialect 를 모두 운용하므로 dialect 별 schema 파일을 분리하고 본 파일에서
 * 합쳐 export.
 *
 * 컨벤션: `import { ... } from "./assignment.schema.js"` 가 가능하지만, 어댑터
 * 구현은 dialect 별 schema 파일을 직접 import 한다 (ambiguity 방지).
 */
export * as sqliteAssignmentSchema from "./sqlite.schema.js";
export * as pgAssignmentSchema from "./pg.schema.js";

export {
  SIM_PM_ASSIGNMENT_SQLITE_DDL,
} from "./sqlite.schema.js";
export {
  SIM_PM_ASSIGNMENT_PG_DDL,
} from "./pg.schema.js";
