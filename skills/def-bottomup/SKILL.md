---
name: def-bottomup
description: "definition-catalog 바텀업 역추적. 특정 문서가 변경될 때 영향받는 문서를 역추적한다."
---

# Definition Catalog — 바텀업 역추적

리프 문서의 변경이 어디까지 영향을 미치는지 역추적한다.

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
- [depends_on ↓] <문서> (depth N)
- [refines ↓] <문서> (depth N)
- [contains ↑] <그룹> (depth N)
```

## 역추적 규칙

| linkType | 영향 방향 | 이유 |
|----------|----------|------|
| depends_on | source가 영향 | 의존 대상 변경 → 의존자 깨짐 |
| implements | source가 영향 | 명세 변경 → 구현 불일치 |
| refines | source가 영향 | 상위 변경 → 하위 불일치 |
| constrains | target이 영향 | 제약 변경 → 피제약자 재검토 |
| contains | source(그룹)가 영향 | 멤버 변경 → 그룹 stale |
| traces_to | 영향 없음 | 추적 관계 ≠ 구조적 의존 |

리프일수록 blast radius가 크다.
