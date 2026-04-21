---
def:
  id: domain-hierarchy-selector-fixes
  type: knowledge
  knowledge_kind: proposal
  lifecycle: accepted
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-selector-review
      type: refines
status: accepted
date: 2026-04-21
part_of: domain-hierarchy
role: fix-report
---

# Selector Fixes — Gap 1 & Gap 3 해소 (2026-04-21)

## 목적 ^purpose

`2026-04-21-selector-review.md` 에서 식별된 **Gap 1** (topdown 빈 결과) 과 **Gap 3** (rule 문서 발견성 부재) 를 CLI + 데이터 모델 + 문서 3곳에서 단일 세션으로 해소했다. 본 문서는 변경 내용 + 실측 결과 + 잔여 이슈를 기록한다.

---

## §1 Gap 1 — `def topdown`/`def children` 멤버 탐색

### 1.1 문제

Phase 3b Option B 이후 `system-root` / `gate-system` / `apm-system` 등 도메인 루트는 `contains` 순방향 선언을 제거하고 자식이 부모를 `depends_on` 역방향으로 선언한다. 그러나 `cmdTopdown`/`cmdChildren` 은 여전히 `source.getChildren()` (contains 순방향) 만 따랐으므로 멤버가 0건으로 표시되었다.

### 1.2 변경

`packages/cli/src/commands/def.ts` 에 `collectDomainMembers(source, parentId)` 헬퍼를 신설. contains 순방향 + `depends_on` / `refines` 역방향의 **union** 을 반환한다.

```ts
// 변경 전 (topdown)
const children = await source.getChildren(groupId);    // contains 순방향만

// 변경 후
async function collectDomainMembers(source, parentId): Promise<DefDoc[]> {
  const seen = new Set<string>();
  const members: DefDoc[] = [];

  // 1. contains 순방향 (레거시 system-infra 등)
  for (const child of await source.getChildren(parentId)) appendDoc(child);

  // 2. depends_on / refines 역방향 (Phase 3b Option B)
  const incoming = await source.getIncomingLinks(parentId);
  for (const link of incoming) {
    if (link.type !== "depends_on" && link.type !== "refines") continue;
    appendDoc(await source.get(link.source));
  }

  return members.toSorted((a, b) =>
    (a.scope ?? "").localeCompare(b.scope ?? "") || a.docId.localeCompare(b.docId));
}
```

### 1.3 실측

```bash
$ qa-sdk def topdown gate-system
# Gate 시스템
주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
concerns: security

## [feature] GateEngine 그룹 ...
## [flow] Consistency 서비스 ...
## [flow] Gate Consistency — 소비자 기대 시나리오 ...
## [flow] Gate Engine Group — 소비자 기대 시나리오 ...
## [flow] Gate Event Bus — 소비자 기대 시나리오 ...
## [interface] EventBus 이벤트 전파 계약 ...
## [interface] Query 시스템 ...
```

7 members (gate-engine-group, gate-consistency, gate-consistency-cases, gate-engine-group-cases, gate-event-bus-cases, gate-event-bus, query-system).

```bash
$ qa-sdk def topdown apm-system | grep '^##' | wc -l
6
```

```bash
$ qa-sdk def children gate-system
[local] gate-system → 7 children
  gate-engine-group   feature/func_def  approved  (depends_on←)
  gate-consistency    flow/gate_flow    approved  (depends_on←)
  ...
```

각 멤버마다 via 라벨 (`contains` vs `depends_on←`) 을 표시하여 두 경로를 구분할 수 있다.

### 1.4 영향

- `def-topdown` SKILL.md 예시가 실제 데이터와 일치하게 됨.
- `def guide` 의 "영역 구조" 블록은 `getChildren("system-root")` 에 의존 — 신형 레이아웃 하에서는 여전히 비어있으므로, 후속 작업으로 `collectDomainMembers` 를 `cmdGuide` 에도 전파해야 한다 (deferred).

---

## §2 Gap 3 — Rule 발견성

### 2.1 문제

`.rule.md` 확장자를 가진 규약 문서 19건 (`docs/specs/system/` 8건 + 도메인별 11건) 은 `doc_type` 이 `spec` 으로 통일되어 있어 CLI 필터로 구분 불가. 또한 `docs/specs/system/` 디렉토리에는 인덱스가 없어 신규 contributor 가 발견 불가능.

### 2.2 변경

#### 2.2.1 `DefListFilter.ext` 필드 추가

`packages/definition-catalog/src/data-source.ts`:

```ts
export interface DefListFilter {
  // ...
  /** 소스 파일 확장자 필터 — `.rule.md`, `.cases.md`, `.test.md` 등 */
  ext?: string;
}
```

#### 2.2.2 구현

- `packages/definition-data-source/src/local-data-source.ts` — `source_path LIKE '%.{ext}.md'` WHERE 절 추가.
- `packages/definition-data-source/src/scan-data-source.ts` — in-memory `applyFilters` 에 ext 매칭 추가.
- `packages/cli/src/data-sources/local-data-source.ts` — 레거시 copy 도 동일 처리 (일관성).

#### 2.2.3 CLI `--type` 매핑

`packages/cli/src/commands/def.ts` `cmdList`:

```ts
const EXT_TYPE_FLAGS = new Set(["rule", "cases", "test", "todo", "plan", "memo"]);
const typeFlag = flags["type"];
const extFromType = typeFlag && EXT_TYPE_FLAGS.has(typeFlag) ? typeFlag : undefined;
const ext = flags["ext"] ?? extFromType;
```

