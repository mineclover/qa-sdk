// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { resolve } from 'node:path';
import { homedir } from 'node:os';

/** 프로필 디렉토리 (~/.qa-sdk) */
export const PROFILE_DIR = resolve(homedir(), '.qa-sdk');

/** Registry 서비스 URL */
export const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3300';

/** Ingest 서비스 URL */
export const INGEST_URL = process.env.INGEST_URL ?? 'http://localhost:3200';

/** Definition 서비스 URL */
export const DEFINITION_URL = process.env.DEFINITION_URL ?? 'http://localhost:3700';
