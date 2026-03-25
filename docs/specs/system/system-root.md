---
def:
  id: system-root
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [cross-scope, entry-point]
  links:
    - target: system-concepts
      type: contains
    - target: system-data-flow
      type: contains
    - target: system-packages
      type: contains
    - target: ingest-system
      type: contains
    - target: gate-system
      type: contains
    - target: df-system
      type: contains
    - target: pipeline-system
      type: contains
    - target: permission-system
      type: contains
    - target: decode-system
      type: contains
    - target: query-system
      type: contains
    - target: registry-system
      type: contains
    - target: dkg-system
      type: contains
    - target: wi-system
      type: contains
    - target: cq-system
      type: contains
    - target: browser-system
      type: contains
    - target: spec-engine-system
      type: contains
    - target: indexing-core-system
      type: contains
    - target: index-meta-system
      type: contains
    - target: viz-system
      type: contains
    - target: apm-system
      type: contains
    - target: storage-system
      type: contains
    - target: event-vocab-system
      type: contains
    - target: guides-system
      type: contains
    - target: definition-catalog-spec
      type: contains
    - target: analysis-system
      type: contains
    - target: wi-pack-format-system
      type: contains
    - target: dkg-skills-system
      type: contains
---

# QA-SDK 시스템

## 목적 ^purpose

이벤트를 좌표로 인코딩하여, 데이터 흐름의 분기점에 명시적 추적성을 부여하는 로깅 SDK + 분석 인프라. 축(Axis)으로 유한한 분류 차원을 정의하고, Prefix로 축의 조합을 만들고, 정수 하나로 압축한다.

## 구성 ^overview

overview: 총 27개 멤버.
- `system-concepts`: 이벤트, 좌표, 축(Axis), Prefix, prefix_ref — qa-sdk 좌표 시스템의 기본 개념을 정의한다.
- `system-data-flow`: 이벤트가 브라우저/서버에서 발생하여 ingest → 저장 → 재구성 → 판정 → 시각화되는 전체 데이터 흐름.
- `system-packages`: qa-sdk 모노레포의 패키지 의존 관계.
- `ingest-system`: SDK에서 전송된 이벤트를 수신, 저장, 재구성, 판정하는 수집 파이프라인.
- `gate-system`: 주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
- `df-system`: 인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델.
- `pipeline-system`: 이벤트 수집부터 비동기 재구성/판정까지의 2단계 처리 파이프라인.
- `permission-system`: 닫힌 권한 공간을 bitmask로 압축하고, 계층 상속과 외부 컨텍스트를 분리하는 권한 엔진.
- `decode-system`: MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스.
- `query-system`: 관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스.
- `registry-system`: Prefix DAG, 버전 라이프사이클, DraftWorkspace를 중앙에서 관리하는 서비스.
- `dkg-system`: 고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하고, 그 기능이 다시 고정 축이 되는 누적적 성장 나선을 추적하는 설계 시점 메타데이터 그래프.
- `wi-system`: 가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환 라이브러리.
- `cq-system`: 닫힌 좌표 공간 위의 패턴 포함 관계, 정책 해소, cross-index 합성 질의, 버전 횡단 탐색을 다루는 n차원 연산 계층.
- `browser-system`: 브라우저 SDK의 이벤트 수집, 세션 관리, 생명주기, 전송을 담당하는 클라이언트 시스템.
- `spec-engine-system`: 좌표 시스템의 설계 규칙, 타입, 전파, 수렴을 관리하는 스펙 엔진.
- `indexing-core-system`: 좌표 시스템의 기반 원리, 데이터 설계, 축/prefix 운영, 차원 연산을 정의하는 핵심 인덱싱 레이어.
- `index-meta-system`: MetaRegistry, PrefixDecoder, 주소 직렬화 등 좌표 시스템의 런타임 메타데이터 관리 레이어.
- `viz-system`: 시각화 패널, 그래프 렌더러, 모션 에디터, 폼 빌더 등 프론트엔드 UI 시스템.
- `apm-system`: 코드 생성, DSL 스키마, 주소 컨텍스트, 런타임 흐름, 로깅, CLI 등 APM 관측 인프라.
- `storage-system`: 이벤트/시나리오/판정/그래프 데이터의 저장 어댑터, 스키마, 유틸리티.
- `event-vocab-system`: 이벤트 정의의 핵심 패턴, 그래프 힌트, 페이로드 설계 가이드.
- `guides-system`: 개발자 가이드: 빠른 시작, 분석 시스템, prefix 설계, 레시피 모음.
- `definition-catalog-spec`: 비즈니스 로직 정의를 좌표 주소로 분류하고, contains 계층으로 조립하는 문서 메타데이터 시스템.
- `analysis-system`: 수집된 이벤트 데이터를 기반으로 시스템 건강 상태, 좌표 수렴, prefix 공출현 패턴, 상태 전이를 분석하는 관측 레이어.
- `wi-pack-format-system`: WeightedIndex 주소를 다양한 이진 포맷으로 직렬화하고, capacity 계획, hex 경계 연산, 레이아웃 프로토콜을 제공하는 포맷 레이어.
- `dkg-skills-system`: DKG 그래프의 빈 곳을 자동으로 채우는 5개 skill.
