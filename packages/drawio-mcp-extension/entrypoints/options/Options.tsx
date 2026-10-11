import { useState, useEffect, useMemo } from "react";
import { getConfig, saveConfig, resetConfigToDefaults, isValidExtensionWebSocketUrl, DEFAULT_CONFIG, type ExtensionConfig } from "../../config";
import { validateMV3Pattern, isValidPatternList, deduplicatePatterns, patternsAreEquivalent } from "../../utils/urlPatternValidator";
import { useI18n } from "../../utils/useI18n";
import type { Language } from "../../utils/i18n";

const DEFAULT_WS_URL = `ws://localhost:${DEFAULT_CONFIG.websocketPort}`;

// The pattern validator returns English strings; map them to catalog keys
// so the options UI can localize them. Unknown strings pass through.
const PATTERN_ERROR_KEYS: Record<string, string> = {
  "Invalid scheme. Use *, http, https, file, or ftp": "patterns_error_scheme",
  "Invalid URL pattern format": "patterns_error_format",
  "Invalid host pattern. Use *, *.example.com, or example.com": "patterns_error_host",
  "Path must start with /": "patterns_error_path",
  "Invalid URL pattern": "patterns_error_invalid",
  "URL pattern cannot be empty": "patterns_error_empty",
};

const LANGUAGE_OPTIONS: Language[] = ["auto", "en", "zh-CN"];

