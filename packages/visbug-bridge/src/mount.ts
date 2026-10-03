import type {
  VisBugMountOptions,
  VisBugController,
  EditLogEntry,
  DomRefCatalog,
  DomQuerySpec,
} from './types.js';
import { createController } from './controller.js';

const DEFAULT_LOGGER = { warn: (...args: unknown[]) => console.warn('[visbug-bridge]', ...args) };

function passesEntryFilter(
  entry: EditLogEntry,
  filter: VisBugMountOptions['entryFilter'] = 'feature',
): boolean {
  if (filter === 'all') return true;
  if (filter === 'mutation-debug') return entry.source === 'mutation';
  return entry.source === 'feature';
}

export function mountVisBug(host: HTMLElement, opts: VisBugMountOptions = {}): VisBugController {
  if (!host || !(host instanceof HTMLElement)) {
    throw new TypeError('mountVisBug: host must be an HTMLElement');
  }
  const logger = opts.logger ?? DEFAULT_LOGGER;

  const visbug = document.createElement('vis-bug') as HTMLElement & {
    onEditLog?: ((e: EditLogEntry) => void) | null;
    getHistory: VisBugController['getHistory'];
    clearHistory: VisBugController['clearHistory'];
    replay: VisBugController['replay'];
    buildTargetRef: (element: Element) => DomRefCatalog;
    resolveTargetRef: (catalog: DomRefCatalog) => Element | null;
    queryTargets: (spec: DomQuerySpec) => ReadonlyArray<Element>;
    getTargetRefByLabelId: (labelId: string | number) => DomRefCatalog | null;
    resolveDomRefSymbols?: VisBugMountOptions['resolveDomRefSymbols'];
    editLogStream: () => AsyncIterable<EditLogEntry>;
  };
  if (opts.resolveDomRefSymbols) {
    visbug.resolveDomRefSymbols = opts.resolveDomRefSymbols;
  }
  if (opts.colorScheme) {
    visbug.setAttribute('color-scheme', opts.colorScheme);
  }
  if (opts.tutsBaseURL) {
    visbug.setAttribute('tutsBaseURL', opts.tutsBaseURL);
  }
  host.appendChild(visbug);

  if (opts.onEntry) {
    const cb = opts.onEntry;
    const entryFilter = opts.entryFilter ?? 'feature';
    visbug.onEditLog = (entry: EditLogEntry) => {
      if (!passesEntryFilter(entry, entryFilter)) return;
      try {
        cb(entry);
      } catch (err) {
        logger.warn('onEntry threw', err);
      }
    };
  }

  const detach = () => {
    visbug.onEditLog = null;
    visbug.remove();
  };

  return createController(visbug, detach);
}
