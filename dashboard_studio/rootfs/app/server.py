# ╭──────────────────────────────────────────────────────╮
# │                                                      │
# │          ,,                                          │
# │        <(o )___           ✦ PATRICK'S NEST ✦         │
# │         ( ._> /           quackomation for HA        │
# │          `---'            hatched with love          │
# │      __       __       __                            │
# │    <(o )__  <(o )__  <(o )__    (the interns)        │
# │     (._>/    (._>/    (._>/     unpaid. underfoot.   │
# │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
# │                                                      │
# │   file     : server.py                               │
# │   author   : Patrick (and the interns)               │
# │   hatched  : 2026-10-26                              │
# │   license  : Muscovy Public License (joke, see       │
# │              LICENSE file for the real one)          │
# │   status   : no ducks harmed. all fed. one is        │
# │              sitting on the keyboard.                │
# │                                                      │
# ╰──────────────────────────────────────────────────────╯

"""Dashboard Studio add-on server.

Serves the Studio builder through Home Assistant ingress and gives it a small, safe API:
reading entities and areas, saving designs, and installing a finished dashboard
(themes, the hub card, scripts, scenes, automations and files) in one request.
The Supervisor token never leaves this process.
"""
import base64
import json
import logging
import os
import re
import shutil
from pathlib import Path

import yaml
from aiohttp import ClientSession, ClientTimeout, web

VERSION = os.environ.get("STUDIO_VERSION", "0.10.0")
def _token():
    """The Supervisor's token, from the environment or from where s6 keeps the container's environment."""
    tok = os.environ.get("SUPERVISOR_TOKEN", "")
    if not tok:
        for f in ("/run/s6/container_environment/SUPERVISOR_TOKEN", "/var/run/s6/container_environment/SUPERVISOR_TOKEN"):
            try:
                tok = Path(f).read_text(encoding="utf-8").strip()
                break
            except OSError:
                continue
    return tok


TOKEN = _token()
CORE = os.environ.get("STUDIO_CORE", "http://supervisor/core")
APP = Path(__file__).parent
DATA = Path(os.environ.get("STUDIO_DATA", "/data"))
CONFIG = Path(os.environ.get("STUDIO_CONFIG", "/homeassistant"))
INGRESS_IP = "172.30.32.2"
CARD_FILE = "dashboard-studio-card.js"
SAFE_FILE = re.compile(r"^www/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|svg)$")
SAFE_ID = re.compile(r"^[a-z0-9_]{1,64}$")

logging.basicConfig(level=logging.INFO, format="[studio] %(levelname)s %(message)s")
log = logging.getLogger("studio")


class CoreError(Exception):
    pass


class Core:
    """One websocket session with Home Assistant Core, plus REST helpers."""

    def __init__(self, session: ClientSession):
        self.s = session
        self.ws = None
        self.n = 0

    async def __aenter__(self):
        self.ws = await self.s.ws_connect(f"{CORE}/websocket", max_msg_size=0)
        await self.ws.receive_json()  # auth_required
        await self.ws.send_json({"type": "auth", "access_token": TOKEN})
        msg = await self.ws.receive_json()
        if msg.get("type") != "auth_ok":
            raise CoreError("Home Assistant refused the add-on's login.")
        return self

    async def __aexit__(self, *exc):
        if self.ws is not None:
            await self.ws.close()

    async def call(self, kind, **data):
        self.n += 1
        mid = self.n
        await self.ws.send_json({"id": mid, "type": kind, **data})
        while True:
            msg = await self.ws.receive_json()
            if msg.get("id") == mid and msg.get("type") == "result":
                if not msg.get("success"):
                    raise CoreError((msg.get("error") or {}).get("message", "Home Assistant said no."))
                return msg.get("result")

    async def rest(self, method, path, body=None):
        headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
        async with self.s.request(method, f"{CORE}/api{path}", headers=headers, json=body) as r:
            text = await r.text()
            if r.status >= 400:
                raise CoreError(f"{r.status} {text[:200]}")
            return json.loads(text) if text else None


