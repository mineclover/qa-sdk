---
def:
  id: definition-mgmt-verification-loop
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, testing, runtime]
  links:
    - target: definition-management
      type: refines
    - target: definition-mgmt-feedback-loop
      type: depends_on
    - target: definition-quality-gates
      type: depends_on
    - target: definition-harness
      type: depends_on
    - target: skill-cli-def-commands
      type: depends_on
---

# Definition Management — Verification Loop

## 목적 ^purpose

definition-catalog와 quality gate를 수정할 때 어떤 검증 루프를 어떤 순서로 반복해야 하는지 표준화한다. build, sync, validate, audit, quality, vitest 회귀를 하나의 운영 루프로 묶어 drift와 의미 불일치를 빨리 드러내는 것이 목적이다.

## 구성 ^overview

- 기본 루프: `build -> def sync -> def validate -> def audit -> def audit-db`
- quality gate 루프: `quality show -> quality run -> quality diagnose -> quality claims -> quality status/export`
- 회귀 테스트 루프: `scan-real -> tag-coverage -> system-link-coverage -> quality.test`
- 레거시 제거 루프: current 치환 후 `def sync -> def validate -> scan-real`
- raw scan 루프: `def scan-audit`로 frontmatter 기준 미해결 link와 순환을 별도로 확인

## 기본 루프

문서/CLI/정의 조회 surface를 바꾼 뒤 가장 먼저 도는 루프다.

```bash
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
node packages/cli/dist/index.js def audit
node packages/cli/dist/index.js def audit-db
```

### 읽는 법

- `build`
  CLI 표면과 타입 surface가 깨지지 않았는지 본다.
- `def sync`
  docs SSOT를 local datasource에 반영한다.
- `def validate`
  synced SQLite graph 기준의 구조 위반 + code reference boundary 정합성을 본다.
- `def audit`
  purpose, level, links, tags 분포를 한 번에 본다.
- `def audit-db`
  빠른 메타 품질과 고립 문서를 본다.
- address-first surface를 바꿨다면 `def get --address`, `def incoming|outgoing --address`, `def impact --address` smoke를 추가로 본다.

## Quality Gate 루프

quality gate나 claim verdict를 건드렸다면 기본 루프 다음에 돈다.

```bash
node packages/cli/dist/index.js quality show <gate-doc-id>
node packages/cli/dist/index.js quality run <gate-doc-id> --json
node packages/cli/dist/index.js quality diagnose <gate-doc-id> --json
node packages/cli/dist/index.js quality claims <bundle-id>
node packages/cli/dist/index.js quality status quality-gates-system --json
node packages/cli/dist/index.js quality export quality-gates-system --output=artifacts/quality-gates-system.json
```

### 읽는 법

- `quality show`
  게이트 계약과 명령 구성을 확인한다.
- `quality run`
  실제 실행 결과와 ledger 반영을 본다.
- `quality diagnose`
  최근 실패 원인과 추천 조치를 본다.
- `quality claims`
  contract marker 기반 verdict를 본다.
- `quality status/export`
  bundle/system 수준 snapshot을 만든다.

## 회귀 테스트 루프

문서 구조나 taxonomy를 많이 바꾼 뒤 최소한으로 보는 회귀 세트다.

```bash
pnpm --filter definition-catalog exec vitest run src/scan-real.test.ts
pnpm --filter definition-catalog exec vitest run src/tag-coverage.test.ts
pnpm --filter definition-catalog exec vitest run src/system-link-coverage.test.ts
pnpm --filter @qa-sdk/cli exec vitest run src/commands/quality.test.ts
```

### 적용 기준

- `scan-real`
  실문서 스캔이 깨지지 않았는지 본다.
- `tag-coverage`
  태그 체계와 전파 커버리지를 본다.
- `system-link-coverage`
  authored link 구조가 유지되는지 본다.
- `quality.test`
  quality CLI 경로를 건드렸을 때만 같이 본다.

## 레거시 제거 루프

deprecated/draft 정리나 current 치환 뒤에는 이 루프를 먼저 돈다.

```bash
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
pnpm --filter definition-catalog exec vitest run src/scan-real.test.ts
```

## Raw Scan 루프

DB-synced view와 raw frontmatter view를 구분해서 봐야 할 때 사용한다.

```bash
node packages/cli/dist/index.js def scan-audit
node packages/cli/dist/index.js def validate --scan
```

### 역할

- `scan-audit`
  raw frontmatter, 미해결 link, 그리고 같은 graph 규칙을 문서 원본 기준으로 본다.
- `validate --scan`
  datasource fallback 없이 scan graph 자체를 검증한다.

이 루프는 `def audit-db`와 다르다. `audit-db`는 synced SQLite 기준이고, `scan-audit`는 문서 원본 기준이다.

## 루프 선택 기준

| 변경 종류 | 최소 루프 |
|-----------|-----------|
| CLI 표면 변경 | 기본 루프 |
| 문서 frontmatter 구조 변경 | 기본 루프 + 회귀 테스트 루프 |
| quality gate 변경 | 기본 루프 + quality gate 루프 |
| 레거시 정리 | 레거시 제거 루프 |
| datasource/fallback 변경 | 기본 루프 + raw scan 루프 |

## 피드백 신호

- `def validate`는 synced SQLite graph의 현재 운용 상태와 code boundary 정합성을 보여준다.
- `def scan-audit`는 raw 문서 원본의 unresolved 상태를 보여준다.
- 둘의 결과가 다르면 sync 누락, reverse sync 필요, 또는 authored link drift를 의심한다.
- quality gate 결과와 claim verdict가 다르면 harness/contract marker 정합성을 먼저 본다.
