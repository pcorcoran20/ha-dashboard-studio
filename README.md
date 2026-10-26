# Dashboard Studio for Home Assistant

This repository holds two things:

- **The Dashboard Studio add-on** (`dashboard_studio/`): the full drag-and-drop builder, running in your Home Assistant sidebar. It reads your real entities and areas, and installs finished dashboards in one click. [Add-on docs](dashboard_studio/DOCS.md).
- **The Dashboard Studio hub card** (`dist/`): the card described below, installable on its own through HACS.

## Install

### 👉 [Step-by-step install guide](INSTALL.md)

The guide shows you which install you have, has one-click buttons, and tells you what you should see after every step.

**Quick start for the add-on** (Home Assistant OS or Supervised):

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fpcorcoran20%2Fha-dashboard-studio)

Then select **Dashboard Studio** in the add-on store, then **Install**, turn on **Show in sidebar**, and select **Start**.

**Quick start for the cards only** (needs HACS):

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=pcorcoran20&repository=ha-dashboard-studio&category=plugin)

Stuck? The guide has an [If something goes wrong](INSTALL.md#if-something-goes-wrong) section.

---

## The hub card

A touchscreen-style home screen card. Rooms across the top, big tiles for each kind of device, and full controls one tap away. It also has scenes, an alarm keypad and a Good night button.

It is the live version of the **Control hub** block from Dashboard Studio, the web builder. The builder can export your hub straight into this card's YAML.

## What it does

- **Room chips:** look at the whole home, or one room at a time.
- **Category tiles:** Lights, Shades, Comfort, Listen & Watch, Security, Cameras, Fans and Outlets. Each tile shows a live status like "3 on" or "All locked". A tile only shows up when that room has that kind of device.
- **Device controls:** tap a tile to see every device of that type, with toggles, brightness, fan speeds, shade position, thermostat up and down, play and pause with volume, lock and unlock, and live camera images. Tap a device's icon to open Home Assistant's normal more-info dialog.
- **All on / All off:** for lights, fans, outlets, shades and locks.
- **Alarm keypad:** arm home, arm away and disarm with a code, using your real alarm panel.
- **Scenes:** one-tap buttons for your scenes.
- **Good night:** runs your script, or turns things off and locks up by itself.

The card follows your Home Assistant theme, including Dashboard Studio themes and card-mod styles.

## Install the card on its own

The [install guide](INSTALL.md#path-b-the-card-only) walks through this step by step, with a check after each step. In short:

### With HACS (recommended)

1. Open **HACS**, then the three dots in the top right, then **Custom repositories**.
2. Paste this repository's GitHub URL, choose the type **Dashboard**, and select **Add**.
3. Search HACS for **Dashboard Studio**, open it and select **Download**.
4. Reload your browser.

### By hand

1. Copy `dist/dashboard-studio-card.js` into `/config/www/`.
2. Go to **Settings › Dashboards**, then the three dots, then **Resources**. If you don't see Resources, turn on **Advanced mode** in your user profile.
3. Select **Add resource**. Set the URL to `/local/dashboard-studio-card.js` and the type to **JavaScript module**.
4. Reload your browser.

## Set it up

Add a card to any dashboard and choose **Manual**, then paste:

```yaml
type: custom:dashboard-studio-hub
title: My Home
rooms:
  - name: Living Room
    devices:
      - light.living_room_ceiling
      - light.living_room_floor_lamp
      - cover.living_room_shades
      - climate.living_room
      - media_player.living_room_tv
  - name: Entry
    devices:
      - alarm_control_panel.home
      - lock.front_door
      - camera.doorbell
scenes:
  - name: Movie night
    entity: scene.movie_night
good_night: script.good_night
```

In a Sections dashboard, make the card full width so the tiles have room.

### Options

| Option | What it does |
| --- | --- |
| `title` | The name shown when "All rooms" is selected. |
| `rooms` | Required. A list of rooms, each with a `name` and a list of `devices`. |
| `devices` | Each device is an entity ID, or an object with `entity`, plus optional `name`, `icon` and `type`. |
| `scenes` | Optional list of `entity` (a `scene.` entity), with optional `name` and `icon`. |
| `good_night` | A `script.` entity to run. Or leave it out and the card does it itself (see below). Set it to `false` to hide the button. |
| `calm` | `true` turns off the card's animations. |

The card works out what each device is from its entity ID: `light`, `switch` and `input_boolean`, `fan`, `cover`, `climate`, `media_player`, `lock`, `camera` and `alarm_control_panel`. To override it, set `type` to one of `light`, `switch`, `fan`, `shade`, `climate`, `media`, `lock`, `camera` or `alarm`.

### Good night without a script

If `good_night` is not a script, the card runs these steps on the devices in the card:

```yaml
good_night:
  lights: true      # turn off lights
  switches: true    # turn off outlets and switches
  fans: false       # turn off fans
  shades: true      # close shades
  media: true       # pause TVs and speakers
  locks: true       # lock doors
  alarm: true       # arm home, only for panels that don't need a code to arm
  temperature: 66   # set thermostats, in your Home Assistant units
```

## Good to know

- The keypad sends your code to Home Assistant, which checks it. The card never stores your code.
- If a device shows "Not found", check its entity ID in **Settings › Devices & services › Entities**.
- The card needs Home Assistant 2024.8 or newer.


## The effects card

`custom:dashboard-studio-fx` adds a moving background behind the whole view, plus effects on the other cards. It's invisible outside edit mode, so add one per view and put it anywhere.

```yaml
type: custom:dashboard-studio-fx
background: weather          # off, aurora, stars, snow, rain, bokeh, waves, sky, hue, weather
weather_entity: weather.home # for background: weather. It follows your live weather
strength: 70                 # 10 to 100
speed: 1                     # 0.25 to 2
layer: behind                # behind the cards, or front (over them, taps still pass through)
card_effects:
  float_in: true             # cards float in when the view opens
  tilt: false                # cards lean toward your pointer
  glowing_edges: false       # a soft glow pulses around each card
  light_glow: true           # tile cards for lights glow in the light's own color
calm: false                  # true turns off motion. Reduced-motion settings are respected too
```

If you set `layer: behind` and don't see the background, your theme or another custom card may be painting over it. Try `layer: front`.

## License

MIT
