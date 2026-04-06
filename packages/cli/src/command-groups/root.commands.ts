import {
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
} from "../command-spec.js";

export const ROOT_COMMAND_DESCRIPTORS = [
  { id: "root.init", path: ["init"], usage: "qa-sdk init [options]            새 카탈로그 프로젝트 또는 Vite 소비처 스캐폴딩", handlerKey: "root.init" },
  { id: "root.register", path: ["register"], usage: "qa-sdk register [options]          SchemaSnapshot → Registry 등록", handlerKey: "root.register" },
  { id: "root.dry-run", path: ["dry-run"], usage: "qa-sdk dry-run [options]           변경 시뮬레이션 (DAG 전파, 변경 없음)", handlerKey: "root.dry-run" },
  { id: "root.codegen", path: ["codegen"], usage: "qa-sdk codegen [options]           SchemaSnapshot → 타입 인터페이스 생성", handlerKey: "root.codegen" },
  { id: "root.inspect", path: ["inspect"], usage: "qa-sdk inspect [options]           Registry 상태 조회", handlerKey: "root.inspect" },
  { id: "root.sync-obsidian", path: ["sync-obsidian"], usage: "qa-sdk sync-obsidian [options]     CATALOG → Obsidian 볼트 전체 동기화", handlerKey: "root.sync-obsidian" },
  { id: "root.encode", path: ["encode"], usage: "qa-sdk encode <prefix> [--dim val] 문자열 → 주소 인코딩", handlerKey: "root.encode" },
  { id: "root.decode", path: ["decode"], usage: "qa-sdk decode <addr>               주소 → 문자열 디코딩", handlerKey: "root.decode" },
  { id: "root.resolve", path: ["resolve"], usage: "qa-sdk resolve <addr>              자동 마이그레이션", handlerKey: "root.resolve" },
  { id: "root.find-version", path: ["find-version"], usage: "qa-sdk find-version <axis> <entry> 문자열이 있는 버전 찾기", handlerKey: "root.find-version" },
  { id: "root.list-prefixes", path: ["list-prefixes"], usage: "qa-sdk list-prefixes [--json]      prefix 목록", handlerKey: "root.list-prefixes" },
  { id: "root.list-axes", path: ["list-axes"], usage: "qa-sdk list-axes [--json]          축 목록", handlerKey: "root.list-axes" },
  { id: "root.derive-refs", path: ["derive-refs"], usage: "qa-sdk derive-refs [--check]       refEntries 정합성", handlerKey: "root.derive-refs" },
  { id: "root.impact", path: ["impact"], usage: "qa-sdk impact --axis <id>          영향 분석", handlerKey: "root.impact" },
] as const satisfies readonly CommandDescriptor[];

export const ROOT_COMMAND_TREE =
  descriptorsToTree(ROOT_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];
