export { generateProto, type ProtoGenOptions } from "./proto.js";
export { generateTypescript } from "./typescript.js";
export {
  generateCatalogTypes,
  testMigration,
  type CatalogCodegenFile,
  type CatalogCodegenResult,
  type CatalogCodegenOptions,
  type MigrationTestResult,
} from "./catalog-typescript.js";
export {
  toUpperSnake,
  toPascal,
  toConstKey,
  toEnumValue,
  toTsConstKey,
} from "./naming.js";
export type { SchemaSnapshot, Axis, Composite, SnapshotSupply } from "./types.js";
