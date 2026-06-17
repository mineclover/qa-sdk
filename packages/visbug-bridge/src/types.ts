// @def.boundary rlsc
export interface EditLogTarget {
  readonly selector: string
  readonly nodePath: string
  readonly weakRef: WeakRef<Element> | null
}

export interface EditLogDomSnapshot {
  readonly textContent?: string
  readonly src?: Readonly<{ parentPath: string; index: number; nodePath?: string }>
  readonly target?: Readonly<{ parentPath: string; index: number; nodePath?: string }>
  readonly [key: string]: unknown
}

export interface EditLogEntry {
  readonly id: string
  readonly ts: number
  readonly feature: string
  readonly args: unknown
  readonly target: EditLogTarget
  readonly beforeCSS: Readonly<Record<string, string>>
  readonly afterCSS: Readonly<Record<string, string>>
  readonly beforeDOM?: Readonly<EditLogDomSnapshot>
  readonly afterDOM?: Readonly<EditLogDomSnapshot>
  readonly source: 'feature' | 'mutation'
  readonly correlationId: string
}

export interface MergedEditLogEntry extends EditLogEntry {
  readonly sources?: ReadonlyArray<'feature' | 'mutation'>
  readonly agreement?: boolean
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>
}

export type GetHistoryOptions =
  | { merge?: 'none' }
  | { merge: 'correlated' }
  | { merge: 'analyzed'; policy: (entries: ReadonlyArray<EditLogEntry>) => ReadonlyArray<EditLogEntry> }

export type ReplayMode = 'css' | 'feature' | 'dom'

export interface ReplayResult {
  readonly ok: boolean
  readonly reason?: 'target-not-found' | 'style-apply-failed' | 'feature-replay-failed' | 'dom-replay-unsupported' | 'dom-apply-failed' | 'unknown-mode'
  readonly cause?: unknown
  readonly warning?: 'divergent-capture'
  readonly divergence?: Readonly<Record<string, { feature?: string; mutation?: string }>>
}

export interface ReplayOptions {
  readonly mode?: ReplayMode
  readonly registry?: Record<string, (...args: unknown[]) => unknown>
}

export type EditLogListener = (entry: EditLogEntry) => void

export interface VisBugMountOptions {
  readonly bufferSize?: number
  readonly onEntry?: EditLogListener
  readonly logger?: { warn: (...args: unknown[]) => void }
}

export interface VisBugController {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>
  clearHistory(): void
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult
  unmount(): void
  readonly entries: AsyncIterable<EditLogEntry>
}
