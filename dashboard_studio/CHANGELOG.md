# Changelog

## 0.8.1

- Touchscreen tiles are always the same size. Long names shorten with "…" instead of making a tile taller.
- See-through tiles are clear glass by default, not dark.
- With the Pride theme, the hub keeps its rainbow border and is see-through inside.
- The Quick buttons tile is now called **Shortcuts**.

## 0.8.0

- A simpler Studio. A start screen asks what you want to do: build from your home, start from a style, or start with a blank page. Open it again with **Start** at the bottom left.
- One icon menu on the left: **Add**, **Style**, **Effects** and **Magic** (this was Smart). Select the open tool again to hide its panel.
- The right panel shows only the main settings. When a block shows, its style, moving it and its code are under **More options**. Duplicate and Delete sit next to the block's name.
- Less-used settings in Style and Magic are folded away until you open them.

## 0.7.0

- The touchscreen hub is see-through by default, with frosted glass tiles so the text stays easy to read. Set how solid it is with **Background strength**.
- Tiles that are on use soft white icons instead of yellow. Pick **Soft white**, **Theme color** or **Warm** in the Studio, or set `icon_color` on the card.
- The hub card sets itself up: leave out `rooms` and it fills them from your Home Assistant areas, sorted by floor. Leave out `scenes` and it uses your scenes.
- The hub card has a visual editor, so you can set it up without writing any code.

## 0.6.1

- The touchscreen layout is easier to read and softer. The room menu is solid, with a dim layer behind it, and the panel is more solid in Follow my theme. Tiles are rounded and spaced apart, with round icons.

## 0.6.0

- New **Touchscreen** layout for the Control hub, in the Studio and the hub card: the room name at the top center opens a room list, a Now Playing panel with volume and transport controls, big tiles (Watch, Listen, Lighting, Comfort with the temperature, Shades, Security, Cameras, Fans, Outlets, Quick buttons), and the clock and weather along the bottom. Pick a dark touchscreen look or follow your theme.
- New Export setting, **Room switching in Home Assistant**: keep a tab for every page, or make the touchscreen page the only screen with rooms in its dropdown. Other pages stay, hidden from the tab bar. You can also hide Home Assistant's top bar with kiosk-mode.
- Smart › Create touchscreen home now uses the touchscreen layout and the one-screen setting.

## 0.5.0

- New room picker in the Studio: arrows to step through rooms and pages, plus a dropdown with every room, a search box, and drag or ↑ ↓ to reorder.
- Control hub rooms can be moved earlier or later in the right panel.
- The hub card shows a Rooms dropdown instead of chips when there are more than 6 rooms. Set `room_picker` to `chips`, `dropdown` or `auto`.

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
