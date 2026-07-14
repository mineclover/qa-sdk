#!/usr/bin/env tsx
import { DEMO_CATALOG } from '../src/index.js';
const axes = Object.keys(DEMO_CATALOG.axes).length;
const prefixes = Object.keys(DEMO_CATALOG.prefixes).length;
const tables = Object.keys(DEMO_CATALOG.tables ?? {}).length;
console.log(`axes=${axes} prefixes=${prefixes} tables=${tables}`);
