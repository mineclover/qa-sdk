---
def:
  id: meta-semantic-pipe-catalog
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope]
  links:
    - target: meta-semantic-system
      type: refines
    - target: pipe-flow-catalog
      type: contains
    - target: pipe-connection-catalog
      type: contains
    - target: prefix-colocation
      type: contains
    - target: test-name-tokens
      type: contains
---

# Meta-Semantic Pipe Catalog

## 목적 ^purpose

Pipe 구현 코어와 별도로, PipeFlow/ConnectionKind 카탈로그와 naming/colocation 같은 보조 운영 규칙을 한 모듈로 묶는다. 구현 모듈과 문서 카탈로그 모듈의 책임을 분리하는 것이 목적이다.

## 구성 ^overview

- `pipe-flow-catalog` — PipeFlow 30종의 표현·정의·검증 카탈로그
- `pipe-connection-catalog` — ConnectionKind 8종의 연결 semantics 카탈로그
- `prefix-colocation` — 선언 위치 기반 prefix 출처 관리
- `test-name-tokens` — spec/test 이름 매핑 규칙

## 분해 원칙

- 실행 가능한 구현 코어는 `meta-semantic-pipe-impl`가 소유한다.
- kind taxonomy, naming, colocation 같은 문서 카탈로그는 이 module이 소유한다.
- `cross-scope` 성격이 있으므로 flow/data/feature 문서가 함께 들어와도 된다.
