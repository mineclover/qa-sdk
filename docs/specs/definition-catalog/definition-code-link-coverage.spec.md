---
def:
  id: definition-code-link-coverage
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  links:
    - target: definition-quality-gates
      type: refines
---
# Definition Code Link Coverage

## 목적 ^purpose

명시적인 문서 연결이 없는 코드를 file-level로 식별하여, “모든 코드에는 의도가 있고 의도에는 문서가 있어야 한다”는 원칙을 점진적으로 집행한다.

## 정의 ^defines

- **explicit code link**
  - 문서 frontmatter `source:` / `sources:`
  - 코드 주석 `@def.boundary`, `@def.doc`
- **code link gap**
  - target scope 안의 코드 파일 중 explicit code link가 하나도 없는 파일
- **candidate file**
  - 기본: `packages/**/src/**/*.{ts,tsx,js,jsx,mjs,cjs}`
  - 기본 제외: `*.test.*`, `*.spec.*`, `dist`, `node_modules`, coverage 계열

## 명령 표면

```bash
qa-sdk def code-link-gaps
qa-sdk def code-link-gaps --scope=packages/cli/src
qa-sdk def code-link-gaps --scope=packages/cli/src,packages/definition-service/src --strict
qa-sdk def code-link-gaps --scope=packages/work-domain/src --json --limit=20
```

분리된 spec-management platform을 검증 대상으로 사용할 때는 같은 명령에 외부 executable을
주입할 수 있다. 이 경로는 qa-sdk collector를 거치지 않고 플랫폼의 snapshot query를 사용한다.

```bash
QA_SPEC_PLATFORM_BIN=/path/to/qa-spec-platform \
  qa-sdk def code-link-gaps --json --limit=20
```

`--platform-bin=<path>`는 환경변수보다 우선하며, 배포 후 기본 실행 경로 전환 전까지 legacy
collector와의 출력 비교를 위한 compatibility mode로 유지한다.

`--platform=auto`는 PATH에서 `qa-spec-platform`을 찾을 때만 외부 platform query를 선택한다.
실행 파일이 없으면 기존 collector로 폴백하므로, 레지스트리 배포 전에도 동일한 명령을
호환성 검증에 사용할 수 있다. `--platform=true`, `--platform-bin`,
`QA_SPEC_PLATFORM_BIN`은 명시적 외부 실행 요청이므로 실행 실패를 legacy 경로로 숨기지 않는다.

- `--scope`
  - 쉼표로 구분한 path prefix 목록. 없으면 전체 `packages/*/src`
- `--strict`
  - gap이 1건 이상이면 exit code 1
- `--include-tests`
  - `*.test.*`, `*.spec.*`도 후보에 포함
- `--include-non-src`
  - `src/` 밖 코드도 후보에 포함

## 운영 원칙

- repo 전체 strict gate를 바로 걸지 않는다.
- 초기 단계는 report/list 중심으로 현재 baseline을 드러낸다.
- strict gate는 package 또는 boundary scope를 좁혀서 점진적으로 도입한다.
- 문서 연결은 heuristic이 아니라 explicit mapping만 인정한다.
- 자동 선택 모드는 기본값이 아니며, 외부 패키지 배포와 clean consumer 검증이 끝날 때까지
  `--platform=auto`로만 활성화한다.

## 관련 소스

- `packages/cli/src/commands/def/platform.ts`
- `packages/definition-catalog/src/code-references.ts`
- `packages/cli/src/commands/def.ts`
- `packages/cli/src/commands/def/quality.ts`
- `packages/cli/src/commands/def.quality.test.ts`
- `packages/cli/src/commands/def.lifecycle.test.ts`
- `packages/definition-catalog/src/code-references.test.ts`

## 관련 검증

- `docs/specs/definition-catalog/definition-code-link-coverage.cases.md` — auto 선택과 legacy 폴백 BDD
- `packages/cli/src/commands/def.lifecycle.test.ts` — executable availability와 route selection
