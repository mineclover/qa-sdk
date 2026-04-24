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
- `infra authz graph`로 Nginx/Zitadel proxy config와 route별 Cerbos policy map을 authorization ontology graph로 투영한다.

## CLI 사용 기준

`infra-engine`는 **운영/소비자 CLI**다.

- 배포/검증/관측/이력/Fleet 상태: `infra ...`
- 환경 공급(.env/TS 연결 코드/compose override): `infra-env ...`가 기본 surface

즉:

```bash
# 운영/배포
pnpm --filter infra-engine infra deploy ingest-server dev
pnpm --filter infra-engine infra status dev

# 환경 공급
pnpm --filter infra-env-kit build
pnpm --filter infra-env-kit cli env ingest-server dev
pnpm --filter infra-env-kit cli ts dev
pnpm --filter infra-env-kit cli compose dev
```

`infra export env|ts|compose`는 호환성 때문에 유지되는 legacy consumer surface다. 신규 문서, 예제, 운영 스크립트는 `infra-env` 기준으로 작성하는 것이 원칙이다.

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
pnpm --filter infra-engine infra authz graph --nginx nginx-zitadel.conf --policy-map /tmp/qa-authz-policy-map.json
```

패키지 로컬 `docs/`는 보조 문서다. 구현 목표와 변경 영향은 중앙 spec을 먼저 갱신한 뒤 이 패키지 코드를 따라가는 순서로 작업한다.
