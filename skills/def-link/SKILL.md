---
name: def-link
description: "definition-catalog 문서 간 링크 연결. 고아 문서에 depends_on/implements/refines/constrains 관계를 추가한다."
---

# Definition Catalog — 문서 링크 연결

links가 없는 리프 문서에 횡방향 관계를 추가한다.

## 현황 확인

```bash
qa-sdk def sync        # 최근 docs 변경 반영
qa-sdk def audit       # links 없는 문서 수 확인
qa-sdk def validate    # 고아/multi-parent 경고 확인
```

## LinkType 선택 기준 (LINK_TYPE_RULES)

SSOT: `packages/definition-catalog/src/types.ts` §`LinkType` (9종) + `verifies` (test-md-convention §1.5 frontmatter-only). 상세 매트릭스는 `docs/specs/system/link-type-usage.rule.md`.

| 유형 | "A가 B를..." | 언제 사용 | 혼동 주의 |
|------|-------------|----------|----------|
| **contains** | 포함한다 | 그룹→멤버 소속 (트리) | depends_on과 혼동 금지. "소속"만 contains. tier: layout 은 contains 금지 |
| **depends_on** | 의존한다 | A가 B 없이 동작 불가 | refines와 혼동 금지. "필요"면 depends_on |
| **implements** | 구현한다 | 추상 계약→구체 코드 | refines와 구분. 추상→구체면 implements |
| **refines** | 구체화한다 | 같은 계층 내 상세화 | implements와 구분. 문서→상세문서면 refines |
| **constrains** | 제약한다 | 규칙/제한 부과 | depends_on과 구분. "규칙 부과"면 constrains |
| **traces_to** | 추적한다 | 이력/마이그레이션 | depends_on과 구분. 런타임 의존 아닌 이력 |
| **refs** | 카탈로그로 참조한다 | **tier: layout 전용** — Layout이 System을 단순 배치 (STC D-4). 의미적 결합 없음 | contains 금지 위치에서 사용. 일반 문서는 쓰지 않음 |
| **verifies** | 검증한다 | `.test.md` → 검증 대상 spec (test-md-convention §1.5). 신규 작성 권장, 기존 `refines/depends_on` 유예 | `.cases.md`에는 사용 금지 (cases는 `refines`+`depends_on`) |
| **evolves_from** | 개정으로 이어진다 | v2 spec → v1 spec, 버전 진화 DAG | refines 아님. ISA 의미 없음, 단순 revision 순서 |
| **supersedes** | 이전 개정을 대체한다 | 신규 계약이 구 계약을 폐기 | evolves_from과 짝. 폐기 의미 명시 시 추가 |

## 제약 조건

| 규칙 | 적용 대상 |
|------|----------|
| **순환 검사** | depends_on, implements, refines (`cyclicTypes` — `validate.ts:116`) |
| **순환 미검사** | contains, constrains, traces_to, refs, evolves_from, supersedes (방향성 약하거나 DAG) |
| **다중 부모 경고** | **contains** — 2곳 이상 소속 시 warning. cross-scope 태그가 있으면 의도적 허용 |
| **다중 부모 허용** | depends_on, implements, refines, constrains, traces_to, refs, evolves_from, supersedes |

## tier × linkType 제약 (`validate.ts:218-273`)

| tier | 강제/금지 | 위반 시 |
|------|----------|---------|
| `layout` | **`refs` 강제** — `contains` 사용 금지. `refs`/`contains` 모두 0건이면 "배치된 시스템 없음" | error: `level-violation` |
| `system` | 다른 `tier: system`을 `contains` 금지 — `depends_on` 또는 `refs`로 전환 | error: `system-contains-system` |
| `component` | `contains` 자식 보유 시 비권장 — data-shape 분리 권장 | warning: `level-violation` |

## 자동 연결 가능 (scope만으로 결정, 같은 그룹 내)

| 패턴 | 안전도 |
|------|--------|
| constraint → interface (constrains) | 높음 |
| constraint → feature (constrains) | 높음 |
| flow → interface (refines) | 높음 |
| flow → feature (refines) | 높음 |
| scenario → feature (traces_to) | 높음 |

자주 쓰는 안전 패턴:

| 패턴 | 권장 link |
|------|-----------|
| quality contract → quality bundle | `refines` |
| gate 문서 → contract 문서 | `depends_on` |
| overview leaf → 상위 system/module | `refines` |
| data model → API 계약 | `depends_on` |

## 수동 검토 필요 (본문 확인)

| 패턴 | 이유 |
|------|------|
| feature → data (depends_on) | 어떤 data에 의존하는지 본문 확인 |
| interface → data (depends_on) | 어떤 스키마를 사용하는지 확인 |
| 다른 그룹 간 관계 | 반드시 본문 참조 확인 |

## 링크 추가

frontmatter에 links 섹션 추가:

```yaml
  links:
    - target: <대상 ID>
      type: <depends_on|implements|refines|constrains|traces_to>
```

## synthetic 관계 주의

- `feedback_request`나 synthetic incoming link는 datasource가 계산한 읽기 전용 관계다.
- 이런 관계는 frontmatter에 직접 쓰지 않는다.
- 문서 기반 feedback 연결이 필요하면 `review request`나 관련 문서 매핑 흐름을 사용한다.

## multi-parent 해소

한 문서가 2곳에서 `contains`로 참조되면:

1. "이 문서의 주 책임은 어디인가" → 주 소속 1곳만 `contains` 유지
2. 나머지는 `depends_on`으로 전환 (참조 관계)
3. repo 문서를 수정한 뒤 `qa-sdk def sync`로 local datasource를 갱신

## 검증

```bash
qa-sdk def sync
qa-sdk def validate    # 깨진 링크 0건, 순환 참조 0건, multi-parent 0건
qa-sdk def bottomup <문서ID>   # blast radius 확인
```

## 주의

- 순환 참조 금지 — 검사 대상은 depends_on/implements/refines 3종 (`cyclicTypes`)
- contains 다중 부모 — cross-scope 태그가 있으면 허용, 없으면 warning. 위 본문 표 기준
- DB나 실행 환경의 캐시를 직접 고치지 않는다. `docs/`와 frontmatter가 SSOT다.
- 불확실하면 추가하지 않음
- 자동 패턴 먼저, 수동은 별도 처리
- tags는 링크를 대체하지 않는다. `cross-scope`는 다중 소속의 의도를 설명할 뿐, authored relation 대신 쓰지 않는다.
- 상세 매트릭스: `docs/specs/system/link-type-usage.rule.md`
