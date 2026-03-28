---
def:
  id: invariants-spec
  address: def_document:v2:273555
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: index-codec-spec
      type: constrains
    - target: resolver-spec
      type: constrains
    - target: index-meta-sdk-spec
      type: constrains
---

# 변환 불변조건 (Invariants) 명세

## 목적 ^purpose

산재된 불변조건을 단일 스펙으로 통합하여 시스템의 정합성 보증을 명문화한다.

## 구성 ^overview

- **불변조건 12종**: encode/decode roundtrip(INV-1~2), serialize/parse roundtrip(INV-3), obfuscation roundtrip(INV-4), migration 보존(INV-5), gate 상태 3종(INV-6~8), BigInt 동등성(INV-9), 순환 방지(INV-10), full stack/cross-protocol roundtrip(INV-11~12)
- **조건 분류**: 무조건 적용(대부분)과 gate 활성 시/version 호환 시 조건부 적용으로 구분
- **검증 전략**: 기존 단위 테스트 커버 + `invariants.test.ts` 갭 보강(INV-G1~G4)
- **핵심 보증**: 어떤 경로(encode→serialize→parse→decode)로든 원본 데이터가 손실 없이 복원됨

## 불변조건 목록

| ID | 불변조건 | 조건 |
|----|----------|------|
| INV-1 | `encode(decode(v)) === v` ∀v ∈ [0, size) | 무조건 |
| INV-2 | `decode(encode(entities))` ≡ entities | 무조건 |
| INV-3 | `parse(serialize(vv, p))` ≡ vv ∀ registered protocol p | 무조건 |
| INV-4 | `deobfuscate(obfuscate(id)) === id` ∀id ∈ [0, size) | 무조건 |
| INV-5 | migration 후 shared dim entity 보존 | version 호환 시 |
| INV-6 | inactive 주소는 decode 가능, encode 불가 | gate 활성 시 |
| INV-7 | open 주소는 encode 가능, decode 불가 | gate 활성 시 |
| INV-8 | reserved 주소는 encode·decode 모두 불가 | gate 활성 시 |
| INV-9 | BigInt/Number 동일 결과 (shape ≤ 2^53) | 무조건 |
| INV-10 | deepDecode는 visited set으로 순환 방지 | 무조건 |
| INV-11 | Full stack: `decode(parse(serialize(encode(e))))` ≡ e | 무조건 |
| INV-12 | Cross-protocol: `parse(convert(serialize(vv,p1),p2))` ≡ vv | 무조건 |

## INV-1: encode/decode roundtrip

WeightedIndex의 핵심 보증. 모든 유효 주소 v에 대해 encode(decode(v)) === v.

- **커버**: `weighted-index` 단위 테스트 (encode/decode roundtrip)

## INV-2: decode/encode roundtrip

entity 좌표 → encode → decode → 동일 entity 좌표 복원.

- **커버**: `weighted-index` 단위 테스트

## INV-3: serialize/parse roundtrip

어떤 프로토콜이든 serialize → parse → 동일 VersionedValue 복원.

- **커버**: `address-protocol-manager.test.ts`, `semantic-address.test.ts`

## INV-4: obfuscation roundtrip

compose chain을 통한 ID 난독화/복원 roundtrip.

- **커버**: `compose.test.ts` (obfuscation chain roundtrip)

## INV-5: migration entity preservation

version 간 migration 시 shared dim의 entity가 보존된다.

- **커버**: `migrate-address.test.ts`

## INV-6 / INV-7 / INV-8: gate 상태 불변조건

각 상태의 encode/decode 허용 여부가 ADDRESS_GATE 상수에 부합한다.

- **커버**: `invalid-ranges.test.ts`, `gate-engine.test.ts`
- **갭 보강**: `invariants.test.ts` INV-G1

## INV-9: BigInt/Number 동등성

shape ≤ 2^53 범위에서 WeightedIndex와 WeightedIndexBig가 동일 결과를 생성한다.

- **갭 보강**: `invariants.test.ts` INV-G3

## INV-10: deepDecode 순환 방지

visited set으로 동일 주소 재방문을 방지하여 무한 루프를 차단한다.

- **커버**: `cross-index-query.test.ts`

## INV-11: Full stack roundtrip

encode → serialize → parse → decode 전체 파이프라인 roundtrip.

- **갭 보강**: `invariants.test.ts` INV-G2, INV-G4

## INV-12: Cross-protocol roundtrip

serialize(p1) → convert(p2) → parse → 동일 VersionedValue.

- **갭 보강**: `invariants.test.ts` INV-G4
