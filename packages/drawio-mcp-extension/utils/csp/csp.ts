import { WxtBrowser } from "wxt/browser";
import { getConfig } from "../../config";

type DeclarativeRule = NonNullable<
    Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]["addRules"]
>[number];

const DRAWIO_CSP_RULE_ID = 1001;
const WS_RULE_VALUES = "ws://localhost:* wss://localhost:*";
const WS_CSP_RULE_ID_BASE = 1002; // Base ID for dynamic rules
const WS_CSP_HEADER_VALUE = [
    "default-src 'self'",
    "script-src https://www.dropbox.com https://api.trello.com 'self' https://viewer.diagrams.net https://apis.google.com https://*.pusher.com 'sha256-f6cHSTUnCvbQqwa6rKcbWIpgN9dLl0ROfpEKTQUQPr8=' 'sha256-vS/MxlVD7nbY7AnV+0t1Ap338uF7vrcs7y23KjERhKc='",
    `connect-src https://*.dropboxapi.com https://api.trello.com https://3axinmwptbp2engjl5hovms4ta0lbvit.lambda-url.eu-central-1.on.aws 'self' https://*.draw.io https://*.diagrams.net https://*.googleapis.com wss://app.diagrams.net wss://*.pusher.com https://*.pusher.com https://api.github.com https://raw.githubusercontent.com https://gitlab.com https://graph.microsoft.com https://my.microsoftpersonalcontent.com https://*.sharepoint.com https://*.sharepoint.de https://*.1drv.com https://api.onedrive.com https://dl.dropboxusercontent.com https://api.openai.com https://*.google.com https://fonts.gstatic.com https://fonts.googleapis.com ${WS_RULE_VALUES}`,
    "img-src * data: blob:",
    "media-src * data:",
    "font-src * data: about:",
    "frame-src 'self' https://viewer.diagrams.net https://www.draw.io https://*.google.com",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "base-uri 'none'",
    "child-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'self' https://teams.microsoft.com https://*.cloud.microsoft",
].join("; ");

const DRAWIO_CSP_RULE: DeclarativeRule = {
    id: DRAWIO_CSP_RULE_ID,
    priority: 1,
    action: {
        type: "block" as const,
    },
    condition: {
        urlFilter: "https://*/service-worker.js",
        resourceTypes: ["main_frame", "sub_frame", "script"] as const,
    },
};


/**
 * Generate a CSP rule for a specific URL pattern
 */
function createWsCspRule(urlPattern: string, ruleId: number): DeclarativeRule {
    return {
        id: ruleId,
        priority: 2,
        action: {
            type: "modifyHeaders" as const,
            responseHeaders: [
                {
                    header: "Content-Security-Policy",
                    operation: "remove" as const,
                },
                {
                    header: "content-security-policy",
                    operation: "set" as const,
                    value: WS_CSP_HEADER_VALUE,
                },
            ],
        },
        condition: {
            urlFilter: urlPattern,
            resourceTypes: ["main_frame", "sub_frame"] as const,
        },
    };
}

/**
 * Convert URL pattern to urlFilter format
 * Handles patterns like "*://app.diagrams.net/*" -> "https://app.diagrams.net/*" and "http://app.diagrams.net/*"
 */
function patternToUrlFilter(pattern: string): string[] {
    // If pattern starts with *://, we need to create rules for both http and https
    if (pattern.startsWith("*://")) {
        const rest = pattern.slice(4); // Remove "*://"
        return [`https://${rest}`, `http://${rest}`];
    }
    return [pattern];
}

let wsCspRuleApplied = false;
let appliedRuleIds: number[] = [];

