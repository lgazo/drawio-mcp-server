import cachedir from "cachedir";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CDN_BASE_URL = "https://embed.diagrams.net";
export const DEFAULT_CACHE_NAME = "drawio-mcp-server";

export interface AssetConfig {
  readonly assetSource: "cdn" | "download";
  readonly assetPath?: string;
}

export function getCacheDir(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  const dir = cachedir(DEFAULT_CACHE_NAME);
  if (!dir) {
    throw new Error("Could not determine cache directory. Use --asset-path to specify one.");
  }
  return dir;
}

export function getAssetRoot(config: AssetConfig): string {
  const cacheDir = getCacheDir(config.assetPath);
  return join(cacheDir, "webapp");
}

export function assetsExist(config: AssetConfig): boolean {
  const assetRoot = getAssetRoot(config);
  const indexPath = join(assetRoot, "index.html");
  return existsSync(indexPath);
}

export async function fetchCdnHtml(): Promise<string> {
  const response = await fetch(`${CDN_BASE_URL}/index.html`);
  if (!response.ok) {
    throw new Error(`Failed to fetch CDN HTML: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function rewriteAssetUrls(html: string): string {
  const cdnBase = CDN_BASE_URL;
  const editorPath = "/";

  return html
    .replace(/href="styles\//g, `href="${cdnBase}/styles/`)
    .replace(/href="images\//g, `href="${cdnBase}/images/`)
    .replace(/href="img\//g, `href="${cdnBase}/img/`)
    .replace(/href="favicon.ico"/g, `href="${cdnBase}/favicon.ico"`)
    // Don't rewrite js/bootstrap.js - we serve it locally with monkeypatch
    .replace(/src="js\/bootstrap.js"/g, `src="${editorPath}/js/bootstrap.js"`)
    // Rewrite other JS to CDN
    .replace(/src="js\//g, `src="${cdnBase}/js/`)
    .replace(/src="images\//g, `src="${cdnBase}/images/"`)
    .replace(/src="img\//g, `src="${cdnBase}/img/"`);
}

export function getMxscriptMonkeypatch(cdnBase: string): string {
  return `
(function() {
  var originalMxscript = window.mxscript;
  window.mxscript = function(src, onLoad, id, dataAppKey, noWrite, onError) {
    if (src && !src.startsWith('http') && !src.startsWith('/')) {
      src = '${cdnBase}/' + src;
    }
    return originalMxscript.call(this, src, onLoad, id, dataAppKey, noWrite, onError);
  };

  var originalMxinclude = window.mxinclude;
  window.mxinclude = function(src) {
    if (src && !src.startsWith('http') && !src.startsWith('/')) {
      src = '${cdnBase}/' + src;
    }
    return originalMxinclude.call(this, src);
  };
})();
`;
}

export function injectPlugin(html: string): string {
  const editorPath = "/";
  const pluginScript = `<script src="${editorPath}/js/mcp-plugin.js"></script>`;

  if (html.includes("mcp-plugin.js")) {
    return html;
  }

  // Plugin injected at end (monkeypatch is in bootstrap.js)
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pluginScript}</body>`);
  }

  return html + pluginScript;
}

export function prepareCdnHtml(html: string): string {
  const rewritten = rewriteAssetUrls(html);
  return injectPlugin(rewritten);
}

let cachedCdnHtml: string | null = null;

export async function getCdnHtml(forceRefresh = false): Promise<string> {
  if (cachedCdnHtml && !forceRefresh) {
    return cachedCdnHtml;
  }

  const html = await fetchCdnHtml();
  cachedCdnHtml = prepareCdnHtml(html);
  return cachedCdnHtml;
}

export function getLocalPluginPath(): string {
  return join(__dirname, "..", "plugin", "mcp-plugin.js");
}

export function getLocalAssetPath(config: AssetConfig): string {
  return join(__dirname, "..", "assets", "drawio", "webapp");
}

export function isUsingLocalAssets(config: AssetConfig): boolean {
  if (config.assetSource === "download") {
    return assetsExist(config);
  }

  const localPath = getLocalAssetPath(config);
  const indexPath = join(localPath, "index.html");
  return existsSync(indexPath);
}

export async function fetchCdnBootstrapJs(): Promise<string> {
  const response = await fetch(`${CDN_BASE_URL}/js/bootstrap.js`);
  if (!response.ok) {
    throw new Error(`Failed to fetch bootstrap.js: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function injectMonkeypatchIntoBootstrap(js: string): string {
  const monkeypatch = getMxscriptMonkeypatch(CDN_BASE_URL);
  return monkeypatch + "\n" + js;
}

let cachedBootstrapJs: string | null = null;

export async function getCdnBootstrapJs(forceRefresh = false): Promise<string> {
  if (cachedBootstrapJs && !forceRefresh) {
    return cachedBootstrapJs;
  }

  const js = await fetchCdnBootstrapJs();
  cachedBootstrapJs = injectMonkeypatchIntoBootstrap(js);
  return cachedBootstrapJs;
}
