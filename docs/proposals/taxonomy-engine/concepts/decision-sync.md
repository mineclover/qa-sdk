<!-- status: draft (Stage 3 spec) -->

# Decision Sync — taxonomy ↔ decision-flow 양방향 동기화

> Stage 3 (v0.10) 신규 개념. yaml entry의 lifecycle 진행을 [decision-flow](../../../../packages/decision-flow/) 의사결정 시스템과 양방향 동기화. **decision-flow가 SSOT, yaml은 ref + 결과 반영**.

## 비전 ^purpose

- 결정 진행 중인 entry를 보면 양쪽 상태(yaml + decision)가 즉시 보임 — `feedback_decision-context-over-tracking`
- 작업자가 yaml/decision 어느 쪽에서 시작해도 반대편 skeleton이 자동 생성됨
- 결정 완료 시 yaml lifecycle 자동 갱신 commit (PR 아님 — 로컬 commit)

## 통합 결정 (확정)

| 결정 항목 | 결정 |
|----------|------|
| trigger 방향 | 양쪽 자유 — yaml/decision 어디서 시작해도 반대편 push |
| 데이터 SSOT | decision 객체는 **def-catalog 통합** — markdown + frontmatter 패턴, DB는 메타 |
| 자동화 주체 | local dev에서 `qa-sdk decision sync` 수동 명령 (Actions cron/webhook 아님) |
| PR vs commit | **commit으로 대체** — 봇/CI 아닌 사용자 본인의 commit |
| 충돌 정책 | 양쪽 변경 비교 후 사용자 선택 (`--accept-yaml` / `--accept-decision` / `--merge`) |
| 작은 변경 단위 | evidence weight 변경도 매번 commit — 결정 진행 흐름이 git log에 남음 |
| Web UI | taxonomy-web에 DecisionPanel 추가 (양쪽 상태 한 화면) |

## 데이터 모델

### Decision 파일

decision은 def-catalog 패턴을 따라 markdown + frontmatter. **frontmatter는 검색용 메타, 본문은 자연어 마커로 의미 추출**.

```
docs/decisions/
  ├── lesson-builder.layer.cue.md
  ├── lesson-builder.layer.branch.md
  └── ...
```

#### frontmatter (검색용 메타데이터 — DB로 indexed)

```yaml
---
id: lesson-builder.layer.cue
subject: tax:lesson-builder-content:layer.cue
lifecycle: review                        # taxonomy-engine Lifecycle 6값과 동일
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---
```

빠른 lookup에 필요한 최소만. 평면 구조, list/nested 없음.

#### 본문 (자연어 + 마커 추출)

CLAUDE.md §Definition 시스템의 마커 컨벤션을 따름 — `^purpose` 등 spec 마커처럼 decision 전용 마커 도입.

```markdown
# Decision: Cue/Beat 경계

interaction이 어디서 끝나고 다음 단위가 어디서 시작하는지의 경계를 정해야 한다. ^purpose

현재 lesson-builder에서 Cue와 Beat이 같은 axis entry로 묶여있어... ^context

## 검토한 옵션

### 옵션 A — Cue가 interaction 전체 포함
... ^option:cue-includes-interaction

### 옵션 B — Beat을 별도 axis entry로
... ^option:beat-as-entry

## 증거

TAXONOMY.md §Cue 섹션에서 "Cue is a meaningful unit ..." 정의가
이미 interaction 포함을 함의. ^evidence:precedent weight=0.8

lesson-builder PoC 실행 결과 Beat 분리 시 navigation 복잡도 증가. ^evidence:data weight=0.6

## 결정 (lifecycle: approved 시 채워짐)

(미정) ^outcome
```

#### 마커 → 추출 → DB

| 마커 | 추출 항목 | DB 컬럼 |
|------|----------|---------|
| `^purpose` | 질문 한 줄 | `decisions.question` |
| `^context` | 배경 문단 | (검색용 full-text only) |
| `^option:<id>` | 옵션 N개 | `decision_options` 테이블 |
| `^evidence:<kind> weight=N` | 증거 N개 | `decision_evidence` 테이블 |
| `^outcome` | 결정 결과 (approved일 때) | `decisions.outcome` |

bridge의 `parseDecisionFile()`이 frontmatter + 마커 둘 다 추출. evidence/option은 본문 안에 자연어 흐름으로 살아있고, DB는 그걸 인덱싱만 함.

결정 완료 시 `lifecycle: approved` + `^outcome` 마커 채움 — frontmatter는 lookup, 본문은 readable narrative.

### yaml 측 ref

기존 [[lifecycle]] spec의 `decisionLink`를 그대로 사용. 형식 추가:
- `./decisions/<id>.md` — 상대 path (기존 path 형식 활용)
- `decision-flow://<id>` — 절차적 URI (Stage 3 활성화 후 인식)

두 형식 모두 같은 decision 객체로 해소. id 생성은 패턴 (`<scope>.<axis>.<entry>`)이므로 봇이 자동 생성.

### def-catalog 통합

