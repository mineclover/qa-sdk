// @def.doc ralph-tui-integration#completed-ralph-prd
import {
  deduplicateCompletedRecords,
  isActiveCompletedRecordDocument,
  type CompletedRecordState,
  type DocumentEnvelope,
} from "doc-envelope";

export interface CompletedRalphPrdDetectionOptions {
  readonly documents: readonly DocumentEnvelope[];
}

/**
 * ralph-tui가 생성한 `.ralph-prd-json` 파일 중 모든 user story가
 * `passes: true`인 경우, 짝을 이루는 `.prd` markdown을 completed record로
 * 감지한다. 본 함수는 ralph-tui-integration 소유로, `doc-envelope`의
 * `.todo.md` 감지와 직교한다. caller는 두 결과를 `deduplicateCompletedRecords`
 * 로 병합한다.
 */
export function detectCompletedRalphPrdRecords(
  options: CompletedRalphPrdDetectionOptions,
): readonly CompletedRecordState[] {
  const activeDocuments = options.documents.filter(isActiveCompletedRecordDocument);
  const ralphPrdByFamilyId = new Map(
    activeDocuments
      .filter((document) =>
        document.kind === "ralph-prd-json"
        && storyCompletionOf(document).allStoriesPassing
      )
      .map((document) => [document.familyId ?? document.stableId, document]),
  );

  const records: CompletedRecordState[] = [];
  for (const document of activeDocuments) {
    if (document.kind !== "prd") continue;
    const paired = ralphPrdByFamilyId.get(document.familyId ?? document.stableId);
    if (!paired) continue;
    const completion = storyCompletionOf(paired);
    records.push({
      source: document.adapterId,
      kind: document.kind,
      documentId: document.stableId,
      path: document.path,
      state: "completed-record",
      title: titleOf(document),
      ...lifecycleOf(document),
      storyCount: completion.storyCount,
      passedStoryCount: completion.passedStoryCount,
      pairedDocumentId: paired.stableId,
      pairedPath: paired.path,
      reason: "paired ralph PRD JSON has all stories passing",
    });
  }

  return deduplicateCompletedRecords(records);
}

function storyCompletionOf(document: DocumentEnvelope): {
  readonly storyCount: number;
  readonly passedStoryCount: number;
  readonly allStoriesPassing: boolean;
} {
  const storyCount = asNumber(document.metadata.storyCount) ?? document.tasks.length;
  const passedStoryCount = asNumber(document.metadata.passedStoryCount)
    ?? document.tasks.filter((task) => task.metadata.passes === true).length;
  return {
    storyCount,
    passedStoryCount,
    allStoriesPassing: document.kind === "ralph-prd-json"
      && storyCount > 0
      && passedStoryCount === storyCount,
  };
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ["title", "name", "defId"] as const) {
    const value = document.metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function lifecycleOf(document: DocumentEnvelope): { readonly lifecycle?: string } {
  const lifecycle = document.metadata.lifecycle;
  return typeof lifecycle === "string" && lifecycle.trim().length > 0
    ? { lifecycle: lifecycle.trim() }
    : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
