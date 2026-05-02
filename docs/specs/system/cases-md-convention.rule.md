---
def:
  id: cases-md-convention
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
    - target: work-lifecycle-cases
      type: refines
---

# `.cases.md` Convention — 소비자 기대 시나리오 문서 표준

## 목적 ^purpose

`.cases.md` 확장자 문서는 시스템이 의존 대상에 대해 **기대하는 시나리오** 를 선언하는 consumer-driven contract 문서다. 본 규칙은 cases.md 의 frontmatter 구조, 시나리오 블록 형식, 배치 원칙을 고정하여 (a) `def validate` 가 일관되게 감지하도록 하고 (b) consumer 기대가 provider `.test.md` 와 명확히 구분되도록 한다.

Phase 5.5 (domain-hierarchy RFC) 에서 도입되어, 링크 그래프가 표현하지 못하는 "A→B 의존의 **의미론**" 을 담는 1급 문서 유형으로 승격되었다.

---

## 1. 규칙

### 1.1 파일 배치 및 네이밍

```
<doc-id>.cases.md   ← <doc-id>.spec.md 와 동일 디렉토리 co-location
```

- `.cases.md` 는 대응되는 `.spec.md` 또는 시스템 문서와 **같은 디렉토리** 에 위치
- 파일명은 kebab-case 로 대응 spec 과 동일한 stem 을 사용 (예: `decode-service-system.spec.md` ↔ `decode-service-system.cases.md`)
- 1 스펙당 `.cases.md` 는 **최대 1개** — 시나리오가 너무 많으면 의미론적 partition 으로 분할하거나 `.test.md` 로 이동

### 1.2 필수 Frontmatter

```yaml
---
def:
  id: <doc-id>-cases              # spec id + "-cases" 접미사 권장
  type: spec
  tier: component                 # 수동 참조 대상
  scope: flow                     # cases = 시나리오 흐름
  aspect: user_scenario           # consumer 기대 = 사용자 관점
  depth: validation               # 검증 레벨
  lifecycle: approved             # (또는 draft — 초기 작성 시)
  layer: operation                # (또는 해당 spec 의 layer 승계)
  tags: [scenario, ...]           # scenario 태그 필수
  links:
    - target: <parent-spec-id>
      type: refines                # 또는 depends_on
    - target: <provider-system-id>
      type: depends_on             # 기대를 선언하는 대상 공급자
---
```

필수 필드:

- `tier: component` — cases 는 자체 정체성을 갖는 subsystem 이 아니라 spec 의 validation facet
- `scope: flow` — 시나리오 흐름
- `aspect: user_scenario` — consumer-driven 기대 (provider 소유 `.test.md` 와 구분)
- `depth: validation` — 검증 목적
- `links.refines` — 상위 spec 으로 refines 링크 (validation 관계)
- `links.depends_on` — 기대를 선언하는 **공급자** 시스템

### 1.3 시나리오 블록 포맷 (4 필수 요소)

각 시나리오 섹션은 아래 4개 볼드 레이블을 **모두** 포함한다.

```markdown
## 시나리오 N: <제목> ^overview

**전제**: <provider 가 선언해야 하는 초기 상태 / 구성 / 계약>

**동작**: <consumer 가 시도하는 호출 / 상호작용>

**기대**:
- <항목 1 — 관측 가능한 결과>
- <항목 2>
- <항목 3>

**실패 시 수정 대상**: <기대가 깨졌을 때 provider 스펙의 어느 섹션을 고쳐야 하는가>
```

4 요소의 역할:

- **전제** — provider 의 설계 계약 (SLA, 타임아웃, 에러 계층 등)
- **동작** — consumer 의 관찰 가능한 호출
- **기대** — 관측 가능한 검증 기준 (bullet list)
- **실패 시 수정 대상** — **핵심 quality gate**. 이 기대가 깨지면 어느 문서/섹션/코드를 고쳐야 하는지 명시. 비어있으면 시나리오는 "API doc 복붙" 으로 전락

