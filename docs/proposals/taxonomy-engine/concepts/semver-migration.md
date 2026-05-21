<!-- status: approved (v0.9 Stage 2) -->

# Semver + Migration — 변경 영향도 분류와 이전 계획

> Stage 2 (v0.9) 신규 개념. multi-version Registry를 폐기하고 **git이 SSOT**라는 결정 위에 구축. [[diff]] 결과에 breakingLevel 부여하고, 두 시점 IR 간 마이그레이션 후보를 자동 추정.

## 목적 ^purpose

- diff 결과의 **사용자 영향도**를 한 단어로 요약 (major/minor/patch)
- yaml 변경이 consumer 코드에 어떤 충격을 주는지 미리 분류
- id rename 후보를 address 동일성으로 자동 추정 → migration PR 작성 보조
- CI 게이트: PR에 major 변경이 섞이면 차단

## 폐기된 대안

초기 roadmap은 `TaxonomyRegistry`에 `Map<slug, Map<version, IR>>` 다중 버전 동시 보관을 검토했으나 **폐기**. git이 이미 모든 yaml 시점을 추적하므로 메모리 다중 버전은 중복 추상화. 라이브 마이그레이션 시점에만 git checkout으로 처리. 상세: [`../roadmap.md`](../roadmap.md) §Stage 2.

## breakingLevel

| level | 의미 | 예시 DiffEntry kinds |
|------|------|---------------------|
| `major` | consumer 코드 깨짐 — 코드/codegen 출력 변경 강제 | axis-removed, entry-removed, entry-address-changed, capacity-changed(감소), relation-removed, relation-rule-removed, constraint-removed |
| `minor` | 호환 가능 추가 — consumer 코드 영향 없음 | axis-added, entry-added, relation-added, relation-rule-added, capacity-changed(증가), constraint-added |
| `patch` | 메타데이터 변경 — 의미 변동 없음 | entry-label-changed, entry-lifecycle-changed, entry-placeholder-reason-changed, entry-decision-link-changed, axis-lifecycle-changed |
| `none` | 변경 없음 | (changes 비어있음) |

### 분류 규칙

- DiffResult에 단일 `breakingLevel` 필드. **최고 등급**(major > minor > patch > none) 우선.
- 같은 kind라도 의미가 다른 경우는 **추가 필드**로 결정:
  - `capacity-changed`: `from > to` → major (기존 entry 잘림 위험), `from < to` → minor (headroom 증가)
  - 추가 필드 비교가 필요한 모든 분류는 kind→level 함수 안에서 처리

### 코드 분류 표 (전체)

| DiffEntry kind | 기본 level | 조건 |
|----------------|-----------|------|
| `axis-added` | minor | |
| `axis-removed` | major | |
| `axis-lifecycle-changed` | patch | |
| `entry-added` | minor | |
| `entry-removed` | major | |
| `entry-address-changed` | major | address는 영구 식별자 |
| `entry-label-changed` | patch | |
| `entry-lifecycle-changed` | patch | tbd→approved 같은 결정 진행도 의미 변경 없음 |
| `entry-placeholder-reason-changed` | patch | |
| `entry-decision-link-changed` | patch | |
| `capacity-changed` | minor (from < to) / major (from > to) | |
| `relation-added` | minor | |
| `relation-removed` | major | |
| `relation-rules-count-changed` | patch | (rule 추가/제거는 rule-* kind가 함께 emit) |
| `relation-rule-added` | minor | 새 매핑 추가 |
| `relation-rule-removed` | major | 기존 invariant 깨짐 |
| `constraint-added` | minor | (constraint 자체는 yaml 강제만, consumer 무관) |
| `constraint-removed` | major | (검증 완화 — consumer가 의존했을 가능성) |

## migrationPlan

```typescript
function migrationPlan(from: TaxonomyIR, to: TaxonomyIR): MigrationPlan;

type MigrationPlan = {
  idRenames: Array<{ axis: string; fromId: string; toId: string; address: number }>;
  addressConflicts: Array<{ axis: string; address: number; ids: string[] }>;
  manualReview: string[];
};
```

### id rename 추론 알고리즘

`from.axes[a].entries`와 `to.axes[a].entries`를 address 키로 매칭:

1. address가 양쪽에 정확히 1건씩 있고 id가 다르면 → `idRenames` 1건
2. address가 한쪽엔 있고 다른 쪽엔 없으면 → `entry-added` / `entry-removed`로 [[diff]]가 처리, migrationPlan은 무시
3. 같은 address에 여러 id가 충돌하면 → `addressConflicts`로 보고 (yaml 입력 자체가 부정합)
4. 유사도(levenshtein 등) 기반 추정은 **하지 않음** — Stage 2 scope 밖

### address conflict

같은 yaml 안에 같은 axis의 같은 address가 두 번 이상 — 정상 yaml에선 `structural-duplicate-address` error로 거부됨. migrationPlan은 호출 시점에 이미 valid IR을 받지만 두 IR을 합쳐 보면 충돌이 생길 수 있음을 보고. **자동 해결은 하지 않음** — 사용자가 결정.

### manualReview

자동 처리할 수 없는 케이스의 자유 텍스트 메시지. 예: "axis `layer` capacity가 16 → 8로 축소됐는데 현재 entries 12개 — 4개 제거 필요". 사용자 액션 필요.

## CLI

### `tax diff <a> <b> --semver`

기존 `tax diff` 출력에 breakingLevel 배지 한 줄 추가. `--semver` 플래그가 있으면 `breakingLevel === "major"`일 때 exit 1.

```bash
qa-sdk tax diff a.yaml b.yaml --semver
# 출력 끝:
#   breakingLevel: major (entry-removed: layer.cue)
# exit 1
```

### `tax migration --base <ref> [file]`

git base와 working tree 비교. 두 IR 추출 후 `diff()` + `migrationPlan()` 함께 실행.

```bash
qa-sdk tax migration --base main docs/taxonomies/lesson-builder-content.yaml
# 출력:
#   diff: 3 changes (major)
#   id renames: 1
#     - axis=layer  address=3  cue → moment
#   address conflicts: 0
#   manual review: 0
```

### CI 게이트 활용

```yaml
# .github/workflows/tax-gate.yml
- name: PR semver gate
  run: pnpm qa-sdk tax diff --base ${{ github.base_ref }} --semver
```

major 변경이 들어오면 PR 빌드 실패. 의도된 major는 PR 설명에 "BREAKING:" 명시 + 별도 승인 절차.

## Web UI

- `DiffContextPanel`에 breakingLevel 배지 (major=red, minor=amber, patch=gray)
- `MigrationPlanPanel` (신규): idRenames / addressConflicts / manualReview를 섹션별 표시
- "Compare to main" 토글 — git-diff plugin endpoint 결과를 breakingLevel로 요약

## 다른 개념과의 관계

- [[diff]] — DiffEntry kinds → breakingLevel 분류의 입력
- [[registry]] — 단일 버전 유지 (multi-version 폐기)
- [[lifecycle]] — entry-lifecycle-changed는 patch (의미 보존)

## 참조

- roadmap Stage 2: `../roadmap.md`
- Stage 2 plan: `../plans/v0.9.md`
- Stage 1 lifecycle: `./lifecycle.md`
