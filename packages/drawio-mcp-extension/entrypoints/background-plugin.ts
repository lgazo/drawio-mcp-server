import { initializeContentScripts, updateContentScriptRegistration } from '@/contentScript';
import { CONFIG_STORAGE_KEY } from '../config';
import { register_csp } from '@/utils/csp/csp';

export default defineBackground(() => {
  console.log("[background] Extension background worker - minimal mode (URL pattern management only)");
  console.log("Hello background!", { id: browser.runtime.id });

  register_csp(browser);

  // Listen for storage changes to update content scripts when URL patterns change
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' || areaName === 'local') {
      if (changes[CONFIG_STORAGE_KEY]) {
        console.debug("[background] Configuration changed, updating content scripts...");

        try {
          const newConfig = changes[CONFIG_STORAGE_KEY].newValue;
          if (newConfig && newConfig.urlPatterns) {
            await updateContentScriptRegistration(newConfig);
            console.debug("[background] Content scripts re-registered for new URL patterns");
          }
        } catch (error) {
          console.error("[background] Failed to update content script registration:", error);
        }
      }
    }
  });

  initializeContentScripts();

  console.info("[background] Background worker initialized");
});
