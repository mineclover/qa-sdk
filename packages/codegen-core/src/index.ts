/** @def.boundary apm-codegen-system */
export { generateProto, type ProtoGenOptions } from './proto.js';
export { generateTypescript } from './typescript.js';
export {
  generateCatalogTypes,
  testMigration,
  type CatalogCodegenFile,
  type CatalogCodegenResult,
  type CatalogCodegenOptions,
  type MigrationTestResult,
} from './catalog-typescript.js';
export { toUpperSnake, toPascal, toConstKey, toEnumValue, toTsConstKey } from './naming.js';
export type { SchemaSnapshot, Axis, Composite, SnapshotSupply } from './types.js';
export {
  generateDataObjectBindings,
  type DataObjectCodegenFile,
  type DataObjectCodegenResult,
  type DataObjectCodegenOptions,
} from './data-object-typescript.js';
export {
  generateTrackCode,
  type EventDef,
  type FieldDef,
  type FieldType,
  type PayloadGuide,
  type EventMapping,
  type TrackCodegenFile,
  type TrackCodegenResult,
  type TrackCodegenOptions,
} from './event-track-typescript.js';
