---
def:
  id: test-md-convention
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, testing, convention]
  links:
    - target: doc-type-convention
      type: refines
    - target: validator-suppression-tags
      type: refines
---

# `.test.md` Convention — 공급자 보장 시나리오 문서 표준

## 목적 ^purpose

`.test.md` 확장자 문서는 공급 시스템이 **자신이 보장하는 시나리오** 를 선언하는 provider-side contract 문서다. 본 규칙은 test.md 의 frontmatter 구조, 시나리오 블록 형식, 배치 원칙, 소비자 `.cases.md` 와의 역할 구분을 고정하여 (a) `def validate` 가 일관되게 감지하도록 하고 (b) provider 자체 보장과 consumer 기대가 섞이지 않도록 한다.

domain-hierarchy RFC §2.5 "기대 시나리오 문서 정책" 에서 consumer `.cases.md` 와 쌍을 이루는 1급 문서 유형으로 규정되었고, Phase 5.5 이후 실제 27개 문서가 축적되면서 본 규칙으로 성문화된다.

---

## 1. 규칙

### 1.1 파일 배치 및 네이밍

```
<doc-id>.test.md   ← <doc-id>.spec.md 와 동일 디렉토리 co-location
```

- `.test.md` 는 대응되는 `.spec.md` 와 **같은 디렉토리** 에 위치
- 파일명은 kebab-case 로 대응 spec 과 동일한 stem 을 사용 (예: `doc-envelope.spec.md` ↔ `doc-envelope.test.md`)
- 1 스펙당 `.test.md` 는 **최대 1개** — 시나리오가 너무 많으면 의미론적 partition 으로 별도 `.test.md` 를 만들 수 있으나 각 파일은 고유 `doc-id` 접미사로 구분

### 1.2 필수 Frontmatter

```yaml
---
def:
  id: <doc-id>-test               # spec id + "-test" 접미사 필수
  type: spec
  tier: component                 # 검증 asset 은 system 이어도 component
  scope: feature                  # provider 가 공급하는 feature 단위
  aspect: scenario                # provider 관점 시나리오
  depth: validation               # 검증 레벨
  lifecycle: approved             # (또는 draft — 초기 작성 시)
  layer: <parent-spec.layer>      # 대상 spec 의 layer 승계
  svc: <service-id>               # (선택) 대상이 서비스 컴포넌트일 때
  tags: [testing, ...]            # testing 태그 권장
  links:
    - target: <tested-doc-id>
      type: verifies              # 핵심 링크 — test 가 대상 spec 을 검증
    - target: <context-doc-id>    # (선택) 이 test 가 놓인 맥락
      type: traces_to
  source: packages/.../foo.test.ts  # (권장) 실제 테스트 코드 파일
---
```

필수 필드:

- `id: <stem>-test` — 대응 spec id 뒤에 `-test` 접미사. 충돌 회피와 역추적 용이
- `tier: component` — test spec 은 검증 asset 이지 자체 정체성이 아님. 실제 대상이 `system` 이어도 `component`
- `scope: feature` + `aspect: scenario` — provider 는 "feature 단위 시나리오" 로 선언. consumer `.cases.md` 의 `flow / user_scenario` 와 의도적으로 다름
- `depth: validation` — 검증 목적
- `links` 에 `verifies` 타입으로 대상 spec 1개 이상
- `source` 는 선택이지만 실제 `*.test.ts` 코드와 1:1 대응이 있다면 명시 권장 (bottom-up 추적 자산)

### 1.3 시나리오 블록 포맷

`.test.md` 는 표준 시나리오 구조를 가진다. 소비자 `.cases.md` 와 3개 핵심 레이블을 공유하되, quality gate 요구사항이 다르다.

**최소 구조 (필수 3 요소)**

```markdown
## 목적 ^purpose

<이 test 가 검증하는 공급자 동작의 한 줄 요약>

## 전제 ^preconditions

- <fixture / 인메모리 store / mock 객체 등 초기 조건>

## 스텝 ^steps

1. <공급자 호출 또는 구성 단계>
2. ...

## 검증 ^assertions

- <관측 가능한 검증 기준>
```

**대체 구조 (허용)**

시나리오가 많거나 테이블로 더 명료한 경우 S-### 블록 또는 표 형식을 사용할 수 있다:

```markdown
### S-001: <시나리오 제목>

- **describe**: `<test 파일의 describe 블록>`
- **it**: `<it 블록>`
- **전제**: <초기 조건>
- **기대**: <관측 가능한 결과>
```

