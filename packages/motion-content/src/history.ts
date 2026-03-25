import {
  applyMotionEditorCommand,
  createMotionEditorState,
} from "./state.js";
import type {
  MotionCompositionDef,
  MotionParameterValues,
} from "./model.js";
import type { MotionEditorCommand, MotionEditorState } from "./editor.js";

export interface MotionEditorSession {
  readonly past: readonly MotionEditorState[];
  readonly present: MotionEditorState;
  readonly future: readonly MotionEditorState[];
}

export type MotionEditorCheckpointStrategy = "ignore" | "append" | "reset";

export function createMotionEditorSession(
  composition: MotionCompositionDef,
  overrides: Partial<MotionParameterValues> = {},
): MotionEditorSession {
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

function checkpointKey(state: MotionEditorState): string {
  return JSON.stringify({
    composition: state.composition,
    values: state.values,
  });
}

export function previewMotionEditorSessionCommand(
  session: MotionEditorSession,
  command: MotionEditorCommand,
): MotionEditorState {
  return applyMotionEditorCommand(session.present, command);
}

export function applyMotionEditorSessionCommand(
  session: MotionEditorSession,
  command: MotionEditorCommand,
): MotionEditorSession {
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

export function isMotionEditorSessionDirty(session: MotionEditorSession): boolean {
  return session.past.length > 0;
}

export function canUndoMotionEditorSession(session: MotionEditorSession): boolean {
  return session.past.length > 0;
}

export function canRedoMotionEditorSession(session: MotionEditorSession): boolean {
  return session.future.length > 0;
}

export function undoMotionEditorSession(
  session: MotionEditorSession,
): MotionEditorSession {
  if (!canUndoMotionEditorSession(session)) return session;
  const previous = session.past[session.past.length - 1];
  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
  };
}

export function redoMotionEditorSession(
  session: MotionEditorSession,
): MotionEditorSession {
  if (!canRedoMotionEditorSession(session)) return session;
  const [next, ...rest] = session.future;
  return {
    past: [...session.past, session.present],
    present: next,
    future: rest,
  };
}