- `--type=rule` → 파일 확장자 필터 (source_path).
- `--type=spec|knowledge|design` → 기존 `doc_type` 컬럼 필터 (back-compat).
- `--ext=rule` → 동일 효과의 명시적 플래그.

#### 2.2.4 시스템 규칙 인덱스

`docs/specs/system/README.md` 신설. `tier: layout`, `knowledge_kind: convention` 로 8 rule 파일을 테이블로 묶고 `aspect-evolution-index` 와 상호 refs 링크. `aspect-evolution-index` 에도 역방향 refs 추가하여 validator orphan 경고 제거.

### 2.3 실측

```bash
$ qa-sdk def list --type=rule --limit=100
[local] 1-19 / 19건
  analysis-convergence-rule             feature/func_def          approved [observability]
  aspect-naming-convention              constraint/tech_constraint approved [structural,taxonomy,convention]
  authorization-management-usage-rule   constraint/tech_constraint approved [security,observability]
  bdd-contract-cli-rule                 constraint/tech_constraint approved [testing,contract]
  cases-md-convention                   constraint/tech_constraint approved [structural,testing,convention]
  catalog-purity-bridge                 constraint/tech_constraint approved [structural,architecture,convention]
  change-simulation-precedence          constraint/tech_constraint approved [structural,process,convention]
  definition-cross-loop-bridge-rule     flow/process_flow         approved [cross-scope,runtime,decision,observability]
  doc-metadata-field-ownership          interface/api_contract    draft    [contract,structural]
  docs-control-plane-rule               constraint/tech_constraint approved [structural,contract,testing]
  facet-test-isolation-rule             feature/func_def          approved [structural,testing]
  gate-state-model-rule                 state/domain_state        approved [security]
  link-type-usage                       constraint/tech_constraint approved [structural,convention,link-graph]
  meta-semantic-ir-rule                 ...
  operational-ontology-pack-interface-rule ...
  service-event-adoption-rule           ...
  test-md-convention                    constraint/tech_constraint approved [structural,testing,convention]
  validator-suppression-tags            constraint/tech_constraint approved [structural,convention,validator]

$ qa-sdk def list --ext=cases --limit=100 | head -3
[local] 1-50 / 130건   # *.cases.md 도 동일 필터로 접근
```

---

## §3 Validation 지표

| 항목 | before | after |
|---|---:|---:|
| `def validate` errors | 0 | **0** |
| `def validate` warnings | 2 | **1** (bdd-contract-cli-rule orphan — 기존 이슈, 본 스코프 외) |
| `def topdown gate-system` members | 0 | **7** |
| `def topdown apm-system` members | 0 | **6** |
| `def list --type=rule` | n/a | **19건** |
| `def children gate-system` | 0 | **7** |
| cli test suite | 494 passed | 494 passed |

---

## §4 파일 변경 요약

| 파일 | 성격 | LOC 변동 |
|---|---|---:|
| `packages/cli/src/commands/def.ts` | topdown union + --type=rule 매핑 | +~60 / -~18 |
| `packages/definition-catalog/src/data-source.ts` | `DefListFilter.ext` 필드 | +5 |
| `packages/definition-data-source/src/local-data-source.ts` | SQL where 절 | +5 |
| `packages/definition-data-source/src/scan-data-source.ts` | in-memory 필터 | +4 |
| `packages/cli/src/data-sources/local-data-source.ts` | 레거시 copy | +4 |
| `docs/specs/system/README.md` | 신규 index | +65 (신규) |
| `docs/proposals/aspect-evolution-index.md` | refs 링크 추가 | +2 |
| `skills/def-topdown/SKILL.md` | union 의미론 + rule filter 섹션 반영 | +~40 / -~20 |

---

## §5 잔여 / Deferred

- **Gap 4/6/9** — `registry-system` boundary split, orphan 패키지 4개, `def guide` 영역 구조. 본 세션 스코프 외.
- **서버 모드 대응** — `ServerDataSource.list()` 는 `filter.ext` 를 URLSearchParams 로 전달만 하고, 서버 측 `/docs` 라우트에서 아직 `ext` 쿼리를 해석하지 않는다. 로컬 모드 (기본) 에서는 정상 동작하며 서버 모드는 subsequent PR 에서 처리.
- **Gap 5c (`def list --help`)** — 본 세션은 `DEF_HELP_SECTIONS` 에 `[--type=rule|cases|test|...] [--ext=rule]` 표기 추가로 부분 해소. 서브명령 help 자가 문서화는 별도 작업.

---

## §6 Commit Log (예상)

1. `feat(def): topdown reverse depends_on walk — restore Option B navigation`
2. `feat(def): list --type=rule filter for rule.md discoverability`
3. `docs(specs): system rules layout + rule index`
4. `docs(skill): def-topdown update — reverse walk + rule filter`
5. `docs(proposals): selector gap fixes report — topdown + rule discoverability`

---

## §7 참조

- [2026-04-21-selector-review](./2026-04-21-selector-review.md) — gap 원본 보고서
- [docs/specs/system/README.md](../../../specs/system/README.md) — 신규 rule 인덱스
- [skills/def-topdown/SKILL.md](../../../../skills/def-topdown/SKILL.md) — 업데이트된 skill
- [aspect-evolution-index](../../aspect-evolution-index.md) — 3-RFC 허브
