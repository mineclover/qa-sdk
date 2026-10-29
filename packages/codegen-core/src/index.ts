/** @def.boundary apm-codegen-system */
export {
  generateCatalogTypes,
  testMigration,
  type CatalogCodegenFile,
  type CatalogCodegenResult,
  type CatalogCodegenOptions,
  type MigrationTestResult,
} from './catalog-typescript.js';
export { GENERATOR_NAME, GENERATOR_VERSION } from './generator-info.js';
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
