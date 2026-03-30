---
def:
  id: definition-quality-gates
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [cross-scope, quality-bundle, testing, entry-point]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: definition-state-model
      type: depends_on
    - target: definition-harness
      type: depends_on
    - target: definition-quality-contract
      type: contains
    - target: definition-gate-fsm
      type: contains
    - target: definition-gate-derivation
      type: contains
    - target: gate-definition-quality-work-domain
      type: contains
    - target: gate-definition-quality-spec-tracker
      type: contains
    - target: gate-definition-quality-cli
      type: contains
---
# Definition Quality Gates — 문서 그래프 기반 품질 검증

## 목적 ^purpose

anchor 문서(unit/module/leaf)의 완성도를 계약 문서 기반으로 검증하는 통합 경로. 문서 그래프에서 게이트를 자동 도출하고, 6단계 프로세스로 실행하며, 2계층 상태 모델로 결과를 추적한다.

## 정의 ^defines

- 6단계 프로세스 (Define→Resolve→Gather→Execute→Judge→Route)
- buildHarnessPlan() — anchor → 계약 문서 → gate 요구사항
- CLI quality 커맨드 (status/export/list/show/run/bundle/claims/next/diagnose)

## 소비 ^consumes

- state-model — convention-compliance 머신 (gate 결과 소비)
- harness — 프로세스 실행 인프라

## 위임 ^delegates

- **gate-fsm** → 상태 전이 + BundleState 파생 + 영속화
- **gate-derivation** → scope×aspect → GateKind 도출 + 구조적 상태

## 구성 ^overview

2개 하위 모듈 + 6단계 프로세스:

- **definition-gate-fsm**: 9-state 게이트 상태 머신 + BundleState 파생 + 영속화
- **definition-gate-derivation**: scope×aspect → GateKind 도출 + 구조적 상태 파생
- `6단계 프로세스`: Define→Resolve→Gather→Execute→Judge→Route
- `CLI`: `qa-sdk quality status/export/list/show/run/bundle/claims/next/diagnose`

## 6단계 프로세스

```
1. Define    — anchor 문서 그래프를 루트로 시작, contains/constrains 탐색
2. Resolve   — 계약 문서에서 contract markers 추출, GateKind 도출
3. Gather    — 계약/제약/scope 관련 문서 컨텍스트 조립
4. Execute   — 비용 순 실행 (static → unit → integration → system)
5. Judge     — 각 gate 결과를 계약 문서 기준과 대조
6. Route     — 미통과 → lifecycle 피드백, 전체 통과 → anchor 검증 완료
```

## 입력 ^inputs

- anchor 문서는 unit/module/leaf 중 하나여야 한다.
- anchor의 contains 그래프에 interface 또는 constraint 문서가 1건 이상 있어야 한다.
- quality claim audit를 사용하려면 bundle 또는 하위 문서에 contract marker(`^inputs`, `^outputs`, `^precondition`, `^postcondition`, `^failure`, `^evidence`, `^flow-steps`)가 있어야 한다.

## 사전 조건 ^precondition

- 문서 그래프가 scanAndBuild 기준으로 깨지지 않아야 한다.
- gate 실행 결과를 판정하려면 quality-ledger에 최신 gate run이 있어야 한다.
- 구현 리뷰 상태를 합성하려면 review-ledger가 대상 package/service scope를 읽을 수 있어야 한다.

## 실행 단계 ^flow-steps

- buildHarnessPlan()이 anchor에서 계약 문서를 식별하고 GateKind를 도출한다.
- quality run이 개별 gate를 실행하고 quality-ledger에 pass/fail/stale 상태를 남긴다.
- quality claims가 contract marker를 claim atom으로 분해하고, gate/review 상태를 합성해 claim composite verdict를 계산한다.

## 출력 ^outputs

- bundle 구조 조회 시 현재 하네스 상태(`concept-defined → contract-bound → gate-bound → verified`)가 표시된다.
- quality claims는 claim별 composite state(`declared`, `bound`, `exercised`, `verified`, `contradicted`, `stale`)와 missing/blocker를 출력한다.
- quality next는 gate success/fail에 따라 다음 gate/doc 후보를 제안한다.
- quality export는 bundle/system 상태를 JSON snapshot으로 남긴다.

