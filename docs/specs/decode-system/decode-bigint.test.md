---
def:
  tier: component
  id: decode-bigint-test
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  tags: [testing, bigint]
  links:
    - target: decode-bigint
      type: verifies
source: packages/index-meta/src/prefix-decoder-big.test.ts
---

# PrefixDecoderBig 테스트 명세

## 목적 ^purpose

PrefixDecoderBig의 생성, decode, encode, deep decode, batch, matchRanges, ref 해석, 대형 주소 공간 동작을 검증한다. 총 28개 테스트.

소스: `packages/index-meta/src/prefix-decoder-big.test.ts`

## 전제 ^preconditions

- 3x3x3 BigInt DecodeMap 픽스처 (perm: role/action/resource, 총 27 주소)
- 256x256x256 대형 BigInt DecodeMap 픽스처 (16,777,216 주소 공간)
- cross-index 픽스처 (service 2x3 + permission 6x3, index_ref dim 포함)

## 스텝 ^steps

### 생성 (4)

1. BigInt DecodeMap으로 생성 → indexId, versionId, size(27n), shape([3n,3n,3n]), strides, dimIds 확인
2. refs 포함 생성 → hasRef("perm_svc") === true, hasRef("role") === false
3. numberType "number" DecodeMap → ValidationError
4. numberType 미지정 → 허용 (호출자 판단 존중)

### resolve (2)

5. resolve(0n) → { indexId: "perm", versionId: "v1", value: 0n }
6. resolve(13n) → 임의 bigint에 대해 VersionedValueBig 반환

### decode (3)

7. decode(0n) → 첫 번째 주소 entity (admin/read/10)
8. decode(26n) → 마지막 주소 entity (viewer/delete/30)
9. decode(13n) → 중간 주소 entity (editor/write/20)

### decodeDeep (4)

10. refs 있을 때 index_ref 1-level 확장 — entities + refs 동시 반환
11. 다양한 값으로 deep decode — perm_svc→service 참조 확장
12. refs 없을 때 raw number 유지, refs 빈 객체
13. index_ref 아닌 dim은 refs에 포함 안 됨

### decodeDeepDetailed (2)

14. ref 코덱 없을 때 unresolved에 dimId 수집
15. 모든 ref 있으면 unresolved 비어 있음

### decodeBatch (2)

16. bigint 배열 [0n, 26n] → 2건 결과 반환
17. 빈 배열 → 빈 배열

### matchRanges (1)

18. { role: "admin" } 부분 조건 → BigInt 범위 `[[0n, 8n]]` 반환

### resolveRef / hasRef (5)

19. ref 코덱으로 해석 — resolveRef(0n, "perm_svc") → service entity
20. hasRef 확인 — perm_svc=true, role=false, nonexistent=false
21. 존재하지 않는 dimId → ValidationError
22. index_ref 아닌 dim → ValidationError
23. ref 코덱 없을 때 → ValidationError

### encode-decode 라운드트립 (2)

24. 단일 entity encode → decode → 동일 entity
25. 0n ~ size-1 전수 라운드트립 (3x3x3 = 27 주소)

### 대형 주소 공간 (2)

26. 256x256x256 decode — 첫 번째(e0/e0/e0), 마지막(e255/e255/e255) 검증
27. 대형 주소 공간 encode → decode 라운드트립

### toDecodeMap (1)

28. 원본 DecodeMap과 동일 구조 반환

## 검증 ^assertions

- 생성: BigInt shape/size/strides 올바르게 변환, numberType 검증 동작
- decode: 좌표 인코딩/디코딩이 stride 기반으로 정확
- deep: index_ref dim만 확장, ref 코덱 없으면 스킵
- batch: 결과 순서와 길이 보장
- matchRanges: 부분 조건에 해당하는 연속 BigInt 범위 반환
- resolveRef: 유효하지 않은 입력에 대해 ValidationError
- 라운드트립: encode(decode(x)) === x, 전수 검증
- 대형: 256^3 공간에서도 정확한 decode/encode