또는

```markdown
## <기능명>

| 시나리오 | 기대 결과 |
|----------|----------|
| <상태 A> | <결과 A> |
```

어떤 구조를 쓰더라도 `^purpose` 앵커는 필수.

### 1.4 Provider vs Consumer — 소유 경계

| 파일 | 소유자 | 관점 | 기술 대상 |
|---|---|---|---|
| `<provider>.test.md` | 공급 시스템 | "**나는 이렇게 동작한다**" | provider 자체 보장, self-verification |
| `<consumer>.cases.md` | 소비 시스템 | "**나는 공급자에게 이걸 기대한다**" | 소비 맥락의 계약 기대 |

같은 시나리오도 관점이 다르다:

- consumer `.cases.md` — "provider 가 이렇게 동작해야 내가 쓸 수 있다" → **실패 시 수정 대상 필수**. 기대가 깨지면 어느 provider 섹션을 고치는지 명시해야 함
- provider `.test.md` — "provider 는 이렇게 동작한다" → **실패 시 수정 대상 선택**. 실패는 provider 자신의 구현/스펙 문제이므로 fix-target 이 암묵적. 대신 `assertions` 가 구체적이어야 함

한 대상 spec 에 `.test.md` (provider 자체 보장) + `.cases.md` (소비자 기대) 가 **공존 가능**. 같은 시나리오라도 관점이 다르면 양쪽에 기술될 수 있다.

### 1.5 Link 타입 — `verifies` 권장

provider 가 대상을 검증한다는 의미는 `verifies` 링크 타입으로 표현한다 (domain-hierarchy §1.4 "링크 타입은 기대의 형태를 구분한다").

```yaml
links:
  - target: <tested-spec>
    type: verifies            # 권장 — "이 test 가 대상 spec 을 검증한다"
```

**마이그레이션 허용**: 기존 27개 문서 중 `refines` (18), `depends_on` (6), `traces_to` (1) 를 사용하는 파일이 혼재한다. 신규 `.test.md` 는 `verifies` 를 우선 사용하되, 기존 파일의 대량 마이그레이션은 별도 작업으로 분리 (본 규칙은 문서 자체가 성문화 단계이므로 혼용 유예).

**연관 맥락 링크**: 이 test 가 검증하는 맥락을 `traces_to` 로 추가 표기 가능:

```yaml
links:
  - target: <tested-spec>
    type: verifies
  - target: <architecture-or-feature-spec>
    type: traces_to           # "이 test 는 이 아키텍처 맥락에서 의미를 가짐"
```

`contains` 를 사용하지 않는다 — test 는 대상을 포함하지 않으며 검증할 뿐이다.

### 1.6 Orphan 허용

`.test.md` 는 validator `orphan` 체크에서 **자동 면제** 된다 (`validate.ts` line 302). provider 자체 검증 문서는 외부 incoming link 가 없어도 독립적으로 유효하다.

면제 이유: `.test.md` 는 대상 spec 에서 outgoing `verifies` 를 받기보다 자신이 대상 spec 을 가리킨다. incoming link 가 없는 것이 정상이다.

### 1.7 Duplicate-coordinate 허용

`tier: component` 이므로 `duplicate-coordinate` 자동 면제 (validate.ts line 361). 같은 좌표를 공유하는 `.test.md` 가 여러 개 있어도 정상이다.

---

## 2. 검증

### 2.1 Frontmatter 검증

```bash
pnpm exec qa-sdk def validate
# test.md 의 tier/scope/aspect/depth/links 자동 검사
```

### 2.2 `verifies` 링크 감사 (신규 파일용)

신규 `.test.md` 에 `verifies` 타입 링크가 있는지 확인:

```bash
for f in $(find docs/specs -name "*.test.md"); do
  grep -q "type: verifies" "$f" || echo "LEGACY-LINK-TYPE: $f"
done
```

기존 파일은 보고만 하고 자동 실패시키지 않는다 — 마이그레이션은 별도 작업.

### 2.3 대응 spec 존재 확인

`.test.md` 의 `verifies` (또는 `refines`/`depends_on`) 대상이 실재 spec 인지 `def validate` 의 `broken-link` 체크가 자동 수행.

### 2.4 Manual review checklist

신규 `.test.md` PR 리뷰 시:

