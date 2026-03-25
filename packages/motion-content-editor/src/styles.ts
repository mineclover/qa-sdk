export const MOTION_EDITOR_CSS = `
.mce-root{display:grid;grid-template-columns:320px minmax(0,1fr) 320px;min-height:760px;background:#10141b;color:#eef3f8;border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden;font-family:"Noto Sans KR",sans-serif}
.mce-pane{padding:18px;border-right:1px solid rgba(255,255,255,.08);overflow:auto}
.mce-pane:last-child{border-right:0;background:rgba(255,255,255,.03)}
.mce-title{margin:0 0 12px;font-size:20px}
.mce-kicker{font:600 11px/1.2 "IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.14em;color:#f08f20;margin-bottom:8px}
.mce-section{margin-bottom:18px;padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
.mce-section h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#9fb3c8}
.mce-control{display:grid;gap:6px;margin-bottom:10px}
.mce-control:last-child{margin-bottom:0}
.mce-control span{font-size:12px;color:#d5deea}
.mce-control input,.mce-control select,.mce-json{width:100%;border:1px solid rgba(255,255,255,.12);background:#0c1117;color:#f7fbff;border-radius:10px;padding:9px 10px;box-sizing:border-box}
.mce-json{min-height:180px;resize:vertical;font:500 12px/1.6 "IBM Plex Mono",monospace}
.mce-error{margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,97,97,.1);border:1px solid rgba(255,97,97,.28);color:#ffb4b4;font:500 12px/1.5 "IBM Plex Mono",monospace;display:none}
.mce-error.is-visible{display:block}
.mce-list{display:grid;gap:8px}
.mce-item{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:10px;background:#0b1016;border:1px solid rgba(255,255,255,.05);cursor:pointer}
.mce-item.is-active{border-color:#f08f20;background:rgba(240,143,32,.08)}
.mce-toolbar{display:flex;gap:8px;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.16);flex-wrap:wrap}
.mce-toolbar button{border:0;border-radius:999px;padding:9px 12px;background:#f08f20;color:#121820;font-weight:700;cursor:pointer}
.mce-toolbar button.mce-secondary{background:#273240;color:#eef3f8}
.mce-toolbar button:disabled{opacity:.5;cursor:default}
.mce-toolbar input[type="range"]{flex:1}
.mce-toolbar-toggle,.mce-toolbar-field{display:inline-flex;align-items:center;gap:8px;padding:0 2px;color:#dbe4ef;font:600 12px/1.2 "IBM Plex Mono",monospace}
.mce-toolbar-toggle input{margin:0}
.mce-toolbar-field input{width:72px;border:1px solid rgba(255,255,255,.12);background:#0c1117;color:#f7fbff;border-radius:999px;padding:8px 10px;box-sizing:border-box;font:600 12px/1.2 "IBM Plex Mono",monospace}
.mce-stage-wrap{display:grid;grid-template-rows:auto 1fr auto;min-width:0}
.mce-stage-host{position:relative;padding:24px;overflow:hidden}
.mce-debug{font:500 12px/1.6 "IBM Plex Mono",monospace;white-space:pre-wrap;color:#dbe4ef}
.mce-diag{display:grid;gap:10px}
.mce-diag-group{display:grid;gap:8px}
.mce-diag-group-title{font:600 11px/1.2 "IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.08em;color:#8fa6bc}
.mce-diag-row{display:grid;gap:4px;padding:10px 12px;border-radius:10px;background:#0b1016;border:1px solid rgba(255,255,255,.05)}
.mce-diag-row strong,.mce-diag-card strong{font:600 11px/1.2 "IBM Plex Mono",monospace;color:#eef3f8}
.mce-diag-row span,.mce-diag-card p{font-size:12px;line-height:1.55;color:#d2dce8;overflow-wrap:anywhere}
.mce-diag-card{display:grid;gap:6px;padding:10px 12px;border-radius:10px;background:#0b1016;border:1px solid rgba(255,255,255,.05)}
.mce-diag-card p{margin:0}
.mce-diag-card code{font:500 11px/1.5 "IBM Plex Mono",monospace;color:#f2f7fb}
.mce-diag-card[data-tone="accent"]{border-color:rgba(240,143,32,.36);background:rgba(240,143,32,.08)}
.mce-diag-card[data-tone="error"]{border-color:rgba(255,97,97,.32);background:rgba(255,97,97,.08)}
.mce-diag-card[data-tone="ok"]{border-color:rgba(122,214,160,.32);background:rgba(122,214,160,.08)}
.mce-diag-empty{padding:10px 12px;border-radius:10px;background:#0b1016;border:1px dashed rgba(255,255,255,.12);font-size:12px;color:#9fb3c8}
.mce-stage{position:relative;min-height:540px;border-radius:18px;background:radial-gradient(circle at 20% 0%, rgba(240,143,32,.14), transparent 32%),linear-gradient(180deg,#171d26 0%,#0f141a 100%);padding:32px;overflow:hidden}
.mce-hero{border:1px solid rgba(240,143,32,.3);border-radius:24px;padding:24px;background:linear-gradient(140deg, rgba(255,255,255,.06), rgba(255,255,255,.02))}
.mce-chip{display:inline-flex;padding:7px 10px;border-radius:999px;background:#f08f20;color:#111820;font:700 11px/1 "IBM Plex Mono",monospace}
.mce-hero h1{margin:16px 0 8px;max-width:8ch;font-size:clamp(36px,4vw,68px);line-height:.95}
.mce-hero p{margin:0;max-width:36rem;color:rgba(241,246,255,.74);font-size:17px;line-height:1.6}
.mce-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}
.mce-card,.mce-outro{border-radius:20px;padding:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.mce-card span,.mce-outro{font:600 11px/1.2 "IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.12em;color:#96a9bd}
.mce-card strong{display:block;margin:12px 0 8px;font-size:24px}
.mce-card p{margin:0;color:rgba(237,243,251,.72);line-height:1.55}
.mce-outro{margin-top:18px;max-width:460px}
.mce-caption{position:absolute;left:32px;bottom:28px;max-width:min(60vw,640px);padding:13px 16px;border-radius:14px;background:rgba(8,12,18,.84);border:1px solid rgba(255,255,255,.08)}
.mce-caption[data-tone="accent"]{border-color:rgba(240,143,32,.48)}
.mce-caption[data-tone="warning"]{border-color:rgba(255,97,97,.48)}
.mce-timeline{padding:16px 18px;border-top:1px solid rgba(255,255,255,.08);background:#0d1218}
.mce-lane{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:12px;margin-bottom:10px}
.mce-lane:last-child{margin-bottom:0}
.mce-lane-label{font:600 11px/1.2 "IBM Plex Mono",monospace;color:#9bb2c8;text-transform:uppercase;letter-spacing:.08em}
.mce-track{position:relative;height:34px;border-radius:10px;background:rgba(255,255,255,.04);overflow:hidden}
.mce-bar{position:absolute;top:4px;bottom:4px;border-radius:9px;background:rgba(240,143,32,.18);border:1px solid rgba(240,143,32,.4);display:flex;align-items:center;justify-content:space-between;padding:0 8px;cursor:grab;gap:8px}
.mce-bar.is-active{box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.mce-bar[data-bar-kind="sequence"]{background:rgba(92,146,255,.16);border-color:rgba(92,146,255,.42)}
.mce-bar[data-bar-kind="caption"]{background:rgba(122,214,160,.16);border-color:rgba(122,214,160,.42)}
.mce-bar[data-bar-kind="transition"]{background:rgba(215,112,255,.14);border-color:rgba(215,112,255,.42)}
.mce-bar[data-bar-moveable="false"]{cursor:default}
.mce-bar strong{font-size:11px;color:#eef3f8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mce-bar-handle{width:12px;height:100%;cursor:ew-resize;display:flex;align-items:center;justify-content:center;color:#f08f20;font:700 11px/1 "IBM Plex Mono",monospace;flex:0 0 auto}
.mce-bar[data-bar-kind="sequence"] .mce-bar-handle{color:#89b2ff}
.mce-bar[data-bar-kind="caption"] .mce-bar-handle{color:#8bdfb2}
.mce-bar[data-bar-kind="transition"] .mce-bar-handle{color:#e8a8ff}
@media (max-width:1440px){.mce-root{grid-template-columns:300px 1fr 320px}.mce-card-grid{grid-template-columns:1fr}}
`;

export function ensureMotionEditorStyles(): void {
  if (document.getElementById("motion-content-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "motion-content-editor-styles";
  style.textContent = MOTION_EDITOR_CSS;
  document.head.appendChild(style);
}
