import { join as joinPosix } from "node:path/posix";
import { join as joinWin32 } from "node:path/win32";
import { join } from "node:path";

export const APP_NAME = "drawio-mcp-server";

export interface ResolveTlsDirArgs {
  override?: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
}

export function resolveTlsDir(args: ResolveTlsDirArgs): string {
  if (args.override && args.override.length > 0) return args.override;

  if (args.platform === "darwin") {
    return joinPosix(
      args.home,
      "Library",
      "Application Support",
      APP_NAME,
      "tls",
    );
  }

  if (args.platform === "win32") {
    const base =
      args.env.LOCALAPPDATA && args.env.LOCALAPPDATA.length > 0
        ? args.env.LOCALAPPDATA
        : joinWin32(args.home, "AppData", "Local");
    return joinWin32(base, APP_NAME, "Data", "tls");
  }

  // Linux + other unix
  const xdg = args.env.XDG_DATA_HOME;
  const base =
    xdg && xdg.length > 0 ? xdg : joinPosix(args.home, ".local", "share");
  return joinPosix(base, APP_NAME, "tls");
}

export interface TlsFilePaths {
  readonly caCert: string;
  readonly caKey: string;
  readonly serverCert: string;
  readonly serverKey: string;
  readonly meta: string;
}

export function tlsFilePaths(dir: string): TlsFilePaths {
  return {
    caCert: join(dir, "ca.crt"),
    caKey: join(dir, "ca.key"),
    serverCert: join(dir, "server.crt"),
    serverKey: join(dir, "server.key"),
    meta: join(dir, "meta.json"),
  };
}
