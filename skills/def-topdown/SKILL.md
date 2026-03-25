---
name: def-topdown
description: "definition-catalog 탑다운 조회. 시스템/그룹에서 시작하여 멤버 문서의 purpose/overview를 scope 순서로 조립한다."
---

# Definition Catalog — 탑다운 조회

시스템/그룹 문서에서 시작하여 contains 멤버의 purpose/overview를 scope 순서로 조립한다.

## 실행

```bash
qa-sdk def topdown <그룹ID>
qa-sdk def topdown <그룹ID> --overview
```

예:
```bash
qa-sdk def topdown gate-system
qa-sdk def topdown ingest-system
qa-sdk def topdown system-root
```

## 출력

```
# <그룹 제목>
<그룹 purpose>
concerns: <tags>

## [constraint] <제목>
<purpose>

## [state] <제목>
<purpose>

## [feature] <제목>
...
```

scope 정렬: constraint → state → data → feature → flow → interface → ui

## 사용 가능한 그룹

```bash
qa-sdk def stats
```

그룹 목록이 하단에 출력된다.