## 사후 조건 ^postcondition

- 모든 gate가 verified이고 review 입력까지 충족되면 bundle은 `verified` 상태로 읽을 수 있다.
- failed gate나 stale review가 있으면 대응 claim은 `contradicted` 또는 `stale`로 승격된다.
- bundle 상태 변경은 cross-loop bridge를 통해 harness/decision 흐름으로 전달될 수 있다.

## 증거 요구 ^evidence

- `qa-sdk quality run <gate-doc-id>` 실행 결과가 quality-ledger에 기록되어 있어야 한다. [reversible]
- `qa-sdk quality claims <bundle-doc-id>` 출력에서 claim 수와 composite state 분포가 확인되어야 한다. [reversible]
- 관련 구현 파일의 review 상태가 review-ledger에서 `reviewed` 또는 `stale`로 조회 가능해야 한다. [reversible]

## CLI (quality 커맨드)

```bash
qa-sdk def sync                                     # 문서 변경을 local datasource에 반영
qa-sdk def validate                                 # 링크/계층/분류 검증
qa-sdk quality status [quality-gates-system]    # bundle 상태 요약
qa-sdk quality export [quality-gates-system] --output=artifacts/quality-gates-system.json
qa-sdk quality list [--domain=X] [--kind=Y]   # gate 문서 목록
qa-sdk quality show <gate-doc-id>              # gate 상세
qa-sdk quality run <gate-doc-id> [--dry-run]   # gate 실행
qa-sdk quality bundle <bundle-doc-id>          # 번들 구조
qa-sdk quality claims <bundle-doc-id>          # contract claim 감사표
qa-sdk quality next <gate-doc-id>              # 다음 gate 추천
qa-sdk quality diagnose <gate-doc-id>          # 최근 실행 결과 진단
```

## 운영 라이프사이클

대표 운영 순서는 다음과 같다.

1. `def sync`로 docs 변경을 datasource에 반영한다.
2. `def validate`로 broken link, level 위반, taxonomy 문제를 먼저 차단한다.
3. `quality show`로 대상 gate의 command, successPattern, bundle 연결을 확인한다.
4. `quality run`으로 gate를 실행해 `quality-ledger`에 최신 `gateDocId + docVersion` 결과를 남긴다.
5. `quality diagnose`와 `quality next`로 최근 실패/후속 gate 경로를 읽는다.
6. `quality claims`로 contract marker 기반 claim verdict를 계산한다.
7. `quality bundle`, `quality status`, `quality export`로 bundle/system 수준 상태를 요약하고 JSON snapshot을 남긴다.

## Claim Audit

`quality claims`는 bundle 문서의 contract marker(`^inputs`, `^outputs`, `^precondition`, `^postcondition`, `^failure`, `^evidence`, `^flow-steps`)를 claim atom으로 분해하고, 다음 입력을 합성하여 감사표를 만든다.

- `definition-catalog assembleContract()` — 섹션 조립
- `spec-tracker claim-extractor` — claim atom 추출
- `quality-ledger` — gate verified/failed/stale 상태
- `review-ledger` — 구현 파일 reviewed/stale/unreviewed 상태

현재 구현은 gate의 `package` 메타를 구현 바인딩 scope로 사용하는 휴리스틱을 쓴다. package 메타가 없으면 claim은 대부분 declared/bound 수준에 머문다.

`quality status`는 루트 `quality-gates-system` 아래 직계 bundle을 순회해 각 bundle의 claim verified 비율과 gate verified 비율을 한 번에 요약한다. `quality export`는 같은 스냅샷을 JSON artifact로 저장한다.

## 관련 소스

- `work-domain/src/harness.ts` — buildHarnessPlan, createHarnessInstance, applyGateEvent
- `cli/src/commands/quality.ts` — CLI quality 커맨드
- `spec-tracker/src/claim-audit.ts` — claim composite verdict 계산
