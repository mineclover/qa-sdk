---
name: def-context
description: "definition-catalog 노드 컨텍스트 조회. 특정 문서 작업 시 필요한 상위/하위/제약/의존 정보를 수집한다."
---

# Definition Catalog — 노드 컨텍스트 조회

특정 문서에 대해 작업할 때 필요한 선행 지식을 수집한다.

## 사용법

```
/def-context <문서ID>
```

예: `/def-context gate-api`, `/def-context record-spec`

## 수집 항목

| 항목 | 방향 | 수집 방법 |
|------|------|----------|
| purpose | 자신 | `## 목적 ^purpose` 섹션 |
| 소속 그룹 | upstream | incoming `contains` link |
| 적용 제약 | upstream | incoming `constrains` link → `^constraint` 마커 |
| 의존 대상 | outgoing | `depends_on`/`implements`/`refines` target의 purpose |
| concerns | 전파 | 직접 tags + 상속 |
| blast radius | downstream | 역추적 영향 문서 수 |

## 출력

```
# 컨텍스트: <제목>
scope: <scope>/<aspect>  depth: <depth>

## 이 문서의 목적
<purpose>

## 소속
<그룹> → <상위>

## 적용되는 제약
- [constraint] <문서>: <^constraint 내용>

## 의존 대상
- [depends_on] <문서>: <purpose 1줄>

## concerns
직접: <tags>
상속: <concern> from <출처>

## 영향 범위
blast radius: N건
```
