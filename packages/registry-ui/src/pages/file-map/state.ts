// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import { filterTreeByMode, findNodeById, normalizeReport } from "./normalize.js";
import { SAMPLE_REPORT } from "./sample-report.js";
import type { FileTreeNode, JsonRecord, RenderState } from "./types.js";

export function createInitialState(): RenderState {
  const normalized = normalizeReport(SAMPLE_REPORT as unknown as JsonRecord);
  return {
    report: normalized,
    rawInput: JSON.stringify(SAMPLE_REPORT, null, 2),
    selectedNodeId: normalized.tree.id,
    autoLoadAttempted: false,
    autoRefreshEnabled: true,
    inputSource: "sample",
    drawerState: "closed",
    viewMode: "all",
  };
}

export function resolveActiveTree(state: RenderState): FileTreeNode {
  const activeTree = filterTreeByMode(state.report.tree, state.viewMode);
  if (!findNodeById(activeTree, state.selectedNodeId)) {
    state.selectedNodeId = activeTree.id;
  }
  return activeTree;
}

export function applyRawInputToState(
  state: RenderState,
  rawText: string,
  options?: {
    inputSource?: RenderState["inputSource"];
    autoRefreshEnabled?: boolean;
    preserveSelection?: boolean;
  },
): RenderState {
  const parsed = JSON.parse(rawText) as JsonRecord;
  const normalized = normalizeReport(parsed);
  const nextSelectedId = options?.preserveSelection && findNodeById(normalized.tree, state.selectedNodeId)
    ? state.selectedNodeId
    : normalized.tree.id;
  return {
    report: normalized,
    rawInput: rawText,
    selectedNodeId: nextSelectedId,
    autoLoadAttempted: true,
    autoRefreshEnabled: options?.autoRefreshEnabled ?? state.autoRefreshEnabled,
    inputSource: options?.inputSource ?? state.inputSource,
    drawerState: state.drawerState,
    viewMode: state.viewMode,
  };
}
