---
def:
  id: git-utils
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: git-utils
  tags: [structural]
  links:
    - target: cli-command-group
      type: refines
    - target: cli-command-registry-plan
      type: traces_to
---

# git-utils — Git 메타데이터 추출 + 분기 충돌 분석

## 목적 ^purpose

모노레포의 Git 메타데이터를 추출하고, 분기 간 충돌 가능성을 사전 분석한다. CLI(`qa-sdk git scan`, `qa-sdk git conflicts`)와 registry-ui(file-map)에서 소비한다.

## 정의 ^defines

- **기본 메타데이터** — conventional commits 파싱, semver 태그, scope별 커밋 집계
- **분기 충돌 분석** — remote branch 간 파일 중첩 탐지, worktree 포함, hotspot 순위
- **워크스페이스 변경** — uncommitted 변경 감지 (repo scope vs execution scope)

## 소비 ^consumes

- `execa` — git CLI shell-out (동기)
- `es-git` — libgit2 bindings (비동기, 분기 충돌 분석 전용)

## 위임 ^delegates

- CLI `git-scan.ts` — 메타데이터 → SchemaSnapshot + meta.json
- CLI `git-conflicts.ts` — 충돌 분석 → GitConflictReport
- registry-ui `file-map/` — 타입 소비 (런타임 없음)

## 서브시스템 1: 기본 메타데이터 (`git.ts`)

모든 함수 동기, fail-silent (에러 시 `[]` 반환).

| 함수 | 입력 | 출력 |
|------|------|------|
| `getRepoName(cwd)` | 작업 디렉토리 | repo 이름 (remote URL 또는 dir basename) |
| `listSemverTags(cwd)` | 작업 디렉토리 | semver 태그 배열 (v prefix 제거) |
| `parseConventionalCommits(cwd, opts?)` | cwd + since/maxCount | `ConventionalCommit[]` |
| `collectCommitTypes(cwd)` | 작업 디렉토리 | 관측된 CC type + 6종 기본 합집합 |
| `commitCountsByScope(cwd)` | 작업 디렉토리 | `Record<scope, Record<type, count>>` |

## 서브시스템 2: 분기 충돌 분석

### 핵심 함수

`analyzeRemoteBranchConflicts(options)` → `RemoteBranchConflictAnalysis`

**base ref 해소 순서**: 명시 옵션 → upstream tracking → remote HEAD → main → master → 첫 번째 remote branch

**분석 흐름**:
1. es-git으로 repo 열기
2. 선택적 `git fetch --prune`
3. base ref 해소
4. 현재 브랜치 merge-base diff → `BranchChangeSet`
5. 모든 remote branch merge-base diff → `ComparedBranchAnalysis[]`
6. 선택적 linked worktree diff → `ComparedWorktreeAnalysis[]`
7. workspace 변경 수집 → `WorkspaceChangeSet`
8. hotspot 계산 (파일별 관련 브랜치 수 내림차순)

### 보조 함수

| 함수 | 역할 |
|------|------|
| `listGitWorktrees(cwd)` | `git worktree list --porcelain` 파싱 |
| `parseGitWorktreeList(output)` | 순수 파서 (porcelain 포맷) |
| `collectWorkspaceChanges(repoPath, execCwd, scope?)` | `git status --porcelain=v1 -z` 기반 uncommitted 변경 |

### 타입 체계 (13개)

| 타입 | 역할 |
|------|------|
| `BranchChangeFile` | 단일 파일 diff (path, status, OID) |
| `BranchChangeCommit` | CC 파싱된 커밋 |
| `BranchChangeStats` | 파일수/삽입/삭제 |
| `BranchSplitPoint` | merge-base 커밋 |
| `BranchChangeSet` | 브랜치 전체 분석 |
| `WorkspaceChangeSet` | 작업 디렉토리 변경 |
| `BranchOverlapFile` | 양쪽 브랜치 공통 파일 |
| `ComparedBranchAnalysis` | 비교 결과 (overlap + only) |
| `ComparedWorktreeAnalysis` | worktree 비교 |
| `GitWorktreeDescriptor` | worktree 정보 |
| `SharedConflictHotspot` | 다중 브랜치 hotspot |
| `RemoteBranchConflictAnalysis` | 최상위 분석 결과 |
| `GitConflictReport` | 버전 봉투 (v1 스키마) |

## 에러 처리

- **기본 메타데이터**: fail-silent — 모든 함수가 에러 시 빈 결과 반환
- **분기 충돌**: `listGitWorktrees`, `collectCommitSummary` 에러 가드 완료 (try-catch + 빈 배열)
- **workspace**: repo 외부 경로 → `null` 반환. untracked 파일 읽기 실패 → 0줄 처리
- **es-git**: 네이티브 바이너리 — CI 환경에서 사전 빌드 필요

## 구현 위치

| 파일 | 역할 |
|------|------|
| `packages/git-utils/src/git.ts` | 기본 메타데이터 (execa, 동기) |
| `packages/git-utils/src/branch-conflicts-analysis.ts` | 핵심 분석 (es-git, 비동기) |
| `packages/git-utils/src/branch-conflicts-commits.ts` | 커밋 수집 (내부) |
| `packages/git-utils/src/branch-conflicts-diff.ts` | 파일 diff (내부) |
| `packages/git-utils/src/branch-conflicts-worktrees.ts` | worktree 조회 |
| `packages/git-utils/src/branch-conflicts-workspace.ts` | 작업 디렉토리 변경 |
| `packages/git-utils/src/branch-conflicts-types.ts` | 타입 정의 |

## 테스트 현황

| 파일 | 패싯 | 테스트 |
|------|------|:------:|
| `git.test.ts` | getRepoName(3), listSemverTags(3), parseConventionalCommits(3), collectCommitTypes(1), commitCountsByScope(2) | 12 |
| `branch-conflicts.test.ts` | 파서(3), fail-silent(1), overlap(1), workspace(2), empty(1), sort(1), fallback(1), worktree(1), collectWorkspaceChanges(3) | 14 |

**합계: 26 tests**
