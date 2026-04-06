/**
 * starlink-combined-card
 *
 * Renders the Starlink GUI add-on's /combined page inside a HA Lovelace card
 * using an iframe.  The ingress URL is resolved automatically from the hassio
 * supervisor API so the card works identically behind Nabu Casa cloud access.
 *
 * Minimal YAML config:
 *
 *   type: custom:starlink-combined-card
 *
 * Optional override (only needed if auto-detect fails):
 *
 *   type: custom:starlink-combined-card
 *   ingress_path: /api/hassio_ingress/YOUR_TOKEN
 */

const ADDON_SLUG = 'starlink_gui';

class StarlinkCombinedCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('starlink-combined-card-editor');
  }

  static getStubConfig() {
    return { type: 'custom:starlink-combined-card' };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._built = false;
    this._ingressUrl = null;
  }

  setConfig(config) {
    this._config = { ...config };
    // Re-apply aspect ratio if the card is already built (editor live-update)
    if (this._wrap) {
      this._applyAspectRatio();
    }
  }

  // ── Apply aspect ratio to the frame wrapper ───────────────────────────────
  // Accepts the same format as HA's built-in webpage card:
  //   "50%"   → height is 50% of width  (default: "100%" = square)
  //   "56.25" → treated as percent, no % sign needed
  // Also accepts CSS ratio strings as a convenience:
  //   "16 / 9" or "16:9" → converted to the equivalent percentage
  _applyAspectRatio() {
    const raw = (this._config.aspect_ratio ?? '100%').toString().trim();

    let pct;
    if (raw.endsWith('%')) {
      // e.g. "56.25%"
      pct = parseFloat(raw);
    } else if (/^\.?\d/.test(raw) && !raw.includes('/') && !raw.includes(':')) {
      // plain number e.g. "56.25"
      pct = parseFloat(raw);
    } else if (raw.includes('/') || raw.includes(':')) {
      // CSS / ratio string e.g. "16 / 9" or "16:9"
      const parts = raw.split(/[\/:]/).map((s) => parseFloat(s.trim()));
      pct = parts.length === 2 && parts[0] ? (parts[1] / parts[0]) * 100 : 100;
    } else {
      pct = 100;
    }

    if (!isFinite(pct) || pct <= 0) pct = 100;
    this._wrap.style.paddingBottom = `${pct}%`;
  }

  getCardSize() {
    return 6;
  }

  /**
   * Called by HA every time the hass state changes.
   * We only need it once to bootstrap – after first render we bail out early.
   */
  set hass(hass) {
    this._hass = hass;
    if (this._built) return;
    this._build();
  }

  // ── Build the card shell immediately, then resolve the iframe src async ───

  _build() {
    this._built = true;

    const card = document.createElement('ha-card');
    card.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; padding: 0; }
        .frame-wrap {
          position: relative;
          width: 100%;
          height: 0;
        }
        iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
          background: transparent;
        }
        .status {
          padding: 16px;
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 14px;
        }
      </style>
      <div class="frame-wrap">
        <div class="status">Loading Starlink GUI…</div>
      </div>
    `;

    this.shadowRoot.appendChild(card);

    this._wrap = card.querySelector('.frame-wrap');
    this._applyAspectRatio();
    this._status = card.querySelector('.status');

    this._resolveIngressUrl().then((url) => {
      this._ingressUrl = url;
      this._mountIframe(url);
    }).catch((err) => {
      const detail = err?.message ?? (typeof err === 'object' ? JSON.stringify(err) : String(err));
      this._showError(detail);
    });
  }

  // ── Resolve the ingress URL ───────────────────────────────────────────────

  async _resolveIngressUrl() {
    // 1. Manual override from card config
    if (this._config.ingress_path) {
      const base = this._config.ingress_path.replace(/\/$/, '');
      return `${window.location.origin}${base}/combined`;
    }

    // 2. Fetch all installed add-ons and find one matching "starlink"
    let addons;
    try {
      const all = await this._hass.connection.sendMessagePromise({
        type: 'supervisor/api',
        endpoint: '/addons',
        method: 'get',
      });
      addons = all?.data?.addons ?? all?.addons ?? [];
    } catch (err) {
      const detail = err?.message ?? (typeof err === 'object' ? JSON.stringify(err) : String(err));
      throw new Error(`Could not list add-ons from supervisor. Original error: ${detail}`);
    }

    console.log('[starlink-combined-card] Installed add-ons:', addons);

    // Match by explicitly configured slug first, then hardcoded slug,
    // then any add-on whose slug or name contains "starlink".
    const match =
      addons.find((a) => a.slug === this._config.addon_slug) ??
      addons.find((a) => a.slug === ADDON_SLUG) ??
      addons.find((a) =>
        a.slug?.toLowerCase().includes('starlink') ||
        a.name?.toLowerCase().includes('starlink')
      );

    if (!match) {
      throw new Error(
        `No Starlink add-on found among installed add-ons. ` +
        `Check the console for the full list and set 'ingress_path' manually in your card config.`
      );
    }

    console.log('[starlink-combined-card] Using add-on:', match.slug, match.name);

    // 3. Fetch the ingress URL for the matched add-on
    let result;
    try {
      result = await this._hass.connection.sendMessagePromise({
        type: 'supervisor/api',
        endpoint: `/addons/${match.slug}/info`,
        method: 'get',
      });
    } catch (err) {
      const detail = err?.message ?? (typeof err === 'object' ? JSON.stringify(err) : String(err));
      throw new Error(
        `Could not query supervisor for add-on "${match.slug}". ` +
        `Original error: ${detail}`
      );
    }

    // The supervisor response is { result: "ok", data: { ingress_url: "/api/hassio_ingress/<token>/" } }
    const ingressPath = result?.data?.ingress_url ?? result?.ingress_url;

    if (!ingressPath) {
      throw new Error(
        `Supervisor returned no ingress_url for add-on "${match.slug}". ` +
        `Set 'ingress_path' manually in your card config.`
      );
    }

    // ingressPath is like "/api/hassio_ingress/abc123/"
    return `${window.location.origin}${ingressPath.replace(/\/$/, '')}/combined`;
  }

  // ── Mount the iframe once we have the URL ────────────────────────────────

  _mountIframe(src) {
    this._status?.remove();

    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.setAttribute('loading', 'lazy');

    this._wrap.appendChild(iframe);
  }

  // ── Error display ─────────────────────────────────────────────────────────

  _showError(message) {
    if (this._status) {
      this._status.textContent = `Error: ${message}`;
      this._status.style.color = 'var(--error-color, red)';
    }
  }
}

customElements.define('starlink-combined-card', StarlinkCombinedCard);

// ── Minimal editor so the visual card editor shows a sensible UI ─────────────

class StarlinkCombinedCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._addons = [];
    this._debugInfo = null; // { slug, name, version, state, ingress_url, source } | { error }
  }

  set hass(hass) {
    if (this._hass) return; // only load once
    this._hass = hass;
    this._loadAddons();
  }

  async _loadAddons() {
    try {
      const all = await this._hass.connection.sendMessagePromise({
        type: 'supervisor/api',
        endpoint: '/addons',
        method: 'get',
      });
      this._addons = all?.data?.addons ?? all?.addons ?? [];
    } catch (e) {
      this._addons = [];
    }

    // If no slug is configured yet, auto-select the best match and save it
    if (!this._config.addon_slug && this._addons.length) {
      const match =
        this._addons.find((a) => a.slug === ADDON_SLUG) ??
        this._addons.find((a) =>
          a.slug?.toLowerCase().includes('starlink') ||
          a.name?.toLowerCase().includes('starlink')
        );
      if (match) {
        this._config = { ...this._config, addon_slug: match.slug };
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        this._fetchDebugInfo(match.slug, 'auto-detected');
      }
    }

    this._render();
  }

  async _fetchDebugInfo(slug, source) {
    this._debugInfo = null;
    this._render();
    try {
      const result = await this._hass.connection.sendMessagePromise({
        type: 'supervisor/api',
        endpoint: `/addons/${slug}/info`,
        method: 'get',
      });
      const d = result?.data ?? result;
      this._debugInfo = {
        source,
        slug: d.slug ?? slug,
        name: d.name,
        version: d.version,
        state: d.state,
        ingress_url: d.ingress_url ?? '(none)',
      };
    } catch (e) {
      this._debugInfo = { error: e?.message ?? String(e) };
    }
    this._render();
  }
    const prevSlug = this._config.addon_slug;
    this._config = { ...config };
    // Fetch debug info if slug changed and we already have hass
    if (this._hass && this._config.addon_slug && this._config.addon_slug !== prevSlug) {
      this._fetchDebugInfo(this._config.addon_slug, 'selected');
    }
    this._render();
  }

  _render() {
    const addons = this._addons;
    const selectedSlug = this._config.addon_slug || '';
    const di = this._debugInfo;

    let debugHtml = '';
    if (selectedSlug && di === null) {
      debugHtml = `<div class="debug loading">Loading info…</div>`;
    } else if (di?.error) {
      debugHtml = `<div class="debug error">Error: ${di.error}</div>`;
    } else if (di) {
      const stateColor = di.state === 'started' ? 'var(--success-color, #4caf50)' : 'var(--warning-color, #ff9800)';
      debugHtml = `
        <div class="debug info">
          <div class="debug-row"><span>Source</span><span>${di.source}</span></div>
          <div class="debug-row"><span>Slug</span><span>${di.slug}</span></div>
          <div class="debug-row"><span>Name</span><span>${di.name}</span></div>
          <div class="debug-row"><span>Version</span><span>${di.version}</span></div>
          <div class="debug-row"><span>State</span><span style="color:${stateColor}">${di.state}</span></div>
          <div class="debug-row"><span>Ingress URL</span><span>${di.ingress_url}</span></div>
        </div>`;
    }

    const options = addons.length
      ? addons.map((a) =>
          `<option value="${a.slug}"${
            a.slug === selectedSlug ? ' selected' : ''
          }>${a.name} (${a.slug})</option>`
        ).join('')
      : `<option value="">Loading…</option>`;

    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
        label { font-size: 12px; color: var(--secondary-text-color); }
        select, input {
          width: 100%;
          padding: 8px;
          box-sizing: border-box;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          font-size: 14px;
        }
        p { font-size: 13px; color: var(--secondary-text-color); margin: 0; }
        .debug {
          font-size: 12px;
          border-radius: 4px;
          padding: 8px;
          background: var(--secondary-background-color, rgba(0,0,0,0.05));
        }
        .debug.loading { color: var(--secondary-text-color); }
        .debug.error { color: var(--error-color, red); }
        .debug-row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
        .debug-row span:first-child { color: var(--secondary-text-color); flex-shrink: 0; }
        .debug-row span:last-child { word-break: break-all; text-align: right; }
      </style>
      <div class="row">
        <p>Embeds the Starlink GUI <code>/combined</code> page as a card.</p>
        <label for="addon_slug">Add-on</label>
        <select id="addon_slug">${options}</select>
        ${debugHtml}
        <label for="aspect_ratio">Aspect ratio (optional, default: 100%)</label>
        <input
          id="aspect_ratio"
          type="text"
          placeholder="56.25% (= 16:9)"
          value="${this._config.aspect_ratio || ''}"
        />
        <label for="ingress_path">Ingress path override (optional)</label>
        <input
          id="ingress_path"
          type="text"
          placeholder="/api/hassio_ingress/YOUR_TOKEN"
          value="${this._config.ingress_path || ''}"
        />
      </div>
    `;

    this.shadowRoot.querySelector('#addon_slug').addEventListener('change', (e) => {
      const val = e.target.value;
      const newConfig = { ...this._config };
      if (val) {
        newConfig.addon_slug = val;
        this._fetchDebugInfo(val, 'selected');
      } else {
        delete newConfig.addon_slug;
        this._debugInfo = null;
      }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    });

    this.shadowRoot.querySelector('#aspect_ratio').addEventListener('change', (e) => {
      const val = e.target.value.trim();
      const newConfig = { ...this._config };
      if (val) {
        newConfig.aspect_ratio = val;
      } else {
        delete newConfig.aspect_ratio;
      }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    });

    this.shadowRoot.querySelector('#ingress_path').addEventListener('change', (e) => {
      const val = e.target.value.trim();
      const newConfig = { ...this._config };
      if (val) {
        newConfig.ingress_path = val;
      } else {
        delete newConfig.ingress_path;
      }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    });
  }
}

customElements.define('starlink-combined-card-editor', StarlinkCombinedCardEditor);

// ── Register with HA card picker ──────────────────────────────────────────────

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'starlink-combined-card',
  name: 'Starlink Combined View',
  description:
    'Embeds the Starlink GUI add-on /combined page (3-D obstruction map + live stats) directly into a Lovelace card.',
  preview: false,
  documentationURL: 'https://github.com/timmchugh11/haos-addons',
});
