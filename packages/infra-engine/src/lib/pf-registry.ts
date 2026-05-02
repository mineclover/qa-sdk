// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const PF_DIR = resolve(homedir(), ".qa-sdk");
const PF_FILE = resolve(PF_DIR, "infra-pf.json");

export type PfEntryKind = "port-forward" | "dev-server";

export interface PfEntry {
  pid?: number;
  localPort: number;
  service: string;
  namespace: string;
  endpoint?: string;
  kind?: PfEntryKind;
  updatedAt?: string;
  note?: string;
}

export async function loadPfMap(): Promise<Record<string, PfEntry>> {
  try {
    return JSON.parse(await readFile(PF_FILE, "utf-8")) as Record<string, PfEntry>;
  } catch {
    return {};
  }
}

export async function savePfMap(map: Record<string, PfEntry>): Promise<void> {
  await mkdir(PF_DIR, { recursive: true });
  const tmp = PF_FILE + ".tmp";
  await writeFile(tmp, JSON.stringify(map, null, 2));
  await rename(tmp, PF_FILE);
}

export async function registerPfEntry(key: string, entry: PfEntry): Promise<void> {
  const map = await loadPfMap();
  map[key] = {
    ...entry,
    kind: entry.kind ?? "dev-server",
    endpoint: entry.endpoint ?? `http://127.0.0.1:${entry.localPort}`,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
  await savePfMap(map);
}

export async function removePfEntry(key: string): Promise<boolean> {
  const map = await loadPfMap();
  if (!map[key]) return false;
  delete map[key];
  await savePfMap(map);
  return true;
}
