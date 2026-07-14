// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from '../command-spec.js';
import { obsRead, obsSearch, obsAppend, obsBacklinks, obsList, obsStats } from '../commands/obs.js';

export const OBS_COMMAND_DESCRIPTORS = [
  {
    id: 'obs.read',
    path: ['read'],
    usage: 'qa-sdk obs read <path> [--vault <name>]             Obsidian 노트 읽기',
    handlerKey: 'obs.read',
  },
  {
    id: 'obs.search',
    path: ['search'],
    usage: 'qa-sdk obs search <query> [--vault <name>]          Obsidian 검색',
    handlerKey: 'obs.search',
  },
  {
    id: 'obs.append',
    path: ['append'],
    usage: 'qa-sdk obs append <path> <content> [--vault <name>] Obsidian 노트에 내용 추가',
    handlerKey: 'obs.append',
  },
  {
    id: 'obs.backlinks',
    path: ['backlinks'],
    usage: 'qa-sdk obs backlinks <name> [--vault <name>]        Obsidian 백링크 조회',
    handlerKey: 'obs.backlinks',
  },
  {
    id: 'obs.list',
    path: ['list'],
    usage: 'qa-sdk obs list [prefix] [--vault <name>]',
    handlerKey: 'obs.list',
  },
  {
    id: 'obs.stats',
    path: ['stats'],
    usage: 'qa-sdk obs stats [--vault <name>]',
    handlerKey: 'obs.stats',
  },
] as const satisfies readonly CommandDescriptor[];

export const OBS_COMMAND_TREE = descriptorsToTree(
  OBS_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const OBS_COMMAND_SPECS = collectCommandUsageSpecs(
  ['obs'],
  OBS_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

function extractVault(args: string[]): { vault?: string; rest: string[] } {
  const vaultIdx = args.indexOf('--vault');
  if (vaultIdx >= 0 && vaultIdx + 1 < args.length) {
    const vault = args[vaultIdx + 1];
    const rest = [...args];
    rest.splice(vaultIdx, 2);
    return { vault, rest };
  }
  return { rest: args };
}

export const OBS_HANDLER_REGISTRY: Record<string, RestCommandHandler> = {
  'obs.read': (args) => {
    const { vault, rest } = extractVault(args);
    if (rest[0]) obsRead(rest[0], vault);
    else console.error('Usage: qa-sdk obs read <path> [--vault <name>]');
  },
  'obs.search': (args) => {
    const { vault, rest } = extractVault(args);
    if (rest[0]) obsSearch(rest[0], vault);
    else console.error('Usage: qa-sdk obs search <query> [--vault <name>]');
  },
  'obs.append': (args) => {
    const { vault, rest } = extractVault(args);
    const path = rest[0];
    const contentIdx = rest.indexOf('--content');
    const content = contentIdx >= 0 ? rest[contentIdx + 1] : rest[1];
    if (!path || !content) {
      console.error('Usage: qa-sdk obs append <path> <content> [--vault <name>]');
      return;
    }
    obsAppend(path, content, vault);
  },
  'obs.backlinks': (args) => {
    const { vault, rest } = extractVault(args);
    if (rest[0]) obsBacklinks(rest[0], vault);
    else console.error('Usage: qa-sdk obs backlinks <name> [--vault <name>]');
  },
  'obs.list': (args) => {
    const { vault, rest } = extractVault(args);
    obsList(rest[0] ?? '', vault);
  },
  'obs.stats': (args) => {
    const { vault } = extractVault(args);
    obsStats(vault);
  },
};
