import type {
  RLSCDocument,
  LayoutChange,
  LayoutMonitor,
  MonitorOptions,
} from "./types.js";
import { collectLayout } from "./collector.js";
import { diffDocuments } from "./query.js";
import { checkConformance } from "./intent.js";

const DEFAULT_DEBOUNCE_MS = 200;

/**
 * MutationObserver + ResizeObserver 기반 레이아웃 모니터를 생성한다.
 * 브라우저 전용.
 */
export function createLayoutMonitor(
  root?: Element,
  options?: MonitorOptions,
): LayoutMonitor {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("createLayoutMonitor는 브라우저 환경에서만 실행 가능합니다");
  }

  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const collectOptions = options?.collectOptions;
  const intent = options?.intent;

  let current: RLSCDocument = collectLayout(root, collectOptions);
  const changes: LayoutChange[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let mutationObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const target = root ?? document.body;

  function handleChange() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const next = collectLayout(root, collectOptions);
      const diffs = diffDocuments(current, next);

      for (const diff of diffs) {
        const change: LayoutChange = {
          type: diff.type,
          nodeId: diff.nodeId,
          before: diff.before,
          after: diff.after,
          timestamp: new Date().toISOString(),
        };
        changes.push(change);
      }

      current = next;

      if (intent && monitor.onConformanceChange && diffs.length > 0) {
        const result = checkConformance(next, intent);
        monitor.onConformanceChange(result);
      }
    }, debounceMs);
  }

  const monitor: LayoutMonitor = {
    start() {
      mutationObserver = new MutationObserver(handleChange);
      mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });

      resizeObserver = new ResizeObserver(handleChange);
      resizeObserver.observe(target);
    },

    stop() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      mutationObserver?.disconnect();
      mutationObserver = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
    },

    snapshot() {
      return current;
    },

    get changes() {
      return changes as readonly LayoutChange[];
    },

    onConformanceChange: options?.onConformanceChange,
  };

  return monitor;
}
