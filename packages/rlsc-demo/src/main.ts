import { createPerspectiveViewer } from "@qa-sdk/rlsc-perspective";
import type { RLSCDocument } from "@qa-sdk/rlsc-analysis";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("app mount failed");

app.innerHTML = `
  <main class="workspace">
    <section class="viewer" data-viewer></section>
  </main>
`;

const viewerElement = app.querySelector<HTMLElement>("[data-viewer]");
if (!viewerElement) throw new Error("viewer mount failed");

createPerspectiveViewer(viewerElement, createDemoDocument(), {
  issues: [{ childId: "cta", parentId: "hero", severity: "warning" }],
});

function createDemoDocument(): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 960, height: 640 },
    url: "about:blank",
    timestamp: new Date().toISOString(),
    root: {
      id: "root",
      tag: "main",
      classes: [],
      rect: { x: 0, y: 0, width: 960, height: 640 },
      zIndex: 0,
      depth: 0,
      display: "grid",
      position: "static",
      overflow: "visible",
      visible: true,
      attributes: {},
      children: [
        {
          id: "hero",
          tag: "section",
          classes: ["hero"],
          role: "banner",
          rect: { x: 64, y: 48, width: 560, height: 300 },
          zIndex: 0,
          depth: 1,
          display: "block",
          position: "relative",
          overflow: "visible",
          visible: true,
          attributes: {},
          children: [
            {
              id: "cta",
              tag: "button",
              classes: ["cta"],
              rect: { x: 504, y: 276, width: 180, height: 56 },
              zIndex: 2,
              depth: 2,
              display: "inline-flex",
              position: "absolute",
              overflow: "visible",
              visible: true,
              textContent: "Review",
              attributes: {},
              children: [],
            },
          ],
        },
      ],
    },
    grid: { cellSize: 24, cols: 40, rows: 27, cells: [] },
    layers: [],
    relations: [{ type: "contains", source: "root", target: "hero", strength: 1 }],
  };
}
