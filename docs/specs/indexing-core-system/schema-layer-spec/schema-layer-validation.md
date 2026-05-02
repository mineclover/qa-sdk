---
def:
  tier: component
  id: schema-layer-validation-spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [testing, structural, runtime]
  links:
    - target: schema-layer-spec
      type: refines
---

# Schema Layer — 검증 파이프라인과 식별 체계

## 목적 ^purpose

스키마 데이터의 4단계 검증 파이프라인(Vocabulary → Coordinate → Schema → Semantic)과
스키마/인스턴스/vocabulary/axis/coordinate 각각의 고유 식별자 형식을 정의한다.

## 검증 파이프라인

데이터가 들어오면 Layer 순서대로 검증:

```
1단계. Vocabulary 검증 (Layer 0)
   축 이름 유효한가? vocabulary 값 존재하는가? 타입 맞는가?

2단계. Coordinate 검증 (Layer 1)
   좌표 구조가 canonical form인가? version 해석 가능한가?

3단계. Schema 검증 (Layer 2)
   필수 축 있는가? cardinality 맞는가? 구조 유효한가?

4단계. Semantic 검증 (Layer 3, 외부)
   도메인 규칙에 맞는가? 상태 전이 유효한가? 권한 규칙에 맞는가?
```

1~3은 이 시스템의 코어. 4는 외부 플러그인.

---

## 식별 체계

스키마, 인스턴스, vocabulary, axis의 식별자를 분리한다.

| 종류 | 형태 | 예시 |
|---|---|---|
| 스키마 식별자 | `schema:{category}.{name}:{version}` | `schema:event.base:v1` |
| 인스턴스 식별자 | 도메인별 | `evt_123`, `rel_889`, `doc_204` |
| vocabulary 식별자 | `vocab:{axisId}:{version}` | `vocab:action:v3` |
| axis 식별자 | `axis:{axisId}` | `axis:action`, `axis:resource` |
| coordinate 식별자 | `{prefixId}:{version}:{address}` | `service:v1:40` |
