import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { scanAndClassify } from '../packages/package-classifier/src/pkg-classifier.js';

async function extractBoundaryTags(pkgDir: string): Promise<{ boundary?: string; doc?: string }> {
  const indexPaths = [join(pkgDir, 'src/index.ts'), join(pkgDir, 'src/main.ts')];

  for (const path of indexPaths) {
    try {
      const content = await readFile(path, 'utf-8');
      const boundary = content.match(/@def\.boundary\s+([^\s\n]+)/)?.[1];
      const doc = content.match(/@def\.doc\s+([^\s\n]+)/)?.[1];
      if (boundary || doc) return { boundary, doc };
    } catch {
      // ignore
    }
  }
  return {};
}

function comparableManifest(value: { generatedAt?: string }): string {
  return JSON.stringify({ ...value, generatedAt: null });
}

async function main() {
  const root = resolve(process.cwd());
  const pkgs = await scanAndClassify(root);
  const manifest: any = {
    generatedAt: new Date().toISOString(),
    layers: {
      consumer: [],
      bridge: [],
      logic: [],
      kernel: [],
      foundation: [],
    },
  };

  for (const pkg of pkgs) {
    const tags = await extractBoundaryTags(join(root, 'packages', pkg.dir));
    const entry = {
      id: pkg.displayName,
      name: pkg.name,
      version: pkg.version,
      tier: pkg.tier,
      boundary: tags.boundary ?? 'unknown',
      docRef: tags.doc ?? 'none',
      internalDeps: pkg.deps,
    };

    if (manifest.layers[pkg.tier]) {
      manifest.layers[pkg.tier].push(entry);
    } else {
      // Default to logic if tier not mapped
      if (!manifest.layers.logic) manifest.layers.logic = [];
      manifest.layers.logic.push(entry);
    }
  }

  const outputPath = join(root, 'docs/generated-api-manifest.json');
  try {
    const previous = JSON.parse(await readFile(outputPath, 'utf-8')) as { generatedAt?: string };
    if (previous.generatedAt && comparableManifest(previous) === comparableManifest(manifest)) {
      // 내용이 같으면 timestamp만 바뀌어 dirty가 생기지 않도록 기존 generatedAt을 보존한다.
      manifest.generatedAt = previous.generatedAt;
    }
  } catch {
    // no previous manifest
  }

  await writeFile(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ API Reference Manifest generated at: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
