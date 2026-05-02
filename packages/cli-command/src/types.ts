// @def.boundary cli-command-spec
// @def.doc cli-command-spec

/** 옵션 정의 */
export interface OptionDef {
  flag: string;           // "--dry-run" | "--provider"
  short?: string;         // "-d" | "-p"
  type: "boolean" | "string";
  default?: unknown;
  description?: string;
  choices?: string[];
  valueHint?: string;     // help에서 표시할 값 힌트 (예: "<name>")
}

/** 위치 인자 정의 */
export interface ArgDef {
  name: string;
  required?: boolean;
  description?: string;
}

/** handler가 받는 파싱된 컨텍스트 */
export interface CommandContext {
  /** 파싱된 위치 인자 */
  args: Record<string, string | undefined>;
  /** 파싱된 옵션 */
  options: Record<string, string | boolean | undefined>;
  /** 나머지 인자 (파싱 안 된) */
  rest: string[];
  /** 원본 인자 배열 */
  rawArgs: string[];
}

/** 명령 handler */
export type CommandHandler = (ctx: CommandContext) => Promise<void>;

/** authored SSOT용 명령 기술자 */
export interface CommandDescriptor {
  /** 안정적인 식별자 (예: "service.health") */
  id: string;
  /** 루트 기준 경로 세그먼트 */
  path: readonly string[];
  /** 명령 설명 */
  description?: string;
  /** 사용법 문자열 */
  usage?: string;
  /** usage 아래 이어지는 줄 */
  continuation?: readonly string[];
  /** 위치 인자 정의 */
  args?: readonly ArgDef[];
  /** 옵션 정의 */
  options?: readonly OptionDef[];
  /** 실행 함수 */
  handler?: CommandHandler;
  /** 외부 dispatch용 핸들러 키 */
  handlerKey?: string;
}

/** CLI 명령 트리 노드 */
export interface CliCommandNode {
  /** 경로 세그먼트 (예: "deploy", "config") */
  segment: string;
  /** 명령 설명 (help에 표시) */
  description?: string;
  /** 사용법 문자열 (기존 호환 — 있으면 help에서 이것을 사용) */
  usage?: string;
  /** usage 아래 이어지는 줄 (기존 호환) */
  continuation?: readonly string[];
  /** 하위 명령 */
  children?: readonly CliCommandNode[];
  /** 위치 인자 정의 */
  args?: readonly ArgDef[];
  /** 옵션 정의 */
  options?: readonly OptionDef[];
  /** 실행 함수 (신규 — 직접 바인딩) */
  handler?: CommandHandler;
  /** 핸들러 키 (기존 호환 — 외부 dispatch 매핑용) */
  handlerKey?: string;
}

/** resolveCommand 결과 */
export interface ResolvedCommand {
  /** 매칭된 전체 명령 이름 (예: "infra deploy") */
  commandName: string;
  /** 명령 이후 남은 인자 */
  rest: string[];
  /** 매칭된 노드 */
  node: CliCommandNode;
}

// ── 기존 호환 타입 (packages/cli에서 사용 중) ──

export interface CommandUsageSpec<TName extends string = string> {
  name: TName;
  usage: string;
  continuation?: readonly string[];
}

export interface CommandDetailOptionSpec {
  flag: string;
  valueHint?: string;
  description: string;
}

export interface CommandDetailSpec {
  command: string;
  options: readonly CommandDetailOptionSpec[];
}

export interface CommandHelpSectionSpec {
  title: string;
  lines: readonly string[];
}
