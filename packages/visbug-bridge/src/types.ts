// @def.boundary rlsc
export interface DomRefSymbol {
  readonly kind:
    | 'xpath'
    | 'css'
    | 'id'
    | 'attr'
    | 'nodePath'
    | 'xpath-relative'
    | 'rlsc'
    | 'qa-coord';
  readonly value: string;
  readonly matchCount: number;
  readonly stability: number;
  readonly provenance?: string;
}

export interface DomRefCatalog {
  readonly canonical: Readonly<{ kind: 'xpath'; value: string }>;
  readonly symbols: ReadonlyArray<DomRefSymbol>;
  readonly primary: DomRefSymbol | null;
  readonly fingerprint: Readonly<{
    tagName: string;
    textSnippet?: string;
  }>;
  readonly capturedAt: number;
}

export interface EditLogTarget {
  readonly selector: string;
  readonly nodePath: string;
  readonly catalog?: DomRefCatalog;
  readonly primary?: DomRefSymbol;
  readonly weakRef: WeakRef<Element> | null;
}

export interface EditLogDomSnapshot {
  readonly textContent?: string;
  readonly src?: Readonly<{ parentPath: string; index: number; nodePath?: string }>;
  readonly target?: Readonly<{ parentPath: string; index: number; nodePath?: string }>;
  readonly [key: string]: unknown;
}

export interface EditLogEntry {
  readonly id: string;
  readonly ts: number;
  readonly feature: string;
  readonly args: unknown;
  readonly target: EditLogTarget;
  readonly beforeCSS: Readonly<Record<string, string>>;
  readonly afterCSS: Readonly<Record<string, string>>;
  readonly beforeDOM?: Readonly<EditLogDomSnapshot>;
  readonly afterDOM?: Readonly<EditLogDomSnapshot>;
  readonly source: 'feature' | 'mutation';
  readonly correlationId: string;
}

export interface MergedEditLogEntry extends EditLogEntry {
  readonly sources?: ReadonlyArray<'feature' | 'mutation'>;
  readonly agreement?: boolean;
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>;
}

export type GetHistoryOptions =
  | { merge?: 'none'; filter?: 'all' | 'feature' | 'intent' | 'mutation-debug' }
  | { merge: 'correlated' }
  | { merge: 'intent' }
  | {
      merge: 'analyzed';
      policy: (entries: ReadonlyArray<EditLogEntry>) => ReadonlyArray<EditLogEntry>;
    };

export type EntryFilter = 'all' | 'feature' | 'intent' | 'mutation-debug';

export type ReplayMode = 'css' | 'feature' | 'dom';

export type DomQuerySpec =
  | { by: 'css'; value: string }
  | { by: 'xpath'; value: string }
  | { by: 'symbol'; symbol: DomRefSymbol }
  | { by: 'catalog'; catalog: DomRefCatalog };

export interface ReplayResult {
  readonly ok: boolean;
  readonly reason?:
    | 'target-not-found'
    | 'style-apply-failed'
    | 'feature-replay-failed'
    | 'dom-replay-unsupported'
    | 'dom-apply-failed'
    | 'unknown-mode';
  readonly cause?: unknown;
  readonly warning?: 'divergent-capture';
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>;
}

export interface ReplayOptions {
  readonly mode?: ReplayMode;
  readonly registry?: Record<string, (...args: unknown[]) => unknown>;
}

export type EditLogListener = (entry: EditLogEntry) => void;

export interface VisBugMountOptions {
  readonly bufferSize?: number;
  readonly onEntry?: EditLogListener;
  readonly logger?: { warn: (...args: unknown[]) => void };
  /** `<vis-bug color-scheme>` — light / dark / auto (기본 auto) */
  readonly colorScheme?: 'light' | 'dark' | 'auto';
  /**
   * editlog 이벤트 필터. 기본 `feature` — mutation 노이즈 제외.
   * `intent`는 feature와 동일(소비자 preset). `all`은 mutation 포함.
   */
  readonly entryFilter?: EntryFilter;
  /** 캡처 시 DomRef catalog에 rlsc/qa-coord 등 외부 좌표 심볼을 주입한다. */
  readonly resolveDomRefSymbols?: (element: Element) => ReadonlyArray<DomRefSymbol>;
}

export interface VisBugController {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>;
  clearHistory(): void;
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult;
  buildTargetRef(element: Element): DomRefCatalog;
  resolveTargetRef(catalog: DomRefCatalog): Element | null;
  queryTargets(spec: DomQuerySpec): ReadonlyArray<Element>;
  getTargetRefByLabelId(labelId: string | number): DomRefCatalog | null;
  unmount(): void;
  readonly entries: AsyncIterable<EditLogEntry>;
}
