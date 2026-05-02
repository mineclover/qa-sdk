// @def.boundary canvas-viewport-spec
// @def.doc canvas-viewport-spec

export interface CanvasHudAction {
  id: string;
  label: string;
  active?: boolean;
  title?: string;
}

export const CANVAS_VIEWPORT_HUD_ACTION_ID = {
  zoomIn: "viewport:zoom-in",
  zoomOut: "viewport:zoom-out",
  fitView: "viewport:fit-view",
  resetView: "viewport:reset-view",
} as const;

export type CanvasViewportHudActionId =
  typeof CANVAS_VIEWPORT_HUD_ACTION_ID[keyof typeof CANVAS_VIEWPORT_HUD_ACTION_ID];

export function createViewportHudActions(options?: {
  includeZoom?: boolean;
  includeFitView?: boolean;
  includeResetView?: boolean;
  extraActions?: CanvasHudAction[];
}): CanvasHudAction[] {
  const includeZoom = options?.includeZoom !== false;
  const includeFitView = options?.includeFitView !== false;
  const includeResetView = options?.includeResetView === true;
  const actions: CanvasHudAction[] = [];

  if (options?.extraActions) {
    actions.push(...options.extraActions);
  }
  if (includeZoom) {
    actions.push(
      { id: CANVAS_VIEWPORT_HUD_ACTION_ID.zoomIn, label: "확대" },
      { id: CANVAS_VIEWPORT_HUD_ACTION_ID.zoomOut, label: "축소" },
    );
  }
  if (includeFitView) {
    actions.push({ id: CANVAS_VIEWPORT_HUD_ACTION_ID.fitView, label: "맞춤 보기" });
  }
  if (includeResetView) {
    actions.push({ id: CANVAS_VIEWPORT_HUD_ACTION_ID.resetView, label: "원위치" });
  }

  return actions;
}

export function isViewportHudActionId(id: string): id is CanvasViewportHudActionId {
  return Object.values(CANVAS_VIEWPORT_HUD_ACTION_ID).includes(id as CanvasViewportHudActionId);
}

export interface RenderCanvasHudOptions {
  actions: CanvasHudAction[];
  hint?: string;
  onAction?: (id: string) => void;
}

export function renderCanvasHud(
  container: HTMLElement,
  options: RenderCanvasHudOptions,
): void {
  container.innerHTML = "";

  const hud = document.createElement("div");
  hud.className = "cv-hud";

  const group = document.createElement("div");
  group.className = "cv-hud-group";

  for (const action of options.actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cv-btn${action.active ? " is-active" : ""}`;
    button.dataset.actionId = action.id;
    button.textContent = action.label;
    if (action.title) {
      button.title = action.title;
    }
    button.addEventListener("click", () => options.onAction?.(action.id));
    group.appendChild(button);
  }

  hud.appendChild(group);

  if (options.hint) {
    const hint = document.createElement("span");
    hint.className = "cv-hint";
    hint.textContent = options.hint;
    hud.appendChild(hint);
  }

  container.appendChild(hud);
}
