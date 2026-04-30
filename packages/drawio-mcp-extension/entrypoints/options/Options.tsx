import { useState, useEffect, useMemo } from "react";
import { getConfig, saveConfig, resetConfigToDefaults, isValidExtensionWebSocketUrl, DEFAULT_CONFIG, type ExtensionConfig } from "../../config";
import { validateMV3Pattern, isValidPatternList, deduplicatePatterns, patternsAreEquivalent } from "../../utils/urlPatternValidator";

const DEFAULT_WS_URL = `ws://localhost:${DEFAULT_CONFIG.websocketPort}`;

function Options() {
  const [config, setConfig] = useState<ExtensionConfig>({ websocketPort: DEFAULT_CONFIG.websocketPort, urlPatterns: ["*://app.diagrams.net/*"], injectIntoIframes: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string>('');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [newPatternInput, setNewPatternInput] = useState('');
  const [patternsError, setPatternsError] = useState<string>('');
  const [injectIntoIframes, setInjectIntoIframes] = useState(false);

  useEffect(() => {
    // Load current configuration
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const currentConfig = await getConfig();
      setConfig(currentConfig);
      setUrlInput(currentConfig.websocketUrl ?? '');
      setPatterns(currentConfig.urlPatterns);
      setInjectIntoIframes(currentConfig.injectIntoIframes);
    } catch (error) {
      console.error('Failed to load config:', error);
      setMessage({ type: 'error', text: 'Failed to load current configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl.length > 0 && !isValidExtensionWebSocketUrl(trimmedUrl)) {
      setUrlError('URL must start with ws:// or wss://');
      setMessage({ type: 'error', text: 'Invalid WebSocket URL' });
      return;
    }
    setUrlError('');

    // Validate patterns
    if (!isValidPatternList(patterns)) {
      setMessage({ type: 'error', text: 'Invalid URL patterns detected. Please fix errors and try again.' });
      return;
    }

    setSaving(true);
    try {
      const uniquePatterns = deduplicatePatterns(patterns);
      const newConfig: ExtensionConfig = {
        websocketPort: config.websocketPort,
        urlPatterns: uniquePatterns,
        websocketUrl: trimmedUrl.length > 0 ? trimmedUrl : undefined,
        injectIntoIframes
      };
      await saveConfig(newConfig);
      setConfig(newConfig);
      setPatterns(uniquePatterns);
      setMessage({ type: 'success', text: 'Settings saved successfully! Extension will reload content scripts for new URLs.' });
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await resetConfigToDefaults();
      const defaultConfig = await getConfig(); // Reload from defaults
      setConfig(defaultConfig);
      setUrlInput(defaultConfig.websocketUrl ?? '');
      setUrlError('');
      setPatterns(defaultConfig.urlPatterns);
      setInjectIntoIframes(defaultConfig.injectIntoIframes);
      setMessage({ type: 'success', text: 'Settings reset to defaults! Connection will reconnect automatically.' });
    } catch (error) {
      console.error('Failed to reset config:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  // Pattern management functions
  const addPattern = (patterns: string[], newPattern: string): string[] => {
    return deduplicatePatterns([...patterns, newPattern].filter(p => p.trim()));
  };

  const removePattern = (patterns: string[], index: number): string[] => {
    return patterns.filter((_, i) => i !== index);
  };

  const handleAddPattern = () => {
    if (!newPatternInput.trim()) {
      setPatternsError('URL pattern cannot be empty');
      return;
    }

    const validation = validateMV3Pattern(newPatternInput.trim());
    if (!validation.isValid) {
      setPatternsError(validation.error || 'Invalid URL pattern');
      return;
    }

    setPatterns(prev => addPattern(prev, newPatternInput.trim()));
    setNewPatternInput('');
    setPatternsError('');
  };

  const handleRemovePattern = (index: number) => {
    setPatterns(prev => removePattern(prev, index));
  };

  const handlePatternInputChange = (value: string) => {
    setNewPatternInput(value);
    if (patternsError) setPatternsError('');
  };

  // Validation memos for real-time feedback
  const newPatternValidation = useMemo(() =>
    validateMV3Pattern(newPatternInput.trim()), [newPatternInput]);

  const patternsListValidation = useMemo(() =>
    patterns.map(pattern => ({
      pattern,
      ...validateMV3Pattern(pattern)
    })), [patterns]);

  if (loading) {
    return (
      <div className="options-container">
        <h1>Draw.io MCP Extension - Settings</h1>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <h1>Draw.io MCP Extension - Settings</h1>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card main-settings-card">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* WebSocket Server Configuration */}
          <div className="settings-section">
            <h3>WebSocket Server Configuration</h3>

            <div className="form-group">
              <label htmlFor="url-input">WebSocket URL:</label>
              <input
                id="url-input"
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlError) setUrlError('');
                  if (message) setMessage(null);
                }}
                className="port-input"
                disabled={saving}
                placeholder={DEFAULT_WS_URL}
              />
              <span className="input-hint">
                Leave blank to use the default ({DEFAULT_WS_URL}). Must start with ws:// or wss://.
                Use wss:// when the MCP server sits behind an HTTPS reverse proxy.
              </span>
              {urlError && <span className="error-text">{urlError}</span>}
            </div>
          </div>

          {/* URL Pattern Separator */}
          <div className="section-separator"></div>

          {/* URL Patterns for Content Script Injection */}
          <div className="settings-section">
            <h3>URL Patterns for Content Script Injection</h3>
            <p className="card-description">
              Configure URL patterns where the Draw.io MCP Extension should inject its content scripts.
              These follow Chrome's MV3 match pattern format.
            </p>

            <div className="pattern-input-section">
              <div className="form-group">
                <label htmlFor="pattern-input">Add URL Pattern:</label>
                <div className="pattern-input-group">
                  <input
                    id="pattern-input"
                    type="text"
                    value={newPatternInput}
                    onChange={(e) => handlePatternInputChange(e.target.value)}
                    placeholder="e.g., *://app.diagrams.net/* or https://example.com/*"
                    className={`pattern-input ${newPatternValidation.isValid && newPatternInput.trim() ? 'valid' : !newPatternValidation.isValid && newPatternInput.trim() ? 'invalid' : ''}`}
                    disabled={saving}
                  />
                  <button
                    onClick={handleAddPattern}
                    disabled={!newPatternValidation.isValid || !newPatternInput.trim() || saving}
                    className="add-pattern-button"
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {patternsError && <span className="error-text">{patternsError}</span>}
                {newPatternInput.trim() && !newPatternValidation.isValid && (
                  <span className="error-text">{newPatternValidation.error}</span>
                )}
                {newPatternInput.trim() && newPatternValidation.isValid && (
                  <span className="success-text">Valid MV3 pattern</span>
                )}
              </div>
            </div>

            <div className="patterns-list">
              <h4>Current URL Patterns ({patterns.length})</h4>
              {patterns.length === 0 ? (
                <p className="no-patterns">No URL patterns configured. Add at least one pattern for the extension to work.</p>
              ) : (
                <ul className="pattern-list">
                  {patternsListValidation.map((item, index) => (
                    <li key={index} className={`pattern-item ${item.isValid ? 'valid' : 'invalid'}`}>
                      <span className="pattern-text">{item.pattern}</span>
                      {patternsAreEquivalent(item.pattern, "*://app.diagrams.net/*") && (
                        <span className="default-badge">default</span>
                      )}
                      <button
                        onClick={() => handleRemovePattern(index)}
                        disabled={saving}
                        className="remove-pattern-button"
                        title="Remove pattern"
                        type="button"
                      >
                        ×
                      </button>
                      {!item.isValid && (
                        <div className="pattern-error">{item.error}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pattern-examples">
              <h5>Example Patterns:</h5>
              <ul>
                <li><code>*://app.diagrams.net/*</code> - Default (matches app.diagrams.net)</li>
                <li><code>*://*.diagrams.net/*</code> - Self-hosted on diagrams.net subdomain</li>
                <li><code>https://draw.example.com/*</code> - Custom domain</li>
                <li><code>https://draw.example.com/drawio/*</code> - Specific path</li>
              </ul>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={injectIntoIframes}
                  onChange={(e) => setInjectIntoIframes(e.target.checked)}
                  disabled={saving}
                />
                {' '}Inject into iframes (support embedded Draw.io)
              </label>
              <span className="input-hint">
                Enable when Draw.io is embedded as an iframe on a host page
                (e.g. Confluence, wiki, custom app). Matches still follow the
                URL patterns above &mdash; they are evaluated against the
                iframe&apos;s URL, not the host page.
              </span>
            </div>
          </div>

          {/* Save Buttons */}
          <div className="form-actions button-container">
            <button
              type="submit"
              disabled={saving}
              className="save-button"
            >
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>

            <button
              onClick={handleReset}
              disabled={saving}
              className="reset-button"
              type="button"
            >
              Reset to Defaults
            </button>
          </div>
        </form>
      </div>

      <div className="card notice">
        <p><strong>Note:</strong> Changes to URL patterns take effect immediately. Content scripts will be re-registered for the new URL patterns.</p>
        <p><strong>Security:</strong> The extension only injects scripts on the URLs you configure here.</p>
      </div>
    </div>
  );
}

export default Options;
