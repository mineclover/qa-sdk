// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const clients = new Map<string, postgres.Sql>();

export function getClient(url: string) {
  const existingClient = clients.get(url);
  if (existingClient) {
    return existingClient;
  }

  const client = postgres(url);
  clients.set(url, client);
  return client;
}

export function createDb(url: string) {
  return drizzle({ client: getClient(url), schema });
}

export async function closeClient(url: string) {
  const client = clients.get(url);
  if (!client) {
    return;
  }

  clients.delete(url);
  await client.end();
}

export type Db = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Db['transaction']>[0] extends (
  tx: infer Tx,
  ...args: never[]
) => unknown
  ? Tx
  : never;
export type DbExecutor = Db | DbTransaction;

export async function withTransaction<T>(db: Db, fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}
