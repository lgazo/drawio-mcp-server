import { ExtensionConfig, getConfig } from './config';
import { deduplicatePatterns } from './utils/urlPatternValidator';

// Content script management
const CONTENT_SCRIPT_ID = 'drawio-mcp-content';

// Content script registration type
interface ContentScriptRegistration {
    id: string;
    matches: string[];
    js: string[];
    runAt: 'document_start' | 'document_end' | 'document_idle';
}

// Pure transformation: config → content script registration spec
const createContentScriptSpec = (patterns: string[]): ContentScriptRegistration => ({
    id: CONTENT_SCRIPT_ID,
    matches: patterns,
    js: ['content-scripts/content.js'],
    runAt: 'document_idle'
});

// Effect: Register content script (contains side effect)
const registerContentScript = async (spec: ContentScriptRegistration) => {
    try {
        console.debug("[background] Unregistering existing content scripts...");
        await browser.scripting.unregisterContentScripts();
        console.debug("[background] Registering new content script with patterns:", spec.matches);
        await browser.scripting.registerContentScripts([spec]);
        console.debug("[background] Content script registered successfully");
    } catch (error) {
        console.error("[background] Failed to register content script:", error);
        throw error;
    }
};

// Manage content script registration from config
export const updateContentScriptRegistration = async (config: ExtensionConfig) => {
    try {
        const deduplicatedPatterns = deduplicatePatterns(config.urlPatterns);
        const spec = createContentScriptSpec(deduplicatedPatterns);
        await registerContentScript(spec);
    } catch (error) {
        console.error("[background] Failed to update content script registration:", error);
        // Continue - don't break WebSocket connection for script registration failure
    }
};

// Initialize content script registration on startup
export const initializeContentScripts = async () => {
    try {
        const config = await getConfig();
        await updateContentScriptRegistration(config);
    } catch (error) {
        console.error("[background] Failed to initialize content scripts:", error);
    }
};