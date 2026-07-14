// @def.boundary canvas-viewport-spec
// @def.doc canvas-viewport-spec

export type CanvasDisclosureState = 'open' | 'closed';

export function toggleCanvasDisclosureState(state: CanvasDisclosureState): CanvasDisclosureState {
  return state === 'open' ? 'closed' : 'open';
}

export function isCanvasDisclosureOpen(state: CanvasDisclosureState): boolean {
  return state === 'open';
}

export type CanvasPaneFocusState<T extends string> = T | null;

export function toggleCanvasPaneFocus<T extends string>(
  current: CanvasPaneFocusState<T>,
  target: T,
): CanvasPaneFocusState<T> {
  return current === target ? null : target;
}

export function getCanvasPaneFocusFlags<T extends string>(
  current: CanvasPaneFocusState<T>,
  target: T,
): { focused: boolean; unfocused: boolean } {
  return {
    focused: current === target,
    unfocused: current !== null && current !== target,
  };
}
