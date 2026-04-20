---
name: def-audit
description: "definition-catalog 문서 품질 감사. purpose 품질, 링크 누락, 태그 미부여, 마커 미사용, multi-parent, contains 깊이, level 검증을 점검하고 개선한다."
---

# Definition Catalog — 문서 품질 감사

문서의 품질 지표를 점검하고 개선 작업을 수행한다.

## 실행

```bash
qa-sdk def sync        # 최근 docs 변경을 local datasource에 반영
qa-sdk def audit       # 전체 품질 리포트 (level 분포 포함)
qa-sdk def audit-db    # approved 문서의 purpose/고립/svc 누락 빠른 점검
qa-sdk def validate    # synced graph + code reference boundary 검증
qa-sdk def stats       # 분포 통계
qa-sdk def link-rules  # LinkType 사용 규칙 조회
```

권장 순서:

```bash
qa-sdk def sync
qa-sdk def validate
qa-sdk def audit
qa-sdk def audit-db
```

실행 위치:

- 가능하면 **repo root**에서 실행한다.
- 이 저장소에서는 `node packages/cli/dist/index.js def ...` 또는 `pnpm exec qa-sdk def ...`가 가장 안전하다.
- `pnpm --filter <pkg> exec qa-sdk def ...`는 package cwd 때문에 `docs/`와 `data/definition-service.sqlite`를 잘못 찾을 수 있으니 우선 피한다.

## audit 출력 예시

```
=== 품질 리포트 ===
문서 N건 | purpose N | links M | tags K
level: leaf(...) module(...) group(...)
```

## 도메인별 리포트 (`--by-domain`)

`domain_root` 파생 결과로 그룹핑하고 루트별 top 좌표 3개를 출력한다.

```bash
qa-sdk def audit --by-domain
```

출력 예:

```
=== 도메인 루트별 리포트 (524개 루트, 문서 1139건) ===

[definition-catalog-spec]  86건
  component:feature:operation:func_def: 13건
  component:interface:mediation:api_contract: 9건
  system:feature:operation:func_def: 7건

[prefix-service]  43건
  component:data:none:prefix_schema: 41건
  system:data:none:prefix_schema: 2건
```

용도:
- 실제 도메인 경계 확인 (owner_system 선언과 링크 그래프가 일치하는가)
- `missing-domain-root` 후보 식별 (루트 카운트 1건짜리가 대량이면 상위 귀속이 필요)
- 후속 드릴다운: `qa-sdk def list --domain-root <rootId>`

`def validate`의 info 진단 중 `owner-root-mismatch`는 이 리포트와 짝으로 본다 — frontmatter의 `owner_system`과 링크 그래프 기반 파생 루트가 어긋나는 경우를 표면화한다. 무시하지 말고 링크/owner 선언 중 어느 쪽이 정답인지 판단한다.

## 품질 기준

### ^purpose

| 등급 | 기준 | 조치 |
|------|------|------|
| 양호 | 30자+ | — |
| 짧음 | <30자 | 보강: "무엇+왜+범위" |
| 없음 | 마커 없음 | `## 목적 ^purpose` 추가 |

### links

리프 문서에 최소 1개 횡방향 관계. `/def-link`로 추가.

synthetic feedback 관계는 보조 신호일 뿐이며, frontmatter 기반 authored link를 대체하지 않는다.

### tags

문서 태그는 좌표를 대체하지 않는 보조 taxonomy다.

- StructuralTag: `entry-point`, `cross-scope`, `decision`, `generated`
- ConcernTag: `security`, `performance`, `accessibility`, `observability`, `testing`, `migration`, `deprecation`
- 운영 관례 태그: `runtime`, `persistence`, `contract`, `versioning`, `frontend`, `quality-bundle`, `quality-gate`

권장 수량은 보통 2~5개다. 자세한 기준은 `docs/specs/system/tag-management.spec.md`를 따른다.

### ^overview

그룹 문서(depth: overview)에 `## 구성 ^overview` 필수.

### multi-parent (다중 소속 감지)

하나의 문서가 2개 이상의 그룹에 `contains`로 소속되면 감지.

- `cross-scope` 태그가 있으면 **의도적 공유** → warning 생략 (허용)
- meta-semantic / scope-nesting 바운더리 문서는 **concept link**로 semantic family가 확인되면 cross-scope parent 조합을 허용할 수 있다
- 태그 없이 다중 소속이면 **비의도적 중복 가능** → warning
- 조치: 의도적이면 `cross-scope` 태그 추가, 비의도적이면 하나를 `depends_on`으로 전환
- 먼저 `contains` 방향이 맞는지 확인한다. leaf가 부모를 `contains`로 잡은 경우는 다중 소속이 아니라 링크 방향 오류일 가능성이 높다.

### level 검증 (3-level 모델)

| level | 검증 | 심각도 |
|-------|------|--------|
| `group` | contains 자식 1건 이상 필수 | error |
| `module` | contains 자식 1건 이상 필수 | error |
| `leaf` | contains 자식 금지 | error |
| `leaf` | 150줄 초과 시 분할 경고 | warning |

원칙: "모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."

### contains 깊이

contains 계층이 4단계를 초과하면 warning.

- group → group → module → leaf 로 이어지는 깊이
- 5단계 이상이면 중간 그룹 도입 검토
- 단, meta-semantic / scope-nesting 바운더리 계열은 semantic family가 확인되면 6단계까지 허용될 수 있다

