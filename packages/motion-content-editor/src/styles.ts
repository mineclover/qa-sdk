// @def.boundary motion-content-editor-system
import {
  applyMotionEditorTheme,
  DEFAULT_MOTION_EDITOR_THEME,
} from "./design-tokens.js";

export const MOTION_EDITOR_CSS = `
.mce-root{--mce-left-size:320px;--mce-right-size:320px;--mce-bottom-size:220px;--mce-splitter-size:10px;--mce-density-row-height:22px;--mce-density-pad-y:4px;--mce-density-pad-x:8px;--mce-density-divider:var(--mce-color-border-default);--mce-density-inactive-opacity:.5;display:grid;grid-template-columns:var(--mce-left-size) var(--mce-splitter-size) minmax(0,1fr) var(--mce-splitter-size) var(--mce-right-size);grid-template-rows:minmax(0,1fr) var(--mce-splitter-size) var(--mce-bottom-size);min-width:calc(260px + 520px + 260px + (var(--mce-splitter-size) * 2));min-height:780px;height:clamp(780px,calc(100vh - 240px),980px);background:var(--mce-color-surface-canvas);color:var(--mce-color-text-primary);border:1px solid var(--mce-color-border-default);border-radius:var(--mce-radius-lg);overflow:hidden;font-family:var(--mce-font-family-mono);font-size:var(--mce-font-size-xs);line-height:var(--mce-line-height-snug);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"liga" 0;box-shadow:var(--mce-shadow-elevation-2)}
:root[data-motion-editor-theme="dark"] .mce-root{--mce-density-divider:#333333}
:root[data-motion-editor-theme="light"] .mce-root{--mce-density-divider:#dddddd}
.mce-root *{box-sizing:border-box}
.mce-root button,.mce-root input,.mce-root select,.mce-root textarea{font-family:var(--mce-font-family-mono);font-size:var(--mce-font-size-xs);line-height:var(--mce-line-height-snug);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"liga" 0}
.mce-dock-slot,.mce-stage-wrap{min-width:0;min-height:0}
.mce-stage-wrap{grid-column:3;grid-row:1;display:grid;grid-template-rows:auto minmax(0,1fr);background:var(--mce-color-surface-canvas)}
.mce-dock-slot[data-layout-slot="left"]{grid-column:1;grid-row:1}
.mce-dock-slot[data-layout-slot="right"]{grid-column:5;grid-row:1}
.mce-dock-slot[data-layout-slot="bottom"]{grid-column:1/-1;grid-row:3}
.mce-splitter{position:relative;min-width:0;min-height:0;background:linear-gradient(180deg,color-mix(in srgb, var(--mce-color-border-default) 36%, transparent),color-mix(in srgb, var(--mce-color-border-strong) 54%, transparent),color-mix(in srgb, var(--mce-color-border-default) 36%, transparent));touch-action:none;cursor:col-resize}
.mce-splitter::after{content:"";position:absolute;inset:0;margin:auto;width:2px;height:56px;border-radius:999px;background:color-mix(in srgb, var(--mce-color-text-muted) 54%, transparent)}
.mce-splitter[data-splitter="left"]{grid-column:2;grid-row:1}
.mce-splitter[data-splitter="right"]{grid-column:4;grid-row:1}
.mce-splitter[data-splitter="bottom"]{grid-column:1/-1;grid-row:2;cursor:row-resize}
.mce-splitter--horizontal::after{width:72px;height:2px}
.mce-splitter[data-disabled="true"]{cursor:default;opacity:.5}
.mce-splitter[data-dragging="true"]{background:color-mix(in srgb, var(--mce-color-accent-primary) 20%, transparent)}
.mce-panel-group{display:grid;grid-template-rows:auto auto minmax(0,1fr);height:100%;min-width:0;min-height:0;background:var(--mce-color-surface-pane);overflow:hidden}
.mce-panel-group__header{display:flex;align-items:center;justify-content:space-between;gap:var(--mce-space-2);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);min-height:calc(var(--mce-density-row-height) + 2px);border-bottom:1px solid var(--mce-density-divider);background:var(--mce-color-surface-toolbar)}
.mce-panel-group__title{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--mce-color-text-primary)}
.mce-panel-group__collapse{border:1px solid var(--mce-color-border-default);border-radius:4px;padding:0 var(--mce-density-pad-x);min-width:48px;height:var(--mce-density-row-height);background:transparent;color:var(--mce-color-text-primary);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);cursor:pointer}
.mce-panel-group__tabs{display:flex;flex-wrap:wrap;gap:var(--mce-space-1);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-bottom:1px solid var(--mce-density-divider);background:var(--mce-color-surface-pane)}
.mce-panel-group__tab{border:1px solid transparent;border-left:3px solid transparent;border-radius:4px;min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);background:transparent;color:var(--mce-color-text-secondary);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.04em;cursor:pointer;opacity:var(--mce-density-inactive-opacity)}
.mce-panel-group__tab[data-state="active"]{background:var(--mce-color-accent-soft);border-color:var(--mce-density-divider);border-left-color:var(--mce-color-accent-primary);color:var(--mce-color-text-primary);opacity:1}
.mce-panel-group__body{min-height:0;overflow:auto;padding:0 var(--mce-density-pad-x) var(--mce-density-pad-x);background:var(--mce-color-surface-pane)}
.mce-panel-view{display:none;min-height:100%}
.mce-panel-view[data-state="active"]{display:block}
.mce-panel-stack{display:grid;gap:0;align-content:start}
.mce-panel-stack .mce-section{margin-bottom:0}
.mce-panel-intro{padding:var(--mce-density-pad-x) 0 calc(var(--mce-density-pad-x) + var(--mce-space-1));border-radius:0;border:0;border-bottom:1px solid var(--mce-density-divider);background:transparent}
.mce-panel-copy{margin:var(--mce-space-1) 0 0;color:var(--mce-color-text-secondary);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-normal) var(--mce-font-family-mono);opacity:var(--mce-density-inactive-opacity)}
.mce-panel-group[data-collapsed="true"]{grid-template-rows:1fr}
.mce-panel-group[data-collapsed="true"] .mce-panel-group__header{height:100%;padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-bottom:0}
.mce-panel-group[data-collapsed="true"] .mce-panel-group__tabs,.mce-panel-group[data-collapsed="true"] .mce-panel-group__body{display:none}
.mce-panel-group[data-collapsed="true"][data-collapse-direction="left"] .mce-panel-group__header,.mce-panel-group[data-collapsed="true"][data-collapse-direction="right"] .mce-panel-group__header{flex-direction:column;justify-content:space-between}
.mce-panel-group[data-collapsed="true"][data-collapse-direction="left"] .mce-panel-group__title{writing-mode:vertical-rl;transform:rotate(180deg)}
.mce-panel-group[data-collapsed="true"][data-collapse-direction="right"] .mce-panel-group__title{writing-mode:vertical-rl}
.mce-panel-group--timeline .mce-panel-group__body{padding:0}
.mce-panel-group--timeline .mce-panel-view[data-state="active"]{height:100%}
.mce-title{margin:0;font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.08em}
.mce-kicker{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.14em;color:var(--mce-color-text-secondary);margin-bottom:var(--mce-space-1);opacity:var(--mce-density-inactive-opacity)}
.mce-section{margin-bottom:0;padding:var(--mce-density-pad-x) 0;border-radius:0;background:transparent;border:0;border-bottom:1px solid var(--mce-density-divider);box-shadow:none}
.mce-section:last-child{margin-bottom:0;border-bottom:0;padding-bottom:0}
.mce-section h3{margin:0;font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--mce-color-text-primary)}
.mce-section-head{display:flex;align-items:center;justify-content:space-between;gap:var(--mce-space-2);margin-bottom:var(--mce-space-1);min-height:var(--mce-density-row-height)}
.mce-section-head h3{margin:0}
.mce-inline-action,.mce-item-action{border:1px solid var(--mce-color-border-default);border-radius:4px;background:transparent;color:var(--mce-color-text-primary);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);cursor:pointer}
.mce-inline-action{min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x)}
.mce-section--details summary{cursor:pointer}
.mce-control{display:grid;gap:var(--mce-space-1);margin-bottom:var(--mce-space-2)}
.mce-control:last-child{margin-bottom:0}
.mce-control span{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-control input,.mce-control select,.mce-diag-row__value input,.mce-diag-row__value select,.mce-json,.mce-toolbar-field input{width:100%;min-height:var(--mce-density-row-height);border:1px solid var(--mce-color-border-strong);background:var(--mce-color-surface-input);color:var(--mce-color-text-primary);border-radius:4px;padding:var(--mce-density-pad-y) var(--mce-density-pad-x);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono)}
.mce-control input[type="color"],.mce-diag-row__value input[type="color"]{padding:2px;min-height:var(--mce-density-row-height);cursor:pointer}
.mce-json{min-height:180px;resize:vertical;line-height:var(--mce-line-height-normal)}
.mce-error{margin-top:var(--mce-space-3);padding:var(--mce-space-3);border-radius:var(--mce-radius-sm);background:color-mix(in srgb, var(--mce-color-state-danger) 12%, transparent);border:1px solid var(--mce-color-border-danger);color:color-mix(in srgb, var(--mce-color-state-danger) 64%, white);font:var(--mce-font-weight-medium) var(--mce-font-size-sm)/var(--mce-line-height-normal) var(--mce-font-family-mono);display:none}
.mce-error.is-visible{display:block}
.mce-list{display:grid;gap:0}
.mce-item-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--mce-space-1);align-items:center}
.mce-item-row--scene{grid-template-columns:minmax(0,1fr) auto auto}
.mce-item{display:flex;justify-content:space-between;align-items:center;gap:var(--mce-space-2);min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border:1px solid transparent;border-left:3px solid transparent;border-radius:4px;background:transparent;cursor:pointer;color:var(--mce-color-text-primary);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-align:left}
.mce-item--scene{align-items:flex-start}
.mce-item-copy{display:grid;gap:2px;min-width:0;flex:1 1 auto}
.mce-item strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;font-weight:var(--mce-font-weight-regular)}
.mce-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-item[data-scene-locked="true"]{background:color-mix(in srgb, var(--mce-color-state-warning) 12%, transparent);border-color:color-mix(in srgb, var(--mce-color-state-warning) 36%, transparent)}
.mce-item.is-active{border-color:var(--mce-density-divider);border-left-color:var(--mce-color-accent-primary);background:var(--mce-color-accent-soft);box-shadow:none}
.mce-item-action{min-width:var(--mce-density-row-height);min-height:var(--mce-density-row-height);padding:0 var(--mce-density-pad-x)}
.mce-scene-presence{display:inline-flex;align-items:center;justify-content:flex-end;gap:var(--mce-space-2);min-height:var(--mce-density-row-height);flex-wrap:wrap;max-width:220px}
.mce-scene-presence--compact{gap:var(--mce-space-1);max-width:none;flex-wrap:nowrap}
.mce-scene-presence__avatars{display:inline-flex;align-items:center;gap:4px;min-width:0}
.mce-scene-presence__names{color:var(--mce-color-text-secondary);opacity:1}
.mce-user-badge,.mce-lock-pill{opacity:1 !important;overflow:visible !important;text-overflow:clip !important;white-space:nowrap !important}
.mce-user-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;border:1px solid color-mix(in srgb, var(--mce-user-color) 64%, rgba(255,255,255,.18));background:color-mix(in srgb, var(--mce-user-color) 24%, transparent);color:var(--mce-color-text-primary) !important;font:var(--mce-font-weight-bold) 10px/1 var(--mce-font-family-mono)}
.mce-user-badge[data-user-self="true"]{box-shadow:0 0 0 1px color-mix(in srgb, var(--mce-color-accent-primary) 48%, transparent)}
.mce-user-badge--more{border-style:dashed;background:color-mix(in srgb, var(--mce-color-surface-pane-alt) 82%, transparent)}
.mce-lock-pill{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 8px;border-radius:999px;border:1px solid color-mix(in srgb, var(--mce-color-state-warning) 52%, transparent);background:color-mix(in srgb, var(--mce-color-state-warning) 16%, transparent);color:var(--mce-color-state-warning) !important;font:var(--mce-font-weight-bold) 10px/1 var(--mce-font-family-mono);letter-spacing:.08em}
.mce-toolbar{display:flex;gap:var(--mce-space-1);align-items:center;padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-bottom:1px solid var(--mce-density-divider);background:var(--mce-color-surface-toolbar);flex-wrap:wrap}
.mce-toolbar button{border:1px solid var(--mce-color-border-default);border-radius:4px;min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);background:var(--mce-color-accent-primary);color:var(--mce-color-accent-contrast);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);cursor:pointer}
.mce-toolbar button.mce-secondary{background:var(--mce-color-surface-pane-alt);border-color:var(--mce-color-border-default);color:var(--mce-color-text-primary)}
.mce-toolbar button:disabled{opacity:var(--mce-density-inactive-opacity);cursor:default}
.mce-toolbar button[data-action="toggle-theme"]{min-width:112px}
.mce-toolbar input[type="range"]{flex:1}
.mce-toolbar-toggle,.mce-toolbar-field{display:inline-flex;align-items:center;gap:var(--mce-space-1);padding:0 var(--mce-space-1);color:var(--mce-color-text-secondary);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);opacity:var(--mce-density-inactive-opacity)}
.mce-toolbar-toggle input{margin:0}
.mce-toolbar-field input{width:72px;border-radius:4px}
.mce-stage-host{position:relative;padding:var(--mce-space-6);overflow:auto;background:var(--mce-preview-surface-canvas,var(--mce-color-surface-canvas));min-height:0;isolation:isolate}
.mce-debug{font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-normal) var(--mce-font-family-mono);white-space:pre-wrap;color:var(--mce-color-text-secondary)}
.mce-diag{display:grid;gap:var(--mce-space-1)}
.mce-diag-group{display:grid;gap:var(--mce-space-1)}
.mce-diag-group-title{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-diag-row{display:grid;grid-template-columns:minmax(76px,auto) minmax(0,1fr);align-items:center;gap:var(--mce-space-2);min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-radius:4px;background:transparent;border:1px solid transparent;border-left:3px solid transparent}
.mce-diag-row__value{display:grid;gap:var(--mce-space-1);min-width:0;align-items:center}
.mce-diag-row strong,.mce-diag-card strong{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-diag-row span,.mce-diag-card p{font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono);color:var(--mce-color-text-primary);overflow-wrap:anywhere}
.mce-color-field{display:flex;align-items:center;gap:var(--mce-space-2)}
.mce-color-field input[type="color"]{width:52px;min-width:52px}
.mce-inline-text-field{display:flex;min-width:0}
.mce-inline-text-field__display,.mce-inline-text-field__editor{width:100%}
.mce-inline-text-field__display{display:inline-flex;align-items:center;min-width:0;min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border:1px solid var(--mce-color-border-strong);border-radius:4px;background:var(--mce-color-surface-input);color:var(--mce-color-text-primary);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono);cursor:text;text-align:left}
.mce-inline-text-field__display:hover,.mce-inline-text-field[data-editing="true"] .mce-inline-text-field__display{border-color:var(--mce-color-border-accent);background:var(--mce-color-accent-soft)}
.mce-inline-text-field__value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mce-inline-text-field__editor{display:none;align-items:center}
.mce-inline-text-field__editor input{flex:1 1 auto;min-width:0}
.mce-inline-text-field__hint{display:none;font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);color:var(--mce-color-state-danger)}
.mce-inline-text-field[data-editing="true"] .mce-inline-text-field__display{display:none}
.mce-inline-text-field[data-editing="true"] .mce-inline-text-field__editor{display:grid;gap:var(--mce-space-2)}
.mce-inline-text-field[data-invalid="true"] .mce-inline-text-field__hint{display:inline}
.mce-inline-text-field[data-invalid="true"] .mce-inline-text-field__editor input{border-color:var(--mce-color-border-danger)}
.mce-scrub-field{display:flex;align-items:center;min-width:0}
.mce-scrub-field__display,.mce-scrub-field__editor{width:100%}
.mce-scrub-field__display{display:inline-flex;align-items:center;justify-content:flex-start;gap:var(--mce-space-2);min-height:var(--mce-density-row-height);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border:1px solid var(--mce-color-border-strong);border-radius:4px;background:var(--mce-color-surface-input);color:var(--mce-color-text-primary);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono);cursor:ew-resize}
.mce-scrub-field__display:hover,.mce-scrub-field[data-scrubbing="true"] .mce-scrub-field__display{border-color:var(--mce-color-border-accent);background:var(--mce-color-accent-soft)}
.mce-scrub-field__number{font:inherit;color:inherit;font-variant-numeric:tabular-nums}
.mce-scrub-field__unit{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);color:var(--mce-color-text-secondary);text-transform:uppercase;letter-spacing:.06em;opacity:var(--mce-density-inactive-opacity)}
.mce-scrub-field__editor{display:none;align-items:center;gap:var(--mce-space-2)}
.mce-scrub-field__editor input{flex:1 1 auto;min-width:0}
.mce-scrub-field[data-editing="true"] .mce-scrub-field__display{display:none}
.mce-scrub-field[data-editing="true"] .mce-scrub-field__editor{display:flex}
.mce-diag-card{display:grid;gap:var(--mce-space-1);padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-radius:4px;background:transparent;border:1px solid var(--mce-density-divider)}
.mce-diag-card p{margin:0}
.mce-diag-card code{font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-normal) var(--mce-font-family-mono);color:var(--mce-color-text-primary)}
.mce-diag-card[data-tone="accent"]{border-color:var(--mce-color-border-accent);background:var(--mce-color-accent-soft)}
.mce-diag-card[data-tone="error"]{border-color:var(--mce-color-border-danger);background:color-mix(in srgb, var(--mce-color-state-danger) 10%, transparent)}
.mce-diag-card[data-tone="ok"]{border-color:var(--mce-color-border-success);background:color-mix(in srgb, var(--mce-color-state-success) 10%, transparent)}
.mce-diag-empty{padding:var(--mce-density-pad-y) var(--mce-density-pad-x);border-radius:4px;background:transparent;border:1px dashed var(--mce-density-divider);font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono);color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-stage{position:relative;min-height:540px;border-radius:var(--mce-radius-lg);background:var(--mce-preview-surface-stage-glow,var(--mce-color-surface-stage-glow)),var(--mce-preview-surface-stage,var(--mce-color-surface-stage));padding:var(--mce-space-8);overflow:hidden;box-shadow:var(--mce-preview-shadow-elevation-3,var(--mce-shadow-elevation-3));color:var(--mce-preview-text-primary,var(--mce-color-text-primary))}
.mce-hero{border:1px solid color-mix(in srgb, var(--mce-preview-accent-primary,var(--mce-color-accent-primary)) 38%, transparent);border-radius:calc(var(--mce-radius-lg) + var(--mce-space-1));padding:var(--mce-space-6);background:linear-gradient(140deg, color-mix(in srgb, var(--mce-preview-text-inverse,var(--mce-color-text-inverse)) 8%, transparent), color-mix(in srgb, var(--mce-preview-text-inverse,var(--mce-color-text-inverse)) 2%, transparent))}
.mce-chip{display:inline-flex;padding:var(--mce-space-2) var(--mce-space-3);border-radius:var(--mce-radius-pill);background:var(--mce-preview-accent-primary,var(--mce-color-accent-primary));color:var(--mce-preview-accent-contrast,var(--mce-color-accent-contrast));font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.08em}
.mce-hero h1{margin:var(--mce-space-4) 0 var(--mce-space-2);max-width:8ch;font-size:clamp(40px,4vw,var(--mce-font-size-hero));line-height:.95;font-family:var(--mce-font-family-display)}
.mce-hero p{margin:0;max-width:36rem;color:color-mix(in srgb, var(--mce-preview-text-primary,var(--mce-color-text-primary)) 74%, transparent);font-size:var(--mce-font-size-lg);line-height:var(--mce-line-height-relaxed)}
.mce-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--mce-space-4);margin-top:var(--mce-space-5)}
.mce-card,.mce-outro{border-radius:var(--mce-radius-lg);padding:var(--mce-space-5);background:var(--mce-preview-surface-card,var(--mce-color-surface-card));border:1px solid var(--mce-preview-border-default,var(--mce-color-border-default));backdrop-filter:blur(6px)}
.mce-card span,.mce-outro{font:var(--mce-font-weight-semibold) var(--mce-font-size-xs)/var(--mce-line-height-snug) var(--mce-font-family-mono);text-transform:uppercase;letter-spacing:.12em;color:var(--mce-preview-text-muted,var(--mce-color-text-muted))}
.mce-card strong{display:block;margin:var(--mce-space-3) 0 var(--mce-space-2);font-size:var(--mce-font-size-2xl);line-height:var(--mce-line-height-snug);font-family:var(--mce-font-family-display)}
.mce-card p{margin:0;color:color-mix(in srgb, var(--mce-preview-text-primary,var(--mce-color-text-primary)) 72%, transparent);line-height:var(--mce-line-height-normal)}
.mce-outro{margin-top:var(--mce-space-5);max-width:460px}
.mce-caption{position:absolute;left:var(--mce-space-8);bottom:var(--mce-space-7);max-width:min(60vw,640px);padding:var(--mce-space-3) var(--mce-space-4);border-radius:var(--mce-radius-md);background:var(--mce-preview-surface-overlay,var(--mce-color-surface-overlay));border:1px solid var(--mce-preview-border-default,var(--mce-color-border-default));font-size:var(--mce-font-size-sm);line-height:var(--mce-line-height-normal);color:var(--mce-preview-text-primary,var(--mce-color-text-primary))}
.mce-caption[data-tone="accent"]{border-color:var(--mce-preview-border-warning,var(--mce-color-border-warning))}
.mce-caption[data-tone="warning"]{border-color:var(--mce-preview-border-danger,var(--mce-color-border-danger))}
.mce-timeline{--mce-timeline-label-width:112px;--mce-timeline-grid-gap:var(--mce-space-2);height:100%;padding:var(--mce-density-pad-x);overflow:auto;background:var(--mce-color-surface-pane)}
.mce-timeline-surface{position:relative;min-width:960px;min-height:100%}
.mce-timeline-grid{display:grid;grid-template-columns:var(--mce-timeline-label-width) minmax(720px,1fr);column-gap:var(--mce-timeline-grid-gap);row-gap:var(--mce-space-1);align-items:center}
.mce-timeline-ruler-label,.mce-lane-label{font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);color:var(--mce-color-text-secondary);text-transform:uppercase;letter-spacing:.08em;opacity:var(--mce-density-inactive-opacity)}
.mce-timeline-ruler-label{align-self:start;padding-top:var(--mce-density-pad-y)}
.mce-timeline-ruler{position:relative;height:var(--mce-density-row-height);border-radius:4px;border:1px solid var(--mce-density-divider);background:var(--mce-color-surface-track);overflow:hidden}
.mce-timeline-ruler::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:color-mix(in srgb, var(--mce-color-border-strong) 55%, transparent)}
.mce-ruler-tick{position:absolute;top:0;bottom:0;width:1px;background:color-mix(in srgb, var(--mce-color-border-default) 72%, transparent)}
.mce-ruler-tick[data-ruler-tick="major"]{background:color-mix(in srgb, var(--mce-color-border-accent) 72%, transparent)}
.mce-ruler-tick-label{position:absolute;top:var(--mce-density-pad-y);left:0;transform:translateX(-50%);padding-left:var(--mce-space-1);white-space:nowrap;font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);color:var(--mce-color-text-secondary);opacity:var(--mce-density-inactive-opacity)}
.mce-ruler-tick[data-ruler-edge="start"] .mce-ruler-tick-label{transform:none}
.mce-ruler-tick[data-ruler-edge="end"] .mce-ruler-tick-label{transform:translateX(-100%)}
.mce-track{position:relative;height:var(--mce-density-row-height);border-radius:4px;background:var(--mce-color-surface-track);border:1px solid var(--mce-density-divider);overflow:hidden}
.mce-track::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0,transparent 79px,color-mix(in srgb, var(--mce-color-border-default) 28%, transparent) 79px,color-mix(in srgb, var(--mce-color-border-default) 28%, transparent) 80px)}
.mce-track[data-track-kind="scene"]{background:color-mix(in srgb, var(--mce-color-accent-primary) 5%, var(--mce-color-surface-track));border-color:color-mix(in srgb, var(--mce-color-accent-primary) 24%, var(--mce-density-divider))}
.mce-bar{position:absolute;top:0;bottom:0;border-radius:4px;background:color-mix(in srgb, var(--mce-color-accent-primary) 18%, transparent);border:1px solid var(--mce-density-divider);border-left:3px solid transparent;display:flex;align-items:center;justify-content:space-between;padding:0 var(--mce-density-pad-x);cursor:grab;gap:var(--mce-space-1)}
.mce-bar.is-active{border-color:var(--mce-density-divider);border-left-color:var(--mce-color-accent-primary);box-shadow:inset 0 0 0 999px color-mix(in srgb, var(--mce-color-accent-primary) 8%, transparent)}
.mce-bar[data-bar-kind="scene"]{background:linear-gradient(135deg,color-mix(in srgb, var(--mce-color-accent-primary) 24%, transparent),color-mix(in srgb, var(--mce-color-accent-info) 18%, transparent));border-color:color-mix(in srgb, var(--mce-color-accent-primary) 42%, transparent)}
.mce-bar[data-bar-kind="scene"][data-scene-locked="true"]{background:linear-gradient(135deg,color-mix(in srgb, var(--mce-color-state-warning) 26%, transparent),color-mix(in srgb, var(--mce-color-state-danger) 14%, transparent));border-color:color-mix(in srgb, var(--mce-color-state-warning) 44%, transparent)}
.mce-bar[data-bar-kind="scene"][data-scene-lane="1"]{background:linear-gradient(135deg,color-mix(in srgb, var(--mce-color-accent-info) 24%, transparent),color-mix(in srgb, var(--mce-color-accent-transition) 18%, transparent));border-color:color-mix(in srgb, var(--mce-color-accent-info) 42%, transparent)}
.mce-bar[data-bar-kind="scene"][data-scene-lane="2"]{background:linear-gradient(135deg,color-mix(in srgb, var(--mce-color-accent-success) 24%, transparent),color-mix(in srgb, var(--mce-color-accent-primary) 18%, transparent));border-color:color-mix(in srgb, var(--mce-color-accent-success) 42%, transparent)}
.mce-bar[data-bar-kind="scene"][data-scene-stacked="true"]{box-shadow:inset 0 0 0 999px color-mix(in srgb, var(--mce-color-surface-pane) 6%, transparent)}
.mce-bar[data-bar-kind="sequence"]{background:color-mix(in srgb, var(--mce-color-accent-info) 18%, transparent);border-color:var(--mce-color-border-info)}
.mce-bar[data-bar-kind="caption"]{background:color-mix(in srgb, var(--mce-color-accent-success) 18%, transparent);border-color:var(--mce-color-border-success)}
.mce-bar[data-bar-kind="transition"]{background:color-mix(in srgb, var(--mce-color-accent-transition) 18%, transparent);border-color:color-mix(in srgb, var(--mce-color-accent-transition) 44%, transparent)}
.mce-bar.is-active[data-bar-kind="scene"],.mce-bar.is-active[data-bar-kind="sequence"],.mce-bar.is-active[data-bar-kind="caption"],.mce-bar.is-active[data-bar-kind="transition"]{border-left-color:var(--mce-color-accent-primary)}
.mce-bar[data-bar-moveable="false"]{cursor:default}
.mce-bar strong{flex:1 1 auto;min-width:0;font:var(--mce-font-weight-regular) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);color:var(--mce-color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mce-bar-presence{display:inline-flex;align-items:center;gap:var(--mce-space-1);flex:0 0 auto}
.mce-bar-presence .mce-scene-presence{max-width:none;gap:var(--mce-space-1);flex-wrap:nowrap}
.mce-bar-presence .mce-scene-presence__names{display:none}
.mce-bar-presence .mce-user-badge,.mce-bar-presence .mce-lock-pill{height:18px;min-width:18px;padding:0 5px;font-size:9px}
.mce-bar-handle{width:12px;height:100%;cursor:ew-resize;display:flex;align-items:center;justify-content:center;color:var(--mce-color-accent-primary);font:var(--mce-font-weight-bold) var(--mce-font-size-xs)/var(--mce-line-height-tight) var(--mce-font-family-mono);flex:0 0 auto}
.mce-bar[data-bar-kind="scene"] .mce-bar-handle{color:var(--mce-color-accent-primary)}
.mce-bar[data-bar-kind="sequence"] .mce-bar-handle{color:var(--mce-color-accent-info)}
.mce-bar[data-bar-kind="caption"] .mce-bar-handle{color:var(--mce-color-accent-success)}
.mce-bar[data-bar-kind="transition"] .mce-bar-handle{color:var(--mce-color-accent-transition)}
.mce-timeline-playhead{position:absolute;top:0;bottom:0;width:2px;transform:translateX(-1px);background:linear-gradient(180deg,var(--mce-color-state-warning),color-mix(in srgb, var(--mce-color-state-warning) 48%, transparent));pointer-events:none;z-index:4;box-shadow:0 0 0 1px color-mix(in srgb, var(--mce-color-surface-pane) 54%, transparent)}
.mce-timeline-playhead__head{position:absolute;top:0;left:50%;width:14px;height:14px;border-radius:999px;transform:translate(-50%,-20%);background:var(--mce-color-state-warning);border:2px solid color-mix(in srgb, var(--mce-color-surface-pane) 82%, transparent);box-shadow:var(--mce-shadow-elevation-1)}
.mce-log-category[data-category="transport"]{color:var(--mce-color-state-info)}
.mce-log-category[data-category="edit"]{color:var(--mce-color-state-warning)}
.mce-log-category[data-category="timeline"]{color:var(--mce-color-state-success)}
.mce-log-category[data-category="composition"]{color:var(--mce-color-accent-transition)}
.mce-log-category[data-category="system"]{color:var(--mce-color-state-neutral)}
.mce-summary-title{display:inline}
.mce-file-input{display:none}
@media (max-width:1440px){.mce-card-grid{grid-template-columns:1fr}.mce-timeline{padding:var(--mce-space-4)}.mce-timeline-surface{min-width:840px}}
`;

export function ensureMotionEditorStyles(): void {
  if (typeof document === "undefined") return;
  if (!document.documentElement.style.getPropertyValue("--mce-color-surface-canvas")) {
    applyMotionEditorTheme(DEFAULT_MOTION_EDITOR_THEME);
  }
  if (document.getElementById("motion-content-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "motion-content-editor-styles";
  style.textContent = MOTION_EDITOR_CSS;
  document.head.appendChild(style);
}
