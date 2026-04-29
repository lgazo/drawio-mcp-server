import { homedir, platform as osPlatform } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import {
  generateCa,
  generateLeaf,
  readMeta,
  writeMaterial,
  type CertMaterial,
} from "./generate.js";
import { caInstallHint } from "./install-hint.js";
import { evaluateMaterial } from "./expiry.js";
import { loadManualMaterial } from "./load.js";
import { resolveTlsDir, tlsFilePaths } from "./paths.js";
import { buildSanList, sanHash } from "./san.js";
import forge from "node-forge";

export interface ResolveTlsConfig {
  readonly tlsEnabled: boolean;
  readonly tlsAuto?: boolean;
  readonly tlsCert?: string;
  readonly tlsKey?: string;
  readonly tlsDir?: string;
  readonly host?: string;
}

export interface ResolvedTlsMaterial {
  readonly cert: string;
  readonly key: string;
  readonly caPath?: string;
}

export type TlsLog = (msg: string) => void;

export function resolveTlsMaterial(args: {
  config: ResolveTlsConfig;
  log: TlsLog;
  now?: Date;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
}): ResolvedTlsMaterial | null {
  const { config } = args;
  if (!config.tlsEnabled) return null;

  const hasManual = Boolean(config.tlsCert || config.tlsKey);
  const hasAuto = Boolean(config.tlsAuto);

  if (hasManual && hasAuto) {
    throw new Error(
      "Cannot combine --tls-auto with --tls-cert/--tls-key. Pick one mode.",
    );
  }
  if (!hasManual && !hasAuto) {
    throw new Error(
      "--tls requires either --tls-auto or --tls-cert/--tls-key",
    );
  }

  if (hasManual) {
    if (!config.tlsCert || !config.tlsKey) {
      throw new Error("--tls-cert and --tls-key must both be provided");
    }
    const m = loadManualMaterial({
      certPath: config.tlsCert,
      keyPath: config.tlsKey,
    });
    return { cert: m.cert, key: m.key, caPath: undefined };
  }

  // Auto mode
  const now = args.now ?? new Date();
  const platform = args.platform ?? osPlatform();
  const env = args.env ?? process.env;
  const home = args.home ?? homedir();

  const dir = resolveTlsDir({
    override: config.tlsDir,
    platform,
    env,
    home,
  });
  const paths = tlsFilePaths(dir);
  const sanList = buildSanList(config.host);
  const currentSanHash = sanHash(sanList);

  const meta = readMeta(paths);
  const state = evaluateMaterial({ meta, currentSanHash, now });

  if (state === "valid") {
    return {
      cert: readFileSync(paths.serverCert, "utf8"),
      key: readFileSync(paths.serverKey, "utf8"),
      caPath: paths.caCert,
    };
  }

  let ca: CertMaterial;
  if (state === "san-drift" || state === "leaf-expired") {
    // CA still valid — keep it, regen leaf only
    ca = loadCaMaterialFromDisk(paths);
  } else {
    // missing or ca-expired — full regen
    ca = generateCa({ now });
  }

  const leaf = generateLeaf({ ca, sanList, now });
  writeMaterial({ paths, ca, leaf, sanHash: currentSanHash, generatedAt: now });

  if (state !== "san-drift" && state !== "leaf-expired") {
    args.log(
      `\n${caInstallHint({ platform, caPath: paths.caCert })}\n`,
    );
  } else {
    args.log(
      `Renewed TLS leaf certificate (state: ${state}). CA at ${paths.caCert} unchanged.`,
    );
  }

  return {
    cert: leaf.certPem,
    key: leaf.keyPem,
    caPath: paths.caCert,
  };
}

function loadCaMaterialFromDisk(
  paths: ReturnType<typeof tlsFilePaths>,
): CertMaterial {
  if (!existsSync(paths.caCert) || !existsSync(paths.caKey)) {
    throw new Error(
      `TLS material directory ${paths.caCert} is in an inconsistent state. Delete it and restart.`,
    );
  }
  const certPem = readFileSync(paths.caCert, "utf8");
  const keyPem = readFileSync(paths.caKey, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;
  return {
    certPem,
    keyPem,
    cert,
    keys: { privateKey, publicKey: cert.publicKey as forge.pki.rsa.PublicKey },
  };
}
