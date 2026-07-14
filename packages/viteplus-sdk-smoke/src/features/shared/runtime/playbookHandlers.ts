import type { QaBridge } from '../../../qa-bridge.js';
import type { PlaybookFocusable } from './playbookPersist.js';

interface PlaybookStoreLike<TState> {
  update(updater: (state: TState) => TState): void;
}

interface PlaybookContextWithActivity<TState, TField extends string> {
  bridge: QaBridge;
  store: PlaybookStoreLike<TState>;
  refs: Record<TField, PlaybookFocusable | null>;
}

export function appendPlaybookActivity<
  TActivity,
  TField extends string,
  TState extends { activity: TActivity[] },
>(context: PlaybookContextWithActivity<TState, TField>, activity: TActivity, limit = 8): void {
  context.store.update((state) => ({
    ...state,
    activity: [activity, ...state.activity].slice(0, limit),
  }));
}

export function focusPlaybookField<TState, TField extends string>(
  context: PlaybookContextWithActivity<TState, TField>,
  field: TField,
): void {
  context.refs[field]?.focus();
}

export async function flushPlaybookBridge<
  TField extends string,
  TState extends { debugRevision: number },
>(context: PlaybookContextWithActivity<TState, TField>): Promise<void> {
  await context.bridge.flush();
  context.store.update((state) => ({
    ...state,
    debugRevision: state.debugRevision + 1,
  }));
}
