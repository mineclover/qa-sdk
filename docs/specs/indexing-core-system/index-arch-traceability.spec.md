---
def:
  id: index-arch-traceability
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: index-arch-layers
      type: depends_on
    - target: indexing-architecture
      type: refines
---

# 인덱싱 아키텍처 - 검증과 추적성

## 목적 ^purpose

문서 스펙, 식별자 규약, 검증 파이프라인, 구현 상태 추적을 분리해 아키텍처 변경이 어떤 산출물에 전파되는지 설명한다.

## 문서 투영과 식별자 규약

- Document Spec은 설계 문서가 schema와 runtime 계약으로 투영되는 최소 단위를 정의한다.
- 식별자 규약은 축, prefix, runtime artifact가 같은 이름 체계를 공유하도록 강제한다.
- 이 규약이 어긋나면 codegen, registry, decode에서 서로 다른 의미를 읽게 된다.

## 검증 파이프라인

- 검증은 문서 -> schema -> runtime 순서로 내려가며, 역방향으로는 결과만 피드백한다.
- 추적성은 각 레이어 산출물이 어느 문서 근거에서 왔는지 되짚을 수 있어야 한다.
- 현재 구현 상태는 완료/초안/다음 단계 구분으로 관리하고, 주의사항은 이 경계가 깨질 때만 문서화한다.
