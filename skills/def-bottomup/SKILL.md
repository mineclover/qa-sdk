---
name: def-bottomup
description: "definition-catalog 바텀업 역추적. 특정 문서가 변경될 때 영향받는 문서를 역추적한다."
---

# Definition Catalog — 바텀업 역추적

리프 문서의 변경이 어디까지 영향을 미치는지 문서 그래프에서 역추적한다.

## 사용법

```
/def-bottomup <문서ID>
```

예: `/def-bottomup record-spec`, `/def-bottomup gate-api`

## 역추적 규칙

| linkType | target 변경 시 영향받는 쪽 | 이유 |
|----------|--------------------------|------|
| depends_on | source (의존자) | 의존 대상이 바뀌면 의존자가 깨짐 |
| implements | source (구현체) | 명세가 바뀌면 구현이 불일치 |
| refines | source (상세 문서) | 상위가 바뀌면 하위가 불일치 |
| constrains | target (피제약자) | 제약이 바뀌면 피제약자 재검토 |
| contains | source (그룹) | 멤버가 바뀌면 그룹 요약이 stale |
| traces_to | — | 추적 관계, 영향 없음 |

## 절차

1. 대상 문서를 `target`으로 참조하는 문서 찾기: `grep -rl "target: <ID>" docs/specs/`
2. 각 참조의 link type 확인하여 역추적 규칙 적용
3. contains 체인 상위 그룹 재귀 탐색
4. 전이적 전파 (직접 영향 → 2차 영향)

## 출력

```
# 영향 분석: <변경 문서>
blast radius: N건

## 직접 영향
- [depends_on] <문서>
- [refines] <문서>

## 그룹 영향
- <그룹> → <상위 그룹>
```

## 핵심: 리프일수록 blast radius가 크다
