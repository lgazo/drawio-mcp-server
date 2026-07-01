import type { CSSProperties } from "react";

type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

const BASE_STYLE: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 4,
  marginBottom: 12,
  fontSize: 12,
  lineHeight: 1.4,
};

const VARIANTS = {
  error: { background: "#f8d7da", color: "#842029", border: "1px solid #f5c2c7" },
  warning: { background: "#fff3cd", color: "#664d03", border: "1px solid #ffecb5" },
  info: { background: "#e9ecef", color: "#495057", border: "1px solid #ced4da" },
} as const;

export function CompatBanner({ state }: { state: CompatState }) {
  if (state.kind === "ok" || state.kind === "unknown") return null;

  if (state.kind === "below-floor") {
    return (
      <div
        role="alert"
        style={{ ...BASE_STYLE, ...VARIANTS.error }}
        data-variant="error"
      >
        <strong>drawio v{state.version}</strong> predates the supported floor
        v{state.floor}. MCP tools that need v{state.floor}+ will return errors.
        Reload drawio with cache cleared, or upgrade your self-hosted drawio.
      </div>
    );
  }

  if (state.kind === "above-window") {
    return (
      <div
        role="alert"
        style={{ ...BASE_STYLE, ...VARIANTS.warning }}
        data-variant="warning"
      >
        <strong>drawio v{state.version}</strong> is newer than the tested window
        (last tested min: v{state.lastSupportedMin}). Tools run on the closest
        impl; please report issues.
      </div>
    );
  }

  return (
    <div
      role="status"
      style={{ ...BASE_STYLE, ...VARIANTS.info }}
      data-variant="info"
    >
      Cannot detect drawio version (<code>{state.reason}</code>).
    </div>
  );
}
