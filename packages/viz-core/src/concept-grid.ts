// @def.boundary viz-system-root
// @def.doc viz-system-root

export interface ConceptGridColumn {
  id: string;
  label: string;
  summary: string;
}

export interface ConceptGridRow {
  id: string;
  label: string;
  summary: string;
  unitScale: number;
}

export interface ConceptGridCell {
  id: string;
  label: string;
  summary: string;
  columnId: string;
  rowId: string;
  docId?: string;
  tags?: readonly string[];
}

export interface ConceptGridBoundary {
  id: string;
  label: string;
  summary: string;
  columnIds: readonly string[];
  rowIds: readonly string[];
}

export interface ConceptGridLink {
  sourceId: string;
  targetId: string;
  kind: "derives" | "constrains" | "verifies" | "bridges";
}

export interface ConceptHierarchyGrid {
  columns: readonly ConceptGridColumn[];
  rows: readonly ConceptGridRow[];
  cells: readonly ConceptGridCell[];
  boundaries: readonly ConceptGridBoundary[];
  links: readonly ConceptGridLink[];
}

const COLUMNS: readonly ConceptGridColumn[] = [
  {
    id: "definition",
    label: "문서 좌표",
    summary: "scope/level/layer처럼 문서를 선언하는 좌표 세계",
  },
  {
    id: "semantic",
    label: "패싯 · 바운더리",
    summary: "데이터 역할, 바운더리, 계약 하향, 검증 단위를 정의하는 의미 세계",
  },
  {
    id: "nesting",
    label: "Nesting Context",
    summary: "provider pattern, mount flow, test phase처럼 위에서 아래로 계약이 전개되는 실행 세계",
  },
  {
    id: "verification",
    label: "검증 · 추적",
    summary: "quality gate, claim audit, code-doc link처럼 증거를 남기는 검증 세계",
  },
] as const;

const ROWS: readonly ConceptGridRow[] = [
  {
    id: "foundation",
    label: "L0 기초 개념",
    summary: "세계관과 분류축. 가장 넓은 의미 단위",
    unitScale: 1,
  },
  {
    id: "boundary",
    label: "L1 구조 단위",
    summary: "바운더리와 역할을 결정하는 구조 단위",
    unitScale: 0.92,
  },
  {
    id: "composition",
    label: "L2 조합 구조",
    summary: "하향 계약, provider, mount 같은 조합 규칙",
    unitScale: 0.84,
  },
  {
    id: "verification-unit",
    label: "L3 검증 단위",
    summary: "테스트나 gate로 직접 판정 가능한 더 작은 단위",
    unitScale: 0.76,
  },
] as const;

const CELLS: readonly ConceptGridCell[] = [
  {
    id: "definition-taxonomy",
    label: "문서 좌표",
    summary: "scope × aspect × depth와 level을 통해 문서의 정체성을 잡는다.",
    columnId: "definition",
    rowId: "foundation",
    docId: "definition-taxonomy",
    tags: ["scope", "aspect", "depth", "level"],
  },
  {
    id: "system-concepts",
    label: "데이터 패싯",
    summary: "생산·소비·정의·관리·저장으로 데이터 역할을 자른다.",
    columnId: "semantic",
    rowId: "foundation",
    docId: "ms-concept-data-facets",
    tags: ["facet"],
  },
  {
    id: "scope-nesting-system",
    label: "Scope Context",
    summary: "scope가 어떤 계약을 제공하고 소비하는지 선언한다.",
    columnId: "nesting",
    rowId: "foundation",
    docId: "scope-nesting-system",
    tags: ["scope", "context"],
  },
  {
    id: "definition-quality-gates",
    label: "Quality Gate",
    summary: "문서·코드·테스트를 기계적으로 판정하는 검증 루프다.",
    columnId: "verification",
    rowId: "foundation",
    docId: "definition-quality-gates",
    tags: ["gate"],
  },
  {
    id: "definition-level",
    label: "DefLevel",
    summary: "group/module/leaf로 문서의 역할 높낮이를 잡는다.",
    columnId: "definition",
    rowId: "boundary",
    docId: "definition-level",
    tags: ["group", "module", "leaf"],
  },
  {
    id: "ms-concept-boundary",
    label: "Boundary",
    summary: "패싯 중 일부가 존재하는, 독립 검증 가능한 기능 단위다.",
    columnId: "semantic",
    rowId: "boundary",
    docId: "ms-concept-boundary",
    tags: ["boundary"],
  },
  {
    id: "scope-nesting-provider-patterns",
    label: "Provider Pattern",
    summary: "override/optional/resolution/lifecycle로 nesting context를 제어한다.",
    columnId: "nesting",
    rowId: "boundary",
    docId: "scope-nesting-provider-patterns",
    tags: ["provider"],
  },
  {
    id: "definition-quality-contract",
    label: "Claim Audit",
    summary: "quality gate 결과와 contract marker를 합성해 claim verdict를 낸다.",
    columnId: "verification",
    rowId: "boundary",
    docId: "definition-quality-contract",
    tags: ["claim", "audit"],
  },
  {
    id: "definition-mgmt-coordinates",
    label: "문서 Scope 관리",
    summary: "문서를 어떤 scope와 aspect로 선언할지 관리 흐름으로 정한다.",
    columnId: "definition",
    rowId: "composition",
    docId: "definition-mgmt-coordinates",
    tags: ["classification"],
  },
  {
    id: "ms-concept-contract-descent",
    label: "Contract Descent",
    summary: "계약은 위에서 아래로 내려가고 각 바운더리는 자기가 소비할 계약만 안다.",
    columnId: "semantic",
    rowId: "composition",
    docId: "ms-concept-contract-descent",
    tags: ["contract"],
  },
  {
    id: "scope-nesting-mount-flow",
    label: "Mount Flow",
    summary: "scope 마운트 순서와 pipe 실행을 연결해 활성 계약 시점을 검증한다.",
    columnId: "nesting",
    rowId: "composition",
    docId: "scope-nesting-mount-flow",
    tags: ["mount", "pipe"],
  },
  {
    id: "definition-code-link-coverage",
    label: "Code ↔ Doc Link",
    summary: "source:/@def.doc/@def.boundary로 코드와 문서를 explicit하게 연결한다.",
    columnId: "verification",
    rowId: "composition",
    docId: "definition-code-link-coverage",
    tags: ["code-link"],
  },
  {
    id: "definition-boundary-doc",
    label: "Boundary Doc",
    summary: "group/module/leaf 문서가 실제 boundary를 드러내는 선언 단위다.",
    columnId: "definition",
    rowId: "verification-unit",
    docId: "definition-boundary-workflow",
    tags: ["doc"],
  },
  {
    id: "ms-concept-verification-unit",
    label: "Verification Unit",
    summary: "독립적으로 테스트 가능한 함수/컴포넌트 레벨의 최소 코드 단위다.",
    columnId: "semantic",
    rowId: "verification-unit",
    docId: "ms-concept-verification-unit",
    tags: ["function", "component"],
  },
  {
    id: "test-phase-propagation",
    label: "Test Phase",
    summary: "precondition/act/assert 같은 테스트 단계를 위에서 아래로 선언한다.",
    columnId: "nesting",
    rowId: "verification-unit",
    docId: "test-phase-propagation",
    tags: ["test-phase"],
  },
  {
    id: "gate-definition-quality-cli",
    label: "Gate Doc / Evidence",
    summary: "구체 gate 문서와 실행 결과가 최종 검증 증거가 된다.",
    columnId: "verification",
    rowId: "verification-unit",
    docId: "gate-definition-quality-cli",
    tags: ["gate-doc", "evidence"],
  },
] as const;

