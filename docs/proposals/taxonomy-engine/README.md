# Taxonomy Engine

YAML로 좌표 텍소노미를 선언 → 검증 → 인덱싱 → 코드 생성 → 시각화/탐색.
qa-sdk 내 신규 라이브러리 + CLI + 로컬 CI 게이트.

## 첫 진입 순서

1. **개념 이해**: [`concepts/README.md`](./concepts/README.md) — 1급 4개 (Axis/Entry/Coordinate/Relation) + 지원 4개
2. **시스템 개요**: [`00-design.md`](./00-design.md) — 목적, 아키텍처
3. **사용 사례**: [`../taxonomies/`](../../taxonomies/) — 5 도그푸딩 yaml
4. **버전 history**: [`plans/`](./plans/) — v0.1~v0.7

## 모듈 위치

| 영역 | 경로 |
|------|------|
| 1급 개념 | `concepts/{axis,entry,coordinate,relation}.md` |
| 지원 개념 | `concepts/{constraint,taxonomy,registry,diagnostic}.md` |
| 진단 카탈로그 | `concepts/diagnostics-catalog.md` |
| CLI 명령 | `concepts/cli-commands.md` |
| 신규 기능 (v0.2+) | `concepts/{doctor,diff,query,codegen-output,auto-extract}.md` |
| 코드 SSOT | `packages/taxonomy-engine/src/` |
| 도그푸딩 yaml | `docs/taxonomies/*.yaml` |
| 로컬 CI | `pnpm tax:ci` |

## 빠른 실행

```bash
pnpm tax:ci                                    # 모든 게이트
qa-sdk tax validate <file>                     # 단일 검증
qa-sdk tax show <file> <ref>                   # 단위 조회
qa-sdk tax doctor <file> --auto                # 외부 SSOT drift
qa-sdk tax git-diff main                       # PR 리뷰
```

## Status (v0.7)

- 라이브러리: 138 tests, 17 public API
- CLI: 7 명령 (validate/show/codegen/diff/doctor/git-diff/help)
- 도그푸딩: 5건 (qa-sdk-coords, lesson-builder, dkg, ingest, def-catalog)
- 로컬 CI: 7 게이트 (build/typecheck/test/validate/doctor/codegen-drift/CLI test)
- Web UI: spec 초안만 (`../taxonomy-web/00-design.md`)
