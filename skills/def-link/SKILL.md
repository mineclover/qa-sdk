---
name: def-link
description: "definition-catalog 문서 간 링크 연결. 고아 문서에 depends_on/implements/refines/constrains 관계를 추가한다."
---

# Definition Catalog — 문서 링크 연결

links가 없는 리프 문서에 횡방향 관계를 추가한다.

## 현황 확인

```bash
qa-sdk def audit       # links 없는 문서 수 확인
qa-sdk def validate    # 고아 문서 경고 확인
```

## 자동 연결 가능 (scope만으로 결정, 같은 그룹 내)

| 패턴 | 안전도 |
|------|--------|
| constraint → interface (constrains) | 높음 |
| constraint → feature (constrains) | 높음 |
| flow → interface (refines) | 높음 |
| flow → feature (refines) | 높음 |
| scenario → feature (traces_to) | 높음 |

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

## 검증

```bash
qa-sdk def validate    # 깨진 링크 0건, 순환 참조 0건
qa-sdk def bottomup <문서ID>   # blast radius 확인
```

## 주의

- 순환 참조 금지 (A→B, B→A)
- 불확실하면 추가하지 않음
- 자동 패턴 먼저, 수동은 별도 처리
