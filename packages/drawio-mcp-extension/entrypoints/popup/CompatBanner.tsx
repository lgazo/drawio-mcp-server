import type { CSSProperties } from "react";

import { useI18n } from "../../utils/useI18n";

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
  const { t } = useI18n();

  if (state.kind === "ok" || state.kind === "unknown") return null;

  if (state.kind === "below-floor") {
    return (
      <div
        role="alert"
        style={{ ...BASE_STYLE, ...VARIANTS.error }}
        data-variant="error"
      >
        <strong>drawio v{state.version}</strong>{" "}
        {t("compat_below_floor", state.floor, state.floor)}
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
        <strong>drawio v{state.version}</strong>{" "}
        {t("compat_above_window", state.lastSupportedMin)}
      </div>
    );
  }

  return (
    <div
      role="status"
      style={{ ...BASE_STYLE, ...VARIANTS.info }}
      data-variant="info"
    >
      {t("compat_no_version", state.reason)}
    </div>
  );
}

export type { CompatState };