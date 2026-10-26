# Changelog

## 1.2.0

- **See-through Tesla View.** The Vehicle card now shows just your car on the card, with no box behind it. This is the new default look. Pick **Blend into the card** or **Light, like the app** in the Studio, or set `tesla_view_look` to `dark` or `light`. If a browser or a future Tesla View version doesn't allow see-through, the card fades the box into the card instead.
- Fix: after you changed a Vehicle card's settings, it said no car was found until something on the car changed.

## 1.1.3

- The Tesla View fade is softer and only touches the very edges, so Tesla View's labels (like Open frunk) show again.
- New fix for cars that report the frunk, trunk or charge port the wrong way round: **Shows open when it's closed?** in the Studio, or `reversed: [frunk, trunk]` on the card. It flips the card's buttons and Tesla View together.
- The card's visual editor lists every entity the card found, so you can check them and change any one.
- If Tesla View can't find the wheels or the lighting in your car file, the card says so under the car.

## 1.1.2

- Credits: a new [CREDITS.md](../CREDITS.md), plus credits in the README, the docs, the Magic panel and the Real 3D Tesla helper. Thank you to Koen Hendriks for Tesla View and Tesla Model Extractor, and to ya-webadb, GDRE Tools and three.js 💜

## 1.1.1

- Fix: Tesla View showed the first car in the pack (like a Model S) instead of yours. The card now tells Tesla View which car to show: from your car's device model ("Model C" is the Cybertruck), or the model picked in the Studio. Set `tesla_view: {model: …}` to choose one yourself.
- Tesla View looks brighter and fits the card. By default its dark box fades into the card and the car is lifted a little. Choose **Light, like the app** for the app's light mode, and set the brightness in the Studio or with `tesla_view_look` and `tesla_view_brightness`.
- When no model is set, the drawing also uses your car's device model.

## 1.1.0

- **Real 3D Tesla asks before restarting.** Choose **Restart now** or **Restart later**. With later, the add-on finishes Tesla View's setup by itself after your next restart.
- **Several cars at once.** Tick every car you drive, or use **Select all**, and they're all made in one go. **Keep the app ready for more cars** saves the read app, so **Add more cars** works later without sending the app again. **Delete the saved app** frees the space.
- **Pick your car.** With more than one car, the Studio and the card's visual editor list your cars, so you don't have to type entity names. On the card it's `device`.
- **Your design matches your car.** After the wizard, the cars in your design switch to the models you made, and the Studio shows which ones appear as your real 3D Tesla.
- **Charging scenes.** The drawing shows a Supercharger stall when your car is fast charging, and a Wall Connector at home. Choose one yourself with `charger`. With Tesla View, the card switches to its charging camera while the car charges, so you see the app's charge cable plugged in.
- Fix: **Show details** stays open while the log updates.
- Fix: the Vehicle card switches to Tesla View even when Tesla View's card loads after it.

## 1.0.0 🎉

The first big release. Everything below 1.0 is still here, plus:

- **Real 3D Tesla, in one go.** **Magic › Real 3D Tesla** gets the Tesla app from your phone over USB (or from a file you upload), makes your car with Tesla Model Extractor, installs Tesla View, adds your car, restarts Home Assistant once and finishes the setup. It needs Home Assistant on an x86 computer. See the docs.
- The Vehicle card and the Control hub's car view use Tesla View by themselves when it's installed. They hand it your car's device and entities. Set `tesla_view: false` to keep the drawing.
- The add-on now uses a Debian base image, so it can run the extractor. The first update takes longer to build.

### Everything Dashboard Studio does, in short

- A drag and drop Studio with themes (including Pride and duck themes with easter eggs), a start screen, and an icon menu: Add, Style, Effects and Magic.
- One-click Install to Home Assistant: dashboard, theme, cards, scripts, scenes and the sunset automation.
- Auto-build a page for every room from your areas, plus a touchscreen home.
- Cards: the Control hub (tiles or touchscreen, with a car tile), dual shades, the Tesla-style vehicle card, and effects (moving backgrounds, page, touch and on/off animations).

## 0.11.0

- **Your car in the hub:** the Control hub has a car tile with the battery level. Tap it for the full Tesla-style view. The hub card finds your car by itself. It shows on All rooms and in a room like Garage or Driveway. Set `vehicle: false` to hide it.
- **Real 3D cars:** use a GLB file you made with [Tesla Model Extractor](https://github.com/koenhendriks/tesla-model-extractor) from your own copy of the Tesla app. The frunk, trunk and charge port open in 3D to match your car, and you can drag to turn it. Set `model_url` on the card, or **3D car** in the Studio.
- **Your own car picture:** upload one in the Studio, or set `image` on the card. Charging, sentry and climate still glow on top.
- The car drawing is more realistic: a metallic sheen, aero wheels, mirrors, door handles, and light housings.
- Fix: Auto-build my home and Fill rooms only use your real Home Assistant areas. They no longer guess rooms from entity names when you have areas.
- Fix: leftover entities from removed devices, and hidden, disabled or settings-only entities, are left out.

## 0.10.0

- New **Vehicle** block and card, in the style of the Tesla app:
  - Your car is drawn in its paint color: Model 3, Model Y, Model S, Model X or Cybertruck. There are 8 Tesla paints, or pick any color.
  - Battery and range, with a charge limit mark. While charging, the bar glows and shows the power and the time left.
  - Buttons for lock, climate, frunk, trunk, charge port, charging and sentry.
  - The car shows what's happening: the frunk and trunk lift open, a charging cable glows, air flows in the cabin (blue to cool, orange to heat), headlights turn on when unlocked, and a red light pulses in sentry mode.
  - It finds your car by itself (Tesla Fleet, Teslemetry, Tessie and similar), and has a visual editor.
- More animation styles:
  - Page changes: **Rise**, **Blur**, **Swing** and **Bounce**.
  - Touch: **Sparkle**, **Ring** and **Glow**.
  - On/off: **Bounce**, **Flash** and **Burst**.

## 0.9.0

- New **Animations** in Effects, in the Studio and in Home Assistant:
  - **Page and room changes:** Fade, Slide, Zoom or Flip. Slide and Flip follow the direction you're going.
  - **When you touch something:** a Ripple, or a soft Press.
  - **When a device turns on or off:** a Pop or a Glow. It also plays when a device changes from somewhere else, like a light switch on the wall.
- The hub card has them built in. The effects card adds them to every card in the view.
- Each one can be turned off. Calm mode and your device's reduced motion setting turn them all off.

## 0.8.2

- New **Room button roundness** for the touchscreen layout, from square corners to fully round. On the card it's `room_radius` (0 to 30, and 30 is fully round).
- New **Icon background** choice: **Circle** or **None**. With no circle, icons that are on glow softly and icons that are off are dimmer. On the card it's `icon_background: false`.

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
