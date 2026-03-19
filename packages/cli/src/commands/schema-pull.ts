import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface SchemaPullOptions {
  registry: string;
  output: string;
  snapshotId?: string;
}

/**
 * Registry 서버에서 SchemaSnapshot을 가져와 로컬 JSON으로 저장.
 * GET /schema/export?versionId={snapshotId}
 */
export async function schemaPull(opts: SchemaPullOptions): Promise<void> {
  const url = new URL("/schema/export", opts.registry);
  if (opts.snapshotId) {
    url.searchParams.set("versionId", opts.snapshotId);
  }

  console.log(`Pulling schema from ${url.toString()} ...`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registry 응답 오류 (${res.status}): ${body}`);
  }

  const snapshot = await res.json();
  const id = snapshot.id ?? "active";

  await mkdir(opts.output, { recursive: true });
  const outPath = join(opts.output, `${id}.json`);
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log(`Saved → ${outPath}`);
}
