export interface PlaybookSubmissionReceipt {
  persistedAt: string;
  submissionId: string;
}

export type PersistPlaybookSubmission<TDraft, TResult> = (
  draft: TDraft,
  result: TResult,
) => Promise<PlaybookSubmissionReceipt>;

export function createPlaybookRefs<TField extends string>(
  fields: readonly TField[],
): Record<TField, PlaybookFocusable | null> {
  return Object.fromEntries(fields.map((field) => [field, null])) as Record<
    TField,
    PlaybookFocusable | null
  >;
}

export interface PlaybookFocusable {
  focus(): void;
}

export function createDefaultPersistPlaybookSubmission<TDraft, TResult>(
  prefix: string,
  delayMs = 160,
): PersistPlaybookSubmission<TDraft, TResult> {
  return async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });

    return {
      persistedAt: new Date().toISOString(),
      submissionId: `${prefix}_${Date.now()}`,
    };
  };
}
