// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { CommandHelpSectionSpec } from '../../command-spec.js';

export const DEF_HELP_SECTIONS = [
  {
    title: '시작하기',
    lines: [
      'help                        이 도움말',
      'doctor                      통합 헬스체크 (validate + sync + coverage + aspect + annotations)',
      'guide                       시스템 전체 구조 안내',
      'guide concepts              핵심 개념 (좌표, prefix, 축)',
      'guide classification        문서 분류 체계 (scope, level, layer)',
      'guide authoring             핵심 작성 규칙 + 코드 매핑 규칙',
      'guide management            definition 관리 흐름',
      'guide services              서비스 구조',
      'guide philosophy            시스템 철학',
      'concepts                    concept 문서 목록',
    ],
  },
  {
    title: '조회',
    lines: [
      'list [--scope=X] [--aspect=A] [--level=Z] [--layer=Y] [--tag=T] [--q=검색어] [--domain-root=<rootId>] [--include-children] [--type=rule|cases|test|...] [--ext=rule]',
      'get <ID> | --address=<ADDR>  단건 조회',
      'body <ID>           최신 본문 조회 (--json 가능)',
      'read <ID>           body의 별칭',
      'children <ID>       구조 멤버(contains/refs/refines←)와 소비자(depends_on←) 분리 조회',
      'parent <ID>         부모 문서',
      'incoming <ID> | --address=<ADDR>  역링크',
      'outgoing <ID> | --address=<ADDR>  순방향 링크',
      'search <검색어>     전문 검색',
      'concepts            knowledge/concept 문서 조회',
      'find-by-file <경로[:symbol]> code_references 기준 boundary 해석',
    ],
  },
  {
    title: '분석',
    lines: [
      'scan-audit [--platform=auto] raw frontmatter/link 감사 (DB 미사용; 설치된 외부 플랫폼 자동 사용)',
      'context <ID> [--bounded] [--used-tokens N] [--initial-usage <path>] [--provider-usage <path> --provider openai|anthropic|generic] [--provider-phase discovery|working] [--tokenizer-module <path>|--tokenizer-registry <path> [--tokenizer-provider openai|anthropic|generic] [--tokenizer-model <id>]] [--stop-routes <csv>] [--stop-facts <csv>] [--stop-evidence <csv>] [--no-progress-limit N] [--json]  작업 전 컨텍스트 (소속/의존/영향)',
      'context <ID> --bounded --handoff-out <path> --result-revision <REV> [--source-revision <REV>] [--unresolved-questions <csv>] [--next-task-key <KEY> --next-task-objective <TEXT>]  Typed Handoff 저장',
      'handoff <store-path> <task-key> [--json]  저장된 Typed Handoff 조회',
      'handoff-aggregate <store-path> <decomposition.json> --source-revision <REV> --result-revision <REV> [--discovery-results <path>] [--json]  discovery child는 refs로, resolution child는 parent Handoff로 집계',
      'boundary <ID> | --address=<ADDR>       바운더리 구조 + direct coupling (--level, --json 가능)',
      'boundary-context <ID> | --address=<ADDR> 바운더리 + concerns + impact + feedback (--level, --mode, --json 가능)',
      'impact <ID> | --address=<ADDR>  변경 영향 분석',
      'topdown <ID>        탑다운 조립 (기본=구조 멤버만, --with-consumers 시 의존자 포함)',
      'bottomup <ID>       영향 역추적',
    ],
  },
  {
    title: '품질',
    lines: [
      'sync                docs → local DB 동기화',
      'audit               품질 리포트 + 그래프 검증',
      'audit --rollup-aspect  aspect family 별 문서 rollup 집계',
      'audit --by-domain   도메인 루트 기준 리포트',
      'validate            DB 기준 그래프 + code reference 검증',
      'code-link-gaps [--platform=auto] explicit 문서 연결 없는 코드 목록 (미설치 시 legacy collector)',
      'platform-verify     외부 spec-management platform으로 문서/코드 evidence 검증',
      'stats               분포 통계',
      'check <ID>          문서 정합성 점검',
      'link-rules          LinkType 사용 규칙',
    ],
  },
  {
    title: '상태',
    lines: [
      'state               전체 머신 상태 분포',
      'state <머신ID>      특정 머신 분포',
      'state <문서ID>      문서별 상태',
      'state [--verification-artifact=<path>] [--verification-drift] [--json]  검증 read model 조합',
      'state --deps        머신 간 의존 관계',
    ],
  },
  {
    title: '유틸',
    lines: [
      'verification-bindings  --spec-ids=<id1,id2> --out=<bindings.json> --captured-at=<ISO> [--json]',
      'verification-artifact  --summary=<VerificationSummary.json> --out=<artifact.json> --run-started-at=<ISO> --run-completed-at=<ISO> [--bindings=<bindings.json>]',
      'audit-db            DB 검증/정리',
      'overview            전체 그룹 구조 조회',
      'tier classify       Phase 1.B 자동 분류 실행기',
    ],
  },
] as const satisfies readonly CommandHelpSectionSpec[];
