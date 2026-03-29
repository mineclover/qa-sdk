---
def:
  id: definition-contract
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [structural]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: definition-extraction
      type: depends_on
    - target: definition-assembly
      type: depends_on
---
# Definition Contract — 계약 조립

## 목적 ^purpose

계약 그룹 문서의 contains 관계를 따라 멤버 문서에서 계약 요소(inputs, outputs, preconditions 등)를 마커 기반으로 추출하고, 하나의 구조화된 계약으로 조립한다.

## 정의 ^defines

- 8종 계약 마커 (inputs/outputs/precondition/postcondition/flow-steps/decision-point/failure/evidence)
- Reversibility 타입 (reversible/irreversible)
- parseEvidenceItems() — 증거 어노테이션 파싱
- ContractStats — 계약 통계 (완성도, 의미밀도, 가역성 비율)
- assembleContract() — 계약 조립 오케스트레이터

## 소비 ^consumes

- extraction (extract.ts) — 마커 기반 섹션 추출
- assembly (assemble.ts) — scope 정렬 + 그룹 탐색
- taxonomy (taxonomy.ts) — CONTRACT_MARKERS 정의

## 구성 ^overview

- `contract-evidence`: [reversible]/[irreversible] 어노테이션 파싱
- `contract-stats`: 계약 통계 계산 (8종 마커 완성도, 의미 밀도, 가역성 비율) + 렌더링
- `assembleContract()`: 그룹 → 멤버 스캔 → 마커 추출 → 슬롯 분류 → 통계 계산

## 8종 계약 마커

| 마커 | 역할 | 실행 힌트 |
|------|------|----------|
| ^inputs | 입력 | code |
| ^outputs | 출력 | code |
| ^precondition | 사전 조건 | code |
| ^postcondition | 사후 조건 | code |
| ^flow-steps | 실행 단계 | llm |
| ^decision-point | 분기 지점 | llm |
| ^failure | 실패 조건 | mixed |
| ^evidence | 증거 요구 | mixed |

## evidence 가역성

```markdown
## 증거 요구 ^evidence
- 입력 정규화 로그 [reversible]
- 최종 verdict 판정 [irreversible]
- 처리 시간 (미지정)
```

reversible = 원본 복원 가능, irreversible = 정보 손실.

## 관련 소스

- `definition-catalog/src/contract.ts` — assembleContract
- `definition-catalog/src/contract-evidence.ts` — parseEvidenceItems
- `definition-catalog/src/contract-stats.ts` — computeStats, renderContract
