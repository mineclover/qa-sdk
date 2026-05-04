// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type {
  LayoutMetrics,
  LayoutPattern,
  RLSCDocument,
  RLSCNode,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";
import { analyzeGrid } from "./grid.js";
import { classifyLayers } from "./layers.js";
import { measureLayout } from "./metrics.js";
import { classifyLayout } from "./pattern.js";
import { detectRelations } from "./relations.js";
import { aggregateTextRegions } from "./text-occupancy.js";
import { flattenTree } from "./tree-utils.js";

export interface AreaDocumentInput {
  readonly root: RLSCNode;
  readonly viewport: RLSCDocument["viewport"];
  readonly url?: string;
  readonly timestamp?: string;
  readonly address?: string;
}

export interface AreaAnalysisOptions {
  readonly textOccupancies?: readonly TextOccupancy[];
  readonly overflowTolerance?: number;
}

export interface AreaOverflowIssue {
  readonly parentId: string;
  readonly childId: string;
  readonly overflow: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly exceededPx: number;
}

export interface AreaAnalysisResult {
  readonly doc: RLSCDocument;
  readonly nodes: readonly RLSCNode[];
  readonly metrics: LayoutMetrics;
  readonly pattern: LayoutPattern;
  readonly overflowIssues: readonly AreaOverflowIssue[];
  readonly textRegions?: readonly TextRegionDensity[];
}

function isDocument(input: RLSCDocument | AreaDocumentInput): input is RLSCDocument {
  return "grid" in input && "layers" in input && "relations" in input;
}

export function createAreaDocument(input: AreaDocumentInput): RLSCDocument {
  const nodes = flattenTree(input.root);

  return {
    version: "1.0",
    viewport: input.viewport,
    url: input.url ?? "about:blank",
    timestamp: input.timestamp ?? new Date().toISOString(),
    address: input.address,
    root: input.root,
    grid: analyzeGrid(input.root, input.viewport),
    layers: classifyLayers(nodes),
    relations: detectRelations(nodes),
  };
}

export function analyzeAreas(
  input: RLSCDocument | AreaDocumentInput,
  options: AreaAnalysisOptions = {},
): AreaAnalysisResult {
  const doc = isDocument(input) ? input : createAreaDocument(input);
  const nodes = flattenTree(doc.root);
  const metrics = measureLayout(doc, options.textOccupancies);
  const pattern = classifyLayout(metrics);
  const overflowIssues = detectAreaOverflow(doc.root, options.overflowTolerance);
  const textRegions = options.textOccupancies
    ? aggregateTextRegions(doc, options.textOccupancies)
    : undefined;

  return {
    doc,
    nodes,
    metrics,
    pattern,
    overflowIssues,
    textRegions,
  };
}

export function detectAreaOverflow(
  root: RLSCNode,
  tolerance = 0.5,
): readonly AreaOverflowIssue[] {
  const issues: AreaOverflowIssue[] = [];

  function visit(parent: RLSCNode): void {
    if (!parent.visible) return;

    for (const child of parent.children) {
      if (!child.visible) continue;

      const overflow = {
        top: Math.max(0, parent.rect.y - child.rect.y),
        right: Math.max(0, child.rect.x + child.rect.width - (parent.rect.x + parent.rect.width)),
        bottom: Math.max(0, child.rect.y + child.rect.height - (parent.rect.y + parent.rect.height)),
        left: Math.max(0, parent.rect.x - child.rect.x),
      };
      const exceededPx = Math.max(overflow.top, overflow.right, overflow.bottom, overflow.left);

      if (exceededPx > tolerance) {
        issues.push({
          parentId: parent.id,
          childId: child.id,
          overflow,
          exceededPx,
        });
      }

      visit(child);
    }
  }

  visit(root);
  return issues;
}
