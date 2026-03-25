---
name: def-split
description: "definition-catalog 대형 문서 분할. 150줄 이상인 리프 문서를 scope별로 분할하여 그룹 + 멤버 구조로 만든다."
---

# Definition Catalog — 문서 분할

150줄+ 리프 문서를 scope별로 분할한다.

## 분할 대상 찾기

```bash
qa-sdk def stats    # 전체 현황
qa-sdk def audit    # 대형 리프 이슈 확인
```

## 절차

1. `grep "^## " <파일>`로 섹션 구조 분석
2. 각 섹션의 scope 분류
3. 그룹 문서 생성 (depth: overview + contains)
4. 멤버 문서 생성 (depth: specification + `## 목적 ^purpose`)
5. 원본 lifecycle: deprecated
6. `qa-sdk def validate`로 검증

## frontmatter 형식

```yaml
---
def:
  id: <id>
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
qa-sdk def validate    # 깨진 링크 0건 확인
qa-sdk def audit       # purpose 누락 0건 확인
pnpm --filter definition-catalog test
```
