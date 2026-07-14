// @def.boundary cli-command-spec
// @def.doc cli-command-spec

import type { CliCommandNode, ResolvedCommand } from './types.js';

/**
 * 인자 배열에서 명령 트리를 탐색하여 매칭되는 노드를 찾는다.
 * 가장 깊이 매칭되는 handler/handlerKey 노드를 반환.
 */
export function resolveCommand(
  args: readonly string[],
  tree: readonly CliCommandNode[],
  rootSegments?: readonly string[],
): ResolvedCommand | null {
  const roots = rootSegments ?? [];

  // rootSegments 매칭 확인
  if (args.length < roots.length) return null;
  for (let i = 0; i < roots.length; i++) {
    if (args[i] !== roots[i]) return null;
  }

  let currentNodes = tree;
  const matchedNodes: CliCommandNode[] = [];
  let index = roots.length;

  while (index < args.length) {
    const segment = args[index];
    // --flag는 명령이 아니라 옵션
    if (segment.startsWith('-')) break;
    const next = currentNodes.find((n) => n.segment === segment);
    if (!next) break;
    matchedNodes.push(next);
    currentNodes = (next.children as CliCommandNode[]) ?? [];
    index++;
  }

  if (matchedNodes.length === 0) return null;

  // 가장 깊이 매칭되는 실행 가능 노드 (handler 또는 handlerKey)
  for (let i = matchedNodes.length - 1; i >= 0; i--) {
    const node = matchedNodes[i];
    if (node.handler || node.handlerKey) {
      const segments = [...roots, ...matchedNodes.slice(0, i + 1).map((n) => n.segment)];
      return {
        commandName: segments.join(' '),
        rest: args.slice(roots.length + i + 1),
        node,
      };
    }
  }

  // handler 없지만 children이 있는 노드 → help 표시용
  const lastNode = matchedNodes[matchedNodes.length - 1];
  if (lastNode.children && lastNode.children.length > 0) {
    const segments = [...roots, ...matchedNodes.map((n) => n.segment)];
    return {
      commandName: segments.join(' '),
      rest: args.slice(roots.length + matchedNodes.length),
      node: lastNode,
    };
  }

  return null;
}

// ── 기존 호환 함수 (packages/cli에서 사용 중) ──

/** @deprecated resolveCommand 사용 권장 */
export function resolveCliTreeCommand(
  args: readonly string[],
  rootSegments: readonly string[],
  nodes: readonly CliCommandNode[],
): ResolvedCommand | null {
  return resolveCommand(args, nodes, rootSegments);
}