### 1.4 Provider vs Consumer 소유

| 파일 | 소유자 | 역할 |
|---|---|---|
| `<provider>.test.md` | 공급 시스템 | "나는 이 시나리오를 보장한다" (self-verification) |
| `<consumer>.cases.md` | 소비 시스템 | "나는 공급자에게 이걸 기대한다" (consumer-driven) |

- provider 가 보장하는 계약은 `.test.md` 에 두어 provider 의 spec 이식 시 동반 이동 가능하게 한다
- consumer 의 기대는 `.cases.md` 에 두어 consumer 가 공급자 변경 시 검증 가이드로 사용한다
- `.cases.md` 에 provider 내부 구현 세부를 담지 않는다 (blackbox 시나리오만)

### 1.5 Orphan 허용

`.cases.md` 는 validator `orphan` 체크에서 **자동 면제** 된다 (`validate.ts` line 301). 소비자 기대 문서는 외부 incoming link 가 없어도 독립적으로 유효하다.

---

## 2. 검증

### 2.1 Frontmatter 검증

```bash
pnpm exec qa-sdk def validate
# cases.md 의 scope/aspect/depth/tier 필수 조합 자동 검사
```

### 2.2 Quality gate — "실패 시 수정 대상" 필수

```bash
# 모든 .cases.md 에 "실패 시 수정 대상" 섹션이 있는지 확인
# (리뷰 체크리스트 — pre-commit hook 후보)
for f in $(find docs/specs -name "*.cases.md"); do
  grep -q "실패 시 수정 대상" "$f" || echo "MISSING: $f"
done
```

결과가 비어있어야 통과. 누락 파일은 quality gate 가 약한 시나리오이므로 보완 대상.

### 2.3 Provider 마커 검증 (후속 확장 후보)

`.cases.md` 의 `depends_on` 대상이 실재 system 인지 `def validate` 의 `broken-link` 체크가 자동 수행.

### 2.4 Manual review checklist

신규 `.cases.md` PR 리뷰 시:

- [ ] frontmatter 에 `scope: flow`, `aspect: user_scenario`, `depth: validation` 명시
- [ ] `links.refines` 로 상위 spec, `links.depends_on` 으로 provider 시스템 각 1개 이상
- [ ] 시나리오 최소 1개 + 각 시나리오가 **전제/동작/기대/실패 시 수정 대상** 4 필수 요소 포함
- [ ] "실패 시 수정 대상" 에 구체적인 파일/섹션 지정 (추상적 문장 금지)
- [ ] provider 내부 구현 세부가 아닌 관측 가능한 계약만 기술

---

## 3. 예외

| 예외 | 정당화 |
|---|---|
| `scope: flow` 가 아닌 다른 scope | 시스템이 flow 외 본연 scope 에서 기대 선언하는 경우는 없음. 예외 없음 |
| `.cases.md` 에 provider 내부 구현 참조 | provider 가 변경 시 함께 깨지므로 금지. blackbox 시나리오만 |
| "실패 시 수정 대상" 누락 | 예외 없음 — quality gate 핵심. 누락 시 추상 문서 전락 |
| provider 소유 시나리오가 `.cases.md` 에 있음 | `.test.md` 로 이동. consumer 기대와 provider 보장을 섞지 않음 |

---

## 4. 근거

- [domain-hierarchy 00-design §2.5 기대 시나리오 문서 정책](../../proposals/domain-hierarchy/00-design.md)
- [domain-hierarchy 01-migration §Phase 5.5 — 기대 시나리오 커버리지](../../proposals/domain-hierarchy/01-migration.md)
- [work-lifecycle.cases.md](./work-lifecycle.cases.md) — 4 요소 포맷의 기준 예시
- [decode-service-system.cases.md](../decode-service/decode-service-system.cases.md) — provider blackbox 시나리오 예시
- `packages/definition-catalog/src/validate.ts` line 298-302 — `.cases.md` orphan 면제 구현
- [aspect-evolution-index.md](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 서사
