// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// commands/secrets-manager.ts — 인프라 시크릿 자동 관리
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const SECRETS_FILE = resolve(homedir(), '.qa-sdk', 'infra-secrets.json');

export interface InfraSecrets {
  zitadelMasterkey: string; // 32 bytes
  minioRootUser: string;
  minioRootPassword: string;
  postgresUser: string;
  postgresPassword: string;
  zitadelAdminPassword: string;
  /** 생성 시각 */
  createdAt: string;
  /** 마지막 로테이션 */
  rotatedAt?: string;
}

/** 안전한 랜덤 문자열 생성 (alphanumeric) */
function generateSecret(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

/** 32바이트 마스터키 생성 (ASCII printable) */
function generateMasterkey(): string {
  return randomBytes(24).toString('base64').slice(0, 32);
}

/** secrets 로드 (없으면 null) */
export async function loadSecrets(): Promise<InfraSecrets | null> {
  try {
    return JSON.parse(await readFile(SECRETS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/** secrets 저장 */
export async function saveSecrets(secrets: InfraSecrets): Promise<void> {
  await mkdir(resolve(homedir(), '.qa-sdk'), { recursive: true });
  const tmp = SECRETS_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  await rename(tmp, SECRETS_FILE);
}

/** secrets 초기화 (없으면 생성, 있으면 반환) */
export async function ensureSecrets(): Promise<InfraSecrets> {
  const existing = await loadSecrets();
  if (existing) return existing;

  const secrets: InfraSecrets = {
    zitadelMasterkey: generateMasterkey(),
    minioRootUser: 'minioadmin',
    minioRootPassword: generateSecret(24),
    postgresUser: 'postgres',
    postgresPassword: generateSecret(24),
    zitadelAdminPassword: generateSecret(16) + '!A1', // Zitadel requires complexity
    createdAt: new Date().toISOString(),
  };

  await saveSecrets(secrets);
  console.log('[secrets] 초기 시크릿 생성됨 → ~/.qa-sdk/infra-secrets.json (0600)');
  return secrets;
}

/** secrets 로테이션 (새 값 생성, 이전 값 보존하지 않음) */
export async function rotateSecrets(): Promise<InfraSecrets> {
  const secrets: InfraSecrets = {
    zitadelMasterkey: generateMasterkey(),
    minioRootUser: 'minioadmin',
    minioRootPassword: generateSecret(24),
    postgresUser: 'postgres',
    postgresPassword: generateSecret(24),
    zitadelAdminPassword: generateSecret(16) + '!A1',
    createdAt: new Date().toISOString(),
    rotatedAt: new Date().toISOString(),
  };

  await saveSecrets(secrets);
  console.log('[secrets] 시크릿 로테이션 완료');
  return secrets;
}

/** docker-compose용 .env.docker 생성 */
export async function generateDockerEnv(secrets: InfraSecrets, outputPath: string): Promise<void> {
  const lines = [
    '# 자동 생성 — infra-engine secrets',
    `# 생성: ${secrets.createdAt}${secrets.rotatedAt ? `, 로테이션: ${secrets.rotatedAt}` : ''}`,
    '# 수동 편집 금지 — infra secrets rotate로 갱신',
    '',
    '# MinIO',
    `MINIO_ROOT_USER=${secrets.minioRootUser}`,
    `MINIO_ROOT_PASSWORD=${secrets.minioRootPassword}`,
    '',
    '# Zitadel',
    `ZITADEL_MASTERKEY=${secrets.zitadelMasterkey}`,
    `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD=${secrets.zitadelAdminPassword}`,
    '',
    '# Zitadel DB (PostgreSQL)',
    `POSTGRES_USER=${secrets.postgresUser}`,
    `POSTGRES_PASSWORD=${secrets.postgresPassword}`,
    `ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel`,
    `ZITADEL_DATABASE_POSTGRES_USER_PASSWORD=${secrets.postgresPassword}`,
    `ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME=${secrets.postgresUser}`,
    `ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD=${secrets.postgresPassword}`,
    '',
  ];

  await writeFile(outputPath, lines.join('\n'), { mode: 0o600 });
}
