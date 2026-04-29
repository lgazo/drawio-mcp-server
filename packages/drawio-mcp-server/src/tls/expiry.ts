import type { PersistedMeta } from "./generate.js";

export type MaterialState =
  | "missing"
  | "valid"
  | "san-drift"
  | "leaf-expired"
  | "ca-expired";

const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function evaluateMaterial(args: {
  meta: PersistedMeta | null;
  currentSanHash: string;
  now: Date;
}): MaterialState {
  if (!args.meta) return "missing";

  const caExpiresAt = new Date(args.meta.caNotAfter).getTime();
  if (caExpiresAt - args.now.getTime() < RENEWAL_WINDOW_MS) return "ca-expired";

  const leafExpiresAt = new Date(args.meta.serverNotAfter).getTime();
  if (leafExpiresAt - args.now.getTime() < RENEWAL_WINDOW_MS)
    return "leaf-expired";

  if (args.meta.sanHash !== args.currentSanHash) return "san-drift";

  return "valid";
}
