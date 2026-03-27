import {
  createPromoGridComposition,
  parseMotionComposition,
  serializeMotionComposition,
  type MotionCompositionDef,
  type MotionCompositionDocumentV1,
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
  readonly document: MotionCompositionDocumentV1;
  readonly fileName: string;
  readonly state: MotionEditorState;
}

export interface MotionEditorShellWorkspace {
  readonly controller: MotionWorkspaceController;
  importDocument(source: string, context: MotionEditorShellDocumentImportContext): void;
  exportDocument(context: MotionEditorShellDocumentExportContext): void;
}

export interface MotionEditorShellWorkspaceOptions {
  readonly controller?: MotionWorkspaceController;
  readonly composition?: MotionCompositionDef;
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
  controller.apply({
    type: "set-composition",
    composition: parseMotionComposition(source),
    values: controller.exportWorkspace().editor.values,
  });
}

function defaultExportDocument(
  context: MotionEditorShellDocumentExportContext,
): void {
  const blob = new Blob([serializeMotionComposition(context.document.composition)], {
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
