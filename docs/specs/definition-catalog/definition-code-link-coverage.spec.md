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

## 관련 소스

- `packages/definition-catalog/src/code-references.ts`
- `packages/cli/src/commands/def.ts`
- `packages/cli/src/commands/def.test.ts`
- `packages/definition-catalog/src/code-references.test.ts`
