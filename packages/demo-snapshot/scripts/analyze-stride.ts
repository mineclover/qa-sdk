#!/usr/bin/env tsx
import { DEMO_CATALOG } from '../src/index.js';

const targets = ['cli_tracking', 'test_coverage'];

for (const pfxId of targets) {
  const pfx = (DEMO_CATALOG.prefixes as any)[pfxId];
  const labels: string[] = pfx.labels.filter((l: string) => pfx.dims[l].kind !== 'table_ref');

  const caps = labels.map((l: string) => {
    const d = pfx.dims[l];
    if (d.kind === 'axis') {
      const axis = (DEMO_CATALOG.axes as any)[d.axisId];
      const ver = pfx.versions[pfx.versions.length - 1];
      const axisVer =
        ver.axisVersions[l] ?? ver.axisVersions[d.axisId] ?? Object.keys(axis.versions).pop();
      const snap = axis.versions[axisVer];
      return {
        label: l,
        axisId: d.axisId,
        entries: snap.entries.length,
        capacity: snap.capacity ?? snap.entries.length,
      };
    }
    return { label: l, axisId: '—', entries: 0, capacity: 0 };
  });

  // stride (right-to-left)
  const strides = new Array(caps.length).fill(1);
  for (let i = caps.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * caps[i + 1].capacity;
  }

  const totalSpace = caps[0].capacity * strides[0];
  const usedCombos = caps.reduce((p: number, c: any) => p * c.entries, 1);

  console.log(`══ ${pfxId} stride 분석 ══\n`);
  console.log('dim              entries  capacity  headroom  stride      최대기여');
  console.log('───────────────  ───────  ────────  ────────  ──────────  ──────────');
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    const maxContrib = (c.entries - 1) * strides[i];
    const hr = c.capacity - c.entries;
    const hrWarn = hr < c.entries ? ' ⚠' : '';
    console.log(
      `${c.label.padEnd(15)}  ${String(c.entries).padStart(7)}  ${String(c.capacity).padStart(8)}  ${String(hr).padStart(6)}${hrWarn.padEnd(2)}  ${String(strides[i]).padStart(10)}  ${String(maxContrib).padStart(10)}`,
    );
  }
  console.log();
  console.log(`전체 주소 공간: ${totalSpace.toLocaleString()}`);
  console.log(
    `실제 조합:     ${usedCombos.toLocaleString()} (${((usedCombos / totalSpace) * 100).toFixed(2)}%)`,
  );
  console.log(`합전략 이벤트:  ${caps.reduce((s: number, c: any) => s + c.entries, 0)}건`);

  // capacity 규칙 검사
  console.log(`\n── capacity 규칙 (nextPowerOf2(entries×2)) ──\n`);
  for (const c of caps) {
    const required = Math.pow(2, Math.ceil(Math.log2(c.entries * 2)));
    const ok = c.capacity >= required;
    console.log(
      `  ${c.label}: ${c.entries}개 → 최소 ${required} 필요, 현재 ${c.capacity} ${ok ? '✓' : '✗ 부족!'}`,
    );
  }
  console.log('\n');
}
