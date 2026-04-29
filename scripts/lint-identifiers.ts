#!/usr/bin/env tsx
/**
 * sim:lint:identifiers — 시뮬 영역에서 식별자 grammar 위반을 정적 검출.
 * 본 step의 1차본은 다음 위반을 잡는다:
 *  (1) docker-compose.sim.yaml의 image: 가 grammar #3 image tag 정규식을 위반
 *  (2) docker-compose.sim.yaml에 host.docker.internal alias 잔존
 *  (3) compose label 키가 grammar #9 label key 정규식 위반
 *
 * 추가 검사(소스 코드의 template literal 합성 등)는 본 단계 이후로 분리.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { glob } from "tinyglobby";

const ROOT = resolve(__dirname, "..");
const errors: string[] = [];

const IMAGE_TAG_RE = /^([a-z][a-z0-9-]+)\/([a-z0-9-]+):(v[1-9][0-9]*(?:-(candidate|retired))?|latest)$/;
const LABEL_KEY_RE = /^sim\.[a-z][a-z0-9-]{0,30}$/;

async function main(): Promise<void> {
  const composeFiles = await glob(["simulations/enterprise-pm/docker-compose*.y*ml"], {
    cwd: ROOT,
    absolute: true,
  });

  for (const file of composeFiles) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (line.includes("host.docker.internal") && !line.includes("extra_hosts")) {
        errors.push(`${file}:${i + 1} host.docker.internal 잔존 (extra_hosts 외)`);
      }
      const imageMatch = line.match(/^\s*image:\s*(\S+)/);
      if (imageMatch && !IMAGE_TAG_RE.test(imageMatch[1])) {
        errors.push(`${file}:${i + 1} image tag grammar 위반: ${imageMatch[1]}`);
      }
      const labelMatch = line.match(/^\s+([a-zA-Z][a-zA-Z0-9.-]*):\s*\S+$/);
      if (labelMatch && /^sim\./.test(labelMatch[1]) && !LABEL_KEY_RE.test(labelMatch[1])) {
        errors.push(`${file}:${i + 1} label key grammar 위반: ${labelMatch[1]}`);
      }
    });
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log("identifier grammar lint OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
