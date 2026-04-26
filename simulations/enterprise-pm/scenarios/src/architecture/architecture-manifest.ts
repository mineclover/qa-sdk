export interface ArchitectureConceptSource {
  readonly id: string;
  readonly title: string;
  readonly sourcePath: string;
}

export interface SimulationTarget {
  readonly kind: "service" | "package" | "contract" | "scenario" | "metadata";
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
    id: "domain-layering",
    title: "도메인 계층 구조 및 모듈 설계 표준",
    sourcePath: "/Users/junwoobang/document/아키텍처/도메인-계층-구조-및-모듈-설계-표준.md",
  },
  {
    id: "write-model-command",
    title: "Write Model 및 Command 인터페이스 명세",
    sourcePath: "/Users/junwoobang/document/아키텍처/Write-Model-및-Command-인터페이스-명세서.md",
  },
  {
    id: "read-model-query",
    title: "Read Model 및 조회 인터페이스 명세",
    sourcePath: "/Users/junwoobang/document/아키텍처/Read-Model-및-조회-인터페이스-명세서.md",
  },
  {
    id: "saga-outbox",
    title: "Saga 트랜잭션 및 이벤트 처리 명세",
    sourcePath: "/Users/junwoobang/document/아키텍처/Saga-트랜잭션-및-이벤트-처리-명세서.md",
  },
  {
    id: "data-governance",
    title: "데이터 거버넌스 및 메타데이터 관리 전략",
    sourcePath: "/Users/junwoobang/document/아키텍처/데이터-거버넌스-및-메타데이터-관리-전략.md",
  },
  {
    id: "metadata-quality",
    title: "메타데이터 태깅 및 데이터 품질 구현 규약",
    sourcePath: "/Users/junwoobang/document/아키텍처/메타데이터-태깅-및-데이터-품질-구현-규약.md",
  },
  {
    id: "openapi-contract",
    title: "API 계약 병합 관리",
    sourcePath: "/Users/junwoobang/workflow/oa-sdk/packages/schemas/scripts/merge.ts",
  },
];

export const ARCHITECTURE_SIMULATION_SLICES: readonly ArchitectureSimulationSlice[] = [
  {
    id: "assignment-command-write-model",
    sourceIds: ["domain-layering", "write-model-command", "saga-outbox"],
    summary: "Assignment command API는 목적형 command DTO, aggregate invariant, repository port, outbox 원자성을 시뮬레이션한다.",
    targets: [
      {
        kind: "service",
        path: "simulations/enterprise-pm/services/pm-api/src/pm/assignment",
        responsibility: "ManagerAssignment aggregate/use case/port/adapter 구현 후보 위치.",
      },
      {
        kind: "scenario",
        path: "simulations/enterprise-pm/scenarios/src/scenarios",
        responsibility: "담당자 배정 command 성공/보상/권한 실패 흐름을 실행한다.",
      },
      {
        kind: "contract",
        path: "simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml",
        responsibility: "Assignment command API OpenAPI fragment.",
      },
    ],
  },
  {
    id: "assignment-read-model-sync",
    sourceIds: ["read-model-query", "saga-outbox", "data-governance"],
    summary: "Outbox event에서 read model updater로 이어지는 eventual consistency와 back-query composition을 시뮬레이션한다.",
    targets: [
      {
        kind: "service",
        path: "simulations/enterprise-pm/services/reporting-api/src",
        responsibility: "Assignment read model 조회/분석 API 후보 위치.",
      },
      {
        kind: "metadata",
        path: "simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml",
        responsibility: "Read API contract와 lineage metadata seed를 같은 domain fragment에서 추적한다.",
      },
    ],
  },
  {
    id: "openmetadata-governance-seed",
    sourceIds: ["data-governance", "metadata-quality"],
    summary: "Domain/Team, glossary, lineage, data quality test skeleton을 OpenMetadata seed로 시뮬레이션한다.",
    targets: [
      {
        kind: "metadata",
        path: "simulations/enterprise-pm/metadata/openmetadata",
        responsibility: "OpenMetadata domain/team/glossary/lineage/data-quality seed 후보 위치.",
      },
      {
        kind: "contract",
        path: "simulations/enterprise-pm/contracts/openapi",
        responsibility: "API contract와 governance tags가 같은 domain owner 기준으로 병합된다.",
      },
    ],
  },
  {
    id: "oa-sdk-openapi-merge-gate",
    sourceIds: ["openapi-contract"],
    summary: "서비스별 OpenAPI fragment를 oa-sdk merge 규칙으로 병합해 path/component 충돌을 gate로 삼는다.",
    targets: [
      {
        kind: "contract",
        path: "simulations/enterprise-pm/contracts/openapi/src",
        responsibility: "oa-sdk packages/schemas layout과 같은 base/profile/domain fragment 구조.",
      },
    ],
  },
];

export function findSimulationSlice(id: string): ArchitectureSimulationSlice | undefined {
  return ARCHITECTURE_SIMULATION_SLICES.find((slice) => slice.id === id);
}

