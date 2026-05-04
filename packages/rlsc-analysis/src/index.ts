export interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RLSCNode {
  readonly id: string;
  readonly tag: string;
  readonly classes: readonly string[];
  readonly role?: string;
  readonly rect: LayoutRect;
  readonly zIndex: number;
  readonly depth: number;
  readonly display: string;
  readonly position: string;
  readonly overflow: string;
  readonly visible: boolean;
  readonly textContent?: string;
  readonly address?: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly RLSCNode[];
}

export interface GridCell {
  readonly nodeIds: readonly string[];
  readonly zStack: readonly string[];
  readonly dominant?: string;
  readonly coverage: number;
}

export interface LayoutGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly (readonly GridCell[])[];
}

export interface LayerStack {
  readonly zIndex: number;
  readonly role: "background" | "content" | "sticky" | "overlay" | "modal" | "tooltip";
  readonly nodeIds: readonly string[];
  readonly totalArea: number;
}

export interface RLSCRelation {
  readonly type:
    | "contains"
    | "overlaps"
    | "adjacent-x"
    | "adjacent-y"
    | "aligned-x"
    | "aligned-y"
    | "stacked"
    | "flow";
  readonly source: string;
  readonly target: string;
  readonly strength?: number;
}

export interface RLSCDocument {
  readonly version: "1.0";
  readonly viewport: { readonly width: number; readonly height: number };
  readonly url: string;
  readonly timestamp: string;
  readonly address?: string;
  readonly root: RLSCNode;
  readonly grid: LayoutGrid;
  readonly layers: readonly LayerStack[];
  readonly relations: readonly RLSCRelation[];
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