async function enableWsCspRule() {
    if (wsCspRuleApplied) return;
    
    // Load config to get URL patterns
    const config = await getConfig();
    const urlPatterns = config.urlPatterns || ["*://app.diagrams.net/*"];
    
    // Create rules for each pattern
    const rulesToAdd: DeclarativeRule[] = [DRAWIO_CSP_RULE];
    appliedRuleIds = [DRAWIO_CSP_RULE_ID];
    
    let currentRuleId = WS_CSP_RULE_ID_BASE;
    for (const pattern of urlPatterns) {
        const urlFilters = patternToUrlFilter(pattern);
        for (const urlFilter of urlFilters) {
            const rule = createWsCspRule(urlFilter, currentRuleId);
            rulesToAdd.push(rule);
            appliedRuleIds.push(currentRuleId);
            currentRuleId++;
        }
    }
    
    await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: appliedRuleIds,
        addRules: rulesToAdd,
    });
    
    console.debug(`enabled ws csp rules for patterns:`, urlPatterns, rulesToAdd);
    wsCspRuleApplied = true;
}

async function disableWsCspRule() {
    if (!wsCspRuleApplied) return;
    await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: appliedRuleIds,
        addRules: [],
    });
    appliedRuleIds = [];
    wsCspRuleApplied = false;
}

const wsRuleConsumers = new Set<number>();

// Bootstrap: Register CSP rules for existing tabs matching configured patterns
(async () => {
    try {
        const config = await getConfig();
        const urlPatterns = config.urlPatterns || ["*://app.diagrams.net/*"];
        
        // Query tabs for each pattern
        for (const pattern of urlPatterns) {
            const tabs = await browser.tabs.query({ url: pattern });
            for (const tab of tabs) {
                if (typeof tab.id === "number") {
                    try {
                        await registerWsRuleConsumer(tab.id);
                    } catch (error) {
                        console.error(
                            "[background] Failed to register CSP rule for existing tab",
                            error,
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error(
            "[background] Failed to bootstrap CSP rule registration",
            error,
        );
    }
})();


async function registerWsRuleConsumer(tabId?: number) {
    if (typeof tabId !== "number") {
        console.warn("[background] Unable to register CSP rule without tabId");
        return;
    }

    wsRuleConsumers.add(tabId);
    if (wsRuleConsumers.size === 1) {
        try {
            await enableWsCspRule();
            console.debug("[background] WebSocket CSP rule enabled");
        } catch (error) {
            console.error(
                "[background] Failed to enable WebSocket CSP rule",
                error,
            );
        }
    }
}

async function unregisterWsRuleConsumer(tabId?: number) {
    if (typeof tabId !== "number") return;
    if (!wsRuleConsumers.delete(tabId)) return;
    if (wsRuleConsumers.size === 0) {
        try {
            await disableWsCspRule();
            console.debug("[background] WebSocket CSP rule disabled");
        } catch (error) {
            console.error(
                "[background] Failed to disable WebSocket CSP rule",
                error,
            );
        }
    }
}

export function register_csp(browser: WxtBrowser) {

    browser.tabs.onRemoved.addListener((tabId) => {
        if (!wsRuleConsumers.has(tabId)) return;
        unregisterWsRuleConsumer(tabId).catch((error) => {
            console.error(
                "[background] Failed to unregister CSP rule consumer on tab removal",
                error,
            );
        });
    });

    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        const url = changeInfo.url ?? tab.url;
        if (!url) return;
        
        // Check if URL matches any configured pattern
        const config = await getConfig();
        const urlPatterns = config.urlPatterns || ["*://app.diagrams.net/*"];
        
        const matchesPattern = urlPatterns.some(pattern => {
            // Convert pattern to regex for matching
            const regexPattern = pattern
                .replace(/\*/g, ".*")
                .replace(/\?/g, ".");
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(url);
        });
        
        if (matchesPattern) {
            console.debug(`[tabs.onUpdated] registering WebSocket CSP for pattern-matched URL: ${url}`);
            try {
                await registerWsRuleConsumer(tabId);
            } catch (error) {
                console.error(
                    "[background] Failed to register CSP rule consumer on tab update",
                    error,
                );
            }
            return;
        }

        // URL doesn't match any pattern, unregister if previously registered
        if (wsRuleConsumers.has(tabId)) {
            unregisterWsRuleConsumer(tabId).catch((error) => {
                console.error(
                    "[background] Failed to unregister CSP rule consumer on tab update",
                    error,
                );
            });
        }
    });

}
