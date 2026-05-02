---
name: def-context
description: "definition-catalog 노드 컨텍스트 조회. 특정 문서 작업 시 필요한 상위/하위/제약/의존 정보를 수집한다."
---

# Definition Catalog — 노드 컨텍스트 조회

특정 문서에 대해 작업할 때 필요한 선행 지식을 수집한다.

## 권장 순서

문서를 방금 수정했거나 다른 사람이 갱신한 직후라면 먼저 local datasource를 맞춘다.

```bash
qa-sdk def sync
qa-sdk def context <문서ID>
```

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
layer: <layer>  tier: <tier>
svc: <serviceId>
address: <address>
도메인 루트: <domain_root>            # 파생 결과 (Phase 2)
aspect family: <parent-aspect>        # deriveAspectParent 체인 상위 (Phase C-2)

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

## 최근 Feedback Requests
- frq_xxx [gpt-5.4]: <purpose>

## 경고 (조건부)
⚠ owner_system <선언값> 과 파생 root <파생값> 불일치
```

owner_system과 파생 root가 어긋나면 하단에 경고가 붙는다 — `def validate` 에서 `owner-root-mismatch` info 진단과 짝이다. 링크 그래프와 frontmatter 중 어느 쪽이 정답인지 판단한다.

## 도메인 컨텍스트 확장

문서의 소속 도메인 전체를 함께 보고 싶으면:

```bash
qa-sdk def context <docId>                 # 개별 컨텍스트
qa-sdk def list --domain-root <rootId>     # 같은 도메인의 형제들
qa-sdk def topdown <rootId>                # 도메인 전체 purpose 조립 (contains ∪ depends_on← ∪ refines←)
```

## 활용

- 코드 작업 전: "이 문서 수정하려면 뭘 알아야 해?"
- PR 리뷰 시: "이 변경의 영향 범위는?"
- 새 문서 추가 시: "어디에 넣어야 하지?"
- feedback request나 synthetic trace가 걸린 문서인지 먼저 확인할 때

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-contract-descent` 참조

컨텍스트 수집 범위는 **"상호 무지, 자기 계약 명확"** 원칙을 따른다:

- **자기가 소비할 것만 수집한다.** 상위의 세부도, 하위의 세부도 불필요
- 상위 문서: 내려준 계약(scope, constraint)만 확인 — 상위 내부 구현은 무시
- 하위 문서: 존재 여부와 purpose만 확인 — 하위 세부 내용은 무시
- peer 문서: 자기가 depends_on하는 문서의 계약만 확인

**모르는 건 자유이지만 아는 건 의무다.**
컨텍스트가 과하면: "이 정보를 내가 소비하는가?"로 필터링.

## 계층 맥락

본 skill 은 **L3 focused-view workflow**. 개별 문서 관점으로 L1 data + L2 파생 값을 조립한다.

출력에는 L2 파생 값이 포함된다:
- `도메인 루트` = `deriveDomainRoot` 결과 (L2 파생)
- `aspect family` = `deriveAspectParent` 체인 상위 (L2 파생, Phase C-2)
- `owner_system` vs 파생 root 불일치 경고 = L2 `owner-root-mismatch` info 진단의 workflow 표현

L1 frontmatter (선언값) 와 L2 파생값이 어긋나면 경고가 붙는다 — 어느 쪽을 정답으로 볼지 판단하는 것은 본 skill 사용자 책임. 단순 조회 도구가 아니라 "정합성 체크포인트" 로 활용하라.

계층 분리 규칙: `docs/specs/system/layer-separation.rule.md` §1.3. Semantic 변경 후 특정 문서의 컨텍스트 변화 확인 — `skills/semantic-change/SKILL.md` Step 3.

## tags 해석 요령

`def context`의 `concerns` 섹션은 문서 tags를 그대로 늘어놓는 용도가 아니다.

- StructuralTag (`entry-point`, `cross-scope`, `decision`)는 문서 역할을 읽는다.
- ConcernTag (`security`, `observability`, `testing` 등)는 횡단 관심사를 읽는다.
- 운영 관례 태그 (`runtime`, `persistence`, `contract`)는 검색 편의를 위한 보조 신호로 본다.

즉 "왜 이 문서를 먼저 봐야 하는가"는 StructuralTag에서, "어떤 종류의 위험/관심사가 있는가"는 ConcernTag에서 먼저 읽는다.
