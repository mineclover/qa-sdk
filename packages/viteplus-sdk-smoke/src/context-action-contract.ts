import {
  validateMountFlow,
  validateScopeNesting,
  type MountFlowValidation,
  type PipeGraph,
  type ScopeNesting,
} from '@qa-sdk/core';

export type ContextActionFeatureId = 'canonical-review' | 'incident-escalation';

export type ContextActionBoundaryId =
  | 'page-root'
  | 'qa-bridge'
  | 'feature-context'
  | 'handlers'
  | 'view';

export interface ContextActionBoundary {
  boundaryId: ContextActionBoundaryId;
  codeOwner: string;
  docOwner: string;
}

export interface ContextActionFeatureContract {
  featureId: ContextActionFeatureId;
  boundaries: ContextActionBoundary[];
  nesting: ScopeNesting;
  graph: PipeGraph;
}

export interface ContextActionValidation {
  featureId: ContextActionFeatureId;
  nestingValid: boolean;
  mountValid: boolean;
  providerOrder: ContextActionBoundaryId[];
  mount: MountFlowValidation;
}

const PROVIDER_ORDER: ContextActionBoundaryId[] = [
  'page-root',
  'qa-bridge',
  'feature-context',
  'handlers',
  'view',
];

export const CONTEXT_ACTION_PROVIDER_ORDER = PROVIDER_ORDER;

export const CONTEXT_ACTION_BOUNDARIES: ContextActionBoundary[] = [
  {
    boundaryId: 'page-root',
    codeOwner: 'src/features/*/*Example.ts',
    docOwner: 'flow/process_flow',
  },
  {
    boundaryId: 'qa-bridge',
    codeOwner: 'src/qa-bridge.ts',
    docOwner: 'feature/func_def 또는 interface/api_contract',
  },
  {
    boundaryId: 'feature-context',
    codeOwner: 'src/features/*/contexts/*Contexts.ts',
    docOwner: 'feature/func_def + state/app_state',
  },
  {
    boundaryId: 'handlers',
    codeOwner: 'src/features/*/handlers/*Handlers.ts',
    docOwner: 'feature/func_def',
  },
  {
    boundaryId: 'view',
    codeOwner: 'src/features/*/views/*View.ts',
    docOwner: 'ui/interaction',
  },
];

export function createContextActionFeatureContract(
  featureId: ContextActionFeatureId,
): ContextActionFeatureContract {
  return {
    featureId,
    boundaries: CONTEXT_ACTION_BOUNDARIES,
    nesting: createContextActionNesting(featureId),
    graph: createContextActionGraph(featureId),
  };
}

export function validateContextActionFeature(
  contract: ContextActionFeatureContract,
): ContextActionValidation {
  const nesting = validateScopeNesting(contract.nesting);
  const mount = validateMountFlow({
    nesting: contract.nesting,
    graph: contract.graph,
    bindings: {
      'validate-input': {
        scopeId: 'handlers',
        scopeContracts: ['playbook-state'],
      },
      'compute-result': {
        scopeId: 'handlers',
        scopeContracts: ['playbook-state'],
      },
      'persist-result': {
        scopeId: 'handlers',
        scopeContracts: ['persist-adapter'],
      },
      'log-event': {
        scopeId: 'handlers',
        scopeContracts: [{ contractId: 'logging-session', required: false }],
      },
      'render-view': {
        scopeId: 'view',
        scopeContracts: ['playbook-state', 'submission-handlers'],
      },
    },
  });

  return {
    featureId: contract.featureId,
    nestingValid: nesting.valid,
    mountValid: mount.valid,
    providerOrder: contract.boundaries.map((boundary) => boundary.boundaryId),
    mount,
  };
}

function createContextActionNesting(featureId: ContextActionFeatureId): ScopeNesting {
  return {
    nestingId: `${featureId}-context-action`,
    scopes: [
      {
        scopeId: 'page-root',
        provides: [],
        consumes: [],
        facets: ['mount'],
      },
      {
        scopeId: 'qa-bridge',
        provides: [
          {
            contractId: 'logging-session',
            type: 'logging',
            shape: 'QaBridge',
          },
        ],
        consumes: [],
        facets: ['logging', 'trace'],
      },
      {
        scopeId: 'feature-context',
        provides: [
          {
            contractId: 'playbook-state',
            type: 'state',
            shape: `${featureId}:state`,
          },
          {
            contractId: 'persist-adapter',
            type: 'persist',
            shape: `${featureId}:persist`,
          },
        ],
        consumes: [
          {
            contractId: 'logging-session',
            type: 'logging',
            required: false,
          },
        ],
        facets: ['state', 'refs', 'persist'],
      },
      {
        scopeId: 'handlers',
        provides: [
          {
            contractId: 'submission-handlers',
            type: 'adapter',
            shape: `${featureId}:handlers`,
          },
        ],
        consumes: [
          {
            contractId: 'playbook-state',
            type: 'state',
          },
          {
            contractId: 'persist-adapter',
            type: 'persist',
          },
          {
            contractId: 'logging-session',
            type: 'logging',
            required: false,
          },
        ],
        facets: ['orchestration', 'logging', 'focus'],
      },
      {
        scopeId: 'view',
        provides: [],
        consumes: [
          {
            contractId: 'playbook-state',
            type: 'state',
          },
          {
            contractId: 'submission-handlers',
            type: 'adapter',
          },
        ],
        facets: ['input', 'render'],
      },
    ],
  };
}

function createContextActionGraph(featureId: ContextActionFeatureId): PipeGraph {
  return {
    graphId: `${featureId}-context-action-graph`,
    version: '1.0.0',
    description: 'Context-action handler flow used by provider order validation.',
    entryPipeId: 'validate-input',
    pipes: [
      createPipe('validate-input', `${featureId}.submit`, 'validation'),
      createPipe('compute-result', `${featureId}.validated`, 'mapping'),
      createPipe('persist-result', `${featureId}.computed`, 'settlement'),
      createPipe('log-event', `${featureId}.submitted`, 'emission'),
      createPipe('render-view', `${featureId}.state_changed`, 'response'),
    ],
    connections: [
      { from: 'validate-input', to: 'compute-result', kind: 'next' },
      { from: 'compute-result', to: 'persist-result', kind: 'next' },
      { from: 'persist-result', to: 'log-event', kind: 'next' },
      { from: 'log-event', to: 'render-view', kind: 'event' },
    ],
  };
}

function createPipe(pipeId: string, eventKey: string, facet: string) {
  return {
    pipeId,
    version: '1.0.0',
    trigger: { eventKey },
    flow: { kind: 'step' as const, facet, eventKey },
    scope: 'feature',
    aspect: 'func_def',
  };
}
