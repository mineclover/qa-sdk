import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
} from "../command-spec.js";
import { motionInspect, motionValidate } from "../commands/motion.js";
import {
  motionApply,
  motionExport,
  motionImport,
  motionPreview,
  motionSceneCreate,
  motionSceneDelete,
  motionSceneList,
  motionSceneShow,
  motionWorkspaceCreate,
  motionWorkspaceDelete,
  motionWorkspaceList,
  motionWorkspaceShow,
} from "../commands/motion-workspace.js";

type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export const MOTION_COMMAND_DESCRIPTORS = [
  { id: "motion.validate", path: ["validate"], usage: "qa-sdk motion validate <file>      Motion composition/workspace 문서 검증", handlerKey: "motion.validate" },
  { id: "motion.inspect", path: ["inspect"], usage: "qa-sdk motion inspect <file>       Motion composition/workspace 요약", handlerKey: "motion.inspect" },
  { id: "motion.workspace.list", path: ["workspace", "list"], usage: "qa-sdk motion workspace list       Remote motion workspace 목록", handlerKey: "motion.workspace.list" },
  { id: "motion.workspace.show", path: ["workspace", "show"], usage: "qa-sdk motion workspace show <id>  Remote motion workspace 상세", handlerKey: "motion.workspace.show" },
  { id: "motion.workspace.create", path: ["workspace", "create"], usage: "qa-sdk motion workspace create <id>  Remote motion workspace 생성", handlerKey: "motion.workspace.create" },
  { id: "motion.workspace.delete", path: ["workspace", "delete"], usage: "qa-sdk motion workspace delete <id>  Remote motion workspace 삭제", handlerKey: "motion.workspace.delete" },
  { id: "motion.scene.list", path: ["scene", "list"], usage: "qa-sdk motion scene list --workspace <id>  Remote motion scene 목록", handlerKey: "motion.scene.list" },
  { id: "motion.scene.show", path: ["scene", "show"], usage: "qa-sdk motion scene show --workspace <id> --scene <id>  Remote motion scene 상세", handlerKey: "motion.scene.show" },
  { id: "motion.scene.create", path: ["scene", "create"], usage: "qa-sdk motion scene create --workspace <id>  Remote motion scene 생성", handlerKey: "motion.scene.create" },
  { id: "motion.scene.delete", path: ["scene", "delete"], usage: "qa-sdk motion scene delete --workspace <id> --scene <id>  Remote motion scene 삭제", handlerKey: "motion.scene.delete" },
  { id: "motion.export", path: ["export"], usage: "qa-sdk motion export --workspace <id> --out <file>  Remote workspace → composition JSON", handlerKey: "motion.export" },
  { id: "motion.import", path: ["import"], usage: "qa-sdk motion import <file> --workspace <id>        composition JSON → remote workspace", handlerKey: "motion.import" },
  { id: "motion.apply", path: ["apply"], usage: "qa-sdk motion apply --workspace <id> --command <json>  Remote workspace command 적용", handlerKey: "motion.apply" },
  { id: "motion.preview", path: ["preview"], usage: "qa-sdk motion preview [--workspace <id>]  Online workspace preview 실행", handlerKey: "motion.preview" },
] as const satisfies readonly CommandDescriptor[];

export const MOTION_COMMAND_TREE =
  descriptorsToTree(MOTION_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const MOTION_COMMAND_SPECS =
  collectCommandUsageSpecs(["motion"], MOTION_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const MOTION_HANDLER_REGISTRY = {
  "motion.validate": motionValidate,
  "motion.inspect": motionInspect,
  "motion.workspace.list": motionWorkspaceList,
  "motion.workspace.show": motionWorkspaceShow,
  "motion.workspace.create": motionWorkspaceCreate,
  "motion.workspace.delete": motionWorkspaceDelete,
  "motion.scene.list": motionSceneList,
  "motion.scene.show": motionSceneShow,
  "motion.scene.create": motionSceneCreate,
  "motion.scene.delete": motionSceneDelete,
  "motion.export": motionExport,
  "motion.import": motionImport,
  "motion.apply": motionApply,
  "motion.preview": motionPreview,
} satisfies Readonly<Record<string, RestCommandHandler>>;
