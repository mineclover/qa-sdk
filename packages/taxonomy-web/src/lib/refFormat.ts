import { parseRef } from "taxonomy-engine";

export function isValidRef(input: string): boolean {
  try {
    parseRef(input);
    return true;
  } catch {
    return false;
  }
}

export function displayRef(input: string): string {
  try {
    const ref = parseRef(input);
    if (ref.kind === "entry") return `${ref.taxonomy}:${ref.axis}.${ref.entry}`;
    if (ref.kind === "axis") return `${ref.taxonomy}:${ref.axis}`;
    if (ref.kind === "taxonomy") return ref.taxonomy;
    return input;
  } catch {
    return input;
  }
}

export function refToCoordTuple(input: string): { taxonomy: string; rest: string } | undefined {
  try {
    const ref = parseRef(input);
    return { taxonomy: ref.taxonomy, rest: JSON.stringify(ref) };
  } catch {
    return undefined;
  }
}
