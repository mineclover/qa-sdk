// @def.boundary cli-command-spec
// @def.doc cli-command-spec

import type { CliCommandNode, CommandContext } from './types.js';
import { resolveCommand } from './resolve.js';
import { parseCommandArgs } from './parse.js';

export interface ExecuteOptions {
  /** handlerKey → handler 매핑 (기존 호환용) */
  handlers?: Record<string, (ctx: CommandContext) => Promise<void>>;
  /** 명령 미매칭 시 호출 */
  onNotFound?: (args: string[]) => Promise<void>;
  /** help 요청 시 호출 (--help 또는 서브커맨드 없음) */
  onHelp?: (node: CliCommandNode | null, commandName: string) => void;
}

/**
 * 인자 배열로 명령 트리에서 매칭 → 파싱 → handler 실행.
 * 성공 시 true, 미매칭 시 false.
 */
export async function executeCommand(
  args: string[],
  tree: readonly CliCommandNode[],
  options?: ExecuteOptions,
  rootSegments?: readonly string[],
): Promise<boolean> {
  // --help 체크
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    const resolved =
      args.length > 0
        ? resolveCommand(
            args.filter((a) => a !== '--help' && a !== '-h'),
            tree,
            rootSegments,
          )
        : null;
    options?.onHelp?.(resolved?.node ?? null, resolved?.commandName ?? '');
    return true;
  }

  const resolved = resolveCommand(args, tree, rootSegments);
  if (!resolved) {
    if (options?.onNotFound) {
      await options.onNotFound(args);
      return true;
    }
    return false;
  }

  const { node, rest } = resolved;

  // handler 직접 바인딩 (신규)
  if (node.handler) {
    const ctx = parseCommandArgs(rest, node);
    await node.handler(ctx);
    return true;
  }

  // handlerKey 기반 dispatch (기존 호환)
  if (node.handlerKey && options?.handlers?.[node.handlerKey]) {
    const ctx = parseCommandArgs(rest, node);
    await options.handlers[node.handlerKey](ctx);
    return true;
  }

  // children만 있고 handler 없는 노드 → help
  if (node.children && !node.handler && !node.handlerKey) {
    options?.onHelp?.(node, resolved.commandName);
    return true;
  }

  return false;
}
