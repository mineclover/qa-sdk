# git-utils

`git-utils`는 Git 메타데이터 추출과 분기 충돌 분석 유틸리티다. 중앙 spec이 이미 잘 정리돼 있다.

## 먼저 볼 문서

- [git-utils.spec.md](../../docs/specs/system/git-utils.spec.md) — 전체 공개 계약

## 패키지 역할

- conventional commit, semver tag, scope 집계를 추출한다.
- 원격 브랜치 간 충돌 가능성과 workspace 변경을 분석한다.
- CLI와 registry-ui의 file-map 계열이 이 패키지를 소비한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/git.ts` — 기본 Git 메타데이터
- `src/branch-conflicts*.ts` — 충돌 분석 계열

## 실행

```bash
pnpm --filter git-utils build
pnpm --filter git-utils test
```
