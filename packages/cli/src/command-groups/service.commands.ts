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
import {
  serviceAppList,
  serviceAppShow,
  serviceCleanupActivate,
  serviceCleanupDraft,
  serviceCleanupExecute,
  serviceCleanupPlan,
  serviceEndpoints,
  serviceHealth,
  serviceHealthAll,
  serviceMode,
  serviceOwners,
  serviceOwnershipTopology,
  serviceList,
  serviceShow,
} from '../commands/service.js';

export const SERVICE_COMMAND_DESCRIPTORS = [
  {
    id: 'service.list',
    path: ['list'],
    usage: 'qa-sdk service list [--json]       서비스 목록 (tier/team/owned/url)',
    handlerKey: 'service.list',
  },
  {
    id: 'service.show',
    path: ['show'],
    usage: 'qa-sdk service show <id>           서비스 상세 (owned + consumed prefixes)',
    handlerKey: 'service.show',
  },
  {
    id: 'service.health',
    path: ['health'],
    usage: 'qa-sdk service health [--env dev]  전체 서비스 헬스체크 (registry 경유)',
    handlerKey: 'service.health',
  },
  {
    id: 'service.health-all',
    path: ['health-all'],
    usage: 'qa-sdk service health-all [--json] 모든 서비스 직접 health check (registry 불필요)',
    handlerKey: 'service.health-all',
  },
  {
    id: 'service.owners',
    path: ['owners'],
    usage: 'qa-sdk service owners [--json]     prefix → 소유 서비스 맵',
    handlerKey: 'service.owners',
  },
  {
    id: 'service.ownership-topology',
    path: ['ownership-topology'],
    usage: 'qa-sdk service ownership-topology <serviceId> [--version v] [--json]',
    handlerKey: 'service.ownership-topology',
  },
  {
    id: 'service.endpoints',
    path: ['endpoints'],
    usage: 'qa-sdk service endpoints [--filter-env dev|prod]  서비스 엔드포인트 목록',
    handlerKey: 'service.endpoints',
  },
  {
    id: 'service.app.list',
    path: ['app', 'list'],
    usage: 'qa-sdk service app list [--json]     Application 목록',
    handlerKey: 'service.app.list',
  },
  {
    id: 'service.app.show',
    path: ['app', 'show'],
    usage: 'qa-sdk service app show <id>         Application 상세 (서비스 포함)',
    handlerKey: 'service.app.show',
  },
  {
    id: 'service.cleanup-plan',
    path: ['cleanup-plan'],
    usage: 'qa-sdk service cleanup-plan <serviceId> [--manifest-version v] [--json]',
    handlerKey: 'service.cleanup-plan',
  },
  {
    id: 'service.cleanup-draft',
    path: ['cleanup-draft'],
    usage:
      'qa-sdk service cleanup-draft <serviceId> --new-version <v> [--manifest-version v] [--replace kind=version]',
    handlerKey: 'service.cleanup-draft',
  },
  {
    id: 'service.cleanup-activate',
    path: ['cleanup-activate'],
    usage: 'qa-sdk service cleanup-activate <serviceId> --manifest-version <v>',
    handlerKey: 'service.cleanup-activate',
  },
  {
    id: 'service.cleanup-execute',
    path: ['cleanup-execute'],
    usage:
      'qa-sdk service cleanup-execute <serviceId> --new-version <v> [--manifest-version v] [--replace kind=version]',
    handlerKey: 'service.cleanup-execute',
  },
  {
    id: 'service.mode',
    path: ['mode'],
    usage: 'qa-sdk service mode [local|staging|prod] [--set key=value]',
    handlerKey: 'service.mode',
  },
] as const satisfies readonly CommandDescriptor[];

export const SERVICE_COMMAND_TREE = descriptorsToTree(
  SERVICE_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const SERVICE_COMMAND_SPECS = collectCommandUsageSpecs(
  ['service'],
  SERVICE_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const SERVICE_HANDLER_REGISTRY = {
  'service.list': serviceList,
  'service.show': serviceShow,
  'service.health': serviceHealth,
  'service.health-all': serviceHealthAll,
  'service.mode': serviceMode,
  'service.owners': serviceOwners,
  'service.ownership-topology': serviceOwnershipTopology,
  'service.endpoints': serviceEndpoints,
  'service.cleanup-plan': serviceCleanupPlan,
  'service.cleanup-draft': serviceCleanupDraft,
  'service.cleanup-activate': serviceCleanupActivate,
  'service.cleanup-execute': serviceCleanupExecute,
  'service.app.list': serviceAppList,
  'service.app.show': serviceAppShow,
} satisfies Readonly<Record<string, RestCommandHandler>>;
