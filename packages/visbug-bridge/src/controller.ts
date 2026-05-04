// @def.boundary rlsc
import type {
  VisBugController,
  EditLogEntry,
  MergedEditLogEntry,
  GetHistoryOptions,
  ReplayOptions,
  ReplayResult,
} from './types.js'

interface VisBugHost {
  getHistory(opts?: GetHistoryOptions): ReadonlyArray<EditLogEntry | MergedEditLogEntry>
  clearHistory(): void
  replay(entry: EditLogEntry | MergedEditLogEntry, opts?: ReplayOptions): ReplayResult
  editLogStream(): AsyncIterable<EditLogEntry>
}

export function createController(host: VisBugHost, detach: () => void): VisBugController {
  return {
    getHistory: (opts) => host.getHistory(opts),
    clearHistory: () => host.clearHistory(),
    replay: (entry, opts) => host.replay(entry, opts),
    unmount: () => detach(),
    get entries() {
      return host.editLogStream()
    },
  }
}
