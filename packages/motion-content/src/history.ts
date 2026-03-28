import {
  applyMotionEditorCommand,
  createMotionEditorState,
} from "./state.js";
import type {
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionParameterValues,
  ResolvedMotionComposition,
  ResolvedMotionCompositionV2,
} from "./model.js";
import type {
  MotionEditorCommand,
  MotionEditorState,
  MotionSetCompositionCommand,
  ResolvedMotionCompositionSchema,
} from "./editor.js";

export interface MotionEditorSession<
  TComposition extends ResolvedMotionCompositionSchema = ResolvedMotionComposition,
> {
  readonly past: readonly MotionEditorState<TComposition>[];
  readonly present: MotionEditorState<TComposition>;
  readonly future: readonly MotionEditorState<TComposition>[];
}

export type MotionEditorCheckpointStrategy = "ignore" | "append" | "reset";

export function createMotionEditorSession(
  composition: MotionCompositionDef,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorSession<ResolvedMotionComposition>;
export function createMotionEditorSession(
  composition: MotionCompositionDefV2,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorSession<ResolvedMotionCompositionV2>;
export function createMotionEditorSession(
  composition: MotionCompositionDef | MotionCompositionDefV2,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorSession<ResolvedMotionCompositionSchema>;
export function createMotionEditorSession(
  composition: MotionCompositionDef | MotionCompositionDefV2,
  overrides: Partial<MotionParameterValues> = {},
): MotionEditorSession<ResolvedMotionCompositionSchema> {
  return {
    past: [],
    present: createMotionEditorState(composition, overrides),
    future: [],
  };
}

export function getMotionEditorCheckpointStrategy(
  command: MotionEditorCommand,
): MotionEditorCheckpointStrategy {
  if (
    [
      "select",
      "play",
      "pause",
      "restart",
      "set-current-time",
      "set-loop",
      "set-playback-rate",
    ].includes(command.type)
  ) {
    return "ignore";
  }
  if (command.type === "set-composition") {
    return "reset";
  }
  return "append";
}

function checkpointKey(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
): string {
  return JSON.stringify({
    composition: state.composition,
    values: state.values,
  });
}

type MotionEditorCommandWithoutSetComposition = Exclude<MotionEditorCommand, MotionSetCompositionCommand>;

export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDef },
): MotionEditorState<ResolvedMotionComposition>;
export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDefV2 },
): MotionEditorState<ResolvedMotionCompositionV2>;
export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionComposition>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorState<ResolvedMotionComposition>;
export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionV2>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorState<ResolvedMotionCompositionV2>;
export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorState<ResolvedMotionCompositionSchema>;
export function previewMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorState<ResolvedMotionCompositionSchema> {
  return applyMotionEditorCommand(session.present, command);
}

export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDef },
): MotionEditorSession<ResolvedMotionComposition>;
export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDefV2 },
): MotionEditorSession<ResolvedMotionCompositionV2>;
export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionComposition>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorSession<ResolvedMotionComposition>;
export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionV2>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorSession<ResolvedMotionCompositionV2>;
export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorSession<ResolvedMotionCompositionSchema>;
export function applyMotionEditorSessionCommand(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorSession<ResolvedMotionCompositionSchema> {
  const strategy = getMotionEditorCheckpointStrategy(command);
  const nextPresent = previewMotionEditorSessionCommand(session, command);
  if (strategy === "ignore") {
    return {
      ...session,
      present: nextPresent,
    };
  }

  if (checkpointKey(session.present) === checkpointKey(nextPresent)) {
    return session;
  }

  if (strategy === "reset") {
    return {
      past: [],
      present: nextPresent,
      future: [],
    };
  }

  return {
    past: [...session.past, session.present],
    present: nextPresent,
    future: [],
  };
}

export function isMotionEditorSessionDirty(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
): boolean {
  return session.past.length > 0;
}

export function canUndoMotionEditorSession(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
): boolean {
  return session.past.length > 0;
}

export function canRedoMotionEditorSession(
  session: MotionEditorSession<ResolvedMotionCompositionSchema>,
): boolean {
  return session.future.length > 0;
}

export function undoMotionEditorSession<TComposition extends ResolvedMotionCompositionSchema>(
  session: MotionEditorSession<TComposition>,
): MotionEditorSession<TComposition> {
  if (!canUndoMotionEditorSession(session)) return session;
  const previous = session.past[session.past.length - 1];
  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
  };
}

export function redoMotionEditorSession<TComposition extends ResolvedMotionCompositionSchema>(
  session: MotionEditorSession<TComposition>,
): MotionEditorSession<TComposition> {
  if (!canRedoMotionEditorSession(session)) return session;
  const [next, ...rest] = session.future;
  return {
    past: [...session.past, session.present],
    present: next,
    future: rest,
  };
}
