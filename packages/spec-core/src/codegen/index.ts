// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * codegen — IR 기반 multi-format 코드 생성기.
 */

export type { IRModule, IREnum, IREnumValue, IRStruct, IRField } from './ir.js';
export { buildIR } from './ir-builder.js';
export type { BuildIROptions } from './ir-builder.js';
export {
  generateAxisType,
  generateExportInterface,
  generateTypescriptFile,
  generateFromIR,
} from './ts-generator.js';
export type { AxisInput, GenerateOptions } from './ts-generator.js';
export { generateJSFromIR, generateCJSFromIR } from './js-generator.js';
export type { JSFormat } from './js-generator.js';
export { generateProtoFromIR } from './proto-generator.js';
export type { ProtoOptions } from './proto-generator.js';
export { generateJsonSchemaFromIR } from './json-schema-generator.js';
export { generateDtsFromIR } from './dts-generator.js';
export type { DtsOptions } from './dts-generator.js';
