// @def.boundary rlsc
import 'visbug';
export { mountVisBug } from './mount.js';
export { createDomRefSymbolResolver } from './coordinate-symbols.js';
export type {
  CoordinateLocateResult,
  CoordinateLocator,
  DomRefSymbolResolverOptions,
} from './coordinate-symbols.js';
export type {
  DomQuerySpec,
  DomRefCatalog,
  DomRefSymbol,
  EntryFilter,
  EditLogEntry,
  MergedEditLogEntry,
  EditLogTarget,
  EditLogListener,
  VisBugMountOptions,
  VisBugController,
  GetHistoryOptions,
  ReplayMode,
  ReplayOptions,
  ReplayResult,
} from './types.js';
