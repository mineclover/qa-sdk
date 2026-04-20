---
name: def-topdown
description: "definition-catalog 탑다운 조회. 시스템/그룹에서 시작하여 멤버 문서의 purpose/overview를 scope 순서로 조립한다."
---

# Definition Catalog — 탑다운 조회

group/module 문서에서 시작하여 contains 멤버의 purpose/overview를 scope 순서로 조립한다.

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

## 도메인 루트에서 드릴다운

`tier: system` 좌표의 `domain_root` 파생 결과를 출발점으로 사용할 수 있다. 먼저 루트를 확인한 뒤 한 번에 멤버를 훑는다.

```bash
# 1. 루트 후보 확인
qa-sdk def audit --by-domain

# 2. 특정 도메인 전체 나열
qa-sdk def list --domain-root <rootId>

# 3. APM 도메인 전체 드릴다운 예시
qa-sdk def list --domain-root apm-system | awk '{print $1}' | xargs -I{} qa-sdk def context {}
```

도메인 루트가 아직 파생되지 않는 시스템(자기 자신이 root인 경우)은 `def audit --by-domain`의 top 리스트에 다수 1~2건 루트로 노출되며, Phase 3 마이그레이션 후에만 상위 도메인에 귀속된다.
