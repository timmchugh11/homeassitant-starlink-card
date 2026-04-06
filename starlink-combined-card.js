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

    // 2. Auto-detect via the supervisor WebSocket API.
    //    Using hass.connection.sendMessagePromise with type "supervisor/api" avoids
    //    the 401 that the REST proxy (/api/hassio/...) throws for non-admin tokens.
    let result;
    try {
      result = await this._hass.connection.sendMessagePromise({
        type: 'supervisor/api',
        endpoint: `/addons/${ADDON_SLUG}/info`,
        method: 'get',
      });
    } catch (err) {
      const detail = err?.message ?? (typeof err === 'object' ? JSON.stringify(err) : String(err));
      throw new Error(
        `Could not query supervisor for add-on "${ADDON_SLUG}". ` +
        `Is the Starlink GUI add-on installed and running? ` +
        `If the slug is wrong, set 'ingress_path' manually in your card config. ` +
        `Original error: ${detail}`
      );
    }

    // The supervisor response is { result: "ok", data: { ingress_url: "/api/hassio_ingress/<token>/" } }
    const ingressPath = result?.data?.ingress_url ?? result?.ingress_url;

    if (!ingressPath) {
      throw new Error(
        `Supervisor returned no ingress_url for add-on "${ADDON_SLUG}". ` +
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
    // Needed for the 3-D canvas and pointer events inside the iframe
    iframe.setAttribute('allow', 'pointer-lock');
    // Sandbox: allow scripts and same-origin requests; block popups / forms
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-pointer-lock',
    );

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
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
        label { font-size: 12px; color: var(--secondary-text-color); }
        input {
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
      </style>
      <div class="row">
        <p>Embeds the Starlink GUI <code>/combined</code> page as a card.
           The add-on ingress URL is auto-detected — no configuration required.</p>
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
