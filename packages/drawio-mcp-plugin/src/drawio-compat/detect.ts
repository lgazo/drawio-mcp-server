import { parseVersion, type DetectedVersion } from "drawio-mcp-compat";

export function detectDrawioVersion(ui?: unknown): DetectedVersion {
  const raw =
    (globalThis as { EditorUi?: { VERSION?: unknown } }).EditorUi?.VERSION ??
    (ui as { constructor?: { VERSION?: unknown } })?.constructor?.VERSION;
  if (typeof raw !== "string") {
    return { ok: false, reason: "missing", raw: null };
  }
  const semver = parseVersion(raw);
  if (!semver) return { ok: false, reason: "unparseable", raw };
  return { ok: true, raw, semver };
}

let cached: DetectedVersion | null = null;

export function getDetectedDrawioVersion(ui?: unknown): DetectedVersion {
  if (cached !== null) return cached;
  const result = detectDrawioVersion(ui);
  if (result.ok) cached = result;
  return result;
}

export function resetDetectedDrawioVersionCache(): void {
  cached = null;
}
