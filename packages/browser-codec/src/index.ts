/** @def.boundary browser-runtime-system */
export {
  encode,
  encodeDetailed,
  decode,
  decodeDetailed,
  track,
  trackWithSignal,
  decodeContext,
  withServiceOverlay,
} from './browser-codec.js';
export type {
  BrowserCatalog,
  BrowserPrefixDef,
  BrowserDimDef,
  BrowserServiceDims,
  EncodeResult,
  DecodeValue,
  BrowserCodecErrorCode,
  BrowserCodecResult,
  SignalRole,
} from './browser-codec.js';
export { BROWSER_CATALOG, BROWSER_CATALOG_SNAPSHOT } from './demo-catalog-browser.js';
export { loadCatalog } from './catalog-loader.js';
export type { CatalogLoaderConfig, LoadResult } from './catalog-loader.js';
