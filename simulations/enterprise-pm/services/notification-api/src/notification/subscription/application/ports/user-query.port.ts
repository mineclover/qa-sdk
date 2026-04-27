// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain query port — user 도메인이 외부 (auth/identity) 에 있을 수 있다.
 *
 * subscription 은 user 의 영속을 소유하지 않고 존재만 확인한다.
 *
 * - 기본 구현은 항상 true 를 반환 (현재 sim-notification-api 환경에서는 user
 *   영속을 가지지 않음). auth-api 가 ready 되면 BFF 또는 anti-corruption 어댑터
 *   가 본 port 의 실제 구현을 주입한다.
 */
export abstract class SubscriptionUserQueryPort {
  abstract userExists(userId: string): Promise<boolean>;
}

export class AlwaysTrueUserQuery extends SubscriptionUserQueryPort {
  async userExists(_userId: string): Promise<boolean> {
    return true;
  }
}
