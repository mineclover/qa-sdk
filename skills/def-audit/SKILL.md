---
name: def-audit
description: "definition-catalog 문서 품질 감사. purpose 품질, 링크 누락, 태그 미부여, 마커 미사용, multi-parent, contains 깊이, level 검증을 점검하고 개선한다."
---

# Definition Catalog — 문서 품질 감사

문서의 품질 지표를 점검하고 개선 작업을 수행한다.

## 실행

```bash
qa-sdk def audit       # 전체 품질 리포트 (level 분포 포함)
qa-sdk def validate    # 깨진 링크/순환/고아/multi-parent/depth 검증
qa-sdk def stats       # 분포 통계
qa-sdk def link-rules  # LinkType 사용 규칙 조회
```

## audit 출력 예시

```
=== 품질 리포트 ===
문서 483건 | purpose 483 | links 376 | tags 483
level: leaf(402) module(71) group(10)
```

## 품질 기준

### ^purpose

| 등급 | 기준 | 조치 |
|------|------|------|
| 양호 | 30자+ | — |
| 짧음 | <30자 | 보강: "무엇+왜+범위" |
| 없음 | 마커 없음 | `## 목적 ^purpose` 추가 |

### links

리프 문서에 최소 1개 횡방향 관계. `/def-link`로 추가.

### tags

concern(security, performance 등) + tier(tier-infra 등) 태그 부여.

### ^overview

그룹 문서(depth: overview)에 `## 구성 ^overview` 필수.

### multi-parent (다중 소속 감지)

하나의 문서가 2개 이상의 그룹에 `contains`로 소속되면 감지.

- `cross-scope` 태그가 있으면 **의도적 공유** → warning 생략 (허용)
- 태그 없이 다중 소속이면 **비의도적 중복 가능** → warning
- 조치: 의도적이면 `cross-scope` 태그 추가, 비의도적이면 하나를 `depends_on`으로 전환

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

## purpose 보강 패턴

```
❌ "서비스 메타데이터 CRUD."
✅ "서비스 메타데이터(이름, tier, team, ownedPrefixes)를 등록/조회/삭제하는
    REST API. 서비스 디스커버리의 입력 데이터."
```

무엇 + 왜 + 범위.

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
