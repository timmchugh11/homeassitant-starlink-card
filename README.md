# starlink-card

Custom Home Assistant Lovelace card for displaying Starlink status and network readings on an image-based dashboard.

## Install

- URL: `/local/starlink-card/starlink-card.js`
- Type: `JavaScript Module`

## What It Shows

The card displays these configured values:

- Downlink throughput
- Uplink throughput
- Ping
- Ping drop rate
- Obstruction status
- Roaming status
- Stow status

Each displayed value can be clicked to open the Home Assistant more-info dialog for the configured entity.

## Visual Editor

The card includes a built-in visual editor in Lovelace.

The editor supports:

- Sensor selection for downlink, uplink, ping, and ping drop
- Binary sensor selection for obstructed and roaming
- Switch selection for stow

## Configuration

### Example Config

```yaml
type: custom:starlink-card
downlink: sensor.starlink_downlink_throughput
uplink: sensor.starlink_uplink_throughput
ping: sensor.starlink_ping
pingdrop: sensor.starlink_ping_drop_rate
obstructed: binary_sensor.starlink_obstructed
roaming: binary_sensor.starlink_roaming_mode
stow: switch.starlink_stowed
```

### Configuration Keys

```yaml
type: custom:starlink-card
downlink: sensor.example
uplink: sensor.example
ping: sensor.example
pingdrop: sensor.example
obstructed: binary_sensor.example
roaming: binary_sensor.example
stow: switch.example
```

Expected entity types:

- `downlink`, `uplink`, `ping`, `pingdrop`: `sensor.*`
- `obstructed`, `roaming`: `binary_sensor.*`
- `stow`: `switch.*`

## Display Behavior

- Downlink and uplink are shown as `Mbits/s`.
- Ping is shown in `ms`.
- Ping drop is shown as a percentage.
- `obstructed` displays `No Obstructions` when the entity state is `off`, otherwise `Obstructed`.
- `roaming` displays `Not Roaming` when the entity state is `off`, otherwise `Roaming`.
- `stow` displays `Stowed` when the switch state is `on`, otherwise `Not Stowed`.
- Unavailable numeric sensor values display as `unavailable`.

## Layout

The card uses a responsive image layout so the labels scale with the card size.

Current image path:

- `/local/starlink-card/img/mini.png`

If you replace the image, you may also need to adjust the text positions in `starlink-card.js`.
