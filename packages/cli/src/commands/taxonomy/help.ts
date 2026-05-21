export function printHelp(): void {
  console.log(`qa-sdk tax — 텍소노미 yaml 검증/조회/생성

사용법:
  qa-sdk tax validate <file> [--registry <dir>] [--strict] [--lifecycle-strict] [--json]
  qa-sdk tax show <file> <ref> [--json]
  qa-sdk tax show <ref> --registry <dir> [--json]
  qa-sdk tax codegen <file> --out <dir> [--registry <dir>] [--skip-validate] [--json]
  qa-sdk tax diff <a> <b> [--registry <dir>] [--json]
  qa-sdk tax git-diff [base-ref] [--json]   git base 대비 yaml 변경 자동 diff
  qa-sdk tax doctor <file> (--expected <file> | --auto) [--json]
  qa-sdk tax help

--registry <dir>: 디렉토리의 모든 .yaml을 TaxonomyRegistry에 로드.
  cross-taxonomy import 검증 및 registry-wide ref 조회에 활용.
  codegen: cross-tax import 해소 후 validate gate 강화 (errors=0 강제)
  diff: 두 yaml의 validate 진단 함께 출력 (informational)

--auto 지원 yaml: dkg-schema, ingest-coords, qa-sdk-def-catalog
  (yaml 파일명 기반 자동 매핑)

ref 형식 (3-tier):
  taxonomy:axis.entry              dotted
  taxonomy#/axes/<axis>/entries/<entry>   JSON pointer
  taxonomy::axis#address           address-based
`);
}
