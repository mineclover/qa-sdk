---
name: claim-workflow
description: "DKG 노드에 작업 선점(claim)하고 해제(release)하는 워크플로우. 트리거: 'claim', '작업 선점', '누가 작업 중', 'release', '작업 해제', '충돌 확인'"
---

# Claim 워크플로우

DKG 노드에 작업을 선점하고, 다른 에이전트와 충돌을 방지하며, 완료 시 해제한다.

## 1. 현재 활성 claims 확인

```bash
node packages/cli/dist/index.js dkg claims
```

## 2. 작업 선점 (claim)

```bash
node packages/cli/dist/index.js dkg claim <nodeId> --by <worker> --reason "작업 사유"
```

- `--reason`은 필수 권장 — 왜 이 노드를 잠그는지 기록
- 이미 다른 에이전트가 claim한 경우 → 차단 + 기존 claim 사유 표시
- 전파 대상 자동 표시: 영향받는 domain, DSL, consumer

예시:
```bash
node packages/cli/dist/index.js dkg claim build_event --by "agent-fix" --reason "배포 스큐 해소"
```

## 3. 작업 수행

claim이 걸린 상태에서 해당 노드 관련 작업을 수행한다.

## 4. 작업 해제 (release)

```bash
node packages/cli/dist/index.js dkg release <nodeId>
```

- 자동으로 `OBS-RELEASE-*` observation이 DKG에 기록됨
- 누가, 언제 claim했고, 언제 해제했는지 이력 보존

## 충돌 시나리오

```
agent-A: dkg claim role --by agent-A --reason "auditor entry 추가"
  → ✓ Claim: role (by agent-A)

agent-B: dkg claim role --by agent-B --reason "role 축 정리"
  → ✗ 이미 작업중: agent-A
  → 사유: auditor entry 추가
  → 해제하려면: qa-sdk dkg release role

agent-A: (작업 완료)
agent-A: dkg release role
  → ✓ Release: role (OBS-RELEASE-role-xxx 기록)

agent-B: dkg claim role --by agent-B --reason "role 축 정리"
  → ✓ Claim: role (by agent-B)
```

## 주의

- claim은 노드 단위 잠금 (도메인 단위가 아님)
- 같은 도메인의 다른 노드는 별도 claim 가능
- 전파 대상이 겹칠 수 있으므로 claims 목록을 먼저 확인

## Skill 기반 실행

`dkg claim`/`dkg release` CLI 명령 대신 skill로 직접 실행 가능:

```bash
dkg run skill-claim <nodeId> <by> --reason "사유"
dkg run skill-release <nodeId>
```

claim → 작업 → release 사이클 후 변경 이력 확인: `dkg run skill-trace <nodeId>`

## 검증 매핑

- `dkg claim`, `dkg release`, `dkg run skill-claim`, `dkg run skill-release`
  - 검증: `packages/cli/src/skills-workflows.test.ts`
