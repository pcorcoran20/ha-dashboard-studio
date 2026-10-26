# Dashboard Studio

Design a dashboard by dragging blocks onto a canvas, pick a theme, and install it in one click. Everything happens inside Home Assistant.

New here? The [step-by-step install guide](https://github.com/pcorcoran20/ha-dashboard-studio/blob/main/INSTALL.md) has a check after every step and a fix-it section.

## Open it

After you start the add-on, select **Dashboard Studio** in the sidebar. If you don't see it, open the add-on page and turn on **Show in sidebar**.

The chip at the top right shows your home's name with a green dot when the Studio is connected to Home Assistant.

## Finding your way around

- The first time you open the Studio, a start screen asks what you want to do: **Build from my home**, **Start from a style** or **Start with a blank page**. Open it again any time with **Start** at the bottom left.
- The menu on the left has four tools: **Add** (blocks), **Style** (themes, colors and fonts), **Effects** and **Magic** (builds pages for you). Select the open tool again to hide its panel and get more room.
- Tap a block to change it. The right panel shows the main settings. Everything else, like when the block shows, its style and its code, is under **More options**.

## What it knows about your home

The Studio reads your entities, their friendly names and your areas straight from Home Assistant:

- Entity fields suggest your real entity IDs as you type.
- **Magic › Auto-build a page** makes a page from your actual devices.
- In a **Control hub** block, **Fill rooms from my HA areas** puts each device in its Home Assistant area.

- **Magic › Auto-build my home** makes a page for every room, filled with that room's devices, plus a Home page with a Control hub. It shows you the rooms it found first, so you can untick any you don't want.

- **Dual shades** (two motors on one window, like day/night honeycomb shades) are found automatically when two covers in a room differ only by day/night, blackout/sheer or top/bottom.

- **A wall touchscreen:** in a Control hub, choose **Layout › Touchscreen**. Then in **Export › Dashboard › Room switching**, choose **One touchscreen, rooms in the dropdown**. Your dashboard opens straight to the touchscreen, and you switch rooms from the name at the top center instead of tabs. **Magic › Create touchscreen home** sets all of this up in one tap.

To pick up new devices, go to **Magic › My entities › Reload from Home Assistant**.

Your designs are saved inside the add-on, so they survive restarts and show up on every device you open the Studio on.

## Real 3D Tesla

**Magic › Real 3D Tesla**, or **Set up my real 3D Tesla** in a Vehicle block, shows your car the way the Tesla app does, with [Tesla View](https://github.com/koenhendriks/tesla-view). The add-on does every step:

1. **Gets the Tesla app.** Plug your Android phone into your computer and select **Get it from my phone**, or upload an app file (`.apk`, `.apks`, `.apkm` or `.xapk`) you saved yourself.
2. **Reads the app** with [Tesla Model Extractor](https://github.com/koenhendriks/tesla-model-extractor) and shows the cars inside it. Your car is ticked already.
3. **Makes your cars.** Tick every car you drive, and they're all made in one go. The add-on installs Tesla View and adds your cars to it.
4. **Asks before restarting.** The first time only, Home Assistant needs to restart once to start Tesla View. Choose **Restart now** or **Restart later**. With later, the add-on finishes Tesla View's setup by itself after your next restart.
5. **Cleans up.** The copy of the app is deleted. If you tick **Keep the app ready for more cars**, the add-on keeps the read app (about 1.5 GB). Then **Add more cars** works later without sending the app again, and **Delete the saved app** removes it.

After that, the Vehicle card and the Control hub's car view show the Tesla View car by themselves. Set `tesla_view: false` on a card to keep the drawing.

What you need:

- **Home Assistant on an x86 computer**, like a mini PC, NUC or virtual machine. One of the tools only exists for x86, so this doesn't work on a Raspberry Pi, Home Assistant Green or Yellow. On those, make the asset pack on a computer with the extractor's desktop app and upload it in Tesla View.
- **About 3 GB of free space** while it works. The first read of the app takes a few minutes.
- **To get the app from your phone:** Home Assistant opened with `https://` in Chrome or Edge on a computer, and USB debugging on. The Studio shows how to turn it on. If Android Studio or `adb` runs on that computer, close it first so the browser can reach the phone.

The car is Tesla's artwork, made from your own copy of the app, so keep it for yourself and don't share it. Tesla View is installed into `custom_components/tesla_view`. To get its updates through HACS, add it there as a custom repository. HACS takes over the existing install.

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

- If you use **Real 3D Tesla**: `custom_components/tesla_view` and your car in `/config/tesla_view`, and it restarts Home Assistant once to start Tesla View

It never edits `configuration.yaml` or any of your other files.

## Security

Only Home Assistant administrators can open the Studio. The add-on accepts connections only from Home Assistant's own ingress, and its access token never reaches your browser.

## Supported systems

Add-ons need Home Assistant OS or a Supervised install, on a 64-bit system (amd64 or aarch64, which includes a Raspberry Pi 4 or 5). On a Container or Core install, use the Studio on the web and the HACS card instead.
