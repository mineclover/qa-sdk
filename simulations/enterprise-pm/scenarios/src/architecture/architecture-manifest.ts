export interface ArchitectureConceptSource {
  readonly id: string;
  readonly title: string;
  readonly sourcePath: string;
}

export interface SimulationTarget {
  readonly kind: 'service' | 'package' | 'contract' | 'scenario' | 'metadata';
  readonly path: string;
  readonly responsibility: string;
}

export interface ArchitectureSimulationSlice {
  readonly id: string;
  readonly sourceIds: readonly string[];
  readonly summary: string;
  readonly targets: readonly SimulationTarget[];
}

export const ARCHITECTURE_CONCEPT_SOURCES: readonly ArchitectureConceptSource[] = [
  {
    id: 'domain-layering',
    title: '도메인 계층 구조 및 모듈 설계 표준',
    sourcePath: '/Users/junwoobang/document/아키텍처/도메인-계층-구조-및-모듈-설계-표준.md',
  },
  {
    id: 'write-model-command',
    title: 'Write Model 및 Command 인터페이스 명세',
    sourcePath: '/Users/junwoobang/document/아키텍처/Write-Model-및-Command-인터페이스-명세서.md',
  },
  {
    id: 'read-model-query',
    title: 'Read Model 및 조회 인터페이스 명세',
    sourcePath: '/Users/junwoobang/document/아키텍처/Read-Model-및-조회-인터페이스-명세서.md',
  },
  {
    id: 'saga-outbox',
    title: 'Saga 트랜잭션 및 이벤트 처리 명세',
    sourcePath: '/Users/junwoobang/document/아키텍처/Saga-트랜잭션-및-이벤트-처리-명세서.md',
  },
  {
    id: 'data-governance',
    title: '데이터 거버넌스 및 메타데이터 관리 전략',
    sourcePath: '/Users/junwoobang/document/아키텍처/데이터-거버넌스-및-메타데이터-관리-전략.md',
  },
  {
    id: 'metadata-quality',
    title: '메타데이터 태깅 및 데이터 품질 구현 규약',
    sourcePath: '/Users/junwoobang/document/아키텍처/메타데이터-태깅-및-데이터-품질-구현-규약.md',
  },
  {
    id: 'openapi-contract',
    title: 'API 계약 병합 관리',
    sourcePath: '/Users/junwoobang/workflow/oa-sdk/packages/schemas/scripts/merge.ts',
  },
];

export const ARCHITECTURE_SIMULATION_SLICES: readonly ArchitectureSimulationSlice[] = [
  {
    id: 'assignment-command-write-model',
    sourceIds: ['domain-layering', 'write-model-command', 'saga-outbox'],
    summary:
      'Assignment command API는 목적형 command DTO, aggregate invariant, repository port, outbox 원자성을 시뮬레이션한다.',
    targets: [
      {
        kind: 'service',
        path: 'simulations/enterprise-pm/services/pm-api/src/pm/assignment',
        responsibility: 'ManagerAssignment aggregate/use case/port/adapter 구현 후보 위치.',
      },
      {
        kind: 'scenario',
        path: 'simulations/enterprise-pm/scenarios/src/scenarios',
        responsibility: '담당자 배정 command 성공/보상/권한 실패 흐름을 실행한다.',
      },
      {
        kind: 'contract',
        path: 'simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml',
        responsibility: 'Assignment command API OpenAPI fragment.',
      },
    ],
  },
  {
    id: 'assignment-read-model-sync',
    sourceIds: ['read-model-query', 'saga-outbox', 'data-governance'],
    summary:
      'Outbox event에서 read model updater로 이어지는 eventual consistency와 back-query composition을 시뮬레이션한다.',
    targets: [
      {
        kind: 'service',
        path: 'simulations/enterprise-pm/services/reporting-api/src',
        responsibility: 'Assignment read model 조회/분석 API 후보 위치.',
      },
      {
        kind: 'metadata',
        path: 'simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml',
        responsibility:
          'Read API contract와 lineage metadata seed를 같은 domain fragment에서 추적한다.',
      },
    ],
  },
  {
    id: 'openmetadata-governance-seed',
    sourceIds: ['data-governance', 'metadata-quality'],
    summary:
      'Domain/Team, glossary, lineage, data quality test skeleton을 OpenMetadata seed로 시뮬레이션한다.',
    targets: [
      {
        kind: 'metadata',
        path: 'simulations/enterprise-pm/metadata/openmetadata',
        responsibility: 'OpenMetadata domain/team/glossary/lineage/data-quality seed 후보 위치.',
      },
      {
        kind: 'contract',
        path: 'simulations/enterprise-pm/contracts/openapi',
        responsibility: 'API contract와 governance tags가 같은 domain owner 기준으로 병합된다.',
      },
    ],
  },
  {
    id: 'oa-sdk-openapi-merge-gate',
    sourceIds: ['openapi-contract'],
    summary:
      '서비스별 OpenAPI fragment를 oa-sdk merge 규칙으로 병합해 path/component 충돌을 gate로 삼는다.',
    targets: [
      {
        kind: 'contract',
        path: 'simulations/enterprise-pm/contracts/openapi/src',
        responsibility: 'oa-sdk packages/schemas layout과 같은 base/profile/domain fragment 구조.',
      },
    ],
  },
];

