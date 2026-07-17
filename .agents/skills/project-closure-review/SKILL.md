---
name: project-closure-review
description: "Use when finishing a multi-step qa-sdk task, handling review leftovers, committing mixed root/submodule changes, or preparing a mid-work review."
---

# Project Closure Review

## 목적

긴 작업의 끝에서 남은 리뷰 항목을 닫고, 문서/코드/서브모듈/검증 상태를 한 번에 정리한다. 핵심은 **상태를 먼저 분해하고, 검증 가능한 단위로 닫고, 커밋 후 중간 리뷰를 남기는 것**이다.

## 언제 사용

- 사용자가 "남은 작업 리뷰", "리뷰 결과 작업 진행", "커밋하고 중간 리뷰"를 요청할 때
- root repo와 `vendor/projectvisbug` 같은 submodule 변경이 함께 있을 때
- 문서 정리 후 `def validate`, package build/test, generated artifact 정리가 필요할 때
- CLI/runtime export drift처럼 검증 중 다음 blocker가 연쇄적으로 드러날 때

## 실행 순서

1. 상태를 root와 submodule로 분리한다.
   - root: `git status --short --untracked-files=all`, `git diff --stat`
   - submodule: `git -C <submodule> status --short --untracked-files=all`, `git -C <submodule> diff`
2. 남은 항목을 severity로 나눈다.
   - High: 검증/빌드/런타임 import를 막는 항목
   - Medium: 작업 범위가 섞인 변경, submodule pointer, lockfile, generated artifact
   - Low: 문서 표현, 후속 운영 결정, CI 활성화 여부
3. High부터 하나씩 닫는다.
   - 실패 메시지를 그대로 읽고, 다음 blocker가 나오면 같은 방식으로 반복한다.
   - 예: `def validate`가 `dkg` export drift로 실패하면 CLI가 기대하는 public export를 복구하고 focused test를 추가한다.
4. generated artifact를 판정한다.
   - 빌드 산출물이면 `.gitignore`에 추가하거나 기존 generated 패턴과 맞춘다.
   - 소스/데모 입력이면 추적 대상으로 포함한다.
5. 검증을 재실행한다.
   - 최소: 관련 package focused test/build/typecheck
   - 문서/definition 변경: `pnpm exec qa-sdk def validate`
   - whitespace: `git diff --check`
6. 커밋은 저장소 경계별로 한다.
   - submodule 내부 변경을 먼저 커밋한다.
   - root에서 submodule pointer와 root 변경을 커밋한다.
   - 커밋 전에는 `git diff`, `git log -n 8 --oneline`으로 메시지 스타일을 확인한다.
7. 중간 리뷰를 남긴다.
   - 커밋 SHA
   - 검증 결과
   - 남은 blocker/후속 결정
   - working tree clean 여부

## 커밋 체크

- 사용자 요청 없이 커밋하지 않는다.
- submodule이 있으면 root 커밋 전에 submodule working tree가 clean인지 확인한다.
- root 커밋에는 submodule pointer 변경이 포함되어야 한다.
- lockfile 변경은 package manifest 변경과 같이 묶는다.
- unrelated 변경이 보이면 되돌리지 말고 범위를 설명한다.

## 리뷰 출력 형식

```
커밋:
- submodule: <sha> <message>
- root: <sha> <message>

검증:
- <command> 통과

중간 리뷰:
- Blocker: 없음 / <항목>
- Medium: <후속 결정>
- Working tree: clean / dirty
```

## 흔한 실수

- submodule 내부 커밋 없이 root pointer만 보려는 것
- generated 파일을 untracked로 방치하는 것
- `def validate`의 첫 실패만 고치고 다음 import drift를 확인하지 않는 것
- 문서 링크 방향 변경 후 validate를 생략하는 것
- 코드 복구와 문서 정리를 같은 커밋에 넣으면서 검증 근거를 남기지 않는 것
