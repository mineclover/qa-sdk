import type {
  ConstraintSignal,
  ConstraintSignalInput,
  ContractMetadata,
  ObservationArtifact,
  ObservationArtifactInput,
  ObservationContract,
  ObservationContractInput,
  ObservationError,
  ObservationErrorInput,
  PromptTemplate,
  PromptTemplateInput,
  PromptTemplateReferences,
  PromptTemplateReferencesInput,
  ReusableReference,
  ReusableReferenceInput,
  RequestContract,
} from './types.js';

const EMPTY_METADATA: ContractMetadata = Object.freeze({});

function trimValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeStringList(values: readonly string[] | null | undefined): readonly string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function metadataOf(metadata: ContractMetadata | null | undefined): ContractMetadata {
  return metadata ?? EMPTY_METADATA;
}

function normalizeReference(input: ReusableReferenceInput): ReusableReference {
  let reference: ReusableReference = {
    id: input.id.trim(),
  };

  const label = input.label?.trim();
  const uri = input.uri?.trim();
  if (label) {
    reference = { ...reference, label };
  }

  if (uri) {
    reference = { ...reference, uri };
  }

  if (input.metadata != null) {
    reference = { ...reference, metadata: input.metadata };
  }

  return reference;
}

function normalizeReferenceList(
  inputs: readonly ReusableReferenceInput[] | null | undefined,
): readonly ReusableReference[] {
  return (inputs ?? []).map(normalizeReference).filter((reference) => reference.id.length > 0);
}

function normalizeReferences(
  references: PromptTemplateReferencesInput | null | undefined,
): PromptTemplateReferences {
  return {
    rag: normalizeReferenceList(references?.rag),
    examples: normalizeReferenceList(references?.examples),
    skills: normalizeReferenceList(references?.skills),
    policies: normalizeReferenceList(references?.policies),
  };
}

export function normalizePromptTemplate(input: PromptTemplateInput): PromptTemplate {
  return {
    id: input.id.trim(),
    role: trimValue(input.role),
    context: {
      purpose: trimValue(input.context?.purpose) || undefined,
      background: trimValue(input.context?.background) || undefined,
      audience: trimValue(input.context?.audience) || undefined,
      currentState: trimValue(input.context?.currentState) || undefined,
    },
    references: normalizeReferences(input.references),
    request: trimValue(input.request),
    output: {
      format: trimValue(input.output?.format) || undefined,
      length: trimValue(input.output?.length) || undefined,
      language: trimValue(input.output?.language) || undefined,
      structure: normalizeStringList(input.output?.structure),
    },
    constraints: {
      tone: trimValue(input.constraints?.tone) || undefined,
      mustInclude: normalizeStringList(input.constraints?.mustInclude),
      mustExclude: normalizeStringList(input.constraints?.mustExclude),
      forbiddenActions: normalizeStringList(input.constraints?.forbiddenActions),
    },
    successCriteria: normalizeStringList(input.successCriteria),
    metadata: metadataOf(input.metadata),
  };
}

export function createRequestContract(template: PromptTemplate): RequestContract {
  return {
    id: template.id,
    role: template.role,
    context: template.context,
    goal: template.request,
    task: {
      instruction: template.request,
    },
    outputSpec: template.output,
    constraints: template.constraints,
    successCriteria: template.successCriteria,
    reusableReferences: template.references,
    metadata: template.metadata,
  };
}

function normalizeArtifact(input: ObservationArtifactInput): ObservationArtifact {
  return {
    id: input.id.trim(),
    kind: input.kind.trim(),
    summary: input.summary?.trim() || undefined,
    metadata: metadataOf(input.metadata),
  };
}

function normalizeError(input: ObservationErrorInput): ObservationError {
  return {
    code: input.code.trim(),
    message: input.message.trim(),
    blocking: input.blocking ?? undefined,
    metadata: metadataOf(input.metadata),
  };
}

function normalizeConstraintSignal(input: ConstraintSignalInput): ConstraintSignal {
  return {
    rule: input.rule.trim(),
    violated: input.violated,
    message: input.message?.trim() || undefined,
    metadata: metadataOf(input.metadata),
  };
}

export function normalizeObservationContract(input: ObservationContractInput): ObservationContract {
  return {
    id: input.id.trim(),
    completed: input.completed ?? false,
    artifacts: (input.artifacts ?? []).map(normalizeArtifact),
    logs: normalizeStringList(input.logs),
    errors: (input.errors ?? []).map(normalizeError),
    usedActions: normalizeStringList(input.usedActions),
    constraintSignals: (input.constraintSignals ?? []).map(normalizeConstraintSignal),
    metadata: metadataOf(input.metadata),
  };
}
