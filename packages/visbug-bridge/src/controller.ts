// @def.boundary rlsc
import type {
  VisBugController,
  EditLogEntry,
  MergedEditLogEntry,
  GetHistoryOptions,
  ReplayOptions,
  ReplayResult,
  DomRefCatalog,
  DomQuerySpec,
} from './types.js';

interface VisBugHost {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>;
  clearHistory(): void;
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult;
  editLogStream(): AsyncIterable<EditLogEntry>;
  buildTargetRef(element: Element): DomRefCatalog;
  resolveTargetRef(catalog: DomRefCatalog): Element | null;
  queryTargets(spec: DomQuerySpec): ReadonlyArray<Element>;
  getTargetRefByLabelId(labelId: string | number): DomRefCatalog | null;
}

export function createController(host: VisBugHost, detach: () => void): VisBugController {
  return {
    getHistory: (opts) => host.getHistory(opts),
    clearHistory: () => host.clearHistory(),
    replay: (entry, opts) => host.replay(entry, opts),
    buildTargetRef: (element) => host.buildTargetRef(element),
    resolveTargetRef: (catalog) => host.resolveTargetRef(catalog),
    queryTargets: (spec) => host.queryTargets(spec),
    getTargetRefByLabelId: (labelId) => host.getTargetRefByLabelId(labelId),
    unmount: () => detach(),
    get entries() {
      return host.editLogStream();
    },
  };
}
