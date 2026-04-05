import type { CliCommandNode } from "./types.js";

/**
 * 여러 서브트리를 하나의 루트 트리로 합성한다.
 *
 * @example
 * composeTree({
 *   deploy: deployCommands,
 *   config: configCommands,
 *   discover: discoverCommands,
 * })
 * // → [{ segment: "deploy", children: [...] }, { segment: "config", ... }]
 */
export function composeTree(
  subtrees: Record<string, CliCommandNode[] | CliCommandNode>,
): CliCommandNode[] {
  return Object.entries(subtrees).map(([segment, nodesOrNode]) => {
    if (Array.isArray(nodesOrNode)) {
      return { segment, children: nodesOrNode };
    }
    // 단일 노드 → segment 오버라이드
    return { ...nodesOrNode, segment };
  });
}
