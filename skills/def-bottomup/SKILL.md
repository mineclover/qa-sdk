---
name: def-bottomup
description: "definition-catalog 바텀업 역추적. 특정 문서가 변경될 때 영향받는 문서를 역추적한다."
---

# Definition Catalog — 바텀업 역추적

리프 문서의 변경이 어디까지 영향을 미치는지 역추적한다.

진입 워크플로우: 리프 변경 감지 → `def find-by-file <code>` 또는 `def doctor` → `def bottomup <id>`로 blast radius 확인.

## 실행

```bash
qa-sdk def bottomup <문서ID>
```

예:
```bash
qa-sdk def bottomup record-spec
qa-sdk def bottomup gate-api
```

## 출력

```
# 영향 분석: <문서>
blast radius: N건

## 그룹 영향
- <그룹> (contains 역추적)

## 영향받는 문서
- [depends_on ↑] <문서> (depth N)
- [refines ↑] <문서> (depth N)
- [refs ↑] <문서> (depth N)
- [traces_to ↑] <문서> (depth N)
- [contains ↑] <그룹> (depth N)
```

화살표(`↑`)는 모두 영향이 위로 전파되는 방향(소비자 → 공급자) 표시. CLI 실제 출력과 일치.

## 역추적 규칙 (LinkType 9종 + verifies)

| linkType | 영향 방향 | 이유 |
|----------|----------|------|
| depends_on | source가 영향 (↑) | 의존 대상 변경 → 의존자 깨짐 |
| implements | source가 영향 (↑) | 명세 변경 → 구현 불일치 |
| refines | source가 영향 (↑) | 상위 변경 → 하위 불일치 |
| constrains | target이 영향 | 제약 변경 → 피제약자 재검토 |
| contains | source(그룹)가 영향 (↑) | 멤버 변경 → 그룹 stale |
| traces_to | source가 영향 (↑) | 추적 출처 변경 → 이력 stale (구조적 약함, 그래도 출력됨) |
| refs | source(layout)가 영향 (↑) | Layout이 카탈로그로 묶은 System 변경 → 카탈로그 stale |
| verifies | source(.test.md)가 영향 (↑) | 검증 대상 spec 변경 → 테스트 재검토 |
| evolves_from | source(신버전)가 영향 (↑) | 이전 개정 변경 → 진화 lineage 재검증 |
| supersedes | source(신계약)가 영향 (↑) | 폐기된 대상 변경 → 대체 관계 재확인 |

리프일수록 blast radius가 크다.

## 코드 → 영향 추적

`@def.boundary` 주석은 코드 파일을 spec 문서에 묶는다. 주석 내용(boundary id) 변경 시:

1. `def find-by-file <code-path>`로 묶인 boundary 식별
2. `def bottomup <boundary-id>`로 영향 범위 계산
3. validate에서 `invalid-code-boundary` 또는 `code-link-gaps`가 뜨면 우선 해소