- [ ] frontmatter 에 `tier: component`, `scope: feature`, `aspect: scenario`, `depth: validation` 명시
- [ ] `id` 가 `<spec-id>-test` 패턴
- [ ] `links` 에 `verifies` 타입 링크 (대상 spec 1개 이상)
- [ ] 최소 `^purpose` + `^preconditions` + `^steps` + `^assertions` 구조 (또는 S-### / 표 대안)
- [ ] `assertions` 는 관측 가능한 검증 기준 (모호한 "정상 동작" 금지)
- [ ] `source` 로 대응 `*.test.ts` 파일 명시 (가능한 경우)
- [ ] provider 내부 구현 디테일이 아닌 **계약 수준** 시나리오

---

## 3. 현황 분석 (2026-04-20 기준)

### 3.1 파일 분포

`docs/specs/**/*.test.md` 총 **27 파일**. 주요 분포:

| 항목 | 값 분포 |
|---|---|
| `tier` | component × 27 (100%) |
| `depth` | validation × 26, specification × 1 |
| `scope` | flow × 23, feature × 4 |
| `aspect` | user_scenario × 23, scenario × 4 |
| 대상 링크 타입 | refines × 18, depends_on × 6, verifies × 2, traces_to × 1 |
| `source` 필드 | 있음 × 24, 없음 × 3 |

### 3.2 정렬 해석

- **tier** 는 완전 일치 — `component` 가 규칙으로 자리잡혔다
- **depth** 는 사실상 일치 — 1건(`axis-projection-test`)은 `specification` 인데 오기 가능성
- **scope/aspect** 는 2분법 —
  - `flow / user_scenario` 다수 (`.cases.md` 컨벤션을 복사한 초기 패턴)
  - `feature / scenario` 소수 (RFC-정렬된 최신 패턴; `doc-envelope.test.md`, `ralph-tui-integration.test.md`, `pipe-static-lineage.test.md`, `axis-projection.test.md`)
- **링크 타입** 은 미정렬 —
  - `refines` (18) 는 "test refines spec" 라는 해석. 의미론적으로는 부정확 (test 는 spec 을 refining 하지 않고 verifying)
  - `verifies` (2) 는 RFC §1.4 에 일치
  - `depends_on` (6) 은 "test 가 대상에 의존한다" 는 기술적 의존을 표시하지만 의미가 약함

### 3.3 마이그레이션 플랜 (별도 작업)

본 규칙 승격 후 후속 PR에서:

1. `scope/aspect` 를 `feature/scenario` 로 통일 (23 파일)
2. 대상 링크 타입을 `verifies` 로 통일 (25 파일)
3. `axis-projection-test` 의 `depth: specification → validation` 교정 (1 파일)

마이그레이션은 **대량 일괄 수정** 이 아니라 관련 작업이 해당 영역을 건드릴 때 기회주의적으로 처리한다.

---

## 4. 예외

| 예외 | 정당화 |
|---|---|
| `tier: component` 가 아닌 다른 tier | 예외 없음 — test 는 항상 검증 asset |
| `.test.md` 에 provider 내부 구현 참조 | provider 변경 시 함께 깨지는 스크립트가 되므로 지양. 단 `source: <path>` 필드는 코드 추적 용도로 허용 |
| "실패 시 수정 대상" 누락 | **허용** — provider 는 자체 책임. 단 `assertions` 가 구체적이어야 함 |
| consumer 기대를 `.test.md` 에 기술 | `.cases.md` 로 분리. 공급-소비 경계를 섞지 않음 |
| `verifies` 외 다른 링크 타입 | 기존 파일은 유예. 신규는 `verifies` 권장 |

---

## 5. 근거

- [domain-hierarchy 00-design §2.5 기대 시나리오 문서 정책](../../proposals/domain-hierarchy/00-design.md)
- [domain-hierarchy 00-design §1.4 링크 타입은 기대의 형태를 구분한다](../../proposals/domain-hierarchy/00-design.md)
- [cases-md-convention.rule.md](./cases-md-convention.rule.md) — 소비자 측 동반 규칙
- [validator-suppression-tags.rule.md §1.7](./validator-suppression-tags.rule.md) — `.test.md` orphan 자동 면제 명세
- `packages/definition-catalog/src/validate.ts` line 294, 302 — `.test.md` orphan 면제 구현
- [doc-envelope.test.md](../definition-catalog/doc-envelope.test.md) — RFC-정렬 표준 예시 (`verifies` + `feature/scenario`)
- [pipe-static-lineage.test.md](../meta-semantic/pipe-impl/pipe-static-lineage.test.md) — S-### 블록 시나리오 포맷 예시
- [gate-consistency.test.md](../gate/gate-consistency.test.md) — 표 형식 시나리오 포맷 예시
