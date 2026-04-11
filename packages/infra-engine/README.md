# infra-engine

`infra-engine`는 배포 파이프라인 자체보다 **중앙 spec을 읽고 구현 위치를 찾기 위한 인덱스**로 보는 것이 맞다. 구현 SSOT는 `docs/specs/infra-engine/`에 있다.

## 먼저 볼 문서

- [infra-engine-pipeline.spec.md](../../docs/specs/infra-engine/infra-engine-pipeline.spec.md) — 패키지 전체 진입점, 5단계 파이프라인과 책임 경계
- [infra-config-stage.spec.md](../../docs/specs/infra-engine/infra-config-stage.spec.md) — 설정 복호화/검증
- [infra-register-stage.spec.md](../../docs/specs/infra-engine/infra-register-stage.spec.md) — registry/service-profile 동기화
- [infra-verify-stage.spec.md](../../docs/specs/infra-engine/infra-verify-stage.spec.md) — 헬스체크와 품질 게이트
- [infra-observe-stage.spec.md](../../docs/specs/infra-engine/infra-observe-stage.spec.md) — deploy/health 관측
- [infra-providers.spec.md](../../docs/specs/infra-engine/infra-providers.spec.md) — provider 추상화
- [infra-adapters.spec.md](../../docs/specs/infra-engine/infra-adapters.spec.md) — qa-sdk 서비스 연동 포트
- [infra-service-operations.md](../../docs/specs/infra-engine/infra-service-operations.md) — 운영 명령 사용 흐름

## 패키지 역할

- Config → Provision → Register → Verify → Observe 5단계 배포 파이프라인을 실행한다.
- `registry-service`, `definition-service`, `gate-service`, `ingest-server`와의 연동을 adapter로 캡슐화한다.
- CLI 표면과 라이브러리 표면을 같은 패키지에서 제공한다.
- `infra authz graph`로 Nginx/Zitadel proxy config를 authorization ontology graph로 투영한다.

## 코드 진입점

- `src/index.ts` — 라이브러리 export 진입점
- `src/core/pipeline.ts` — 파이프라인 실행기
- `src/config/*` — ConfigStage와 설정 bridge
- `src/stages/*` — stage 구현
- `src/providers/*` — cloudflare/aws/gcp/railway/vultr/local provider
- `src/adapters/*` — registry/gate/definition/ingest/coordinate/service-profile 연동
- `src/cli/index.ts` — `infra` CLI 트리
- `src/cli/cmd-authz.ts` — authorization topology graph 생성 명령

## 실행

```bash
pnpm --filter infra-engine build
pnpm --filter infra-engine test
pnpm --filter infra-engine infra --help
```

패키지 로컬 `docs/`는 보조 문서다. 구현 목표와 변경 영향은 중앙 spec을 먼저 갱신한 뒤 이 패키지 코드를 따라가는 순서로 작업한다.
