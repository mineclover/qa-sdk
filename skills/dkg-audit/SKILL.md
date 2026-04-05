---
name: dkg-audit
description: "DKG CLI lifecycle/audit 추적을 점검한다. qa-sdk dkg audit-events, 로컬 ~/.qa-sdk/state.sqlite, QA_CLI_AUDIT_INGEST_URL 기반 중앙 ingest forwarding을 함께 확인하고, cli_event/spec_event/dkg_event 좌표와 payload를 해석한다."
---

# DKG Audit — CLI lifecycle 감사 추적

CLI에서 발생한 DKG 관련 변경이 실제로 추적 가능한지 확인하고, 로컬 감사 로그와 중앙 수집 경로를 함께 점검한다.

## 언제 쓰는가

- `dkg spec add`, `dkg spec transition`, `dkg version` 같은 lifecycle 명령이 실제로 기록되는지 보고 싶을 때
- `qa-sdk dkg audit-events` 출력이 기대와 맞는지 확인할 때
- 로컬 `~/.qa-sdk/state.sqlite`와 중앙 ingest(`/v1/ingest`)가 같은 audit record를 받는지 검증할 때
- `cli_event`, `spec_event`, `dkg_event` 중 어디까지 좌표화되고 어디서 audit-only로 남는지 확인할 때

## 빠른 점검

```bash
pnpm --filter dkg exec vitest run src/store/dkg-sqlite-store.test.ts
pnpm --filter dkg build
pnpm --filter @qa-sdk/cli build
qa-sdk dkg audit-events --limit 20
```

## 로컬 감사 로그

- 저장 위치: `~/.qa-sdk/state.sqlite`
- 테이블:
  - `usage_snapshots`
  - `version_usages`
  - `cli_audit_events`

읽는 법:

- `usage_snapshots`
  coarse telemetry. coverage/skew/usage 분석용
- `cli_audit_events`
  `EventRecord` 기반 감사 로그. command, targetId, lifecycleFrom, lifecycleTo, payload, address_context 확인용

## 기본 명령

```bash
qa-sdk dkg audit-events --limit 30
qa-sdk dkg audit-events --prefix spec_event
qa-sdk dkg audit-events --command "dkg version"
qa-sdk dkg audit-events --target prefix:v1
qa-sdk dkg audit-events --lifecycle active
qa-sdk dkg audit-events --json
```

## 기대 패턴

### `dkg spec add`

최소 3건이 보여야 한다.

1. `cli.command.executed`
   `eventPrefix=cli_event`
2. `cli.spec.lifecycle`
   `eventPrefix=spec_event`
3. `cli.dkg.operation`
   `eventPrefix=dkg_event`

### `dkg version activate`

최소 2건이 보여야 한다.

1. `cli.command.executed`
2. `cli.dkg.version`

여기서 확인할 필드:

- `targetId`: `prefix:version`
- `lifecycleFrom`
- `lifecycleTo`
- `payload.beforeStatus`
- `payload.afterStatus`
- `payload.ok`

## 중앙 ingest forwarding

환경변수:

- `QA_CLI_AUDIT_INGEST_URL`
- 없으면 `INGEST_URL` fallback

규칙:

- 값이 없으면 로컬 감사 로그만 남는다.
- 값이 있으면 같은 audit record를 `/v1/ingest`로 best-effort 전송한다.
- 중앙 전송 실패는 명령 실행을 막지 않는다.

간단 확인:

```bash
export QA_CLI_AUDIT_INGEST_URL=http://127.0.0.1:3200
qa-sdk dkg spec add --id TEST-AUDIT --type evt --title "Audit Test"
```

이후:
- 로컬: `qa-sdk dkg audit-events --limit 10`
- 중앙: ingest-server transmission/record 조회

## 판정 기준

- 로컬 검증 합격:
  - `dkg audit-events`에 command별 예상 event가 모두 남음
  - `targetId`, `payload`, `address_context`가 비어 있지 않음
- 중앙 검증 합격:
  - `/v1/ingest`로 `TransmissionEnvelope`가 수신됨
  - `records[0].event_key`가 `cli.*` 패턴으로 들어감

## 흔한 실패 원인

- `dkg_event` 주소가 비면
  `dkg_target_kind` 축에 targetKind가 등록되지 않았는지 먼저 본다.
- `dkg audit-events`는 나오는데 중앙에는 없으면
  `QA_CLI_AUDIT_INGEST_URL` / `INGEST_URL` 값과 `/v1/ingest` 경로를 확인한다.
- `dkg version`에서 `lifecycleFrom`이 비면
  registry-service의 `GET /prefixes/:prefix/versions/:versionId` 조회가 실패했는지 먼저 본다.
