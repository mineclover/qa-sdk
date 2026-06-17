// @def.boundary rlsc
import type {
  VisBugMountOptions,
  VisBugController,
  EditLogEntry,
} from './types.js'
import { createController } from './controller.js'

const DEFAULT_LOGGER = { warn: (...args: unknown[]) => console.warn('[visbug-bridge]', ...args) }

export function mountVisBug(host: HTMLElement, opts: VisBugMountOptions = {}): VisBugController {
  if (!host || !(host instanceof HTMLElement)) {
    throw new TypeError('mountVisBug: host must be an HTMLElement')
  }
  const logger = opts.logger ?? DEFAULT_LOGGER

  const visbug = document.createElement('vis-bug') as HTMLElement & {
    onEditLog?: ((e: EditLogEntry) => void) | null
    getHistory: VisBugController['getHistory']
    clearHistory: VisBugController['clearHistory']
    replay: VisBugController['replay']
    editLogStream: () => AsyncIterable<EditLogEntry>
  }
  if (opts.colorScheme) {
    visbug.setAttribute('color-scheme', opts.colorScheme)
  }
  host.appendChild(visbug)

  if (opts.onEntry) {
    const cb = opts.onEntry
    visbug.onEditLog = (entry: EditLogEntry) => {
      try {
        cb(entry)
      } catch (err) {
        logger.warn('onEntry threw', err)
      }
    }
  }

  const detach = () => {
    visbug.onEditLog = null
    visbug.remove()
  }

  return createController(visbug, detach)
}
