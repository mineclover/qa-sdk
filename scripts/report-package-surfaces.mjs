#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SURFACES } from "./package-surfaces.mjs";

const root = resolve(process.cwd());
const managedPackageScope = "packages/*";
const packagesDir = join(root, "packages");
const surfaceManagedPackages = new Map();
const surfaceManagedPackageRows = [];

for (const dir of readdirSync(packagesDir)) {
  const packageJsonPath = join(packagesDir, dir, "package.json");
  if (!existsSync(packageJsonPath)) continue;
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const name = pkg.name ?? dir;
  const row = { dir, name };
  surfaceManagedPackageRows.push(row);
  surfaceManagedPackages.set(name, row);
  surfaceManagedPackages.set(name.replace(/^@[^/]+\//, ""), row);
}

const assignments = new Map();
const missing = [];

for (const surface of SURFACES) {
  for (const pkgName of surface.packages) {
    const pkg = surfaceManagedPackages.get(pkgName);
    if (!pkg) {
      missing.push({ surface: surface.id, pkgName });
      continue;
    }
    const current = assignments.get(pkg.name);
    if (current) {
      current.surfaces.push(surface.id);
    } else {
      assignments.set(pkg.name, {
        name: pkg.name,
        dir: pkg.dir,
        surfaces: [surface.id],
      });
    }
  }
}

const duplicates = [...assignments.values()].filter((assignment) => assignment.surfaces.length > 1);
const unassigned = surfaceManagedPackageRows
  .filter((pkg) => !assignments.has(pkg.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    surfaces: SURFACES,
    managedPackageScope,
    totalSurfaceManagedPackages: surfaceManagedPackageRows.length,
    assignedSurfaceManagedPackages: assignments.size,
    totalWorkspacePackages: surfaceManagedPackageRows.length,
    assignedPackages: assignments.size,
    missing,
    duplicates,
    unassigned,
  }, null, 2));
} else {
  console.log("Package Surface Report");
  console.log(`  surface-managed (${managedPackageScope}) packages assigned: ${assignments.size}/${surfaceManagedPackageRows.length}`);
  for (const surface of SURFACES) {
    console.log(`\n[${surface.id}] ${surface.verdict}`);
    for (const pkgName of surface.packages) {
      const pkg = surfaceManagedPackages.get(pkgName);
      const marker = pkg ? "ok" : "missing";
      console.log(`  ${marker.padEnd(7)} ${pkgName}`);
    }
  }
  if (unassigned.length > 0) {
    console.log("\n[unassigned] surface-managed package needs surface decision");
    for (const pkg of unassigned) {
      console.log(`  missing ${pkg.name}`);
    }
  }
}

if (missing.length > 0 || duplicates.length > 0 || unassigned.length > 0) {
  if (missing.length > 0) {
    console.error("\nMissing packages:");
    for (const item of missing) {
      console.error(`  ${item.surface}: ${item.pkgName}`);
    }
  }
  if (duplicates.length > 0) {
    console.error("\nDuplicate surface assignments:");
    for (const item of duplicates) {
      console.error(`  ${item.name}: ${item.surfaces.join(", ")}`);
    }
  }
  if (unassigned.length > 0) {
    console.error("\nUnassigned surface-managed packages:");
    for (const item of unassigned) {
      console.error(`  ${item.name}`);
    }
  }
  process.exit(1);
}
