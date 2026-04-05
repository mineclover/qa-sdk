---
def:
  id: git-utils-todo
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: deprecated
  layer: operation
  links:
    - target: git-utils
      type: depends_on
---

# git-utils — 구현 TODO (전체 완료)

## 목적 ^purpose

git-utils 패키지의 에러 가드 보강 + 패키지 독립 시나리오 테스트 구축 현황. **전 항목 완료.**

## 에러 가드 보강 — 완료

- [x] listGitWorktrees, collectCommitSummary, collectWorkspaceChanges

## 기본 메타데이터 — 완료 (12 tests)

- [x] getRepoName, listSemverTags, parseConventionalCommits, collectCommitTypes, commitCountsByScope

## 순수 파서 — 완료 (3 tests)

- [x] parseGitWorktreeList, listGitWorktrees

## 분기 충돌 분석 — 완료 (10 tests)

- [x] 기본 시나리오: overlap + hotspot
- [x] workspace 변경 감지
- [x] 빈 repo
- [x] hotspot 카운트 정렬 검증
- [x] base ref fallback (upstream → remote HEAD → main → master)
- [x] worktree overlap (linked worktree 변경이 hotspot에 포함)

## 테스트 현황: 25 tests 통과
