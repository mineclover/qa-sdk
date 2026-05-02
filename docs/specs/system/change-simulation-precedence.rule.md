---
def:
  id: change-simulation-precedence
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, process, convention]
  links:
    - target: definition-catalog-spec
      type: constrains
    - target: testing-patterns
      type: refines
---

# Change Simulation Precedence — 구조 변경 전 시뮬레이션 선행 규율

## 목적 ^purpose

구조적 변경 (링크 그래프 재배선, vocabulary 확장, 스키마 전환 등) 은 **코드 커밋 전 시뮬레이션** 을 선행한다. 시뮬레이션은 가설 → 실제 DB 에서 실증 → Go/No-Go 판정의 짧은 사이클로 돌며, 가설이 빗나갔을 때 코드 변경 없이 **규칙을 재설계** 할 수 있다. Phase 0 (domain-hierarchy RFC) 의 3회 반복 경험이 본 규율의 실증 근거다 — deriveDomainRoot 시뮬레이션이 Phase 0/0b/0c 3회 반복 후에야 Phase 1 코드 커밋 진입이 정당화되었다.

---

## 1. 규칙

### 1.1 시뮬레이션 필수 대상

다음 변경은 **반드시 시뮬레이션 선행**:

- 링크 그래프 파생 로직 변경 (`deriveDomainRoot`, `deriveAspectParent` 등)
- vocabulary / taxonomy 확장 (신규 aspect / scope / tier 값)
- validator 검사 규칙 추가 / 억제 수단 도입
- DB 스키마 전환 (Drizzle schema 변경, 컬럼 추가/제거)
- 좌표 키 구성 변경 (예: `tier:scope:layer:aspect` → `...:domain_root`)

### 1.2 시뮬레이션 면제 대상 (skip 허용)

- 문서 본문 편집 (frontmatter 제외)
- 단순 bugfix — 기존 정의된 로직의 오류 수정
- **< 5 문서** 의 소규모 링크 수정
- 명백한 오타 / typo / 포매팅

### 1.3 시뮬레이션 배치 및 산출물

시뮬레이션 스크립트는 **임시 위치** 에 작성:

```bash
/tmp/<change-name>-simulation.ts  # ad-hoc, 커밋하지 않음
```

시뮬레이션 후 반드시 남기는 산출물:

1. **Before/After 지표 표**
   - 변경 전 상태 (dup-coord, orphan, multi-parent 등 validator 카운트)
   - 변경 후 예상 상태
   - Delta 와 기대치와의 일치 여부
2. **Go/No-Go 판정**
   - 사전 정의된 성공 기준 충족 여부 (예: "30건 중 ≥15건 감소")
   - 판정 불명확 시 **규칙 재설계 후 재시뮬레이션** (iteration)
3. **리스크 및 가정 기록**
   - 시뮬레이션이 잡지 못하는 사각지대 명시
   - 실측과 다를 경우 rollback 경로

산출물은 아래 위치에 영속화:

```
docs/proposals/<topic>/reviews/<date>-<phase>-simulation.md
```

예시 참조:
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0-simulation.md` — 1차 시뮬레이션
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0b-q2-resim.md` — 규칙 재설계 후 2차
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0c-owner-heuristic.md` — 3차 (부모 선택 규칙)

### 1.4 시뮬레이션 iteration 허용

한 번의 시뮬레이션으로 Go 가 안 나오면 **가설을 수정한 후 재시뮬레이션**. 직전 시뮬레이션 결과를 근거로 규칙을 조정하고 다시 측정. 코드 커밋은 Go 가 나온 후에만.

### 1.5 시뮬레이션 결과와 실제 결과 비교

Phase 구현 완료 후 Phase 0 예측과 실측을 **재대조** 한다. Phase 3b 에서 dup-coord 가 28 → **36으로 증가한 사례** 는 Phase 0 시뮬레이션이 depends_on 추가의 sibling collision 효과를 미처 잡지 못한 증거. 이 갭을 리뷰 보고서에 명시하여 다음 시뮬레이션의 가정 목록에 추가.

### 1.6 시뮬레이션 스크립트 작성 원칙

- **실제 DB 사용** — `sqlite3 data/definition-service.sqlite` 또는 `MemoryDefinitionRegistry` + 실제 스펙 스캔
- **단일 파일** — 100-300 LOC, 외부 설정 없이 실행 가능
- **멱등성** — 여러 번 실행해도 같은 결과
- **Read-only 권장** — write 는 rollback 경로 확보 후에만

---

## 2. 검증

### 2.1 PR 리뷰 체크리스트

구조 변경 PR 리뷰 시 다음을 확인:

- [ ] §1.1 대상에 해당하면 시뮬레이션 산출물 경로가 PR description 에 링크되어 있는가
- [ ] Before/After 지표 표가 산출물에 포함되어 있는가
- [ ] Go 판정의 성공 기준이 명시되어 있는가 (예: "30 → ≤8")
- [ ] 리스크 및 가정 섹션이 있는가
- [ ] 시뮬레이션 iteration 이 2회 이상이면 규칙 변경 근거가 기록되어 있는가

### 2.2 사후 실측 비교

Phase 구현 완료 후 `pnpm exec qa-sdk def validate` 결과를 시뮬레이션 예측과 비교:

```bash
pnpm exec qa-sdk def validate > /tmp/after.txt
diff <(grep 'coordinate\|orphan\|multi-parent' /tmp/before.txt) \
     <(grep 'coordinate\|orphan\|multi-parent' /tmp/after.txt)
