export type BumpType = "major" | "minor" | "patch";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(v: string): SemVer {
  const parts = v.split(".");
  if (parts.length !== 3) {
    throw new InvalidVersionError(v);
  }

  const [major, minor, patch] = parts.map(Number);
  if ([major, minor, patch].some((n) => !Number.isInteger(n) || n < 0)) {
    throw new InvalidVersionError(v);
  }

  return { major, minor, patch };
}

export function formatVersion(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function bumpVersion(latest: string | null, bump: BumpType): string {
  if (!latest) return "1.0.0";

  const { major, minor, patch } = parseVersion(latest);

  switch (bump) {
    case "major":
      return formatVersion({ major: major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatVersion({ major, minor: minor + 1, patch: 0 });
    case "patch":
      return formatVersion({ major, minor, patch: patch + 1 });
  }
}

export class InvalidVersionError extends Error {
  constructor(version: string) {
    super(`invalid version format: '${version}'`);
    this.name = "InvalidVersionError";
  }
}