decision도 def-catalog scan 대상 → 좌표 부여:
- `def_scope`에 `decision` 추가 (vocab 갱신)
- decision frontmatter의 `id`가 좌표 식별자
- DB에 메타데이터(lifecycle, subject ref, updated) 저장. 본문은 파일 SSOT

→ def-catalog DB로 "결정 중인 entry 목록" 조회 가능.

## qa-sdk decision sync 명령

### 동작 매트릭스

| yaml 상태 | decision 파일 상태 | sync 동작 |
|----------|-------------------|----------|
| `lifecycle: tbd` + `decisionLink` | 없음 | **push**: skeleton 생성 (`question = placeholderReason`, `lifecycle = draft`) |
| `lifecycle: tbd` + `decisionLink` | `lifecycle: approved` | **pull**: yaml lifecycle = approved + commit |
| `lifecycle: approved` | `lifecycle: draft/review` | **pull**: decision lifecycle = approved + commit (yaml 우선 인정) |
| 양쪽 동시 변경 | (양쪽 다 변경) | **충돌 prompt** — 사용자 선택 |
| `lifecycle` 없음 | 없음 | skip |
| (양쪽 동일) | (양쪽 동일) | no-op |

### CLI 사양

```bash
qa-sdk decision sync                          # 전체 yaml scan + 양방향 sync
qa-sdk decision sync <tax:ref>                # 특정 entry만
qa-sdk decision sync --dry-run                # 변경 계획 출력, commit 안 함
qa-sdk decision sync --accept-yaml            # 충돌 시 yaml 우선
qa-sdk decision sync --accept-decision        # 충돌 시 decision 우선
qa-sdk decision sync --json                   # JSON 출력 (CI 통합용)
```

### commit 메시지 패턴

```
chore(decision): create skeleton for tax:lesson-builder-content:layer.cue

sync(taxonomy): lesson-builder-content.layer.cue lifecycle tbd → approved

  Evidence:
    - precedent: TAXONOMY.md §Cue (weight 0.8)
    - data: lesson-builder PoC (weight 0.6)

chore(decision): update evidence for tax:lesson-builder-content:layer.cue

  weight: precedent 0.8 → 0.9
```

evidence 작은 변경도 commit (단위가 작아도 흐름이 git log에 남음).

## 충돌 비교 UI

`qa-sdk decision sync` 실행 시 양쪽 모두 변경 감지하면:

```
충돌 감지: tax:lesson-builder-content:layer.cue

  [yaml]      lifecycle: approved (수정됨, 2025-05-21 14:20)
  [decision]  lifecycle: review   (수정됨, 2025-05-21 14:15, evidence 1건 추가)

옵션:
  (y) yaml 우선  — decision lifecycle = approved
  (d) decision 우선 — yaml lifecycle = review (yaml 변경 되돌림)
  (m) merge     — yaml lifecycle = approved + decision evidence 보존
  (s) skip      — 이번 sync 제외 (다음 실행에 재시도)

선택:
```

Web 패널에서도 같은 비교 뷰 — 클릭으로 선택 + 자동 commit.

## DecisionPanel (Web)

taxonomy-web의 기존 3-pane 컨텍스트 영역에 새 Collapsible 섹션:

- 선택된 entry의 `decisionLink` 발견 → DecisionPanel 활성화
- 표시: decision lifecycle 배지, question, evidence 목록, last updated
- 액션: "Open decision" (markdown 파일 링크), "Sync now" 버튼 (`/api/decision-sync` 호출)
- 양쪽 변경 있으면 충돌 UI inline 표시

신규 dev plugin: `decision-api` (decision 파일 읽기 + sync 명령 wrapping).

## 다른 개념과의 관계

- [[lifecycle]] — sync의 대상 (yaml entry의 lifecycle)
- [[semver-migration]] — `entry-lifecycle-changed`는 patch (이 sync가 trigger)
- decision-flow (`packages/decision-flow/`) — 이미 존재하는 FlowEngine + InstanceStore를 markdown SSOT로 감쌈
- definition-catalog — decision도 한 def_scope 도메인으로 통합

## 진행 조건 (확정)

- [x] taxonomy-engine Stage 1 (lifecycle + decisionLink) 안정 — v0.8 완료
- [x] taxonomy-engine Stage 2 (semver + migration) 안정 — v0.9 완료
- [ ] decision-flow API 안정 확인 (FlowEngine + InstanceStore 인터페이스 freeze)
- [ ] definition-catalog의 `def_scope`에 `decision` 추가 합의

## 비-목표

- decision-flow 자체 신규 기능 (이미 충분히 성숙)
- GitHub Actions cron 자동화 (local CLI 수동만)
- decision-flow의 다른 시스템(ingest-server 등)과의 통합 (별도)

## 참조

- roadmap Stage 3: `../roadmap.md`
- v0.10 plan: `../plans/v0.10.md`
- decision-flow: `packages/decision-flow/src/index.ts`
- definition-catalog SSOT: `packages/definition-catalog/src/`
- 비전 메모리: `feedback_decision-context-over-tracking`
