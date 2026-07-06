---
id: lesson-builder-content.layer.cue
subject: tax:lesson-builder-content:layer.cue
lifecycle: draft
status: open
created: 2026-05-21T11:41:31.789Z
updated: 2026-05-21T11:41:31.789Z
sources:
  - docs/taxonomies/lesson-builder-content.yaml
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - docs/proposals/taxonomy-engine/plans/v0.10.md
  - docs/proposals/taxonomy-engine/plans/v0.8/open-decisions.md
---

# Decision: tax:lesson-builder-content:layer.cue

interaction(beat과의 경계) 정의 미정 — Cue가 어디서 끝나고 Beat이 어디서 시작하는지 결정 필요 ^purpose

## 현행 판정

이 decision은 `docs/taxonomies/lesson-builder-content.yaml`의 `layer.cue` entry가 `lifecycle: draft`와 `decisionLink`를 갖기 때문에 유지되는 열린 결정 stub이다. 현재 `taxonomy-engine` dogfooding 테스트는 lesson-builder taxonomy를 parse/validate/codegen하고 `cue` layer entry가 존재함을 검증하지만, Cue와 Beat의 정확한 경계는 아직 결정하지 않는다.

## 검토할 옵션

(미정)

## 증거

(미정)

## 결정

(미정) ^outcome

## 검증 경로

```bash
corepack pnpm --filter taxonomy-engine test -- dogfooding-lesson-builder
node scripts/design-usefulness-audit.mjs --format json --all
```
