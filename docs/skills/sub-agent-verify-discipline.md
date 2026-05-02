---
name: sub-agent-verify-discipline
description: "sub-agent dispatch 시 verify-before-complete 룰. 트리거: 'sub-agent', 'parallel agent', 'dispatch', '병렬 실행', '검증 누락', 'false claim', 'verify before complete'"
---

# Sub-Agent Verify Discipline

> 상위 에이전트가 sub-agent 에 작업을 위임할 때, sub-agent 의 자가 보고 ("통과", "ok", "passed") 만으로 작업 완료를 인정하지 않는다. **검증 명령의 stdout 원문** 이 보고에 포함되어야 하며, 상위 에이전트는 spot-check 으로 1-2 개 명령을 직접 재실행해 일치를 확인한다.

## 배경 (lessons learned)

`simulations/enterprise-pm` Domain Slice 마이그레이션 (2026-04-27) 에서 다음 파일 패턴이 반복 관측되었다.

- **Phase 1 — validator extension 미적용**: sub-agent 가 "validator 통과" 보고했으나 신규 rule 이 실제로는 추가되지 않음
- **Phase 2 — 7개 서비스 모두 false claim**: sub-agent 들이 "build / test 통과" 보고했지만 vitest (esbuild) 만 돌리고 `tsc` 미실행. 7 서비스 build 가 동시에 깨진 채 cleanup 단계에서 발견. 슬라이스당 평균 30~40분 추가 소요
- **Phase 3 — manifest extension 미적용**: 동일 패턴 재발

**process gap**: sub-agent 가 verify 단계 자가 보고를 신뢰할 수 없다. 보완책은 "출력 원문 캡처 + 상위 spot-check" 강제.

## 핵심 룰 (5)

1. **Verify Before Complete** — sub-agent 가 "완료" 라 부르기 전에 검증 명령을 실제로 실행하고, 마지막 ~20 줄 stdout 을 **그대로** 보고에 첨부한다 (요약 금지).
2. **TSC 강제** — vitest (esbuild loader) 의 통과는 tsc strict 통과를 보장하지 않는다. `pnpm --filter <pkg> build` 또는 `tsc --noEmit` 가 별도로 실행되어야 한다.
3. **Working Tree 가시성** — `git status --short` 출력을 보고에 포함. 변경 파일 목록이 작업 의도와 일치하는지 상위 에이전트가 즉시 검증할 수 있어야 한다.
4. **Failure-First Reporting** — 실패가 있으면 fix 시도 후 재실행하고, fix 결과의 stdout 도 그대로 첨부. 실패 회피용 stub / skip / comment-out 금지.
5. **Spot-Check Owned by Caller** — 상위 에이전트는 sub-agent 보고를 받은 뒤 검증 명령 1-2 개를 **직접** 재실행해 일치를 확인한다. sub-agent 보고만으로 후속 phase 진입 금지.

근거: 위 4가지 룰이 빠질 때 구체적으로 어떤 회귀가 발생했는지 — `docs/specs/system/layer-separation.rule.md` §Workflow Smoke 와 동일한 silent-empty 회귀 패턴.

## Sub-Agent Prompt 템플릿 (재사용)

상위 에이전트가 sub-agent 를 dispatch 할 때 prompt 끝에 다음 블록을 포함한다.

```
## 검증 (모두 실행 후 last 20 lines stdout 그대로 보고)

# typecheck — vitest 와 별개
pnpm --filter <pkg> build

# 단위 테스트
pnpm --filter <pkg> test

# 도메인 슬라이스 등 별도 validator 가 있으면
pnpm exec qa-scaffold validate <slice>

# working tree 상태
git status --short

## 보고 형식

각 명령마다:
- 명령어 한 줄
- exit code
- stdout last ~20 lines (그대로, 요약/번역 금지)

"통과" / "ok" / "passed" 같은 자기 평가 단어를 본문에 사용하지 말 것.
실패가 있으면 fix 시도 후 재실행 결과도 동일 형식으로 첨부.
실패 회피용 stub / skip / comment-out / .skip / xit / `as any` cast 금지.
스펙 요구를 만족시킬 수 없으면 회피하지 말고 보고로 올릴 것.
```

