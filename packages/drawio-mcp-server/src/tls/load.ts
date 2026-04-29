import { existsSync, readFileSync } from "node:fs";

export interface ManualMaterial {
  readonly cert: string;
  readonly key: string;
}

export function loadManualMaterial(args: {
  certPath: string;
  keyPath: string;
}): ManualMaterial {
  if (!existsSync(args.certPath)) {
    throw new Error(`TLS cert file not found: ${args.certPath}`);
  }
  if (!existsSync(args.keyPath)) {
    throw new Error(`TLS key file not found: ${args.keyPath}`);
  }

  const cert = readFileSync(args.certPath, "utf8");
  const key = readFileSync(args.keyPath, "utf8");

  if (!cert.includes("BEGIN CERTIFICATE")) {
    throw new Error(
      `TLS cert at ${args.certPath} is not PEM-encoded (missing BEGIN CERTIFICATE)`,
    );
  }
  if (!key.includes("PRIVATE KEY")) {
    throw new Error(
      `TLS key at ${args.keyPath} is not PEM-encoded (missing PRIVATE KEY)`,
    );
  }

  return { cert, key };
}
