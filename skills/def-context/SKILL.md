---
name: def-context
description: "definition-catalog 노드 컨텍스트 조회. 특정 문서 작업 시 필요한 상위/하위/제약/의존 정보를 수집한다."
---

# Definition Catalog — 노드 컨텍스트 조회

특정 문서에 대해 작업할 때 필요한 선행 지식을 수집한다.

## 실행

```bash
qa-sdk def context <문서ID>
```

예:
```bash
qa-sdk def context gate-api
qa-sdk def context record-spec
```

## 출력

```
# 컨텍스트: <제목>
scope: <scope>/<aspect>  depth: <depth>  lifecycle: <lifecycle>

## 이 문서의 목적
<purpose>

## 소속
<그룹> (contains 체인)

## 적용되는 제약
- [constrains] <문서>: <내용>

## 의존 대상
- [depends_on] <문서>: <purpose>
- [implements] <문서>: <purpose>

## concerns
직접: <tags>
상속: <concern> from <출처>

## 영향 범위
blast radius: N건
```

## 활용

- 코드 작업 전: "이 문서 수정하려면 뭘 알아야 해?"
- PR 리뷰 시: "이 변경의 영향 범위는?"
- 새 문서 추가 시: "어디에 넣어야 하지?"
