---
def:
  tier: component
  id: decode-svc-core-logic
  address: def_document:v2:68866
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [runtime, structural, performance]
  links:
    - target: decode-service-system
      type: refines
    - target: decode-svc-data-model
      type: depends_on
---
# Decode Service — 핵심 로직

## 목적 ^purpose

디코딩 라우트 핸들러와 resolveDecoder 분기 로직을 정의한다. 모든 디코딩 연산은 DecoderPool에서 PrefixDecoder를 조회한 뒤, index-meta 라이브러리의 resolve/decode/decodeDeep을 호출하는 패턴이다.

## 구성 ^overview

### resolveDecoder — 4방향 분기

```
입력: { prefix?, version?, input }
├── prefix + version 둘 다 있음 → pool.get(prefix, version) 직접 조회
├── 하나만 있음 → 400 (불완전 파라미터)
├── 둘 다 없음 + input이 숫자 → 400 (자동 감지 불가)
└── 둘 다 없음 + input이 문자열 → pool.values()에서 detector.detect(input) 순회, 첫 매치
```

### 라우트별 로직

| 라우트 | 로직 | 반환 |
|--------|------|------|
| POST /decode | resolve(input) + decode(input) 병합 | { indexId, versionId, value, entities } |
| POST /decode/batch | inputs[] 순회, 각각 resolve+decode | { results: [...] } |
| POST /decode/deep | decodeDeepDetailed(input) | { entities, refs, unresolved? } |
| GET /decode-map/:prefix/:version | decoder.toDecodeMap() | raw DecodeMap 번들 |
