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
# │   file     : tesla.py                                │
# │   author   : Patrick (and the interns)               │
# │   hatched  : 2026-10-26                              │
# │   license  : Muscovy Public License (joke, see       │
# │              LICENSE file for the real one)          │
# │   status   : no ducks harmed. all fed. one is        │
# │              sitting on the keyboard.                │
# │                                                      │
# ╰──────────────────────────────────────────────────────╯

"""Real 3D Teslas for Dashboard Studio.

Copies the Tesla app the user owns (uploaded, or pulled off their phone by the Studio over USB),
turns it into a Tesla View asset pack with tesla-model-extractor, installs the Tesla View
integration and the pack, and finishes Tesla View's setup. Nothing leaves this Home Assistant.
"""
import asyncio
import importlib.util
import json
import logging
import os
import platform
import re
import shutil
import sys
import time
import zipfile
from pathlib import Path

from aiohttp import ClientTimeout, web

log = logging.getLogger("studio")

EXTRACT = os.environ.get("TESLA_EXTRACT", "/opt/tme/bin/tesla-model-extract")
TV_ZIP = os.environ.get("TESLA_VIEW_ZIP", "https://github.com/koenhendriks/tesla-view/releases/latest/download/tesla_view.zip")
SAFE_NAME = re.compile(r"^[A-Za-z0-9._ -]{1,140}$")
BUNDLE_EXT = (".apk", ".apks", ".apkm", ".xapk")
SAFE_MODEL = re.compile(r"^[A-Za-z0-9_]{1,40}$")

JOB = {"state": "idle", "step": "", "log": [], "error": None, "vehicles": None, "done": None, "started": None}


def _say(line):
    line = str(line).rstrip()
    if line:
        JOB["log"].append(line)
        del JOB["log"][:-300]


def _begin(state, step):
    JOB.update(state=state, step=step, error=None, done=None, started=time.time())
    JOB["log"] = []


class Paths:
    def __init__(self, data: Path, config: Path):
        self.work = data / "tesla"
        self.inbox = self.work / "in"
        self.out = self.work / "out"
        self.recovered = self.work / "recovered"
        self.cache = self.work / "cache"
        self.config = config
        self.tv = config / "custom_components" / "tesla_view"


def supported():
    return platform.machine() in ("x86_64", "amd64") and Path(EXTRACT).exists()


