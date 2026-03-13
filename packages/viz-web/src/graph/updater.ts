import type { SpecGraph, StoredRecord } from "@qa-sdk/core";
import type { GraphRenderer } from "./renderer";
import type { NodeState } from "./style";

export interface GraphUpdater {
  processRecord(record: StoredRecord): void;
  getProgress(): Map<string, NodeState>;
  reset(): void;
}

/**
 * Creates an updater that processes incoming StoredRecords against a SpecGraph
 * and updates the graph renderer accordingly.
 */
export function createUpdater(
  specGraph: SpecGraph,
  renderer: GraphRenderer,
): GraphUpdater {
  const progress = new Map<string, NodeState>();
  let matchIndex = 0;

  for (const node of specGraph.nodes) {
    progress.set(node.step_id, "pending");
  }

  function findMatchingNodeFromIndex(eventKey: string): number {
    for (let i = matchIndex; i < specGraph.nodes.length; i++) {
      if (specGraph.nodes[i].event_key === eventKey) {
        return i;
      }
    }
    return -1;
  }

  function findAnyMatchingNode(eventKey: string): string | null {
    for (const node of specGraph.nodes) {
      if (node.event_key === eventKey) {
        return node.step_id;
      }
    }
    return null;
  }

  function markSkippedBetween(from: number, to: number): void {
    for (let i = from; i < to; i++) {
      const node = specGraph.nodes[i];
      const currentState = progress.get(node.step_id);
      if (currentState === "pending") {
        if (!node.required) {
          progress.set(node.step_id, "skipped");
          renderer.updateNodeState(node.step_id, "skipped");
        }
      }
    }
  }

  function highlightEdgesTo(stepId: string): void {
    for (const edge of specGraph.edges) {
      if (edge.target === stepId) {
        renderer.highlightEdge(edge.source, edge.target);
      }
    }
  }

  return {
    processRecord(record: StoredRecord) {
      const eventKey = record.eventKey;
      const idx = findMatchingNodeFromIndex(eventKey);

      if (idx >= 0) {
        const node = specGraph.nodes[idx];
        markSkippedBetween(matchIndex, idx);

        progress.set(node.step_id, "matched");
        renderer.updateNodeState(node.step_id, "matched");
        highlightEdgesTo(node.step_id);

        const nextIdx = idx + 1;
        if (nextIdx < specGraph.nodes.length) {
          const nextNode = specGraph.nodes[nextIdx];
          if (progress.get(nextNode.step_id) === "pending") {
            renderer.updateNodeState(nextNode.step_id, "active");
          }
        }

        matchIndex = nextIdx;
      } else {
        const anyStepId = findAnyMatchingNode(eventKey);
        if (anyStepId) {
          renderer.addEventToStack(anyStepId, {
            event_key: eventKey,
            timestamp: record.timestamp instanceof Date
              ? record.timestamp.toISOString()
              : String(record.timestamp),
          });
        }
      }
    },

    getProgress() {
      return new Map(progress);
    },

    reset() {
      matchIndex = 0;
      progress.clear();
      for (const node of specGraph.nodes) {
        progress.set(node.step_id, "pending");
        renderer.updateNodeState(node.step_id, "pending");
      }
    },
  };
}
