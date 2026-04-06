import type { CliCommandNode, CommandDescriptor } from "./types.js";

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

type MutableCliCommandNode = {
  segment: string;
  description?: string;
  usage?: string;
  continuation?: readonly string[];
  children?: MutableCliCommandNode[];
  args?: CliCommandNode["args"];
  options?: CliCommandNode["options"];
  handler?: CliCommandNode["handler"];
  handlerKey?: string;
};

/**
 * authored descriptor 목록을 재귀 명령 트리로 변환한다.
 * descriptor 순서를 그대로 보존하여 help/usage 표시 순서를 제어한다.
 */
export function descriptorsToTree(
  descriptors: readonly CommandDescriptor[],
): CliCommandNode[] {
  const roots: MutableCliCommandNode[] = [];

  for (const descriptor of descriptors) {
    let level = roots;

    for (let index = 0; index < descriptor.path.length; index += 1) {
      const segment = descriptor.path[index]!;
      let node = level.find((candidate) => candidate.segment === segment);

      if (!node) {
        node = { segment };
        level.push(node);
      }

      if (index === descriptor.path.length - 1) {
        node.description = descriptor.description ?? node.description;
        node.usage = descriptor.usage ?? node.usage;
        node.continuation = descriptor.continuation ?? node.continuation;
        node.args = descriptor.args ?? node.args;
        node.options = descriptor.options ?? node.options;
        node.handler = descriptor.handler ?? node.handler;
        node.handlerKey = descriptor.handlerKey ?? node.handlerKey;
      } else {
        node.children ??= [];
        level = node.children;
      }
    }
  }

  return roots as CliCommandNode[];
}