@web.middleware
async def ingress_only(request, handler):
    if request.remote not in (INGRESS_IP, "127.0.0.1", "::1"):
        return web.Response(status=403, text="Open Dashboard Studio from the Home Assistant sidebar.")
    try:
        return await handler(request)
    except CoreError as err:
        log.warning("%s %s: %s", request.method, request.path, err)
        return web.json_response({"error": str(err)}, status=502)


async def index(_request):
    body = (APP / "studio.html").read_text(encoding="utf-8")
    page = (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
        "body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>"
        f"<script>window.STUDIO_ADDON={{version:{json.dumps(VERSION)}}}</script>"
        f"</head><body>{body}</body></html>"
    )
    return web.Response(text=page, content_type="text/html", headers={"Cache-Control": "no-store"})


async def ha_info(request):
    async with Core(request.app["session"]) as c:
        states = await c.rest("GET", "/states")
        cfg = await c.rest("GET", "/config")
        areas = await c.call("config/area_registry/list")
        entities = await c.call("config/entity_registry/list")
        devices = await c.call("config/device_registry/list")
    device_area = {d["id"]: d.get("area_id") for d in devices}
    entity_area = {e["entity_id"]: e.get("area_id") or device_area.get(e.get("device_id")) for e in entities}
    return web.json_response({
        "entities": [{
            "entity_id": s["entity_id"],
            "name": s.get("attributes", {}).get("friendly_name") or s["entity_id"],
            "state": s.get("state"),
            "area": entity_area.get(s["entity_id"]),
        } for s in states],
        "areas": [{"id": a["area_id"], "name": a["name"]} for a in areas],
        "unit": (cfg.get("unit_system") or {}).get("temperature"),
        "location": cfg.get("location_name"),
        "version": cfg.get("version"),
    })


async def design_get(_request):
    f = DATA / "design.json"
    if not f.exists():
        return web.json_response(None)
    return web.Response(text=f.read_text(encoding="utf-8"), content_type="application/json")


async def design_put(request):
    text = await request.text()
    json.loads(text)  # refuse anything that isn't JSON
    tmp = DATA / "design.json.tmp"
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(DATA / "design.json")
    return web.json_response({"ok": True})


