// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * CredentialStore — email/password 검증 책임 분리.
 *
 * 운영 auth-api는 NoopCredentialStore (항상 false) — main.ts 부팅 시 기본.
 * 테스트/시뮬 시나리오는 TestCredentialStore (in-memory Map) — seedTestData에서 주입.
 *
 * 실제 bcrypt/argon2 구현은 시뮬 스코프 밖 (§Defer). 본 plan은 sim 편의 목적.
 */
export interface CredentialStore {
  verify(email: string, password: string): Promise<boolean>;
}

export class NoopCredentialStore implements CredentialStore {
  async verify(_email: string, _password: string): Promise<boolean> {
    return false;
  }
}

export class TestCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, string>();

  set(email: string, passwordPlain: string): void {
    this.credentials.set(email.toLowerCase(), passwordPlain);
  }

  async verify(email: string, password: string): Promise<boolean> {
    const stored = this.credentials.get(email.toLowerCase());
    if (stored === undefined) return false;
    return stored === password;
  }

  reset(): void {
    this.credentials.clear();
  }
}

/** NestJS DI token. */
export const CREDENTIAL_STORE = Symbol("CREDENTIAL_STORE");
