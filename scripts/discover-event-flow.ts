import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';
import chalk from 'chalk';

/**
 * Event-Driven Dependency Scanner (Refined)
 */

async function main() {
  const isJson = process.argv.includes('--json');
  const root = resolve(process.cwd());
  const categoriesDir = join(root, 'packages/event-catalog/src/categories');

  if (!isJson) console.log(chalk.bold.cyan('\n📡 Event Symbol Connection Discovery\n'));

  // 1. Extract Event Keys from Catalog
  const eventKeys = new Set<string>();
  const catFiles = readdirSync(categoriesDir).filter((f) => f.endsWith('.ts'));

  for (const file of catFiles) {
    const content = readFileSync(join(categoriesDir, file), 'utf-8');
    const matches = content.matchAll(/event_key:\s*['"]([^'"]+)['"]/g);
    for (const m of matches) eventKeys.add(m[1]);
  }
  if (!isJson)
    console.log(`[1] Identified ${eventKeys.size} authoritative event symbols from catalog.`);

  // 2. Scan all packages for symbol usage
  if (!isJson) console.log(`[2] Scanning 108 packages for Signal Flow (Emit vs Listen)...`);

  const packageUsage = new Map<string, { signals: Set<string> }>();
  const packages = readdirSync(join(root, 'packages')).filter((d) => {
    const p = join(root, 'packages', d);
    return statSync(p).isDirectory() && !d.startsWith('.');
  });

  for (const pkg of packages) {
    const pkgPath = join(root, 'packages', pkg);
    const srcDir = join(pkgPath, 'src');
    if (!existsSync(srcDir)) continue;

    const signals = new Set<string>();
    const files = findTsFiles(srcDir);

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');

      for (const key of eventKeys) {
        // Refined heuristic: look for the key as a whole word or in a common pattern
        // Avoid matching partial strings.
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`['"]${escapedKey}['"]`, 'g');

        if (pattern.test(content)) {
          signals.add(key);
        }
      }
    }
    if (signals.size > 0) packageUsage.set(pkg, { signals });
  }

  if (isJson) {
    const report: any = {};
    for (const [pkg, usage] of packageUsage.entries()) {
      report[pkg] = Array.from(usage.signals);
    }
    process.stdout.write(JSON.stringify(report, null, 2));
    return;
  }

  // 3. Report Connectivity
  console.log(`\n[3] Signal Connectivity Map:\n`);

  for (const [pkg, usage] of packageUsage.entries()) {
    console.log(`${chalk.bold.yellow(pkg)}`);
    usage.signals.forEach((key) => {
      const peers: string[] = [];
      for (const [otherPkg, otherUsage] of packageUsage.entries()) {
        if (otherPkg !== pkg && otherUsage.signals.has(key)) peers.push(otherPkg);
      }

      const peerInfo = peers.length > 0 ? ` <-> Linked with: ${peers.join(', ')}` : '';
      console.log(`  🔹 ${key}${chalk.dim(peerInfo)}`);
    });
    console.log('');
  }
}

function findTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      if (basename(file) === 'node_modules' || basename(file) === 'dist') return;
      results = results.concat(findTsFiles(file));
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
      results.push(file);
    }
  });
  return results;
}

main().catch(console.error);
