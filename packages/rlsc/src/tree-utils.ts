import type { RLSCNode } from "./types.js";

/** 트리를 평면 배열로 변환 */
export function flattenTree(node: RLSCNode): RLSCNode[] {
  const result: RLSCNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  return result;
}
