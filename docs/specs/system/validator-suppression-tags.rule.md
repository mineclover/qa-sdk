---
def:
  id: validator-suppression-tags
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, validation, convention]
  links:
    - target: definition-catalog-spec
      type: constrains
    - target: doc-metadata-field-ownership
      type: refines
---

# Validator Suppression Tags — 경고 억제 메커니즘 성문화

## 목적 ^purpose

`packages/definition-catalog/src/validate.ts` 가 제공하는 경고 억제 메커니즘 (태그, frontmatter 필드, 파일 확장자) 을 전수 목록화한다. 각 억제 수단의 (a) 발동 조건, (b) 의미론, (c) 사용 가이드, (d) 오용 금지선을 고정하여, 새 억제 수단이 추가될 때 **먼저 본 규칙 문서를 갱신** 하도록 강제한다. 억제는 "문제를 숨기는 것" 이 아니라 "**구조적 의도를 선언** 하는 것" 이라는 관점을 유지한다.

---

## 1. 억제 수단 카탈로그 (2026-04-21 기준)

### 1.1 `lifecycle: deprecated`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 81, 118, 188, 205, 296, 318, 360, 394, 411, 431, 450 (대부분 검사 블록 전수) |
| 억제 대상 | **거의 모든 검사** (broken-link, circular-ref, orphan, dup-coord, level-violation, multi-parent, contains-depth, system-contains-system, owner-root-mismatch, missing-owner-system 등) |
| 의미 | 해당 문서가 정책상 폐기 예정이므로 정합성 대상에서 제외 |
| 권장 사용 | 문서가 SSoT 지위를 잃었을 때 — 실질적 삭제 전 유예 기간 |
| 오용 금지 | 단순 경고 회피 목적으로 사용 금지. draft/review/archived 중 하나가 더 적합할 수 있음 |

### 1.2 `tier: component`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 361 |
| 억제 대상 | `duplicate-coordinate` |
| 의미 | Component 는 수동 참조 대상 — 독립 정체성이 아니라 다른 시스템이 공유하는 shape/data. 좌표 유일성 요구 없음 |
| 권장 사용 | data-shape, link-target, cases/test 문서 |
| 오용 금지 | 실질적 system 을 component 로 분류하여 dup-coord 회피 금지 — tier 승격 또는 aspect 세분화가 정답 |

### 1.3 `knowledgeKind in {proposal, adr, convention}`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 357 (`DUP_COORD_EXEMPT_KNOWLEDGE_KINDS`), 362 |
| 억제 대상 | `duplicate-coordinate` |
| 의미 | proposal/ADR/convention 문서는 설계상 같은 좌표에 cluster 를 이룸 (RFC 관련 문서 묶음, 결정 레코드 묶음, 컨벤션 묶음) |
| 권장 사용 | `docs/proposals/**` 의 모든 문서, `docs/specs/**/*.adr.md`, convention 문서 |
| 오용 금지 | 정규 spec 을 knowledge 로 표기하여 dup-coord 회피 금지 — type 은 문서 역할의 1급 선언 |

### 1.4 `tags: [cross-scope]`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 163 (multi-parent), line 372 (dup-coord, 그룹 전원 요구) / `semantic-lint.ts` `allowsSemanticMultiParent` |
| 억제 대상 | `multi-parent`, `duplicate-coordinate` |
| 의미 | "다중 scope 에 의도적으로 걸친다" 는 **명시적 opt-out 선언**. 그룹 내 peer 가 독립 facet 으로 공존함을 선언 |
| 권장 사용 | peer service 묶음 (content/payment/shopping-backend), sibling subsystem (dkg-skill-catalog vs dkg-state-store), cross-domain tool (spec-analyzer vs spec-tracker) |
| 오용 금지 | dup-coord 에서는 **그룹 전원** 에 태그가 있어야 함 — 일부만 태그 시 의도성이 불명확하므로 validator 는 여전히 경고. 일부만 태그 부여로 회피 시도 금지 |