```

Delta 가 예측과 크게 다르면 추가 review 보고서 작성.

### 2.3 시뮬레이션 품질 gate

시뮬레이션이 다음 중 하나를 만족하지 못하면 재작성:

- 실제 DB 를 읽지 않고 하드코딩된 데이터로 진행 → **재작성 필수**
- Before/After 수치만 출력하고 판정 없음 → 판정 추가 필수
- 성공 기준이 사전 정의되지 않음 → 기준 명시 후 재판정

---

## 3. 예외

| 예외 | 정당화 |
|---|---|
| < 5 문서 링크 편집 | 영향 범위 극소 — validator 가 즉시 감지 가능 |
| 명백한 오타 / bugfix | 시뮬레이션보다 즉시 고치는 것이 효율 |
| 문서 본문 편집만 | 좌표/링크 변경 없으면 영향 없음 |
| Revert 커밋 | 이전 상태로 복귀 — 시뮬레이션 불필요 |

---

## 4. 이점 (관측된 증거)

### 4.1 가설 오류 조기 발견

Phase 0 시뮬레이션이 **definition-catalog-spec 이 90건 흡수** 한다는 primary-parent 알고리즘의 오흡수 문제를 코드 커밋 전 발견. Phase 0b 에서 규칙을 수정해 재시뮬레이션. 코드 작성 후 발견했다면 3-5일 낭비 예상.

### 4.2 Rollback 경로 사전 확인

Phase 2 시뮬레이션이 validator 변경의 fail-open 경로를 사전 검증. 배포 후 파생 실패 시 빈 Map 으로 fallback 하여 기존 키로 계속 동작 — catalog 가동 중단 없음.

### 4.3 범위 재조정 근거 확보

Phase 3b 실측에서 dup-coord 가 28 → 36 증가한 것이 **Phase 5 재설계** (36 그룹 A/B/C/D 분류) 의 근거가 됨. Phase 0 시뮬레이션이 이 증가를 예측하지 못한 갭을 review 보고서로 남겨 다음 시뮬레이션의 가정 목록 개선.

---

## 5. 근거

- [`skills/semantic-change/SKILL.md`](../../../skills/semantic-change/SKILL.md) §"Step 2 — 시뮬레이션" — 본 규칙을 체크리스트로 소비하는 playbook
- [layer-separation.rule.md](./layer-separation.rule.md) — 시뮬 후 실측과의 계층별 검증 접점 (L2 validator + L3 workflow smoke)
- [domain-hierarchy/reviews/2026-04-20-phase0-simulation.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase0-simulation.md) — 1차 시뮬레이션 (Go/No-Go 판정의 원형)
- [domain-hierarchy/reviews/2026-04-20-phase0b-q2-resim.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase0b-q2-resim.md) — 2차 (규칙 재설계 후)
- [domain-hierarchy/reviews/2026-04-20-phase0c-owner-heuristic.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase0c-owner-heuristic.md) — 3차
- [domain-hierarchy 01-migration §Phase 0 — 투자 판단](../../proposals/domain-hierarchy/01-migration.md) — 시뮬레이션 선행 원칙의 원형 서술
- [domain-hierarchy/reviews/2026-04-20-phase5-redesign.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md) — 실측과 예측 갭이 범위 재설계로 이어진 증거
- [aspect-evolution-index.md](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 서사
- CLAUDE.md §"제안 단계 동안 규칙에 묶이지 않고 자유롭게 탐색할 surface" — proposals 디렉토리 격리 원칙의 연장선