이 블록은 superpowers `verification-before-completion` skill 의 사용 패턴과 호환된다. sub-agent prompt 본문에 다음 한 줄을 추가하여 명시적으로 invoke 를 강제할 수 있다.

```
작업 완료를 주장하기 전에 superpowers `verification-before-completion` skill 을 invoke 하여 위 형식대로 stdout 원문을 캡처해 보고할 것.
```

## 상위 에이전트 책임 (caller checklist)

1. **Dispatch 전** — sub-agent prompt 에 위 검증 템플릿 + verification-before-completion invoke 지시 포함.
2. **수신 시** — sub-agent 보고에 stdout 원문이 있는지 1차 확인. 없으면 재요청.
3. **Spot-Check** — 보고된 명령 중 1-2 개를 상위 에이전트가 직접 실행하고 결과를 비교. 차이 발견 시 sub-agent 작업을 reject.
4. **다음 Phase 진입 조건** — spot-check 일치 + 모든 검증 명령 exit code 0. 한 가지라도 실패면 phase advance 금지.
5. **Plan 기록** — phase 별 verify 산출물을 `docs/plan/<plan-name>/lessons-learned.md` 또는 phase 문서 끝에 누적.

## 적용 범위

- `superpowers:dispatching-parallel-agents` 와 `superpowers:subagent-driven-development` skill 사용 시 본 가이드 우선 적용
- `docs/plan/**` 의 multi-phase plan 에서 sub-agent 호출 시 prompt 템플릿 재사용
- `qa-scaffold` / `qa-sdk def` 등 자체 validator 가 있는 작업 — vitest 로 대체하지 말 것

## 안티 패턴

| 패턴 | 왜 위험한가 | 대응 |
|---|---|---|
| sub-agent 가 "tsc / vitest / validator 모두 통과" 한 줄로 보고 | 실제 실행 여부 검증 불가 | stdout 원문 + exit code 첨부 강제 |
| vitest 만 실행하고 build 누락 | esbuild loader 는 tsc strict 보다 느슨 — 타입 회귀 silent | `pnpm --filter <pkg> build` 별도 강제 |
| validator extension (rule / manifest) 추가했다고 보고했으나 실제 코드 미반영 | 자가 보고 의존 | `git status --short` + diff 라인 수 보고 |
| 실패 발견 시 .skip / xit / `as any` cast / stub 으로 회피 | 회귀 누적 | spec 준수 불가 시 상위 에이전트에 보고 (no-fallback 원칙) |
| 상위 에이전트가 sub-agent 보고만 보고 다음 phase 진입 | 7-서비스 동시 회귀 사례 | phase advance 전 spot-check 1-2 개 직접 실행 |

## 관련 문서

- `docs/specs/system/layer-separation.rule.md` — Workflow Smoke 원칙 (silent-empty 회귀 차단)
- `docs/specs/system/change-simulation-precedence.rule.md` — 구조 변경 시 사전 시뮬레이션
- `docs/specs/system/testing-patterns.spec.md` — 테스트 SSOT 파생 표준
- `docs/plan/simulations-domain-slice-migration/README.md` — 본 가이드의 실증 사례 plan
- `docs/plan/simulations-domain-slice-migration/lessons-learned.md` — Phase 1/2/3 false-claim 7/7 패턴 + 6+ 시간 cleanup 비용 등 정량 근거
- superpowers `verification-before-completion` skill — evidence before assertions
- superpowers `dispatching-parallel-agents` skill — 병렬 dispatch 일반 가이드

## Reference (실증)

- 2026-04-27 simulations/enterprise-pm Domain Slice 마이그레이션 — Phase 2 sub-agent 7/7 false-claim, vitest(esbuild) 통과 ≠ tsc 통과. 정량 데이터: [`docs/plan/simulations-domain-slice-migration/lessons-learned.md`](../plan/simulations-domain-slice-migration/lessons-learned.md) §2~§3.

## 트리거 키워드

`sub-agent`, `subagent`, `parallel agent`, `dispatch`, `병렬 에이전트`, `verify before complete`, `false claim`, `검증 누락`, `tsc 누락`, `validator 미적용`
