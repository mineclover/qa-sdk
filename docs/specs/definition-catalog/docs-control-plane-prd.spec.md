---
def:
  id: docs-control-plane-prd
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: experience
  svc: cli
  tags: [contract, prd, authoring]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-interface
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/prd-to-ralph-json.ts
  - packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts
  - packages/cli/src/lib/docs-control-plane/adapters/prd-markdown.ts
---

# Docs Control Plane PRD

## 목적 ^purpose

`qa-sdk docs prd ...` command family가 PRD authoring context, markdown scaffold, ralph-compatible JSON conversion, completed PRD sync preview를 어떻게 제공하는지 정의한다. 이 문서는 PRD authoring/compatibility flow를 소유하고, ralph runtime execution이나 TODO/spec promotion write authority는 소유하지 않는다.

## 명령 표면 ^defines

| command | write authority | 역할 |
|---------|-----------------|------|
| `docs prd context` | read-only | specs/TODO/plans/PRD/session/source/evidence authoring context 수집 |
| `docs prd scaffold` | explicit markdown output | context 기반 markdown PRD skeleton 생성 |
| `docs prd to-ralph-json` | explicit JSON output | markdown PRD를 ralph-compatible flat JSON으로 변환 |
| `docs prd sync-completion` | dry-run only | completed ralph PRD JSON에서 graph-axis scored TODO/spec/roadmap update candidates를 계산하고 `--strict` / `--evidence-only` review mode를 제공 |

## 구현 경계

- `commands/docs.ts` owns command parsing, validation, output formatting, and explicit output writes.
- `prd-to-ralph-json.ts` owns markdown PRD to ralph JSON preview/content generation.
- `prd-completion-sync.ts` owns completed PRD dry-run candidate calculation.
- `adapters/prd-markdown.ts` owns PRD markdown read model extraction.

## 규칙

- PRD markdown은 authoring/review artifact다.
- Ralph PRD JSON은 execution compatibility state다.
- `passes: true`는 review signal이며 TODO/spec promotion authority가 아니다.
- `sync-completion`은 dry-run only다.
- `sync-completion` candidate score는 graph-axis signal(`target`/`trace`/`source`/`evidence`/`role` 등)와 aligned source/test/evidence support를 함께 본다.
- `--evidence-only`는 source/test-only proof를 promotion support로 세지 않는다.
- `--strict`는 blocked promotion, session drift, diagnostics가 남아 있으면 non-zero exit으로 review failure를 표시한다.
- `scaffold`와 `to-ralph-json`은 explicit output path만 쓴다.