def _index(p: Paths):
    try:
        return json.loads((p.config / "tesla_view" / "index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _kept(p: Paths):
    try:
        return json.loads((p.work / "vehicles.json").read_text(encoding="utf-8")) if p.recovered.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


async def status(request):
    p: Paths = request.app["tesla"]
    idx = _index(p) or {}
    files = [{"name": f.name, "size": f.stat().st_size} for f in sorted(p.inbox.glob("*")) if f.is_file()] if p.inbox.exists() else []
    free = shutil.disk_usage(p.work.parent).free if p.work.parent.exists() else 0
    return web.json_response({
        "supported": supported(), "arch": platform.machine(),
        "tesla_view": (p.tv / "manifest.json").exists(),
        "models": [{"id": k, "name": v.get("name") or k} for k, v in (idx.get("models") or {}).items()],
        "files": files, "free_gb": round(free / 1e9, 1), "kept": _kept(p),
        "job": {**JOB, "log": JOB["log"][-60:]},
    })


async def upload(request):
    """Receive one piece of an APK file. The Studio sends big files in pieces, in order."""
    p: Paths = request.app["tesla"]
    name = request.query.get("name", "")
    if not SAFE_NAME.match(name) or not name.lower().endswith(BUNDLE_EXT):
        return web.json_response({"error": "Only Tesla app files (.apk, .apks, .apkm or .xapk) can be uploaded."}, status=400)
    if JOB["state"] in ("scan", "build"):
        return web.json_response({"error": "Please wait until the current step finishes."}, status=409)
    offset = int(request.query.get("offset", "0"))
    if request.query.get("reset") == "1":
        shutil.rmtree(p.inbox, ignore_errors=True)
        shutil.rmtree(p.recovered, ignore_errors=True)
        JOB.update(vehicles=None)
    p.inbox.mkdir(parents=True, exist_ok=True)
    target = p.inbox / name
    mode = "r+b" if offset and target.exists() else "wb"
    with open(target, mode) as f:
        f.seek(offset)
        async for chunk in request.content.iter_chunked(1 << 20):
            f.write(chunk)
        size = f.tell()
    return web.json_response({"ok": True, "size": size})


def _bundle(p: Paths) -> Path:
    files = [f for f in sorted(p.inbox.glob("*")) if f.is_file() and f.suffix.lower() in BUNDLE_EXT and f.name != "tesla.apks"]
    if not files:
        raise RuntimeError("No Tesla app file yet. Upload one, or get it from your phone.")
    if len(files) == 1:
        return files[0]
    # several split APKs from a phone: pack them the way an .apks bundle is packed
    out = p.inbox / "tesla.apks"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
        for f in files:
            z.write(f, f.name)
    return out


async def _run(p: Paths, *args, want_stdout=False):
    env = {**os.environ, "XDG_CACHE_HOME": str(p.cache), "XDG_DATA_HOME": str(p.cache / "xdg"), "HOME": str(p.work),
           "PYTHONUNBUFFERED": "1", "COLUMNS": "100", "TERM": "dumb", "NO_COLOR": "1"}
    p.cache.mkdir(parents=True, exist_ok=True)
    proc = await asyncio.create_subprocess_exec(EXTRACT, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
    out = []

    async def pump(stream, keep):
        async for raw in stream:
            line = raw.decode("utf-8", "replace")
            if keep:
                out.append(line)
            else:
                _say(line)

    await asyncio.gather(pump(proc.stdout, want_stdout), pump(proc.stderr, False))
    code = await proc.wait()
    if code != 0:
        if want_stdout:
            for line in out[-20:]:
                _say(line)
        raise RuntimeError(f"The extractor stopped (code {code}). The log above says why.")
    return "".join(out)


async def scan(request):
    """Read the app and list the cars inside it."""
    p: Paths = request.app["tesla"]
    if not supported():
        return web.json_response({"error": "This needs a Home Assistant on an x86 computer, like a mini PC."}, status=400)
    if JOB["state"] in ("scan", "build"):
        return web.json_response({"error": "Already working on it."}, status=409)
    _begin("scan", "Reading the Tesla app. The first time takes a few minutes.")

    async def go():
        try:
            bundle = _bundle(p)
            _say(f"Reading {bundle.name} ({bundle.stat().st_size / 1e6:.0f} MB)")
            text = await _run(p, "list", str(bundle), "--keep-recovered", str(p.recovered), "--json", want_stdout=True)
            data = json.loads(text[text.index("{"):])
            JOB["vehicles"] = [{"id": v["id"], "name": v.get("name") or v["id"], "size": v.get("raw_bytes")}
                               for v in data.get("vehicles", []) if v.get("present")]
            (p.work / "vehicles.json").write_text(json.dumps({"vehicles": JOB["vehicles"], "app_version": data.get("app_version")}), encoding="utf-8")
            JOB["paints"] = data.get("paints") or []
            JOB.update(state="scanned", step=f"Found {len(JOB['vehicles'])} cars in Tesla app {data.get('app_version') or ''}".strip())
        except Exception as err:  # noqa: BLE001
            log.exception("Tesla scan failed")
            JOB.update(state="error", error=str(err))

    request.app["tesla_task"] = asyncio.create_task(go())
    return web.json_response({"ok": True})


async def _core(app, method, path, body=None, timeout=30):
    core, token = app["tesla_core"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with app["session"].request(method, f"{core}/api{path}", headers=headers, json=body, timeout=ClientTimeout(total=timeout)) as r:
        text = await r.text()
        if r.status >= 400:
            raise RuntimeError(f"Home Assistant said {r.status}: {text[:200]}")
        return json.loads(text) if text else None


async def _install_tesla_view(request, p: Paths):
    _say("Downloading Tesla View from GitHub")
    async with request.app["session"].get(TV_ZIP, timeout=ClientTimeout(total=120)) as r:
        if r.status >= 400:
            raise RuntimeError(f"Couldn't download Tesla View ({r.status}).")
        data = await r.read()
    tmp = p.work / "tesla_view_zip"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    zpath = p.work / "tesla_view.zip"
    zpath.write_bytes(data)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            name = info.filename
            if name.startswith(("/", "\\")) or ".." in Path(name).parts:
                raise RuntimeError("The Tesla View download looks wrong, so it wasn't installed.")
        z.extractall(tmp)
    if not (tmp / "manifest.json").exists():
        raise RuntimeError("The Tesla View download has no manifest.json, so it wasn't installed.")
    p.tv.parent.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(p.tv, ignore_errors=True)
    shutil.move(str(tmp), str(p.tv))
    zpath.unlink(missing_ok=True)
    _say(f"Installed Tesla View in {p.tv.relative_to(p.config)}")


def _install_packs(p: Paths):
    """Use Tesla View's own pack installer, so the files end up exactly where it expects them."""
    spec = importlib.util.spec_from_file_location("tesla_view_packs", p.tv / "packs.py")
    packs = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = packs  # its dataclasses look themselves up here
    spec.loader.exec_module(packs)
    zips = sorted(p.out.glob("*.zip"))
    if not zips:
        raise RuntimeError("The extractor didn't write an asset pack.")
    names = []
    for z in zips:
        info = packs.install_pack(str(p.config), str(z))
        names += info.models
        _say(f"Added asset pack {info.id}: {', '.join(info.models)}")
    return names


async def _wait_for_core(app, timeout=600):
    start = time.time()
    await asyncio.sleep(15)
    while time.time() - start < timeout:
        try:
            cfg = await _core(app, "GET", "/config", timeout=10)
            if cfg and cfg.get("state") in (None, "RUNNING"):
                return cfg
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(5)
    raise RuntimeError("Home Assistant took too long to restart. Open Settings › Devices & services › Tesla View to finish.")


async def _ensure_entry(app):
    entries = await _core(app, "GET", "/config/config_entries/entry?domain=tesla_view") or []
    entries = [e for e in entries if e.get("domain") == "tesla_view"]
    if entries:
        await _core(app, "POST", f"/config/config_entries/entry/{entries[0]['entry_id']}/reload")
        _say("Reloaded Tesla View")
        return
    flow = await _core(app, "POST", "/config/config_entries/flow", {"handler": "tesla_view", "show_advanced_options": False})
    if flow.get("type") == "form":
        flow = await _core(app, "POST", f"/config/config_entries/flow/{flow['flow_id']}", {})
    if flow.get("type") != "create_entry":
        raise RuntimeError(f"Tesla View's setup stopped at '{flow.get('step_id') or flow.get('reason')}'. Finish it in Settings › Devices & services.")
    _say("Set up Tesla View")


async def build(request):
    """Make the asset pack, install Tesla View and the pack, and finish Tesla View's setup."""
    p: Paths = request.app["tesla"]
    if not supported():
        return web.json_response({"error": "This needs a Home Assistant on an x86 computer, like a mini PC."}, status=400)
    if JOB["state"] in ("scan", "build"):
        return web.json_response({"error": "Already working on it."}, status=409)
    body = await request.json()
    models = [m for m in (body.get("models") or []) if SAFE_MODEL.match(str(m))]
    keep = bool(body.get("keep"))
    if not models:
        return web.json_response({"error": "Pick at least one car."}, status=400)
    _begin("build", "Making your car")

    async def go():
        try:
            shutil.rmtree(p.out, ignore_errors=True)
            p.out.mkdir(parents=True)
            # reuse the project the scan already recovered, so the slow part runs only once
            source = str(p.recovered) if p.recovered.exists() else str(_bundle(p))
            if not JOB.get("vehicles") and _kept(p):
                JOB["vehicles"] = _kept(p)["vehicles"]
            await _run(p, "extract", source, "--models", ",".join(models), "-o", str(p.out), "--yes")
            fresh = not (p.tv / "manifest.json").exists()
            JOB["step"] = "Installing Tesla View"
            if fresh:
                await _install_tesla_view(request, p)
            JOB["step"] = "Adding your car to Tesla View"
            added = await asyncio.get_running_loop().run_in_executor(None, _install_packs, p)
            JOB["step"] = "Cleaning up"
            shutil.rmtree(p.out, ignore_errors=True)
            if keep and p.recovered.exists():
                shutil.rmtree(p.inbox, ignore_errors=True)  # the read app is all that's needed to add more cars
                _say("Kept the read app, so you can add more cars later without sending it again")
            else:
                shutil.rmtree(p.inbox, ignore_errors=True)
                shutil.rmtree(p.recovered, ignore_errors=True)
                (p.work / "vehicles.json").unlink(missing_ok=True)
                _say("Removed the copy of the Tesla app and the work files")
            names = {v["id"]: v["name"] for v in (JOB.get("vehicles") or [])}
            JOB["done"] = {"models": [names.get(m, m) for m in added], "fresh": fresh}
            if fresh:
                # Home Assistant only finds a new integration when it starts, so ask before restarting it
                JOB.update(state="restart", step="Tesla View is installed. Home Assistant needs to restart once to start it.")
                _say("Waiting for you to choose when Home Assistant restarts")
                return
            await _finish(request.app)
        except Exception as err:  # noqa: BLE001
            log.exception("Tesla build failed")
            JOB.update(state="error", error=str(err))

    request.app["tesla_task"] = asyncio.create_task(go())
    return web.json_response({"ok": True})


async def _finish(app):
    JOB.update(state="build", step="Finishing Tesla View's setup")
    await _ensure_entry(app)
    JOB.update(state="done", step="Your real 3D Tesla is ready")


async def _tesla_view_found(app):
    try:
        handlers = await _core(app, "GET", "/config/config_entries/flow_handlers", timeout=10) or []
    except Exception:  # noqa: BLE001
        return False
    return "tesla_view" in handlers


async def restart(request):
    """Restart Home Assistant now, or wait and finish after the next restart, whenever that is."""
    if JOB["state"] not in ("restart", "later"):
        return web.json_response({"error": "Nothing is waiting for a restart."}, status=409)
    now = bool((await request.json()).get("now"))
    app = request.app

    async def go():
        try:
            if now:
                JOB.update(state="build", step="Restarting Home Assistant. This takes a minute or two.")
                _say("Restarting Home Assistant")
                try:
                    await _core(app, "POST", "/services/homeassistant/restart", {})
                except Exception:  # noqa: BLE001
                    pass  # the connection drops while it restarts
                await _wait_for_core(app)
                await _finish(app)
                return
            JOB.update(state="later", step="Waiting for your next Home Assistant restart. Setup finishes by itself after that.")
            _say("Will finish after the next restart")
            while JOB["state"] == "later":
                if await _tesla_view_found(app):
                    await _finish(app)
                    return
                await asyncio.sleep(30)
        except Exception as err:  # noqa: BLE001
            log.exception("Tesla View setup failed")
            JOB.update(state="error", error=str(err))

    app["tesla_task"] = asyncio.create_task(go())
    return web.json_response({"ok": True})


async def _resume(app):
    """After the add-on itself restarts: if Tesla View and a car are installed but not set up yet, finish once Home Assistant finds it."""
    p: Paths = app["tesla"]
    await asyncio.sleep(20)
    for _ in range(240):
        if JOB["state"] not in ("idle", "later") or not (p.tv / "manifest.json").exists() or not (_index(p) or {}).get("models"):
            return
        try:
            entries = await _core(app, "GET", "/config/config_entries/entry?domain=tesla_view", timeout=10) or []
            if any(e.get("domain") == "tesla_view" for e in entries):
                return
            if await _tesla_view_found(app):
                await _ensure_entry(app)
                log.info("Finished Tesla View's setup")
                return
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(60)


async def clear(request):
    p: Paths = request.app["tesla"]
    if JOB["state"] in ("scan", "build", "restart", "later"):
        return web.json_response({"error": "Please wait until the current step finishes."}, status=409)
    for d in (p.inbox, p.recovered, p.out):
        shutil.rmtree(d, ignore_errors=True)
    (p.work / "vehicles.json").unlink(missing_ok=True)
    _begin("idle", "")
    JOB.update(vehicles=None)
    return web.json_response({"ok": True})


def setup(app, data: Path, config: Path, core: str, token: str):
    app["tesla"] = Paths(data, config)
    app["tesla_core"] = (core, token)
    app.router.add_get("/api/tesla/status", status)
    app.router.add_post("/api/tesla/upload", upload)
    app.router.add_post("/api/tesla/scan", scan)
    app.router.add_post("/api/tesla/build", build)
    app.router.add_post("/api/tesla/clear", clear)
    app.router.add_post("/api/tesla/restart", restart)

    async def resume(app):
        app["tesla_resume"] = asyncio.create_task(_resume(app))
    app.on_startup.append(resume)