async def install(request):
    p = await request.json()
    report = []

    def ok(step, detail=""):
        report.append({"step": step, "ok": True, "detail": detail})

    def bad(step, detail):
        report.append({"step": step, "ok": False, "detail": detail})

    dash = p.get("dashboard") or {}
    url = str(dash.get("url_path") or "home-studio")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", url):
        return web.json_response({"error": "The dashboard URL needs lowercase letters and a dash, like home-studio."}, status=400)

    async with Core(request.app["session"]) as c:
        # 1. Files: wallpaper and floor plans, only inside /config/www
        for f in p.get("files") or []:
            path = str(f.get("path", ""))
            if not SAFE_FILE.match(path):
                bad("File skipped", f"{path} isn't a picture name the add-on is allowed to write.")
                continue
            target = CONFIG / path
            target.parent.mkdir(parents=True, exist_ok=True)
            if "data_url" in f:
                target.write_bytes(base64.b64decode(str(f["data_url"]).split(",", 1)[-1]))
            else:
                target.write_text(str(f.get("text", "")), encoding="utf-8")
            ok("Saved " + path.replace("www/", "picture "), f"/local/{path[4:]}")

        # 2. Themes: our own file in /config/themes, then reload
        themes = p.get("themes") or {}
        if themes:
            try:
                (CONFIG / "themes").mkdir(exist_ok=True)
                (CONFIG / "themes" / "dashboard_studio.yaml").write_text(
                    "# Written by the Dashboard Studio add-on. Install again to update it.\n"
                    + yaml.safe_dump(themes, sort_keys=False, allow_unicode=True), encoding="utf-8")
                await c.rest("POST", "/services/frontend/reload_themes", {})
                loaded = (await c.call("frontend/get_themes")).get("themes", {})
                missing = [n for n in themes if n not in loaded]
                if missing:
                    bad("Themes", "Saved to /config/themes, but Home Assistant isn't reading that folder yet. "
                                  "Add  frontend: themes: !include_dir_merge_named themes  to configuration.yaml, restart, then install again.")
                else:
                    ok("Themes", ", ".join(themes))
            except (CoreError, OSError) as err:
                bad("Themes", str(err))

        # 3. The hub card, registered as a dashboard resource
        if p.get("card"):
            try:
                (CONFIG / "www").mkdir(exist_ok=True)
                shutil.copyfile(APP / CARD_FILE, CONFIG / "www" / CARD_FILE)
                res_url = f"/local/{CARD_FILE}?v={VERSION}"
                resources = await c.call("lovelace/resources")
                mine = [r for r in resources if r["url"].split("?")[0] == f"/local/{CARD_FILE}"]
                if not mine:
                    await c.call("lovelace/resources/create", res_type="module", url=res_url)
                elif mine[0]["url"] != res_url:
                    await c.call("lovelace/resources/update", resource_id=mine[0]["id"], res_type="module", url=res_url)
                ok("Dashboard Studio card", f"Version {VERSION}. Reload your browser if the hub shows an error the first time.")
            except CoreError as err:
                bad("Dashboard Studio card", f"The card file is in /config/www, but it couldn't be added as a resource ({err}). "
                                             f"If your dashboards are in YAML mode, add /local/{CARD_FILE} as a module yourself.")

        # 4. Scripts, scenes and automations through Home Assistant's own editors
        for sid, cfg in (p.get("scripts") or {}).items():
            if not SAFE_ID.match(sid):
                continue
            try:
                await c.rest("POST", f"/config/script/config/{sid}", cfg)
                ok(f"Script: {cfg.get('alias', sid)}", f"script.{sid}")
            except CoreError as err:
                bad(f"Script: {cfg.get('alias', sid)}", str(err))
        for scene in p.get("scenes") or []:
            sid = str(scene.get("id", ""))
            if not SAFE_ID.match(sid):
                continue
            try:
                await c.rest("POST", f"/config/scene/config/{sid}", scene)
                ok(f"Scene: {scene.get('name', sid)}")
            except CoreError as err:
                bad(f"Scene: {scene.get('name', sid)}", str(err))
        for auto in p.get("automations") or []:
            aid = str(auto.get("id", ""))
            if not SAFE_ID.match(aid):
                continue
            try:
                await c.rest("POST", f"/config/automation/config/{aid}", auto)
                ok(f"Automation: {auto.get('alias', aid)}")
            except CoreError as err:
                bad(f"Automation: {auto.get('alias', aid)}", str(err))

        # 5. The dashboard itself: create it once, then save its config
        boards = await c.call("lovelace/dashboards/list")
        if not any(b.get("url_path") == url for b in boards):
            fields = dict(url_path=url, title=dash.get("title") or "Home", icon=dash.get("icon") or "mdi:view-dashboard",
                          show_in_sidebar=True, require_admin=False)
            try:
                await c.call("lovelace/dashboards/create", mode="storage", **fields)
            except CoreError as err:
                if "extra keys" not in str(err):
                    raise
                await c.call("lovelace/dashboards/create", **fields)
        await c.call("lovelace/config/save", url_path=url, config=dash.get("config") or {})
        ok("Dashboard", f"Saved at /{url} and added to the sidebar.")

    return web.json_response({"report": report, "url": f"/{url}"})


async def ping(_request):
    return web.json_response({"ok": True, "version": VERSION})


async def on_startup(app):
    app["session"] = ClientSession(timeout=ClientTimeout(total=60))


async def on_cleanup(app):
    await app["session"].close()


def make_app():
    app = web.Application(middlewares=[ingress_only], client_max_size=25 * 1024 * 1024)
    app.router.add_get("/", index)
    app.router.add_get("/api/ping", ping)
    app.router.add_get("/api/ha", ha_info)
    app.router.add_get("/api/design", design_get)
    app.router.add_put("/api/design", design_put)
    app.router.add_post("/api/install", install)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    if not TOKEN:
        log.error("Couldn't find the Supervisor token, so the Studio can't reach Home Assistant. Check that the add-on is up to date, then restart it.")
    log.info("Dashboard Studio %s is ready. Open it from the Home Assistant sidebar.", VERSION)
    web.run_app(make_app(), host="0.0.0.0", port=8099, print=None, access_log=None)
