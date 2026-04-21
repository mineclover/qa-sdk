---
def:
  id: system-specs-rules-index
  type: knowledge
  knowledge_kind: convention
  lifecycle: approved
  owner_system: definition-catalog
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  tags: [structural, convention, index]
  links:
    - target: aspect-naming-convention
      type: refs
    - target: cases-md-convention
      type: refs
    - target: test-md-convention
      type: refs
    - target: validator-suppression-tags
      type: refs
    - target: catalog-purity-bridge
      type: refs
    - target: change-simulation-precedence
      type: refs
    - target: link-type-usage
      type: refs
    - target: facet-test-isolation-rule
      type: refs
    - target: layer-separation
      type: refs
    - target: aspect-evolution-index
      type: refs
---

# System-level Rules & Conventions Index

## 목적 ^purpose

`docs/specs/system/` 는 qa-sdk 의 system-wide rule / convention 문서를 수집한다. 본 인덱스는 `*.rule.md` 확장자를 가진 규약 문서 9건과 관련 proposal 을 한 화면으로 묶어 발견성을 제공한다. `qa-sdk def list --type=rule` 로도 동일 목록에 접근할 수 있다.

---

## Rules (`*.rule.md` 9건)

| 문서 | 요지 |
|---|---|
| [aspect-naming-convention](./aspect-naming-convention.rule.md) | `DEF_ASPECT` 에 신규 aspect 값을 추가할 때의 `{role}_{parent-stem}` 네이밍 + 매핑 규율 |
| [cases-md-convention](./cases-md-convention.rule.md) | `.cases.md` — consumer-driven 기대 시나리오 문서 작성 규칙 |
| [test-md-convention](./test-md-convention.rule.md) | `.test.md` — provider-side 테스트 문서 작성 규칙 |
| [validator-suppression-tags](./validator-suppression-tags.rule.md) | `@def.ignore`/`suppress` 태그로 validator 경고를 억제할 때의 규율 |
| [catalog-purity-bridge](./catalog-purity-bridge.rule.md) | `definition-catalog` 는 DB 의존 없는 순수 라이브러리 — 브릿지는 `definition-service` 가 담당 |
| [change-simulation-precedence](./change-simulation-precedence.rule.md) | 구조적 변경은 코드 커밋 전 시뮬레이션 선행 |
| [link-type-usage](./link-type-usage.rule.md) | LinkType 6종 사용 규칙 (contains / depends_on / implements / refines / constrains / traces_to) |
| [facet-test-isolation](./facet-test-isolation.rule.md) | 격리 테스트 패키지 운영 규칙 + 서비스 온보딩 절차 |
| [layer-separation](./layer-separation.rule.md) | data / validator / workflow / tooling 4 계층 책임 모델 + workflow smoke 원칙 |

---

## 관련 Proposal / Index

- [aspect-evolution-index](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 허브 (aspect-vocab-split / aspect-schema-hierarchy / domain-hierarchy)
- [domain-hierarchy](../../proposals/domain-hierarchy/README.md) — domain 계층 RFC + 실측 리뷰

---

## CLI 진입점

```bash
# rule 확장자 문서만 필터
qa-sdk def list --type=rule

# 소스 파일 확장자 일반 필터 (cases / test / todo 등도 동일)
qa-sdk def list --ext=rule
qa-sdk def list --ext=cases
qa-sdk def list --ext=test

# 개별 규칙 본문 조회
qa-sdk def body aspect-naming-convention
qa-sdk def context aspect-naming-convention
```

---

## 비고

- `doc_type` frontmatter 는 대부분 `spec` 으로 통일되어 있어 `--type=rule` CLI 플래그는 **소스 파일 확장자** (`source_path LIKE '%.rule.md'`) 기준으로 필터링한다. 내부적으로 `DefListFilter.ext` 를 사용한다.
- 추가 규율이 필요할 때는 `docs/specs/system/<topic>.rule.md` 를 생성하고 본 인덱스에 `refs` 링크를 추가한다.
