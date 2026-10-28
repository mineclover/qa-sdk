# Cross-Domain Query Ports & Anti-Corruption Seam

> 한 슬라이스/서비스가 **다른 슬라이스 또는 다른 서비스의 read** 를 필요로 할 때, 깊은 import 대신 query port + adapter 로 분리한다. 슬라이스 boundary 를 침범하지 않는 anti-corruption seam.

## 1. 언제 쓰는가

- subscription 슬라이스가 user 존재를 검증해야 하지만 user 영속을 소유하지 않을 때
- bitmap 슬라이스가 user/role/role-assignment 의 read-model 을 합성할 때
- BFF 가 다른 도메인의 read-model 을 비즈니스 결정 없이 단순 합성할 때

쓰면 안 되는 경우:
- 같은 슬라이스 내부의 read — port 분리 불필요
- 비즈니스 결정이 cross-domain 에 걸쳐 있는 경우 — saga / 도메인 이벤트로 처리

## 2. 패턴 위치

```
services/<svc>/src/<domain>/<slice>/
  application/
    ports/
      <dependency>-query.port.ts        # 추상 (interface/abstract class) + AlwaysTrue 기본 구현
  infrastructure/
    adapters/
      in-process-<dependency>-query.adapter.ts   # 단일 프로세스 (구조적 타이핑으로 정적 의존 회피)
      http-<dependency>-query.adapter.ts          # cross-process (auth-api → HTTP)
```

## 3. Port 추상 (실증)

`simulations/enterprise-pm/services/notification-api/src/notification/subscription/application/ports/user-query.port.ts`

```ts
export abstract class SubscriptionUserQueryPort {
  abstract userExists(userId: string): Promise<boolean>;
}

export class AlwaysTrueUserQuery extends SubscriptionUserQueryPort {
  async userExists(_userId: string): Promise<boolean> {
    return true;
  }
}
```

핵심:
- 추상 클래스 + 항상 true 를 반환하는 기본 구현. auth-api 부재 환경에서도 슬라이스가 부팅 가능.
- 슬라이스는 **존재만 확인** — user 영속을 소유하지 않음.

## 4. Adapter 2종 (production)

### 4.1 In-Process — 구조적 타이핑

`infrastructure/adapters/in-process-user-query.adapter.ts`

```ts
// 구조적 타이핑 — sim-auth-api 에 정적 의존하지 않음.
export interface UserReadModelLike {
  findDetail(id: string): Promise<unknown | null>;
}

export class InProcessSubscriptionUserQuery extends SubscriptionUserQueryPort {
  constructor(private readonly readModel?: UserReadModelLike) { super(); }
  // ... readModel 미주입 시 fail-open (true 반환)
}
```

핵심:
- import 가 아니라 **구조적 타이핑** — boundary 보호.
- read-model 미주입 시 fail-open — `AlwaysTrueUserQuery` 와 동일 컨벤션.
- 조회 throw 시 fail-open (CLAUDE.md "Fail-open").

### 4.2 HTTP — Cross-Process

`infrastructure/adapters/http-user-query.adapter.ts`

```ts
export class HttpSubscriptionUserQuery extends SubscriptionUserQueryPort {
  // GET /users/:id — 200 → exists, 404 → not exists.
  // AbortSignal.timeout(5000) 으로 외부 fetch 보호 (CLAUDE.md "네트워크 호출").
  // timeout / 5xx / 네트워크 에러 → fail-open (true).
}
```

핵심:
- `AbortSignal.timeout` 필수 (CLAUDE.md 컨벤션).
- 5xx / 네트워크 에러 → fail-open (gate 부재가 파이프라인 차단 금지).
- 운영 환경 마이크로서비스 경계를 더 잘 표현.

## 5. Composition Root 책임

서비스 부팅부 (또는 NestJS 모듈 / 시나리오 환경) 가 어느 어댑터를 주입할지 결정:

| 환경 | 주입 |
|---|---|
| 시뮬레이션 단일 프로세스 | `InProcessSubscriptionUserQuery(authReadModel)` |
| 운영 마이크로서비스 | `HttpSubscriptionUserQuery({ authApiBaseUrl })` |
| auth-api 부재 / 테스트 | `AlwaysTrueUserQuery` (기본) |

## 6. Validator 룰

`bounded-context-uses-contracts` (commit `155e448e` 이후 AST 기반):
- 다른 도메인의 deep import (`/<other-domain>/domain/...`, `/<other-domain>/infrastructure/...`) 금지.
- 통과 경로: query port (구조적 타이핑) + adapter, 또는 published contracts / projections.

## 7. 안티 패턴

| 패턴 | 왜 위험한가 | 대응 |
|---|---|---|
| 다른 슬라이스의 entity / repository 직접 import | boundary 무력화, 트랜잭션 경계 흐림 | query port + 구조적 타이핑 어댑터 |
| Cross-domain port 가 throw 만 강제 | gate 부재가 운영 파이프라인 차단 | fail-open + warning 로깅 |
| HTTP adapter 에 timeout 없음 | 외부 서비스 지연이 caller 전파 | `AbortSignal.timeout(5_000)` 필수 |
| Composition root 외부에서 어댑터 인스턴스화 | 슬라이스 내부에 환경 결정 | 부팅부 / 시나리오에서만 주입 |

## 8. 참조

- `simulations/enterprise-pm/services/notification-api/src/notification/subscription/application/ports/user-query.port.ts`
- `simulations/enterprise-pm/services/notification-api/src/notification/subscription/infrastructure/adapters/{in-process,http}-user-query.adapter.ts`
- `docs/plan/simulations-domain-slice-migration/lessons-learned.md` §3 — C10/C11 commits (`9faa04a1`)
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/02-command-query-contracts.md` — 외부 query 계약 일반론
