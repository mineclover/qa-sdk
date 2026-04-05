---
def:
  id: cli-minor-gaps-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: experience
  links:
    - target: cli-flow-store
      type: depends_on
---

# CLI Minor Gaps — 구현 TODO

## 목적 ^purpose

CLI 명령 표면에서 아직 구조적으로 남아 있는 작은 부채와 다음 정리 대상을 추적한다.

## 잔여 항목

### command registry — tree 모델 예외 표면 (2건)

- [ ] `spec drift`, `def help`, `quality` 예외 표면을 CliCommandNode tree/runtime 모델에 흡수할지 결정
- [ ] 나머지 command-specific 세부 usage 블록까지 metadata 기반 생성으로 넓힐지 결정

### address-first parity (1건)

- [x] GraphQL: `docByAddress`, `impactByAddress`, outgoing links — 구현 완료
- [x] REST: `by-address/:address` 엔드포인트 — 구현 완료
- [x] CLI: `def get/incoming/outgoing/impact --address` — 구현 완료 + smoke
- [ ] review/quality surface에도 canonical address를 직접 받을지 검토

### smoke coverage (2건)

- [x] `def get/incoming/outgoing/boundary/impact --address` smoke — 기본 커버 완료
- [ ] address-first smoke를 boundary/boundary-context까지 넓힘
- [ ] `dkg audit-events` + ingest forwarding e2e smoke를 CLI 회귀 세트에 포함할지 검토

## 완료 항목

### command registry — CliCommandNode tree migration (전체 완료)

- [x] 전 명령군 CliCommandNode tree 마이그레이션 (service/def/dkg/quality/review/ingest/obs/gate/query/spec/test/catalog/motion/flow/scan/git/prefix/facet + root)
- [x] `executeCommand()` 공통 경로
- [x] 서브트리 help 생성형 연결 (전 명령군)
- [x] `CommandDescriptor` authored SSOT 계층
- [x] `@qa-sdk/cli` → `cli-command` package import 정리

### address-first (완료 부분)

- [x] `def scan` alias 정리
- [x] `def get/incoming/outgoing/impact --address` 구현
- [x] `dkg audit-events` 구현
- [x] `document_links` address 병행 저장
- [x] GraphQL address query 구현
- [x] REST by-address 엔드포인트 구현

## 잔여 5건 요약

| # | 항목 | 유형 | 선행 조건 |
|---|------|------|----------|
| 1 | tree 모델 예외 표면 흡수 결정 | 설계 결정 | CLI tree 작업 안정화 |
| 2 | usage metadata 확장 범위 결정 | 설계 결정 | — |
| 3 | review/quality address parity | 설계 결정 | — |
| 4 | boundary address smoke 확장 | 테스트 | — |
| 5 | audit-events e2e smoke 포함 결정 | 설계 결정 | — |
