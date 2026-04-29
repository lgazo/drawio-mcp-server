export function caInstallHint(args: {
  platform: NodeJS.Platform;
  caPath: string;
}): string {
  const { platform, caPath } = args;

  if (platform === "darwin") {
    return [
      `Install the local CA into the macOS System keychain so browsers trust it:`,
      ``,
      `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caPath}`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  if (platform === "win32") {
    return [
      `Install the local CA into the Windows Trusted Root store (run as Administrator):`,
      ``,
      `  certutil -addstore -f ROOT "${caPath}"`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  if (platform === "linux") {
    return [
      `Install the local CA so the system and browsers trust it.`,
      ``,
      `Debian/Ubuntu:`,
      `  sudo cp ${caPath} /usr/local/share/ca-certificates/drawio-mcp-ca.crt`,
      `  sudo update-ca-certificates`,
      ``,
      `Fedora/RHEL/Arch:`,
      `  sudo cp ${caPath} /etc/pki/ca-trust/source/anchors/drawio-mcp-ca.crt`,
      `  sudo update-ca-trust extract`,
      ``,
      `Firefox uses its own NSS store; import via Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import.`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  return [
    `Install the local CA at ${caPath} into your OS / browser trust store.`,
    `Without this, browsers will reject the self-signed certificate.`,
  ].join("\n");
}
