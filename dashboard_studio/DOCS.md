# Dashboard Studio

Design a dashboard by dragging blocks onto a canvas, pick a theme, and install it in one click. Everything happens inside Home Assistant.

New here? The [step-by-step install guide](https://github.com/pcorcoran20/ha-dashboard-studio/blob/main/INSTALL.md) has a check after every step and a fix-it section.

## Open it

After you start the add-on, select **Dashboard Studio** in the sidebar. If you don't see it, open the add-on page and turn on **Show in sidebar**.

The chip at the top right shows your home's name with a green dot when the Studio is connected to Home Assistant.

## What it knows about your home

The Studio reads your entities, their friendly names and your areas straight from Home Assistant:

- Entity fields suggest your real entity IDs as you type.
- **Smart › Auto-build a page** makes a page from your actual devices.
- In a **Control hub** block, **Fill rooms from my HA areas** puts each device in its Home Assistant area.

- **Smart › Auto-build my home** makes a page for every room, filled with that room's devices, plus a Home page with a Control hub. It shows you the rooms it found first, so you can untick any you don't want.

- **Dual shades** (two motors on one window, like day/night honeycomb shades) are found automatically when two covers in a room differ only by day/night, blackout/sheer or top/bottom.

To pick up new devices, go to **Smart › My entities › Reload from Home Assistant**.

Your designs are saved inside the add-on, so they survive restarts and show up on every device you open the Studio on.

## Install your dashboard

Select **Export**, then **Install to Home Assistant**. The add-on then:

1. Saves your wallpaper and floor plan pictures to `/config/www`.
2. Writes your theme to `/config/themes/dashboard_studio.yaml` and reloads themes.
3. Copies the Dashboard Studio hub card to `/config/www` and adds it as a dashboard resource.
4. Creates or updates the **Good night** script, your hub scenes and the sunset theme automation.
5. Creates the dashboard (the first time) and saves your design into it. It appears in the sidebar.

You get a checklist showing what worked and anything that needs a look. Install again whenever you change something. It updates the same dashboard, theme, scripts and scenes instead of making copies.

The dashboard's address comes from **Export › Dashboard › Dashboard URL** and starts as `home-studio`.

### If themes don't appear

Home Assistant only reads theme files when your `configuration.yaml` includes:

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

Add it, restart Home Assistant, and select **Install** again.

### Frosted glass and per-block styles

The frosted blur, Pride flag borders and per-block styles use **card-mod**. Install it from HACS. Without it, everything still works, just without those extras.

## What the add-on changes

The add-on only writes:

- `/config/themes/dashboard_studio.yaml`
- Pictures and `dashboard-studio-card.js` in `/config/www`
- Scripts, scenes and automations whose IDs it made (`good_night`, `studio_…` scenes, `studio_sunset_switch`), through Home Assistant's own editors
- The one dashboard at your chosen URL

It never edits `configuration.yaml` or any of your other files.

## Security

Only Home Assistant administrators can open the Studio. The add-on accepts connections only from Home Assistant's own ingress, and its access token never reaches your browser.

## Supported systems

Add-ons need Home Assistant OS or a Supervised install, on a 64-bit system (amd64 or aarch64, which includes a Raspberry Pi 4 or 5). On a Container or Core install, use the Studio on the web and the HACS card instead.
