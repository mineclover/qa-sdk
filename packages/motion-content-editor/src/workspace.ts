// @def.boundary motion-content-editor-system
import {
  createPromoGridComposition,
  MOTION_COMPOSITION_SCHEMA_V2,
  parseMotionComposition,
  parseMotionCompositionV2,
  serializeMotionComposition,
  serializeMotionCompositionV2,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionCompositionDocumentV1,
  type MotionCompositionDocumentV2,
  type MotionCompositionSchema,
  type ResolvedMotionCompositionSchema,
  type MotionEditorState,
  type MotionParameterValues,
} from "motion-content";
import {
  createMotionWorkspaceController,
  type MotionWorkspaceController,
  type MotionWorkspaceSourceMetadataV1,
} from "motion-workspace";

export interface MotionEditorShellDocumentImportContext {
  readonly source: "textarea" | "file";
}

export interface MotionEditorShellDocumentExportContext {
  readonly document: MotionCompositionDocumentV1 | MotionCompositionDocumentV2;
  readonly fileName: string;
  readonly state: MotionEditorState<ResolvedMotionCompositionSchema>;
}

export interface MotionEditorShellWorkspace {
  readonly controller: MotionWorkspaceController;
  importDocument(source: string, context: MotionEditorShellDocumentImportContext): void;
  exportDocument(context: MotionEditorShellDocumentExportContext): void;
}

export interface MotionEditorShellWorkspaceOptions {
  readonly controller?: MotionWorkspaceController;
  readonly composition?: MotionCompositionSchema;
  readonly values?: Partial<MotionParameterValues>;
  readonly source?: MotionWorkspaceSourceMetadataV1;
  readonly savedAt?: string;
  readonly onImportDocument?: (
    source: string,
    context: MotionEditorShellDocumentImportContext & {
      readonly controller: MotionWorkspaceController;
    },
  ) => void;
  readonly onExportDocument?: (
    context: MotionEditorShellDocumentExportContext & {
      readonly controller: MotionWorkspaceController;
    },
  ) => void;
}

function defaultImportDocument(
  source: string,
  controller: MotionWorkspaceController,
): void {
  const isV2Document = /"schemaVersion"\s*:\s*"qa-sdk\.motion-composition\/v2"/.test(source);
  const values = controller.exportWorkspace().editor.values;
  if (isV2Document) {
    controller.apply({
      type: "set-composition",
      composition: parseMotionCompositionV2(source),
      values,
    });
    return;
  }
  controller.apply({
    type: "set-composition",
    composition: parseMotionComposition(source),
    values,
  });
}

function defaultExportDocument(
  context: MotionEditorShellDocumentExportContext,
): void {
  const source = context.document.schemaVersion === MOTION_COMPOSITION_SCHEMA_V2
    ? serializeMotionCompositionV2(context.document.composition as MotionCompositionDefV2)
    : serializeMotionComposition(context.document.composition as MotionCompositionDef);
  const blob = new Blob([source], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = context.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function createMotionEditorShellWorkspace(
  options: MotionEditorShellWorkspaceOptions = {},
): MotionEditorShellWorkspace {
  const controller = options.controller ?? createMotionWorkspaceController({
    composition: options.composition ?? createPromoGridComposition(),
    values: options.values,
    source: options.source,
    savedAt: options.savedAt,
  });

  return {
    controller,
    importDocument(source, context) {
      if (options.onImportDocument) {
        options.onImportDocument(source, { ...context, controller });
        return;
      }
      defaultImportDocument(source, controller);
    },
    exportDocument(context) {
      if (options.onExportDocument) {
        options.onExportDocument({ ...context, controller });
        return;
      }
      defaultExportDocument(context);
    },
  };
}
