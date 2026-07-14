export type ContractMetadata = Readonly<Record<string, unknown>>;

export interface ReusableReference {
  readonly id: string;
  readonly label?: string;
  readonly uri?: string;
  readonly metadata?: ContractMetadata;
}

export interface ReusableReferenceInput {
  readonly id: string;
  readonly label?: string;
  readonly uri?: string;
  readonly metadata?: ContractMetadata | null;
}

export interface PromptTemplateContext {
  readonly purpose?: string;
  readonly background?: string;
  readonly audience?: string;
  readonly currentState?: string;
}

export interface PromptTemplateReferences {
  readonly rag: readonly ReusableReference[];
  readonly examples: readonly ReusableReference[];
  readonly skills: readonly ReusableReference[];
  readonly policies: readonly ReusableReference[];
}

export interface PromptTemplateReferencesInput {
  readonly rag?: readonly ReusableReferenceInput[] | null;
  readonly examples?: readonly ReusableReferenceInput[] | null;
  readonly skills?: readonly ReusableReferenceInput[] | null;
  readonly policies?: readonly ReusableReferenceInput[] | null;
}

export interface PromptTemplateOutputSpec {
  readonly format?: string;
  readonly length?: string;
  readonly language?: string;
  readonly structure: readonly string[];
}

export interface PromptTemplateOutputSpecInput {
  readonly format?: string | null;
  readonly length?: string | null;
  readonly language?: string | null;
  readonly structure?: readonly string[] | null;
}

export interface PromptTemplateConstraints {
  readonly tone?: string;
  readonly mustInclude: readonly string[];
  readonly mustExclude: readonly string[];
  readonly forbiddenActions: readonly string[];
}

export interface PromptTemplateConstraintsInput {
  readonly tone?: string | null;
  readonly mustInclude?: readonly string[] | null;
  readonly mustExclude?: readonly string[] | null;
  readonly forbiddenActions?: readonly string[] | null;
}

export interface PromptTemplate {
  readonly id: string;
  readonly role: string;
  readonly context: PromptTemplateContext;
  readonly references: PromptTemplateReferences;
  readonly request: string;
  readonly output: PromptTemplateOutputSpec;
  readonly constraints: PromptTemplateConstraints;
  readonly successCriteria: readonly string[];
  readonly metadata: ContractMetadata;
}

export interface PromptTemplateInput {
  readonly id: string;
  readonly role?: string | null;
  readonly context?: PromptTemplateContext | null;
  readonly references?: PromptTemplateReferencesInput | null;
  readonly request?: string | null;
  readonly output?: PromptTemplateOutputSpecInput | null;
  readonly constraints?: PromptTemplateConstraintsInput | null;
  readonly successCriteria?: readonly string[] | null;
  readonly metadata?: ContractMetadata | null;
}

export interface RequestContract {
  readonly id: string;
  readonly role: string;
  readonly context: {
    readonly purpose?: string;
    readonly background?: string;
    readonly audience?: string;
    readonly currentState?: string;
  };
  readonly goal: string;
  readonly task: {
    readonly instruction: string;
  };
  readonly outputSpec: PromptTemplateOutputSpec;
  readonly constraints: PromptTemplateConstraints;
  readonly successCriteria: readonly string[];
  readonly reusableReferences: PromptTemplateReferences;
  readonly metadata: ContractMetadata;
}

export type ContractDiagnosticSeverity = 'error' | 'warning';

export interface ContractDiagnostic {
  readonly code: string;
  readonly severity: ContractDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly metadata: ContractMetadata;
}

export interface RequestContractValidation {
  readonly valid: boolean;
  readonly diagnostics: readonly ContractDiagnostic[];
}

export interface ObservationArtifact {
  readonly id: string;
  readonly kind: string;
  readonly summary?: string;
  readonly metadata: ContractMetadata;
}

export interface ObservationArtifactInput {
  readonly id: string;
  readonly kind: string;
  readonly summary?: string;
  readonly metadata?: ContractMetadata | null;
}

export interface ObservationError {
  readonly code: string;
  readonly message: string;
  readonly blocking?: boolean;
  readonly metadata: ContractMetadata;
}

export interface ObservationErrorInput {
  readonly code: string;
  readonly message: string;
  readonly blocking?: boolean | null;
  readonly metadata?: ContractMetadata | null;
}

export interface ConstraintSignal {
  readonly rule: string;
  readonly violated: boolean;
  readonly message?: string;
  readonly metadata: ContractMetadata;
}

export interface ConstraintSignalInput {
  readonly rule: string;
  readonly violated: boolean;
  readonly message?: string;
  readonly metadata?: ContractMetadata | null;
}

export interface ObservationContract {
  readonly id: string;
  readonly completed: boolean;
  readonly artifacts: readonly ObservationArtifact[];
  readonly logs: readonly string[];
  readonly errors: readonly ObservationError[];
  readonly usedActions: readonly string[];
  readonly constraintSignals: readonly ConstraintSignal[];
  readonly metadata: ContractMetadata;
}

export interface ObservationContractInput {
  readonly id: string;
  readonly completed?: boolean | null;
  readonly artifacts?: readonly ObservationArtifactInput[] | null;
  readonly logs?: readonly string[] | null;
  readonly errors?: readonly ObservationErrorInput[] | null;
  readonly usedActions?: readonly string[] | null;
  readonly constraintSignals?: readonly ConstraintSignalInput[] | null;
  readonly metadata?: ContractMetadata | null;
}

export type EvaluationStatus = 'success' | 'partial' | 'failure' | 'blocked';

export interface EvaluationFinding {
  readonly code: string;
  readonly message: string;
  readonly severity: ContractDiagnosticSeverity;
  readonly metadata: ContractMetadata;
}

export interface EvaluationResult {
  readonly status: EvaluationStatus;
  readonly findings: readonly EvaluationFinding[];
  readonly replanRequired: boolean;
}
