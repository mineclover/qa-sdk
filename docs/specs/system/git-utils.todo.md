---
def:
  id: git-utils-todo
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: git-utils
      type: depends_on
---

# git-utils — 구현 TODO

## 목적 ^purpose

git-utils 패키지의 에러 가드 보강 + 패키지 독립 시나리오 테스트 구축 현황을 추적한다.

## 에러 가드 보강 — 완료 (2026-04-05)

- [x] `listGitWorktrees` — try-catch + 빈 배열 반환
- [x] `collectCommitSummary` — try-catch + 빈 SplitPoint 반환
- [x] `collectWorkspaceChanges` — readFileSync 이미 try-catch 존재

## 패키지 독립 시나리오 테스트

전략: 임시 bare remote + clone으로 브랜치/worktree를 만들고 테스트 후 자동 정리.

### 기본 메타데이터 (`git.ts`) — 완료 (12 tests)

- [x] `getRepoName` — remote URL 추출 + remote 없는 repo basename fallback + 잘못된 경로
- [x] `listSemverTags` — 태그 정렬 + 비-semver 제외 + 태그 없음
- [x] `parseConventionalCommits` — CC 파싱 + since 범위 + maxCount
- [x] `collectCommitTypes` — 기본 6종 + 관측 타입
- [x] `commitCountsByScope` — scope별 count + scopeless

### 순수 파서 — 완료 (3 tests)

- [x] `parseGitWorktreeList` — branch/bare/detached HEAD + 빈 출력
- [x] `listGitWorktrees` — 잘못된 경로 fail-silent

### 분기 충돌 분석 시나리오 — 완료 (3 tests)

- [x] 기본 시나리오: main + alpha/beta → src/api.ts overlap + hotspot
- [x] workspace 변경: uncommitted untracked 파일 감지
- [x] 빈 repo: 브랜치 없음 → 빈 hotspot

### 잔여 (다음 사이클)

- [ ] worktree 포함 시나리오 (linked worktree overlap — es-git worktree 지원 확인 필요)
- [ ] base ref 해소 fallback 체인 (upstream/remote HEAD/main/master)
- [x] hotspot 카운트 정렬 검증 (3브랜치/2브랜치 정렬 + branches 내부 알파벳순)