const BOUNDARIES: readonly ConceptGridBoundary[] = [
  {
    id: "definition-boundary-plane",
    label: "문서 선언 경계",
    summary: "문서 좌표, level, boundary doc이 한 줄기로 연결된다.",
    columnIds: ["definition"],
    rowIds: ["foundation", "boundary", "composition", "verification-unit"],
  },
  {
    id: "semantic-boundary-plane",
    label: "의미 경계",
    summary: "패싯에서 시작해 바운더리와 계약 하향, 검증 단위로 내려간다.",
    columnIds: ["semantic"],
    rowIds: ["foundation", "boundary", "composition", "verification-unit"],
  },
  {
    id: "nesting-boundary-plane",
    label: "Nesting 경계",
    summary: "scope context가 provider pattern과 mount flow를 거쳐 test phase로 내려간다.",
    columnIds: ["nesting"],
    rowIds: ["foundation", "boundary", "composition", "verification-unit"],
  },
  {
    id: "verification-boundary-plane",
    label: "검증 경계",
    summary: "quality gate가 claim audit, code-doc link, gate evidence를 묶는다.",
    columnIds: ["verification"],
    rowIds: ["foundation", "boundary", "composition", "verification-unit"],
  },
] as const;

const LINKS: readonly ConceptGridLink[] = [
  { sourceId: "definition-taxonomy", targetId: "definition-level", kind: "derives" },
  { sourceId: "definition-level", targetId: "definition-boundary-doc", kind: "derives" },
  { sourceId: "system-concepts", targetId: "ms-concept-boundary", kind: "derives" },
  { sourceId: "ms-concept-boundary", targetId: "ms-concept-contract-descent", kind: "constrains" },
  { sourceId: "ms-concept-contract-descent", targetId: "scope-nesting-provider-patterns", kind: "bridges" },
  { sourceId: "scope-nesting-system", targetId: "scope-nesting-provider-patterns", kind: "derives" },
  { sourceId: "scope-nesting-provider-patterns", targetId: "scope-nesting-mount-flow", kind: "derives" },
  { sourceId: "scope-nesting-mount-flow", targetId: "test-phase-propagation", kind: "verifies" },
  { sourceId: "ms-concept-contract-descent", targetId: "definition-code-link-coverage", kind: "bridges" },
  { sourceId: "definition-quality-gates", targetId: "definition-quality-contract", kind: "derives" },
  { sourceId: "definition-quality-contract", targetId: "definition-code-link-coverage", kind: "constrains" },
  { sourceId: "definition-code-link-coverage", targetId: "gate-definition-quality-cli", kind: "verifies" },
] as const;

export function buildConceptHierarchyGrid(): ConceptHierarchyGrid {
  return {
    columns: COLUMNS,
    rows: ROWS,
    cells: CELLS,
    boundaries: BOUNDARIES,
    links: LINKS,
  };
}