### 1.5 `tags: [orphan-expected]`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 300 |
| 억제 대상 | `orphan` |
| 의미 | 문서가 외부 incoming link 없이 독립적으로 유효함을 명시 |
| 권장 사용 | standalone guide, 외부 참조 전용 reference, system-root 외 루트 문서 |
| 오용 금지 | 고아 의심 문서에 무조건 부여 금지 — 진짜 미연결이면 `depends_on` / `refines` / `refs` 로 편입 검토 |

### 1.6 `.cases.md` 확장자 (자동 orphan 면제)

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 301 (`entry.ref?.endsWith(".cases.md")`) |
| 억제 대상 | `orphan` |
| 의미 | consumer 기대 시나리오는 외부 incoming link 없이 독립 유효 |
| 권장 사용 | 모든 `.cases.md` — 수동 `orphan-expected` 태그 불필요 |
| 오용 금지 | 확장자 자동 판정이므로 남용 여지 없음. cases 내용이 provider 계약이라면 `.test.md` 로 이동 |

### 1.7 `.test.md` 확장자 (자동 orphan 면제)

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 302 (`entry.ref?.endsWith(".test.md")`) |
| 억제 대상 | `orphan` |
| 의미 | provider 자체 검증 문서는 외부 incoming link 없이 독립 유효 |
| 권장 사용 | 모든 `.test.md` |
| 오용 금지 | provider 내부 구현 테스트는 실제 test 코드 (`*.test.ts`) 의 영역. `.test.md` 는 계약 시나리오만 |

### 1.8 `lifecycle in {draft, review, archived}`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 297-298 |
| 억제 대상 | `orphan` |
| 의미 | 초안 / 검토 / 보관 상태는 정합성 완결 대상 아님 |
| 권장 사용 | 작성 진행 중 문서 |
| 오용 금지 | approved 문서를 draft 로 되돌려 orphan 회피 금지 — lifecycle 는 실제 상태를 반영 |

### 1.9 `CONTAINS_DEPTH_EXEMPT` (system-* 루트)

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 52-57 (`system-design-tools`, `system-infra`, `system-root`, `system-support`) |
| 억제 대상 | `contains-depth-violation` |
| 의미 | 최상위 루트 layout 은 넓은 contains 트리를 허용 (집계 역할) |
| 권장 사용 | 코드로 고정 — 개별 문서는 수정 불가 |
| 오용 금지 | 리스트 확장은 코드 커밋 필요. 단순 deep tree 회피 목적으로 추가 금지 |

### 1.10 `LEGACY_SAFE_EXTS` — `.md`, `.todo.md`, `.memo.md`

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 329 |
| 억제 대상 | `invalid-type-classification` (design/spec 문서의 확장자 불일치) |
| 의미 | Legacy/혼용 확장자 허용 — 점진 migration 기간 중 경고 없음 |
| 권장 사용 | 기존 문서 유지 |
| 오용 금지 | 신규 design/spec 문서는 `.spec.md` / `.rule.md` / `.plan.md` / `.cases.md` / `.test.md` 중 하나를 사용 |

### 1.11 CONTAINS 깊이 semantic 조정

| 항목 | 값 |
|---|---|
| 발동 지점 | `validate.ts` line 192, `semantic-lint.ts` `semanticContainsDepthLimit` |
| 억제 대상 | `contains-depth-violation` (limit 상향) |
| 의미 | 특정 의미론적 컨텍스트에서는 4단계보다 깊은 계층 허용 |
| 권장 사용 | 코드 로직으로만 조정 |
| 오용 금지 | 문서 수준에서 제어 불가 — semantic-lint 수정 PR 로만 변경 |

---

## 2. 규칙

### 2.1 신규 억제 수단 도입 프로토콜

validator 에 새 억제 메커니즘을 추가할 때:

