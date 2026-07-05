# Taxonomy Engine

YAML로 좌표 텍소노미를 선언 → 검증 → 인덱싱 → 코드 생성 → 시각화/탐색 → 결정 흐름과 양방향 동기화.
qa-sdk 내 라이브러리 + CLI + 로컬 CI 게이트 + Web 리뷰 사이트.

## 목적 ^purpose

taxonomy-engine proposal의 첫 진입점으로, 핵심 개념/로드맵/계획/패키지 표면을 현재 구현 기준으로 연결한다.

## 첫 진입 순서

1. **개념 이해**: [`concepts/README.md`](./concepts/README.md) — 1급 4개(Axis/Entry/Coordinate/Relation) + 지원 5개 + 결정 흐름 2개
2. **시스템 개요**: [`00-design.md`](./00-design.md) — 목적, 아키텍처
3. **사용 사례**: [`../taxonomies/`](../../taxonomies/) — 5 도그푸딩 yaml
4. **진화 로드맵**: [`roadmap.md`](./roadmap.md) — Stage 1~4 결정 흐름 통합
5. **버전 history**: [`plans/README.md`](./plans/README.md) — v0.1~v0.14

## Stage 진행 상태

| Stage | 라운드 | 핵심 | 상태 |
|-------|--------|------|------|
| 1 | v0.8 | entry/axis [Lifecycle](./concepts/lifecycle.md) + placeholder(tbd) + decisionLink | ✅ |
| 2 | v0.9 | [Semver + Migration](./concepts/semver-migration.md) — diff breakingLevel + migrationPlan | ✅ |
| 3 | v0.10 | [Decision Sync](./concepts/decision-sync.md) — yaml ↔ markdown 양방향 (마커 컨벤션 통일) | ✅ |
| 4 | v0.11+ | [Decision-Flow Bridge](./concepts/decision-flow-bridge.md) — decision markdown ↔ FlowSchema projection | ✅ |

## 패키지 토폴로지

```
taxonomy-engine                  (lib, dual format) — schema/parse/validate/diff/migration/query/codegen/doctor
  ├ Lifecycle/BreakingLevel/MigrationPlan public types
  └ decisionImpact in MigrationPlan

taxonomy-decision-bridge         (lib, dual format) — Stage 3-4 추가
  ├ DecisionFile (frontmatter + 본문 마커)
  ├ resolveDecisionLink (path / decision:<id> / external)
  ├ computeSyncAction (yaml↔markdown sync 매트릭스)
  ├ toFlowSchema + extractEvidence + toMarkdown (decision-flow projection)
  ├ single-gate + multi-gate decision marker support
  └ decision-flow Evidence 재사용 (DecisionEvidence 별도 타입 없음)

decision-flow                    (lib, dual format, 14k 줄) — 풍부 모델/분석
  └ FlowEngine/FlowSchema/Evidence/CognitivePhase/GateWeight/analyzeGateStructure...

@qa-sdk/cli                      (서비스, tsup 번들)
  ├ tax {validate|show|codegen|diff|git-diff|migration|doctor|help}
  └ decision {sync|analyze|render|help}

@qa-sdk/taxonomy-web             (SPA, dev plugin 5개)
  ├ Tree + UnitDetail + lifecycle filter
  ├ DiffContextPanel (BreakingLevel 배지 + MigrationPlanPanel)
  └ DecisionPanel (조건부, decisionLink 가진 entry 선택 시)
```

의존 방향 한쪽만: `bridge → engine`, `bridge → decision-flow`, `cli → bridge`, `web → bridge`.

## 빠른 실행

```bash
# 검증/조회/생성
pnpm tax:ci                                            # 모든 게이트
qa-sdk tax validate <file> [--lifecycle-strict]        # 검증
qa-sdk tax show <file> <ref>                           # 단위 조회
qa-sdk tax doctor <file> --auto                        # 외부 SSOT drift
qa-sdk tax codegen <file> --out <dir>                  # TS 5 파일 생성

# 변경 분석
qa-sdk tax diff <a> <b> [--semver]                     # 두 yaml 비교 + breakingLevel
qa-sdk tax git-diff main                               # git base 대비 yaml 변경
qa-sdk tax migration --base <ref> <file>               # migrationPlan + decisionImpact

# 결정 흐름
qa-sdk decision sync [<tax:ref>]                       # yaml ↔ markdown decision 양방향
                  [--dry-run] [--no-commit] [--accept-yaml|--accept-decision|--merge]
qa-sdk decision analyze [<tax:ref>]                    # decision → FlowSchema + decision-flow 분석
```

## 모듈 위치

| 영역 | 경로 |
|------|------|
| 1급 개념 | `concepts/{axis,entry,coordinate,relation}.md` |
| 지원 개념 | `concepts/{constraint,taxonomy,registry,diagnostic}.md` |
| 결정 흐름 | `concepts/{lifecycle,semver-migration,decision-sync,decision-flow-bridge}.md` |
| 진단 카탈로그 | `concepts/diagnostics-catalog.md` |
| CLI 명령 | `concepts/cli-commands.md` |
| 도구/기능 | `concepts/{doctor,diff,query,codegen-output,auto-extract}.md` |
| 코드 SSOT | `packages/taxonomy-engine/src/`, `packages/taxonomy-decision-bridge/src/` |
| 도그푸딩 yaml | `docs/taxonomies/*.yaml` |
| 도그푸딩 decision | `docs/decisions/*.md` |
| 로컬 CI | `pnpm tax:ci` |

## 설계 검증 entry point

설계가 의도대로 작동하는지 확인하려면:

1. **데이터 흐름 검증**:
   - yaml 편집 → `pnpm tax:ci` → 모든 게이트 통과
   - tbd entry 박기 → `qa-sdk decision sync` → markdown decision 자동 생성 + commit
   - decision 본문 작성(`^purpose`/`^option`/`^evidence`) → `qa-sdk decision analyze` → FlowSchema + decision-flow 분석
2. **결정론 검증**:
   - 같은 yaml → 같은 contentHash (codegen drift 0)
   - yaml lifecycle 변경 → contentHash 변화 → drift 감지 → `--update`로 lockfile 갱신
3. **양방향 sync 검증**:
   - yaml `lifecycle: tbd` + decision draft = in-sync (사용자 의도 보존)
   - decision lifecycle 변경 → 다음 sync에서 yaml 자동 갱신 + commit
   - 양쪽 동시 변경 → conflict report + `--accept-yaml|--accept-decision|--merge`
4. **변환 검증**:
   - DecisionFile → FlowSchema: ^option 수 = branches 수, ^evidence kind 집합 = requiredEvidence
   - decision-flow의 분석 함수 호출 결과(coreGates/profiles) 출력
5. **회귀 패턴**:
   - 코드/yaml 변경 후 `pnpm tax:ci` + `pnpm --filter taxonomy-decision-bridge test`

## Status (v0.13+)

- **라이브러리**:
  - taxonomy-engine: 183 tests, ~30 public API
  - taxonomy-decision-bridge: 71 tests, 5 표면(resolve-link/sync/decision-file/to-flow-schema/from-flow-schema)
- **CLI**: 12 명령 (tax 8 + decision 4)
- **Web UI**: 4 컴포넌트 신규(LifecycleBadge/BreakingLevelBadge/MigrationPlanPanel/DecisionPanel) + 5-그룹 Context Panel
- **도그푸딩**: 5 yaml + 2 decision(lesson-builder cue/branch tbd)
- **로컬 CI**: `tax:ci` — 5 게이트(build/typecheck/test/validate fixtures/doctor/codegen drift) + Web build + Web test
