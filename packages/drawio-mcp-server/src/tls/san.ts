import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type SanEntry =
  | { type: "dns"; value: string }
  | { type: "ip"; value: string };

const LOOPBACK_DEFAULTS: readonly SanEntry[] = [
  { type: "dns", value: "localhost" },
  { type: "ip", value: "127.0.0.1" },
  { type: "ip", value: "::1" },
];

export function buildSanList(host: string | undefined): SanEntry[] {
  const entries: SanEntry[] = [...LOOPBACK_DEFAULTS];
  if (!host || host === "0.0.0.0" || host === "::") return entries;

  const family = isIP(host);
  if (family === 0) return entries;

  const candidate: SanEntry = { type: "ip", value: host };
  const exists = entries.some(
    (e) => e.type === candidate.type && e.value === candidate.value,
  );
  if (!exists) entries.push(candidate);
  return entries;
}

export function sanHash(entries: readonly SanEntry[]): string {
  const canonical = [...entries]
    .map((e) => `${e.type}:${e.value}`)
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
