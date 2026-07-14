// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export { createIndexSDK } from './typed-sdk.js';
export type {
  SdkSchema,
  AxisDef,
  PrefixDef,
  AxisEntries,
  PrefixNames,
  PrefixDims,
  PrefixCoord,
  TypedIndexSDK,
} from './typed-sdk.js';
export { createDimWireCodec } from './dim-wire.js';
export type { DimWireCodec } from './dim-wire.js';
