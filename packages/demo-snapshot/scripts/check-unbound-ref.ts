#!/usr/bin/env tsx
import { DEMO_CATALOG, getPrefixProfile } from '../src/index.js';

for (const [id, pfx] of Object.entries(DEMO_CATALOG.prefixes)) {
  for (const [label, dim] of Object.entries(pfx.dims)) {
    if (dim.kind === 'prefix_ref') {
      const ver = pfx.versions[pfx.versions.length - 1];
      if (!ver.refEntries?.[label]) {
        const p = getPrefixProfile(DEMO_CATALOG, id);
        const d = p.dims.find((d) => d.label === label);
        console.log(
          `${id}.${label}: refEntries 없음 → entries=${d?.entries}, headroom=${d?.headroom}`,
        );
      }
    }
  }
}
console.log('done');