export function findSimulationSlice(id: string): ArchitectureSimulationSlice | undefined {
  return ARCHITECTURE_SIMULATION_SLICES.find((slice) => slice.id === id);
}

/**
 * Phase 0–3 마이그레이션 결과 슬라이스 인벤토리 (24건).
 *
 * `ARCHITECTURE_SIMULATION_SLICES` 가 외부 아키텍처 *개념* → 시뮬레이션 위치를
 * 매핑한다면, 본 인벤토리는 실제로 마이그레이션된 슬라이스 디렉터리와 그 산출물
 * 위치를 추적한다. cross-slice-conventions.test 와 architecture-manifest.test
 * 의 fileExists 검증 입력으로 사용된다.
 */
export interface MigrationSliceTarget {
  readonly kind: 'service' | 'metadata' | 'contract';
  readonly path: string;
}

export interface MigrationSlice {
  readonly id: string;
  readonly service: string;
  readonly domain: string;
  readonly kind: 'service' | 'read-model' | 'bff' | 'command-only' | 'read-mostly';
  readonly targets: readonly MigrationSliceTarget[];
  readonly responsibility: string;
}

const SIM_ROOT = 'simulations/enterprise-pm';

function buildSlice(
  service: string,
  domain: string,
  slicePath: string,
  fragmentName: string,
  kind: MigrationSlice['kind'],
  responsibility: string,
): MigrationSlice {
  return {
    id: `${service}/${fragmentName}`,
    service,
    domain,
    kind,
    targets: [
      { kind: 'service', path: `${SIM_ROOT}/${slicePath}` },
      { kind: 'metadata', path: `${SIM_ROOT}/${slicePath}/metadata/openmetadata.seed.json` },
      {
        kind: 'contract',
        path: `${SIM_ROOT}/contracts/openapi/src/domains/${fragmentName}/spec.yaml`,
      },
    ],
    responsibility,
  };
}