function Options() {
  const { t, language, setLanguage } = useI18n();
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
  const [languageSaved, setLanguageSaved] = useState(false);

  useEffect(() => {
    // Load current configuration
    loadConfig();
  }, []);

  const patternError = (raw?: string): string | undefined =>
    raw ? (PATTERN_ERROR_KEYS[raw] ? t(PATTERN_ERROR_KEYS[raw]) : raw) : undefined;

  const loadConfig = async () => {
    try {
      const currentConfig = await getConfig();
      setConfig(currentConfig);
      setUrlInput(currentConfig.websocketUrl ?? '');
      setPatterns(currentConfig.urlPatterns);
      setInjectIntoIframes(currentConfig.injectIntoIframes);
    } catch (error) {
      console.error('Failed to load config:', error);
      setMessage({ type: 'error', text: t('ws_url_error_load') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl.length > 0 && !isValidExtensionWebSocketUrl(trimmedUrl)) {
      setUrlError(t('ws_url_error_start'));
      setMessage({ type: 'error', text: t('ws_url_error_invalid') });
      return;
    }
    setUrlError('');

    // Validate patterns
    if (!isValidPatternList(patterns)) {
      setMessage({ type: 'error', text: t('ws_url_error_patterns') });
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
      setMessage({ type: 'success', text: t('ws_url_saved') });
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: t('ws_url_error_save') });
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
      setMessage({ type: 'success', text: t('ws_url_reset') });
    } catch (error) {
      console.error('Failed to reset config:', error);
      setMessage({ type: 'error', text: t('ws_url_error_reset') });
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (next: Language) => {
    setLanguageSaved(false);
    await setLanguage(next);
    setLanguageSaved(true);
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
      setPatternsError(t('patterns_error_empty'));
      return;
    }

    const validation = validateMV3Pattern(newPatternInput.trim());
    if (!validation.isValid) {
      setPatternsError(patternError(validation.error) || '');
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
        <h1>{t('options_title')}</h1>
        <div className="loading">{t('options_loading')}</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <h1>{t('options_title')}</h1>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card main-settings-card">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Language */}
          <div className="settings-section">
            <h3>{t('language_heading')}</h3>

            <div className="form-group">
              <select
                value={language ?? 'auto'}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'auto' ? t('language_auto_option') : option === 'en' ? t('language_english_option') : t('language_chinese_option')}
                  </option>
                ))}
              </select>
              {languageSaved && (
                <span className="input-hint">{t('language_changed_hint')}</span>
              )}
            </div>
          </div>

          <div className="section-separator"></div>

          {/* WebSocket Server Configuration */}
          <div className="settings-section">
            <h3>{t('ws_section_heading')}</h3>

            <div className="form-group">
              <label htmlFor="url-input">{t('ws_url_label')}</label>
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
                {t('ws_url_hint', DEFAULT_WS_URL)}
              </span>
              {urlError && <span className="error-text">{urlError}</span>}
            </div>
          </div>

          {/* URL Pattern Separator */}
          <div className="section-separator"></div>

          {/* URL Patterns for Content Script Injection */}
          <div className="settings-section">
            <h3>{t('patterns_section_heading')}</h3>
            <p className="card-description">
              {t('patterns_description')}
            </p>

            <div className="pattern-input-section">
              <div className="form-group">
                <label htmlFor="pattern-input">{t('patterns_add_label')}</label>
                <div className="pattern-input-group">
                  <input
                    id="pattern-input"
                    type="text"
                    value={newPatternInput}
                    onChange={(e) => handlePatternInputChange(e.target.value)}
                    placeholder={t('patterns_input_placeholder')}
                    className={`pattern-input ${newPatternValidation.isValid && newPatternInput.trim() ? 'valid' : !newPatternValidation.isValid && newPatternInput.trim() ? 'invalid' : ''}`}
                    disabled={saving}
                  />
                  <button
                    onClick={handleAddPattern}
                    disabled={!newPatternValidation.isValid || !newPatternInput.trim() || saving}
                    className="add-pattern-button"
                    type="button"
                  >
                    {t('patterns_add_button')}
                  </button>
                </div>
                {patternsError && <span className="error-text">{patternsError}</span>}
                {newPatternInput.trim() && !newPatternValidation.isValid && (
                  <span className="error-text">{patternError(newPatternValidation.error)}</span>
                )}
                {newPatternInput.trim() && newPatternValidation.isValid && (
                  <span className="success-text">{t('patterns_valid')}</span>
                )}
              </div>
            </div>

            <div className="patterns-list">
              <h4>{t('patterns_current_heading', String(patterns.length))}</h4>
              {patterns.length === 0 ? (
                <p className="no-patterns">{t('patterns_empty')}</p>
              ) : (
                <ul className="pattern-list">
                  {patternsListValidation.map((item, index) => (
                    <li key={index} className={`pattern-item ${item.isValid ? 'valid' : 'invalid'}`}>
                      <span className="pattern-text">{item.pattern}</span>
                      {patternsAreEquivalent(item.pattern, "*://app.diagrams.net/*") && (
                        <span className="default-badge">{t('patterns_default_badge')}</span>
                      )}
                      <button
                        onClick={() => handleRemovePattern(index)}
                        disabled={saving}
                        className="remove-pattern-button"
                        title={t('patterns_remove_title')}
                        type="button"
                      >
                        ×
                      </button>
                      {!item.isValid && (
                        <div className="pattern-error">{patternError(item.error)}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pattern-examples">
              <h5>{t('patterns_examples_heading')}</h5>
              <ul>
                <li><code>*://app.diagrams.net/*</code> - {t('patterns_example_default')}</li>
                <li><code>*://*.diagrams.net/*</code> - {t('patterns_example_subdomain')}</li>
                <li><code>https://draw.example.com/*</code> - {t('patterns_example_custom_domain')}</li>
                <li><code>https://draw.example.com/drawio/*</code> - {t('patterns_example_specific_path')}</li>
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
                {' '}{t('patterns_iframe_label')}
              </label>
              <span className="input-hint">
                {t('patterns_iframe_hint')}
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
              {saving ? t('save_button_saving') : t('save_button')}
            </button>

            <button
              onClick={handleReset}
              disabled={saving}
              className="reset-button"
              type="button"
            >
              {t('reset_button')}
            </button>
          </div>
        </form>
      </div>

      <div className="card notice">
        <p><strong>{t('options_note_title')}</strong> {t('options_note_text')}</p>
        <p><strong>{t('options_security_title')}</strong> {t('options_security_text')}</p>
      </div>
    </div>
  );
}

export default Options;