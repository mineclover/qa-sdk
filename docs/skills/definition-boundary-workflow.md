---
name: definition-boundary-workflow
description: "definition-catalog boundary를 기준으로 direct 구조, coupling, transitive 영향 범위를 읽고 문서 경계를 정렬하는 운영 플레이북."
---

# Definition Boundary Workflow

문서 경계나 컨텍스트 경계를 안정화할 때 쓰는 운영 순서다.
구현 세부보다 구조적 목적과 결합 표현을 먼저 정리한다.

## 기본 흐름

1. datasource를 맞춘다.
2. `boundary`로 direct 구조를 읽는다.
3. `boundary-context --mode direct`로 현재 작업 단위를 읽는다.
4. `boundary-context --mode transitive`로 전이 영향을 읽는다.
5. 필요하면 provider/state/interaction/validation 문서로 분리한다.

```bash
qa-sdk def sync
qa-sdk def boundary <문서ID>
qa-sdk def boundary-context <문서ID> --mode direct
qa-sdk def boundary-context <문서ID> --mode transitive
```

## direct 와 transitive

- `direct`
  지금 boundary 정리에 필요한 직접 관계만 본다.
- `transitive`
  inherited concern과 확장 blast radius까지 본다.

정리 작업은 `direct`부터 시작하고, 리뷰와 영향 평가는 `transitive`로 넓힌다.

## 문서 분해 기준

- boundary overview
  structural purpose만 적는다.
- provider 순서
  `flow/process_flow`
- 상태 전이
  `state/app_state`
- interaction
  `ui/interaction`
- 세부 구현
  `feature/func_def`
- 검증
  `feature/scenario` + `depth: validation`

## 함께 쓰는 skill

- `skills/def-boundary/SKILL.md`
  boundary 조회와 구조화의 기본 루틴
- `skills/def-context/SKILL.md`
  상위/하위/제약/의존 맥락 확인
- `skills/def-link/SKILL.md`
  누락된 authored link 보강
- `skills/def-state/SKILL.md`
  상태 전이와 lifecycle 분리

## 참고 문서

- `docs/specs/viteplus-sdk-smoke/viteplus-playbook-boundary-relation.spec.md`
- `docs/specs/definition-service/def-svc-api-contract.md`
