import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

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
  const client = getClient(url);
  return drizzle(client, { schema });
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
