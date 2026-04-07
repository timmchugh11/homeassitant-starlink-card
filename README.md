# Starlink Card

A Home Assistant custom Lovelace card that embeds the Starlink GUI add-on in an iframe.

The card resolves the add-on ingress URL automatically through the Home Assistant Supervisor API, so it works with normal local access and Home Assistant Cloud / Nabu Casa access.

This card requires the [Starlink GUI Home Assistant add-on](https://github.com/timmchugh11/haos-addons/tree/main/starlink_gui).

## Features

- Embeds the Starlink GUI directly inside a Lovelace card
- Auto-detects the Starlink add-on from installed Supervisor add-ons
- Supports manual ingress override if auto-detection is not available
- Supports configurable aspect ratios, including percent values and `16:9` style ratios
- Includes a simple visual editor for Home Assistant

## Installation

Install the required [Starlink GUI add-on](https://github.com/timmchugh11/haos-addons/tree/main/starlink_gui) first.

### HACS

Add this repository as a custom dashboard repository in HACS, then install **Starlink Card**.

### Manual

1. Copy `starlink-card.js` into your Home Assistant `www` directory.
2. Add it as a Lovelace resource:

```yaml
url: /local/starlink-card.js
type: module
```

## Basic usage

```yaml
type: custom:starlink-card
```

## Configuration

| Option | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `custom:starlink-card` |
| `addon_slug` | No | Override the add-on slug used for Supervisor lookup |
| `ingress_path` | No | Manual ingress path, for example `/api/hassio_ingress/YOUR_TOKEN` |
| `aspect_ratio` | No | Frame aspect ratio. Default is `100%` |

## Aspect ratio examples

These formats are supported:

```yaml
type: custom:starlink-card
aspect_ratio: 56.25%
```

```yaml
type: custom:starlink-card
aspect_ratio: "16:9"
```

```yaml
type: custom:starlink-card
aspect_ratio: "16 / 9"
```

## Manual ingress override

Use this only if automatic Supervisor detection fails:

```yaml
type: custom:starlink-card
ingress_path: /api/hassio_ingress/YOUR_TOKEN
```

## Changing colours

Colour changes are handled by the [Starlink GUI add-on](https://github.com/timmchugh11/haos-addons/tree/main/starlink_gui), not by this card.

To change the obstruction map colours:

1. Open the Starlink GUI add-on.
2. Go to the Settings page.
3. Find **Obstruction Map Colours**.
4. Adjust these values:

- **Clear / Good Signal**: default `#42e0f5`
- **Obstructed**: default `#f7524a`

The add-on saves those colours in browser `localStorage` and this card will display them automatically because it embeds the add-on UI.

## Notes

- This card requires the [Starlink GUI add-on](https://github.com/timmchugh11/haos-addons/tree/main/starlink_gui).
- Automatic add-on lookup requires Home Assistant Supervisor access.
- If no matching add-on is found, the card shows an error and you can supply `ingress_path` manually.
- On some browsers, including iPad Safari, the embedded add-on may return `401 Unauthorized` until the Starlink GUI add-on has been opened once from the Home Assistant side panel in that browser session.
- Current workaround for those browsers: open the Starlink GUI add-on from the side panel first, then return to the dashboard card.
