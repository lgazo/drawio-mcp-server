export type Semver = readonly [number, number, number];

export type VersionRange = {
  readonly min: string;
  readonly maxExclusive: string | null;
};

export type DetectedVersion =
  | { readonly ok: true; readonly raw: string; readonly semver: Semver }
  | {
      readonly ok: false;
      readonly reason: "missing" | "unparseable";
      readonly raw: string | null;
    };

const SEMVER_HEAD = /^(\d+)\.(\d+)\.(\d+)/;

export function parseVersion(raw: string): Semver | null {
  const m = SEMVER_HEAD.exec(raw);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersion(a: Semver, b: Semver): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function isBelowFloor(v: Semver, floor: string): boolean {
  const parsed = parseVersion(floor);
  if (!parsed) return false;
  return compareVersion(v, parsed) < 0;
}

export function isInRange(v: Semver, r: VersionRange): boolean {
  const min = parseVersion(r.min);
  if (!min) return false;
  if (compareVersion(v, min) < 0) return false;
  if (r.maxExclusive === null) return true;
  const max = parseVersion(r.maxExclusive);
  if (!max) return true;
  return compareVersion(v, max) < 0;
}