## purpose 보강 패턴

```
❌ "서비스 메타데이터 CRUD."
✅ "서비스 메타데이터(이름, tier, team, ownedPrefixes)를 등록/조회/삭제하는
    REST API. 서비스 디스커버리의 입력 데이터."
```

무엇 + 왜 + 범위.

## 자기 증명 점검

leaf 문서는 자기 존재를 증명할 수 있어야 한다:

- `^purpose`, `^defines`, `^consumes` 마커가 규칙에 맞게 작성되었는가
- 구현 코드 참조(`패키지/src/파일.ts`)가 있는가
- 테스트 코드 참조(`패키지/src/파일.test.ts:라인`)가 있는가

상위 문서(module/group)는 하위를 빠짐없이 담는가:
- `contains` 링크가 실제 하위 문서와 1:1 대응하는가
- `^overview`에서 각 하위 문서의 역할을 요약하는가

과편화는 상관없다 — 패싯이 다르면 줄 수와 무관하게 분할한다.

## 빠른 합격선

문서 품질을 빠르게 올릴 때는 아래 5개를 우선 맞춘다.

1. `^purpose` 30자 이상
2. authored links 1개 이상
3. tags 2~5개
4. leaf에 구현/테스트 코드 참조 존재
5. `def validate`, `def audit-db` 모두 이슈 0

## 경험 규칙

- `def validate`와 `scan-audit`는 같은 graph 규칙을 보되, 전자는 synced SQLite + code reference 기준이고 후자는 raw frontmatter 기준이다.
- graph lint는 structural layer 위에 semantic override를 얹는다. meta-semantic / scope-nesting concept link가 있으면 multi-parent와 contains-depth 일부 규칙이 완화될 수 있다.
- `def validate`는 통과하지만 `scan-audit`가 실패하면 local DB stale보다 **frontmatter 조합 오류**나 **scan 전용 duplicate-id**를 먼저 의심한다.
- `def sync` 직후 `def validate`가 `no such table`로 깨지면 sync가 끝나기 전에 validate를 친 것이다. sync 완료 후 다시 본다.
- `svc 미부여`는 현재 저장소에서는 **참고 지표**다. generic concept/prefix-catalog/guide 문서를 fail로 보지 않는다.
- duplicate-id가 `.spec.md + .todo.md`의 **같은 stem 공존**이라면 허용 케이스다. stem이 다르면 실제 충돌이다.

## 검증 이슈 유형

| 유형 | 심각도 | 설명 |
|------|--------|------|
| broken-link | error | target이 존재하지 않는 문서를 참조 |
| circular-ref | error | depends_on/implements/refines 순환 |
| self-ref | error | 자기 자신을 참조 |
| orphan | warning | 어디에서도 참조되지 않는 approved 문서 |
| multi-parent | warning | contains로 2개 이상 부모에 소속 |
| contains-depth-violation | warning | contains 계층 4단계 초과 |
| missing-purpose | warning | ^purpose 마커 없음 |
| short-purpose | warning | purpose 30자 미만 |
| level-no-children | error | group/module인데 contains 자식 없음 |
| leaf-has-children | error | leaf인데 contains 자식 있음 |
| leaf-too-long | warning | leaf 150줄 초과 → 분할 검토 |
| leaf-no-impl-ref | warning | leaf에 구현/테스트 코드 참조 없음 → 자기 증명 부재 |
| owner-root-mismatch | info | frontmatter `owner_system`과 링크 기반 파생 `domain_root`가 불일치 |

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-boundary`, `ms-concept-five-roles`, `ms-concept-verification-unit` 참조

감사 시 추가로 확인할 수 있는 원칙적 기준:

| 점검 | 근거 | 조치 |
|------|------|------|
| 한 문서에 다른 패싯 조합이 섞여 있는가? | 패싯 분리 | `/def-split` 검토 |
| 이 문서는 검증 가능한가? (기계적 판정) | 바운더리 | 검증 불가면 바운더리 재정의 |
| level과 패싯 조합이 일치하는가? | 바운더리 | 관리+저장 없는데 module이면 재검토 |

기존 품질 기준(purpose 30자+, links, tags, level 규칙)은 그대로 유지.
위 원칙은 **심화 감사** 시 추가 적용한다.

## LinkType 사용 규칙 (taxonomy.ts LINK_TYPE_RULES)

| 유형 | 읽는 법 | 순환 | 다중부모 | 사용 기준 |
|------|---------|------|---------|----------|
| contains | A가 B를 포함한다 | 금지 | **경고** (cross-scope 태그 시 허용) | 그룹→멤버 소속 |
| depends_on | A가 B에 의존한다 | 금지 | 허용 | A가 B 없이 동작 불가 |
| implements | A가 B를 구현한다 | 금지 | 허용 | 계약→코드 |
| refines | A가 B를 구체화한다 | 금지 | 허용 | 같은 계층 내 상세화 |
| constrains | A가 B를 제약한다 | 금지 | 허용 | 규칙 부과 |
| traces_to | A가 B로 추적한다 | 금지 | 허용 | 이력/마이그레이션 추적 |

혼동 주의:
- "사용한다" → `depends_on`, "소속시킨다" → `contains`
- "구체화한다" → `refines`, "필요로 한다" → `depends_on`
- "계약→코드" → `implements`, "문서→상세문서" → `refines`
