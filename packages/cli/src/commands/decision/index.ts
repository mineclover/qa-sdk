import { decisionSyncCmd } from "./sync.js";

export async function cliDecision(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "sync":
      return decisionSyncCmd(args);
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      console.error(`알 수 없는 decision 명령: ${sub}`);
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`qa-sdk decision — taxonomy ↔ decision 양방향 sync

사용법:
  qa-sdk decision sync [<tax:ref>] [--dry-run] [--no-commit] [--json]
                       [--accept-yaml | --accept-decision | --merge]

옵션:
  --dry-run             변경 계획만 출력, 파일/commit 미적용
  --no-commit           파일 변경은 적용, git add/commit 생략 (사용자가 묶어서 commit)
  --accept-yaml         충돌 시 yaml 우선
  --accept-decision     충돌 시 decision 우선
  --merge               충돌 시 yaml lifecycle + decision evidence 병합
  --json                JSON 출력

ref 없으면 전체 docs/taxonomies/*.yaml의 decisionLink 가진 entry 모두 sync.
`);
}
