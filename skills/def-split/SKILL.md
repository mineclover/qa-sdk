---
name: def-split
description: "definition-catalog 대형 문서 분할. 150줄 이상인 leaf 문서를 개념 단위로 분할하여 module + leaf 구조로 만든다."
---

# Definition Catalog — 문서 분할

150줄+ leaf 문서를 개념 단위로 분할한다. 분할 시 원본 leaf는 같은 `docId`를 유지한 채 module overview로 변경된다.

원칙: "모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."

## 분할 대상 찾기

```bash
qa-sdk def stats    # 전체 현황
qa-sdk def audit    # 대형 리프 이슈 확인
```

## 시작 전 확인

```bash
qa-sdk def sync
qa-sdk def context <문서ID>
qa-sdk def bottomup <문서ID>
```

- 분할 기준은 `scope`보다 `단일 개념 + stable trace unit`을 우선한다.
- 기본 패턴은 `module + leaf`다.
- 여러 module을 왜 함께 묶는지 자체를 설명해야 할 때만 `group`을 고려한다.

## 절차

1. `grep "^## " <파일>`로 섹션 구조 분석
2. 각 섹션을 "하나의 개념으로 독립 추적 가능한가" 기준으로 묶는다
3. 원본 문서의 `level`을 `leaf` → `module`로 변경하고 `depth: overview` + `contains` 링크를 추가한다
4. 멤버 leaf 문서를 생성하고 `## 목적 ^purpose`를 채운다
5. 필요한 횡방향 관계는 `/def-link` 기준으로 보강한다
6. `qa-sdk def sync`로 local datasource를 갱신한다
7. 검증: module은 contains 자식 1건 이상 필수, leaf는 자식 금지

## frontmatter 형식

```yaml
---
def:
  id: <id>
  level: module
  scope: <scope>
  aspect: <aspect>
  depth: <depth>
  lifecycle: approved
---
# <제목>

## 목적 ^purpose

<purpose>
```

`def:` 래퍼 + 2칸 들여쓰기. `## 목적 ^purpose` 필수.

## scope 결정: "주 독자가 누구인가"

constraint → state → data → feature → flow → interface → ui

## 검증

```bash
qa-sdk def sync
qa-sdk def validate    # 깨진 링크 0건 확인
qa-sdk def audit       # purpose/overview/level 누락 0건 확인
pnpm --filter definition-catalog test
```

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-boundary`, `ms-concept-five-roles` 참조

분할 판단의 근거는 **5원 분리**(생산·소비·정의·관리·저장)다.

- 한 문서 내에서 **서로 다른 5원 조합**이 섞여 있으면 분리 신호
- 예: 스키마 정의(정의) 부분과 검증 규칙(관리) 부분이 한 문서에 → 분리
- 예: API 계약(소비 인터페이스)과 구현 로직(생산) → 분리

분할 결과의 각 leaf는 **검증 가능한 기능 단위(바운더리)**여야 한다:
- 실행 검증, 타입 검증, 계약 검증, 정합성 검증 중 하나 이상 가능한가?
- "기계적으로 판정 가능한가"가 기준. 코드 리뷰로만 확인 가능하면 검증이 아님

## 주의

- 원본 문서를 `deprecated`로 바꾸지 않는다. 기존 `docId`는 부모 module로 유지한다.
- 설치본 `~/.codex/skills/`나 DB를 직접 수정하지 않는다. repo 문서 수정 후 sync한다.
