# merge-contract

> 의미적 중복 제거(indexing-merge-plan)의 안전망으로 기능하는 계약 테스트.

## 목적

같은 의미의 연산이 여러 패키지에 존재할 때, **리팩터링 전후로 결과가 동일함**을 보장한다. 각 테스트 파일은 식별된 중복 지점(D-1 ~ D-5)에 대응한다.

## 테스트 파일

| 파일 | 대상 중복 | 검증 내용 |
|---|---|---|
| `d1-label-map-parity.test.ts` | D-1: String→Index 맵 | PermissionCodec과 LabelRegistry가 같은 ID에 같은 1-based index를 부여하는지, 에러 거부 동작이 동일한지 |
| `d2-d5-meta-registry-shape.test.ts` | D-2, D-5 | MetaRegistry 내 shape 경로 일관성 (getWeightedIndex/createCodec/getCapacityInfo), PrefixDecoder unresolved ref 수집 |
| `d3-capacity-parity.test.ts` | D-3: Capacity 곱셈 | compileSchema capacity와 MetaRegistry codec.size가 동일한지 (3D/다중버전/6D/PrefixRegistry sync) |
| `d4-stride-parity.test.ts` | D-4: Stride 공식 | `calcWeights(shape)` === `new WeightedIndex(shape).strides` (1D~8D, 다양한 shape) |
| `error-parity.test.ts` | 에러 거부 | PermissionCodec/PrefixCodec/MetaCodec이 unknown label, out-of-range, parse error에 대해 모두 에러를 던지는지 |

## 관련 문서

- [tasks/indexing-merge-plan.md](../../../../tasks/indexing-merge-plan.md) — 전체 병합 계획 및 실행 기록
- [adr-merge-dedup.md](../../../../docs/specs/indexing/index-meta/adr-merge-dedup.md) — 결정 근거
