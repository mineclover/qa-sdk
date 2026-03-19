import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { SchemaSnapshot } from "../lib/types.js";
import { readSnapshot, readSnapshots, writeOutput } from "../lib/snapshot-io.js";
import { generateProto, type ProtoGenOptions } from "../generators/proto.js";
import { generateTypescript } from "../generators/typescript.js";

export type CodegenFormat = "proto" | "ts";

export interface CodegenOptions {
  formats: CodegenFormat[];
  input: string;
  output: string;
  packageName?: string;
}

/**
 * SchemaSnapshot JSON에서 protobuf / TypeScript 코드 생성.
 * input이 파일이면 단일 스냅샷, 디렉토리면 모든 .json 파일 처리.
 */
export async function codegen(opts: CodegenOptions): Promise<void> {
  const info = await stat(opts.input);
  const snapshots = info.isDirectory()
    ? await readSnapshots(opts.input)
    : [await readSnapshot(opts.input)];

  if (snapshots.length === 0) {
    console.log("입력 경로에 SchemaSnapshot JSON이 없음");
    return;
  }

  let generated = 0;

  for (const snapshot of snapshots) {
    const baseName = snapshot.id;

    for (const format of opts.formats) {
      const { content, ext } = generate(snapshot, format, {
        packageName: opts.packageName,
      });
      const outPath = join(opts.output, `${baseName}${ext}`);
      await writeOutput(outPath, content);
      console.log(`Generated → ${outPath}`);
      generated++;
    }
  }

  console.log(`${generated} file(s) generated`);
}

function generate(
  snapshot: SchemaSnapshot,
  format: CodegenFormat,
  protoOpts: ProtoGenOptions,
): { content: string; ext: string } {
  switch (format) {
    case "proto":
      return { content: generateProto(snapshot, protoOpts), ext: ".proto" };
    case "ts":
      return { content: generateTypescript(snapshot), ext: ".d.ts" };
  }
}
