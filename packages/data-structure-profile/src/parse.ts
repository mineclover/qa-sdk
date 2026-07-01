import { parse } from "yaml";
import type { DataStructureProfile } from "./types.js";

export function parseProfile(yamlText: string): DataStructureProfile {
  const parsed = parse(yamlText) as Partial<DataStructureProfile> | null;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Data Structure Profile YAML must parse to an object.");
  }
  if (!parsed.profile) {
    throw new Error("Data Structure Profile requires profile.");
  }
  if (!parsed.source) {
    throw new Error("Data Structure Profile requires source.");
  }

  return {
    ...parsed,
    profile: parsed.profile,
    version: Number(parsed.version ?? 1),
    source: parsed.source,
    structures: parsed.structures ?? [],
    relationships: parsed.relationships ?? [],
    transforms: parsed.transforms ?? [],
    measurements: parsed.measurements ?? {},
    quality_gates: parsed.quality_gates ?? [],
  };
}
