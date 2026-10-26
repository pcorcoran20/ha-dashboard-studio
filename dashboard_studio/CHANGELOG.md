# Changelog

## 0.4.0

- New **Dual shade** block and card for one window with two shade motors: day/night honeycomb shades (blackout plus light filtering, like SmartWings day/night) or top down, bottom up shades. Each shade has its own controls, plus one-tap presets (Open, Day, Night or Open, Privacy, Closed).
- Without the Studio card, dual shades export as two tiles plus preset buttons, and Install creates the preset scripts.
- Auto-build my home pairs up dual shades by itself when two covers differ only by day/night, blackout/sheer or top/bottom.

## 0.3.0

- New: **Smart › Auto-build my home** makes a page for every room from your Home Assistant areas, plus an optional Home page with a Control hub that already has every room. You pick the rooms first, and choose whether to keep or replace your current pages.
- Fix: two pages with the same name no longer clash in Home Assistant. The second one gets its own address, like home-2.

## 0.2.1

- Fix: the add-on now receives its Home Assistant access token, so the Studio connects to your devices (the dot turns green) and Install works.

## 0.2.0

- New Dashboard Studio effects card: moving backgrounds (aurora, stars, snow, rain, bokeh, waves, sky, color shift, and live weather) and card effects (float in, 3D tilt, glowing edges, lights glowing in their own color).
- Install to Home Assistant adds the effects card to each view when you use effects in the Studio.
- Every code file now carries the Patrick's Nest header.

## 0.1.0

- First release.
- The Studio runs in the Home Assistant sidebar and reads your entities, names and areas.
- Designs are saved inside the add-on.
- Install to Home Assistant creates or updates the dashboard, theme, hub card, Good night script, scenes and the sunset automation.