1. **본 규칙 문서를 먼저 갱신** — 억제 수단을 §1 카탈로그에 등록
2. `validate.ts` 에 구현 (억제 수단의 의미론 주석 포함)
3. 테스트 추가 — 억제 조건 충족/불충족 양쪽 검증
4. PR 설명에 "suppression tag 도입" 명시

### 2.2 적용 우선 순위 (중복 억제 시)

같은 검사에 여러 억제가 가능할 때 validator 는 가장 **명시적인 선언** 을 따른다.

1. `lifecycle: deprecated` (최상위) — 거의 모든 검사 skip
2. `knowledgeKind: proposal|adr|convention` — dup-coord skip
3. `tier: component` — dup-coord skip
4. `tags: [cross-scope]` — multi-parent / dup-coord skip (그룹 전원 요구)
5. `tags: [orphan-expected]` / `.cases.md` / `.test.md` — orphan skip

### 2.3 그룹 전원 요구 — cross-scope 의 엄격성

`cross-scope` 는 dup-coord 억제 시 그룹 **전원** 에 태그가 있어야 발동한다 (validate.ts line 372-376). 이 엄격성은 "일부 태그" 로 의도성을 위장하는 것을 방지한다. 신규 peer 를 추가할 때 기존 cross-scope 그룹에 합류하려면 새 문서에도 태그 부여 필수.

### 2.4 억제 ≠ 해결

억제 태그는 **의도 선언** 이지 문제 해결이 아니다. 다음 경우는 억제가 아니라 구조 수정이 정답:

- peer 가 아니라 parent-child 관계라면 → `contains` / `refines` 관계 명시 (Class A)
- 시스템 정체성이 coarse aspect 에 수렴했다면 → aspect 세분화 (Class D)
- 다른 시스템 산하 service 라면 → `owner_system` 재지정 또는 boundary 이동

---

## 3. 검증

### 3.1 Suppression 사용 감사

```bash
# cross-scope 태그를 가진 문서 수
sqlite3 data/definition-service.sqlite \
  "SELECT COUNT(*) FROM documents WHERE tags LIKE '%cross-scope%';"

# knowledge_kind 별 문서 수
sqlite3 data/definition-service.sqlite \
  "SELECT knowledge_kind, COUNT(*) FROM documents GROUP BY knowledge_kind;"
```

감사 시점 체크:
- cross-scope 태그가 급증하면 aspect 세분화 또는 구조 수정 대상이 누락되었을 가능성
- deprecated 급증은 정리 필요 신호

### 3.2 Validator 무결성 테스트

```bash
pnpm --filter definition-catalog test validate
# 각 suppression 조건의 on/off 케이스 자동 검증
```

### 3.3 Rule 문서-코드 Drift 체크

본 문서 §1 목록과 `validate.ts` 의 실제 구현 가드 조건이 일치하는지 리뷰 시 수동 확인. Drift 발견 시 본 문서를 즉시 갱신.

---

## 4. 예외

억제 수단 자체에 대한 예외는 없다 (모든 억제는 명시적). 단 **새 억제 수단 도입** 시 본 §2.1 프로토콜 준수를 예외 없이 강제.

---

## 5. 근거

- `packages/definition-catalog/src/validate.ts` — 구현 SSoT (모든 억제 로직의 실제 근원)
- `packages/definition-catalog/src/semantic-lint.ts` — `allowsSemanticMultiParent`, `semanticContainsDepthLimit`
- [domain-hierarchy/reviews/2026-04-21-final-cleanup.md](../../proposals/domain-hierarchy/reviews/2026-04-21-final-cleanup.md) §"Part B — Dup-coord 처리" — cross-scope 전원 요구의 rationale
- [domain-hierarchy/reviews/2026-04-20-phase5-redesign.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md) §"Class C" — knowledge_kind 면제의 근거
- [aspect-evolution-index.md](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 서사
- [cases-md-convention.rule.md](./cases-md-convention.rule.md) — `.cases.md` 자동 면제의 상세
