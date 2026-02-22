export {
  CDN_BASE_URL,
  DEFAULT_CACHE_NAME,
  getCacheDir,
  getAssetRoot,
  assetsExist,
  fetchCdnHtml,
  rewriteAssetUrls,
  injectPlugin,
  prepareCdnHtml,
  getCdnHtml,
  fetchCdnBootstrapJs,
  injectMonkeypatchIntoBootstrap,
  getCdnBootstrapJs,
  getLocalPluginPath,
  getLocalAssetPath,
  isUsingLocalAssets,
  type AssetConfig,
} from "./manager.js";

export {
  getLatestWarUrl,
  downloadFile,
  extractWar,
  cleanupExtractedFiles,
  downloadAndExtractAssets,
  ensureAssets,
} from "./downloader.js";
