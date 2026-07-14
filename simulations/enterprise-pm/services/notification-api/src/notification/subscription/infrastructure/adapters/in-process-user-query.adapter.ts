// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { SubscriptionUserQueryPort } from '../../application/ports/user-query.port.js';

/**
 * 외부 (auth) 도메인 read-model 의 최소 인터페이스 — 구조적 타이핑.
 *
 * sim-auth-api 의 `UserReadModelQuery` 와 시그니처 호환 (findDetail 만 사용).
 * 정적 import 를 피하기 위해 구조적 타이핑을 사용 — notification-api 는
 * sim-auth-api 에 정적 의존하지 않는다 (boundary 보호). 컴포지션 루트
 * (시나리오/통합 환경) 가 실제 인스턴스를 주입한다.
 */
export interface UserReadModelLike {
  findDetail(id: string): Promise<unknown | null>;
}

/**
 * In-process anti-corruption 어댑터.
 *
 * - 단일 프로세스 / in-memory 환경 (시뮬레이션, NestJS Testing) 에서 auth 도메인의
 *   `UserReadModelQuery` 를 직접 주입받아 user 존재를 검증.
 * - read-model 미주입 시 fail-open (true 반환) — 기존 `AlwaysTrueUserQuery` 와
 *   동일한 컨벤션 (auth-api 부재 환경 호환).
 * - 조회 자체에서 throw 가 발생하면 fail-open (true) — gate 부재가 운영을 막지
 *   않도록 (CLAUDE.md "Fail-open: gate check 실패 → 허용 + warning diagnostic").
 */
export class InProcessSubscriptionUserQuery extends SubscriptionUserQueryPort {
  constructor(private readonly readModel?: UserReadModelLike) {
    super();
  }

  async userExists(userId: string): Promise<boolean> {
    if (!this.readModel) return true;
    try {
      const detail = await this.readModel.findDetail(userId);
      return detail !== null && detail !== undefined;
    } catch {
      return true;
    }
  }
}
