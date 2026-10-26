# Credits and thanks 💜

Dashboard Studio's real 3D Teslas stand on the work of other people. Thank you!

## The two projects behind Real 3D Tesla

### Tesla View, by Koen Hendriks
**[github.com/koenhendriks/tesla-view](https://github.com/koenhendriks/tesla-view)** · MIT License

A Home Assistant integration and card that renders your Tesla in 3D, the way the Tesla app does: the same meshes, materials, animations and lighting, driven by your entities, with tap targets that really work.

How Dashboard Studio uses it:
- The add-on downloads Tesla View's own release from its GitHub page and installs it into `custom_components/tesla_view`. It isn't copied into this repository.
- It adds your car with Tesla View's own pack installer (`packs.py`), so everything ends up where Tesla View expects it.
- When Tesla View is installed, the Vehicle card and the Control hub's car view show Tesla View's card inside them.

### Tesla Model Extractor, by Koen Hendriks
**[github.com/koenhendriks/tesla-model-extractor](https://github.com/koenhendriks/tesla-model-extractor)** · MIT License

Turns your own copy of the Tesla app into 3D files: GLB models with their animations, and asset packs for Tesla View.

How Dashboard Studio uses it:
- The add-on installs it from its GitHub page (at a pinned version) when the add-on is built, and runs it to make your car.
- The Vehicle card can also show a GLB file you made with it yourself (`model_url`).

## Other open-source projects

| Project | What it does here | License |
| --- | --- | --- |
| [GDRE Tools](https://github.com/GDRETools/gdsdecomp) | Reads the Godot project inside the Tesla app. Tesla Model Extractor uses it, and the add-on downloads the release Tesla Model Extractor pins, with a checksum check | MIT |
| [ya-webadb / Tango](https://github.com/yume-chan/ya-webadb) by Simon Chan | Talks to your phone over USB from the browser (`@yume-chan/adb`, `adb-daemon-webusb`, `adb-credential-web`), bundled in `dashboard_studio/rootfs/app/adb.js` | MIT |
| [three.js](https://threejs.org) | Draws GLB cars in 3D, loaded from jsDelivr when a card shows one | MIT |

## About Tesla's material

Neither this project nor the projects above include anything made by Tesla. Your car's 3D files come from your own copy of the Tesla app, are made on your own Home Assistant, and are for you alone. Please don't share them.

Tesla, Model 3, Model S, Model X, Model Y and Cybertruck are trademarks of Tesla, Inc. Dashboard Studio isn't affiliated with or endorsed by Tesla, Inc., or by the authors of the projects above.
