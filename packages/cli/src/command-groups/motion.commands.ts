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
import { motionInspect, motionValidate } from '../commands/motion.js';
import {
  motionApply,
  motionExport,
  motionImport,
  motionSceneCreate,
  motionSceneDelete,
  motionSceneList,
  motionSceneShow,
  motionWorkspaceCreate,
  motionWorkspaceDelete,
  motionWorkspaceList,
  motionWorkspaceShow,
} from '../commands/motion-workspace.js';

export const MOTION_COMMAND_DESCRIPTORS = [
  {
    id: 'motion.validate',
    path: ['validate'],
    usage: 'qa-sdk motion validate <file>',
    description: 'Motion composition/workspace 문서 검증',
    args: [{ name: 'file', required: true, description: '검증할 JSON 파일 경로' }],
    handlerKey: 'motion.validate',
  },
  {
    id: 'motion.inspect',
    path: ['inspect'],
    usage: 'qa-sdk motion inspect <file>',
    description: 'Motion composition/workspace 요약',
    args: [{ name: 'file', required: true, description: '조회할 JSON 파일 경로' }],
    handlerKey: 'motion.inspect',
  },
  {
    id: 'motion.workspace.list',
    path: ['workspace', 'list'],
    usage: 'qa-sdk motion workspace list [options]',
    description: 'Remote motion workspace 목록',
    options: [
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.workspace.list',
  },
  {
    id: 'motion.workspace.show',
    path: ['workspace', 'show'],
    usage: 'qa-sdk motion workspace show <id> [options]',
    description: 'Remote motion workspace 상세',
    args: [{ name: 'id', required: true, description: 'Workspace ID' }],
    options: [
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.workspace.show',
  },
  {
    id: 'motion.workspace.create',
    path: ['workspace', 'create'],
    usage: 'qa-sdk motion workspace create <id> [options]',
    description: 'Remote motion workspace 생성',
    args: [{ name: 'id', required: true, description: 'Workspace ID' }],
    options: [
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.workspace.create',
  },
  {
    id: 'motion.workspace.delete',
    path: ['workspace', 'delete'],
    usage: 'qa-sdk motion workspace delete <id> [options]',
    description: 'Remote motion workspace 삭제',
    args: [{ name: 'id', required: true, description: 'Workspace ID' }],
    options: [
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.workspace.delete',
  },
  {
    id: 'motion.scene.list',
    path: ['scene', 'list'],
    usage: 'qa-sdk motion scene list --workspace <id> [options]',
    description: 'Remote motion scene 목록',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.scene.list',
  },
  {
    id: 'motion.scene.show',
    path: ['scene', 'show'],
    usage: 'qa-sdk motion scene show --workspace <id> --scene <id> [options]',
    description: 'Remote motion scene 상세',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      { flag: '--scene', valueHint: '<id>', type: 'string', description: 'Scene ID' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.scene.show',
  },
  {
    id: 'motion.scene.create',
    path: ['scene', 'create'],
    usage: 'qa-sdk motion scene create --workspace <id> [options]',
    description: 'Remote motion scene 생성',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.scene.create',
  },
  {
    id: 'motion.scene.delete',
    path: ['scene', 'delete'],
    usage: 'qa-sdk motion scene delete --workspace <id> --scene <id> [options]',
    description: 'Remote motion scene 삭제',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      { flag: '--scene', valueHint: '<id>', type: 'string', description: 'Scene ID' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.scene.delete',
  },
  {
    id: 'motion.export',
    path: ['export'],
    usage: 'qa-sdk motion export --workspace <id> --out <file> [options]',
    description: 'Remote workspace → composition JSON',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      { flag: '--out', valueHint: '<file>', type: 'string', description: '저장할 파일 경로' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.export',
  },
  {
    id: 'motion.import',
    path: ['import'],
    usage: 'qa-sdk motion import <file> --workspace <id> [options]',
    description: 'composition JSON → remote workspace',
    args: [{ name: 'file', required: true, description: '가져올 JSON 파일 경로' }],
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.import',
  },
  {
    id: 'motion.apply',
    path: ['apply'],
    usage: 'qa-sdk motion apply --workspace <id> --command <json> [options]',
    description: 'Remote workspace command 적용',
    options: [
      { flag: '--workspace', valueHint: '<id>', type: 'string', description: 'Workspace ID' },
      {
        flag: '--command',
        valueHint: '<json>',
        type: 'string',
        description: '적용할 Command JSON',
      },
      {
        flag: '--base-url',
        valueHint: '<url>',
        type: 'string',
        description: 'Workspace 서비스 URL',
      },
    ],
    handlerKey: 'motion.apply',
  },
] as const satisfies readonly CommandDescriptor[];

export const MOTION_COMMAND_TREE = descriptorsToTree(
  MOTION_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const MOTION_COMMAND_SPECS = collectCommandUsageSpecs(
  ['motion'],
  MOTION_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const MOTION_HANDLER_REGISTRY = {
  'motion.validate': motionValidate,
  'motion.inspect': motionInspect,
  'motion.workspace.list': motionWorkspaceList,
  'motion.workspace.show': motionWorkspaceShow,
  'motion.workspace.create': motionWorkspaceCreate,
  'motion.workspace.delete': motionWorkspaceDelete,
  'motion.scene.list': motionSceneList,
  'motion.scene.show': motionSceneShow,
  'motion.scene.create': motionSceneCreate,
  'motion.scene.delete': motionSceneDelete,
  'motion.export': motionExport,
  'motion.import': motionImport,
  'motion.apply': motionApply,
} satisfies Readonly<Record<string, RestCommandHandler>>;