export const ARCHITECTURE_MIGRATION_SLICES: readonly MigrationSlice[] = [
  // pm-api (4)
  buildSlice(
    'pm-api',
    'pm',
    'services/pm-api/src/pm/assignment',
    'assignment',
    'service',
    'Phase 1 reference: ManagerAssignment aggregate + outbox + read-model.',
  ),
  buildSlice(
    'pm-api',
    'pm',
    'services/pm-api/src/pm/project',
    'project',
    'service',
    'Project lifecycle (draft→active→archived) + delegation graph + access policy.',
  ),
  buildSlice(
    'pm-api',
    'pm',
    'services/pm-api/src/pm/task',
    'task',
    'service',
    'Task state machine (todo→in_progress→done) + assignment link.',
  ),
  buildSlice(
    'pm-api',
    'pm',
    'services/pm-api/src/pm/member',
    'member',
    'service',
    'Project membership + role transition policy.',
  ),
  // approval-api (4)
  buildSlice(
    'approval-api',
    'approval',
    'services/approval-api/src/approval/budget',
    'budget',
    'service',
    'Budget request + access service coupling + decision lifecycle.',
  ),
  buildSlice(
    'approval-api',
    'approval',
    'services/approval-api/src/approval/expense',
    'expense',
    'service',
    'Expense report submit/review/approve flow.',
  ),
  buildSlice(
    'approval-api',
    'approval',
    'services/approval-api/src/approval/resource',
    'resource',
    'service',
    'Resource request approval + resource-policy lookup.',
  ),
  buildSlice(
    'approval-api',
    'approval',
    'services/approval-api/src/approval/timeoff',
    'timeoff',
    'service',
    'Time-off request + status transitions.',
  ),
  // auth-api (6)
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/user',
    'user',
    'service',
    'User aggregate + credential lookup.',
  ),
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/role',
    'role',
    'service',
    'Role aggregate + permission catalog.',
  ),
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/role-assignment',
    'role-assignment',
    'service',
    'User↔Role binding + bitmap cache invalidation.',
  ),
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/department',
    'department',
    'service',
    'Department hierarchy + cycle detection.',
  ),
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/authenticate',
    'authenticate',
    'command-only',
    'Command-only login + credential verification (no aggregate).',
  ),
  buildSlice(
    'auth-api',
    'auth',
    'services/auth-api/src/auth/bitmap',
    'bitmap',
    'read-mostly',
    'Authorization bitmap cache + issuer query.',
  ),
  // document-api (3)
  buildSlice(
    'document-api',
    'document',
    'services/document-api/src/document/document',
    'document',
    'service',
    'Document aggregate + version chain root.',
  ),
  buildSlice(
    'document-api',
    'document',
    'services/document-api/src/document/comment',
    'comment',
    'service',
    'Comment thread + cross-domain document existence check.',
  ),
  buildSlice(
    'document-api',
    'document',
    'services/document-api/src/document/version',
    'version',
    'service',
    'Document version history.',
  ),
  // notification-api (2)
  buildSlice(
    'notification-api',
    'notification',
    'services/notification-api/src/notification/notification',
    'notification',
    'service',
    'Notification aggregate + delivery state machine.',
  ),
  buildSlice(
    'notification-api',
    'notification',
    'services/notification-api/src/notification/subscription',
    'subscription',
    'service',
    'Subscription per (user, eventType) composite key.',
  ),
  // reporting-api (3 read-model)
  buildSlice(
    'reporting-api',
    'reporting',
    'services/reporting-api/src/reporting/report',
    'report',
    'read-model',
    'Report read-model + admin upsert command.',
  ),
  buildSlice(
    'reporting-api',
    'reporting',
    'services/reporting-api/src/reporting/metric',
    'metric',
    'read-model',
    'Time-series metric read-model.',
  ),
  buildSlice(
    'reporting-api',
    'reporting',
    'services/reporting-api/src/density',
    'density',
    'read-model',
    'Density distribution read-model + cross-domain key observation query.',
  ),
  // audit-browser-api (2 BFF)
  buildSlice(
    'audit-browser-api',
    'audit-browser',
    'services/audit-browser-api/src/audit-explorer',
    'audit-explorer',
    'bff',
    'Audit trace BFF — composes audit recorder + auth lookups.',
  ),
  buildSlice(
    'audit-browser-api',
    'audit-browser',
    'services/audit-browser-api/src/graph-explorer',
    'graph-explorer',
    'bff',
    'Graph snapshot BFF — composes authorization-ontology + retention insight.',
  ),
];
