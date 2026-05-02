type Listener = () => void;

export interface PlaybookStore<TState> {
  getState(): TState;
  setState(nextState: TState): void;
  update(updater: (state: TState) => TState): void;
  subscribe(listener: Listener): () => void;
}

export function createPlaybookStore<TState>(
  initialState: TState,
): PlaybookStore<TState> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState(): TState {
      return state;
    },
    setState(nextState: TState): void {
      state = nextState;
      listeners.forEach((listener) => listener());
    },
    update(updater: (current: TState) => TState): void {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
