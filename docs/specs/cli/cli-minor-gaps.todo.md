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
    - target: skill-cli-def-commands
      type: depends_on
    - target: skill-cli-dkg-commands
      type: depends_on
---

# CLI Minor Gaps — 구현 TODO

## 목적 ^purpose

CLI 명령 표면에서 아직 구조적으로 남아 있는 작은 부채와 다음 정리 대상을 추적한다.

## 현재 잔여

### command registry 중복

- [x] 공통 인터페이스: `packages/cli/src/command-spec.ts`
- [x] `def` 명령군은 `packages/cli/src/index.ts`에서 SSOT 배열로 정리했다.
- [x] `dkg` 명령군도 two-word / three-word SSOT 배열과 helper dispatch로 정리했다.
- [x] `service` 명령군도 two-word / three-word SSOT 배열과 helper dispatch로 정리했다.
- [x] `quality` 명령군도 two-word SSOT 배열과 helper dispatch로 정리했다.
- [x] `review` 명령군도 two-word SSOT 배열과 helper dispatch로 정리했다.
- [x] `service`, `quality`, `review` top-level usage line은 metadata 기반으로 생성한다.
- [x] `def help`는 section metadata 기반으로 생성한다.
- [x] `dkg` top-level usage 블록도 metadata 기반 생성으로 옮겼다.
- [x] `motion/spec/dx/flow/ingest/gate/query/catalog/obs/test` top-level usage 블록도 metadata 기반 생성으로 옮겼다.
- [x] `Commands:` 아래 핵심 세부 옵션 usage 블록도 metadata 기반 생성으로 옮겼다.
- [ ] 나머지 command-specific 세부 usage 블록까지 metadata 기반 생성으로 넓힐지 결정한다.

### address-first parity

- [ ] GraphQL에 `boundaryByAddress`, `boundaryContextByAddress`, `incoming/outgoing by address` 직접 query를 둘지 결정한다.
- [ ] review/quality surface도 canonical address를 직접 받는 것이 타당한지 검토한다.

### smoke coverage

- [ ] `def get/incoming/outgoing/boundary/impact --address`의 address-first smoke를 더 넓힌다.
- [ ] `dkg audit-events`와 ingest forwarding의 end-to-end smoke를 CLI 회귀 세트에 넣을지 검토한다.

## 완료 항목

- [x] `def scan` alias 정리
- [x] `def get --address`
- [x] `def incoming|outgoing --address`
- [x] `def impact --address`
- [x] `dkg audit-events`
- [x] `document_links` address 병행 저장
