# Starlink Combined Card

A custom Home Assistant Lovelace card that embeds the [Starlink GUI add-on](https://github.com/timmchugh11/haos-addons) `/combined` page (live 3-D obstruction map + real-time stats) directly inside a dashboard card. The ingress URL is resolved automatically so the card works behind Nabu Casa remote access with no extra configuration.

## Installation

### HACS (recommended)

1. Open **HACS** → **Frontend** → **⋮** → **Custom repositories**.
2. Add this repository URL and select category **Lovelace**.
3. Click **Download** on the **Starlink Combined Card** entry.
4. Reload your browser.

### Manual

1. Copy `starlink-combined-card.js` to your `config/www/` folder (or a subfolder).
2. In Home Assistant go to **Settings** → **Dashboards** → **⋮** → **Resources** and add:
   - URL: `/local/starlink-combined-card.js`
   - Type: **JavaScript Module**
3. Reload your browser.

## Requirements

The **Starlink GUI** add-on must be installed and running in Home Assistant OS/Supervised. The card auto-detects its ingress path via the supervisor API.

## Configuration

### Minimal (auto-detect)

```yaml
type: custom:starlink-combined-card
```

No further configuration is needed in most cases.

### Override ingress path

Only required if auto-detection fails (e.g. non-standard add-on slug or API unavailable):

```yaml
type: custom:starlink-combined-card
ingress_path: /api/hassio_ingress/YOUR_TOKEN
```

### Configuration Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ingress_path` | `string` | No | Manual override for the Starlink GUI ingress path. |

## Visual Editor

The card includes a built-in visual editor in the Lovelace UI. The editor exposes the optional `ingress_path` override field — leave it blank to use auto-detection.
