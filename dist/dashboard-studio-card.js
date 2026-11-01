// ╭──────────────────────────────────────────────────────╮
// │                                                      │
// │          ,,                                          │
// │        <(o )___           ✦ PATRICK'S NEST ✦         │
// │         ( ._> /           quackomation for HA        │
// │          `---'            hatched with love          │
// │      __       __       __                            │
// │    <(o )__  <(o )__  <(o )__    (the interns)        │
// │     (._>/    (._>/    (._>/     unpaid. underfoot.   │
// │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
// │                                                      │
// │   file     : dashboard-studio-card.js                │
// │   author   : Patrick (and the interns)               │
// │   hatched  : 2026-10-26                              │
// │   license  : Muscovy Public License (joke, see       │
// │              LICENSE file for the real one)          │
// │   status   : no ducks harmed. all fed. one is        │
// │              sitting on the keyboard.                │
// │                                                      │
// ╰──────────────────────────────────────────────────────╯

/*
 * Dashboard Studio hub card for Home Assistant
 * Rooms show as chips, or as a dropdown when there are more than 6 (room_picker: chips, dropdown or auto).
 * layout: touchscreen gives a wall-panel look: room name at the top center opens the room list, now playing, big tiles, clock and weather.
 * A touchscreen-style home screen: room chips, big category tiles, per-room device controls,
 * scenes, an alarm keypad and a Good night button. Works with live entity states.
 *
 *   type: custom:dashboard-studio-hub
 *   title: My Home
 *   rooms:
 *     - name: Living Room
 *       devices:
 *         - light.living_room_ceiling
 *         - entity: cover.living_room_shades
 *           name: Shades
 *   scenes:
 *     - name: Movie night
 *       entity: scene.movie_night
 *   good_night: script.good_night
 */
const STUDIO_VERSION = '1.13.0';

const DOMAIN_TYPE = {
  light: 'light', switch: 'switch', input_boolean: 'switch', fan: 'fan', cover: 'shade', climate: 'climate',
  media_player: 'media', lock: 'lock', camera: 'camera', alarm_control_panel: 'alarm'
};
const TYPE_ICON = {
  light: 'mdi:lightbulb', switch: 'mdi:power-socket-us', fan: 'mdi:fan', shade: 'mdi:blinds', climate: 'mdi:thermostat',
  media: 'mdi:speaker', lock: 'mdi:lock', camera: 'mdi:cctv', alarm: 'mdi:shield-home'
};
const CATS = [
  ['light', 'Lights', 'mdi:lightbulb-group'], ['shade', 'Shades', 'mdi:blinds'], ['climate', 'Comfort', 'mdi:thermostat'],
  ['media', 'Listen & Watch', 'mdi:play-circle'], ['security', 'Security', 'mdi:shield-home'], ['camera', 'Cameras', 'mdi:cctv'],
  ['fan', 'Fans', 'mdi:fan'], ['switch', 'Outlets', 'mdi:power-socket-us'], ['laundry', 'Laundry', 'mdi:washing-machine'], ['car', 'Car', 'mdi:car-electric']
];
const catOf = t => (t === 'lock' || t === 'alarm') ? 'security' : t;
/* touchscreen layout tiles, in screen order */
const TOUCH = [['watch', 'Watch', 'mdi:television'], ['listen', 'Listen', 'mdi:speaker'], ['light', 'Lighting', 'mdi:lightbulb'], ['climate', 'Comfort', 'mdi:thermostat'], ['car', 'Car', 'mdi:car-electric'],
  ['shade', 'Shades', 'mdi:blinds'], ['security', 'Security', 'mdi:shield-home'], ['camera', 'Cameras', 'mdi:cctv'], ['fan', 'Fans', 'mdi:fan'],
  ['switch', 'Outlets', 'mdi:power-socket-us'], ['laundry', 'Laundry', 'mdi:washing-machine'], ['quick', 'Shortcuts', 'mdi:gesture-tap-button']];
/* one window with two shade motors (day/night fabrics, or top down, bottom up): two covers on one device, or names that only differ by a fabric word */
const DS_SWAP = [['blackout', 'sheer'], ['blackout', 'light_filtering'], ['blackout', 'filtering'], ['blackout', 'day'], ['night', 'day'], ['room_darkening', 'light_filtering'],
  ['dark', 'light'], ['privacy', 'sheer'], ['top', 'bottom'], ['upper', 'lower']];
const DS_DARK = /night|blackout|dark|privacy|top|upper|(^|[\s_])\d*b$/i, DS_LITE = /sheer|day|light|filter|bottom|lower|(^|[\s_])\d*s$/i;
function pairShades(list, hass) {
  const ents = hass.entities || {}, devs = hass.devices || {}, used = new Set(), pairs = [];
  const nm = id => hass.states[id]?.attributes?.friendly_name || id;
  const sl = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const covers = list.filter(d => d.entity.startsWith('cover.') && !d.entity2).map(d => d.entity);
  const byDev = {};
  covers.forEach(e => { const dv = ents[e]?.device_id; if (dv) (byDev[dv] ||= []).push(e); });
  Object.entries(byDev).forEach(([dv, l]) => { if (l.length !== 2) return; l.forEach(e => used.add(e)); pairs.push([l[0], l[1], devs[dv]?.name_by_user || devs[dv]?.name || '']); });
  const keys = () => covers.filter(e => !used.has(e)).map(e => [e, sl(nm(e)), sl(e.split('.')[1])]);
  for (const [a, z] of DS_SWAP) for (const [e, k, o] of keys()) {
    if (used.has(e)) continue;
    const re = new RegExp(`(^|_)${a}(?=_|$)`), base = re.test(k) ? k : re.test(o) ? o : null; if (!base) continue;
    const t = base.replace(re, (m, pre) => pre + z), tw = keys().find(([e2, k2, o2]) => e2 !== e && (k2 === t || o2 === t));
    if (tw) { used.add(e); used.add(tw[0]); pairs.push([e, tw[0], nm(e).replace(new RegExp(a.replace('_', ' '), 'i'), '').replace(/\s+/g, ' ').trim()]); }
  }
  /* numbered pairs like "1B" and "1S" */
  for (const [e, k] of keys()) {
    if (used.has(e)) continue;
    const m = k.match(/^(.*?)_?(\d+)_?b$/); if (!m) continue;
    const tw = keys().find(([e2, k2]) => e2 !== e && (k2 === `${m[1]}${m[2]}s` || k2 === `${m[1]}_${m[2]}s` || k2 === `${m[1]}_${m[2]}_s`));
    if (tw) { used.add(e); used.add(tw[0]); pairs.push([e, tw[0], `${m[1] ? m[1].replace(/_/g, ' ') + ' ' : ''}Shade ${m[2]}`.replace(/^\w/, c => c.toUpperCase())]); }
  }
  if (!pairs.length) return list;
  const txt = e => `${e} ${nm(e)}`, label = (e, base, dark) => {
    let n = nm(e); if (base && n.toLowerCase().startsWith(base.toLowerCase())) n = n.slice(base.length).trim();
    return !n || /^\d*\s*[sb]$/i.test(n) || n.length > 18 ? (dark ? 'Blackout' : 'Sheer') : n;
  };
  const merged = new Map(pairs.map(([x, y, base]) => {
    const [e1, e2] = (DS_DARK.test(txt(y)) && !DS_DARK.test(txt(x))) || (DS_LITE.test(txt(x)) && !DS_LITE.test(txt(y))) ? [y, x] : [x, y];
    return [e1, {entity: e1, entity2: e2, type: 'shade', name: base || nm(e1), labels: [label(e1, base, true), label(e2, base, false)]}];
  }));
  const second = new Set([...merged.values()].map(d => d.entity2));
  return list.filter(d => !second.has(d.entity)).map(d => merged.get(d.entity) || d);
}
const DS_PRESETS = [['Open', 100, 100, 'mdi:blinds-open'], ['Day', 100, 0, 'mdi:weather-sunny'], ['Night', 0, 0, 'mdi:weather-night']];
const isTV = x => x.st?.attributes?.device_class === 'tv' || /(^|[._ ])(tv|roku|apple_?tv|shield|chromecast|fire_?tv|android_?tv|television)([._ ]|$)/i.test(`${x.entity} ${x.name}`);
const WX_ICON = {sunny: 'mdi:weather-sunny', 'clear-night': 'mdi:weather-night', partlycloudy: 'mdi:weather-partly-cloudy', cloudy: 'mdi:weather-cloudy', rainy: 'mdi:weather-rainy',
  pouring: 'mdi:weather-pouring', snowy: 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy', lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy',
  fog: 'mdi:weather-fog', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', hail: 'mdi:weather-hail', exceptional: 'mdi:alert-circle-outline'};
const ALARM_LABEL = {
  disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away', armed_night: 'Armed night',
  armed_vacation: 'Armed vacation', armed_custom_bypass: 'Armed', arming: 'Arming…', pending: 'Entry delay…',
  disarming: 'Disarming…', triggered: 'Alarm triggered!'
};
const GN_DEFAULT = {lights: true, switches: true, fans: false, shades: true, media: true, locks: true, alarm: true};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

/* animations shared by the hub and effects cards: page and room changes, touch, on/off */
const ANIM_DEFAULT = {page: 'slide', tap: 'ripple', state: 'pop'};
const PAGE_KF = {
  fade: () => [{opacity: 0}, {opacity: 1}],
  slide: d => [{opacity: 0, transform: `translateX(${36 * d}px)`}, {opacity: 1, transform: 'none'}],
  zoom: () => [{opacity: 0, transform: 'scale(.94)'}, {opacity: 1, transform: 'none'}],
  flip: d => [{opacity: 0, transform: `perspective(1100px) rotateY(${14 * d}deg) translateX(${18 * d}px)`}, {opacity: 1, transform: 'none'}],
  rise: () => [{opacity: 0, transform: 'translateY(28px)'}, {opacity: 1, transform: 'none'}],
  blur: () => [{opacity: 0, filter: 'blur(12px)', transform: 'scale(1.02)'}, {opacity: 1, filter: 'blur(0)', transform: 'none'}],
  swing: () => [{opacity: 0, transform: 'perspective(1100px) rotateX(-18deg)', transformOrigin: '50% 0'}, {opacity: 1, transform: 'none', transformOrigin: '50% 0'}],
  bounce: () => [{opacity: 0, transform: 'scale(.86)'}, {opacity: 1, transform: 'scale(1.03)', offset: .6}, {transform: 'scale(.99)', offset: .8}, {opacity: 1, transform: 'none'}]
};
const animPage = (el, kind, dir = 1) => PAGE_KF[kind] && el?.animate(PAGE_KF[kind](dir < 0 ? -1 : 1), {duration: {fade: 350, flip: 500, bounce: 560, swing: 520, blur: 450}[kind] || 420, easing: kind === 'bounce' ? 'ease-out' : 'cubic-bezier(.2,.8,.2,1)'});
const animState = (el, kind, color) => {
  if (!el) return;
  if (kind === 'pop') el.animate([{transform: 'scale(1)'}, {transform: 'scale(1.07)', offset: .3}, {transform: 'scale(.98)', offset: .6}, {transform: 'scale(1)'}], {duration: 450, easing: 'cubic-bezier(.3,1.6,.5,1)'});
  if (kind === 'glow') el.animate([{boxShadow: `0 0 0 0 ${color}`}, {boxShadow: '0 0 0 16px rgba(0,0,0,0)'}], {duration: 750, easing: 'ease-out'});
  if (kind === 'bounce') el.animate([{transform: 'none'}, {transform: 'translateY(-8px)', offset: .3}, {transform: 'translateY(0)', offset: .55}, {transform: 'translateY(-3px)', offset: .75}, {transform: 'none'}], {duration: 600, easing: 'ease-out'});
  if (kind === 'flash') el.animate([{filter: 'brightness(1)'}, {filter: 'brightness(1.9) saturate(1.3)', offset: .25}, {filter: 'brightness(1)'}], {duration: 600, easing: 'ease-out'});
};
/* little bits of light that fly out from a point: on/off bursts and sparkle taps */
const burst = (layer, x, y, color, n = 10, dist = 46) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * .4, d = dist * (.6 + Math.random() * .6), sz = 4 + Math.random() * 4;
    const p = document.createElement('span');
    p.style.cssText = `position:absolute;left:${x - sz / 2}px;top:${y - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;background:${color};box-shadow:0 0 8px ${color}`;
    layer.append(p);
    p.animate([{transform: 'translate(0,0) scale(1)', opacity: 1}, {transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0}], {duration: 620 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)'}).onfinish = () => p.remove();
  }
};
const tapFx = (kind, layer, x, y, size, color) => {
  if (kind === 'ripple') return ripple(layer, x, y, size, color);
  if (kind === 'sparkle') return burst(layer, x, y, color, 8, 34);
  const r = document.createElement('span');
  const ring = kind === 'ring', sz = ring ? Math.min(size, 140) : size * 1.2;
  r.style.cssText = `position:absolute;left:${x - sz / 2}px;top:${y - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;` + (ring ? `border:2px solid ${color}` : `background:radial-gradient(circle,${color} 0,transparent 65%);filter:blur(6px)`);
  layer.append(r);
  r.animate(ring ? [{transform: 'scale(.1)', opacity: 1}, {transform: 'scale(1)', opacity: 0}] : [{transform: 'scale(.5)', opacity: 0}, {transform: 'scale(1)', opacity: 1, offset: .3}, {transform: 'scale(1.1)', opacity: 0}], {duration: ring ? 520 : 700, easing: 'ease-out'}).onfinish = () => r.remove();
};
const ripple = (layer, x, y, size, color) => {
  const r = document.createElement('span');
  r.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,${color} 0,transparent 70%)`;
  layer.append(r);
  r.animate([{transform: 'scale(.15)', opacity: .9}, {transform: 'scale(1)', opacity: 0}], {duration: 600, easing: 'ease-out'}).onfinish = () => r.remove();
};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

class DashboardStudioHub extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._room = -1; this._view = null; this._code = ''; this._msg = ''; this._err = false; this._busy = false;
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
    this.shadowRoot.addEventListener('change', e => this._onChange(e));
    this.shadowRoot.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) this._busy = true; this._tap(e); });
    window.addEventListener('pointerup', () => { if (this._busy) { this._busy = false; if (this._pending) this._render(); } });
  }

  static getStubConfig() {
    return {layout: 'touchscreen'};
  }

  static getConfigElement() { return document.createElement('dashboard-studio-hub-editor'); }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    const hand = Array.isArray(config.rooms) && config.rooms.length > 0;
    /* no rooms: fill them from Home Assistant areas. No scenes: use the scene entities */
    this._auto = !hand; this._autoScenes = config.scenes == null; this._regs = null;
    this._config = {
      ...config,
      rooms: hand ? config.rooms.map(r => ({name: r.name || 'Room', devices: (r.devices || []).map(d => typeof d === 'string' ? {entity: d} : d).filter(d => d && d.entity)})) : [],
      scenes: (config.scenes || []).map(s => typeof s === 'string' ? {entity: s} : s).filter(s => s && s.entity)
    };
    if (this._hass) this._autoFill(this._hass);
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    const filled = this._autoFill(hass);
    if (this._carCfg() && (!this._carE || old?.entities !== hass.entities)) {
      this._carE = findVehicle(hass, this._carCfg());
      this._cars = this._findCars(hass);
    }
    const car = this._view === 'car' ? [] : (this._cars || []).flatMap(x => Object.values(x.e));
    if (old?.entities !== hass.entities) this._lfound = null;
    if (this._lc) car.push(...(this._lc._machines || []).flatMap(m => Object.values(m.r).filter(Boolean)));
    if (filled || !old || [...this._watched(), ...car].some(e => old.states[e] !== hass.states[e]) || old.themes !== hass.themes) this._schedule();
    const v = this._root?.querySelector('.hub-car'); if (v) v.hass = hass;
    Object.values(this._minis || {}).forEach(m => { if (m.isConnected) m.hass = hass; });
  }

  /* the car: found by itself unless vehicle is false. It shows on All rooms, and in a room that sounds like where it parks */
  _carCfg() { const v = this._config?.vehicle; return v === false ? null : typeof v === 'object' ? v : typeof v === 'string' ? {vehicle: v} : {}; }
  _hasCar() { return !!this._cars?.length; }

  _findCars(hass) {
    const mine = this._carCfg(), devOf = e => hass.entities?.[e?.battery]?.device_id;
    const list = this._config.vehicles === false ? [] : findCars(hass).map(c => ({cfg: c, e: findVehicle(hass, c)}));
    const own = this._carE?.battery ? {cfg: {...mine, ...(devOf(this._carE) ? {device: devOf(this._carE)} : {})}, e: this._carE} : null;
    let cars = own ? [own, ...list.filter(x => devOf(x.e) !== devOf(own.e))] : list;
    if (this._config.vehicles === false && own) cars = [own];
    return cars.filter(x => x.e.battery).map((x, i) => {
      const dev = x.cfg.device || devOf(x.e), d = hass.devices?.[dev] || {};
      const name = x.cfg.name || d.name_by_user || d.name || hass.states[x.e.battery]?.attributes.friendly_name?.replace(/ battery( level)?$/i, '') || `Car ${i + 1}`;
      return {cfg: {...x.cfg, ...(dev ? {device: dev} : {}), name, model: x.cfg.model || carKey(d.model) || 'car'}, e: x.e, name, i};
    });
  }

  /* the washers and dryers in the room on screen (every one on All rooms) */
  _laundryHere() {
    const h = this._hass; if (!h || this._config.laundry === false) return [];
    const all = this._lfound ||= findLaundry(h);
    if (this._room < 0) return all;
    const room = (this._config.rooms[this._room]?.name || '').toLowerCase();
    return all.filter(m => { const aid = h.devices?.[m.device]?.area_id || h.entities?.[m.ids[0]]?.area_id; return aid && (h.areas?.[aid]?.name || '').toLowerCase() === room; });
  }

  _laundryCard() {
    const ms = this._laundryHere(), sig = ms.map(m => m.device || m.name).join('|') + (this._config.calm ? '|calm' : '');
    this._lc ||= document.createElement('dashboard-studio-laundry');
    if (this._lcSig !== sig) { this._lc.setConfig({name: 'Laundry', machines: ms.map(m => m.device ? {device: m.device, ...(m.sub ? {sub: m.sub} : {}), name: m.name, kind: m.kind} : {...m}), bare: true, calm: !!this._config.calm}); this._lcSig = sig; }
    if (this._hass) this._lc.hass = this._hass;
    return this._lc;
  }

  _laundryStatus() {
    const lc = this._laundryCard(), ms = lc._machines || [], sts = ms.map(m => lc._state(m));
    const run = sts.map((x, i) => [x, ms[i]]).filter(([x]) => x.mode === 'running').sort((a, b) => (a[0].left ?? 1e9) - (b[0].left ?? 1e9));
    if (run.length) { const [x, m] = run[0]; return {text: x.left != null ? `${m.name} · ${Math.max(1, Math.round(x.left))} min left` : `${m.name} · ${x.word}`, active: true}; }
    const done = sts.map((x, i) => [x, ms[i]]).filter(([x]) => x.mode === 'done');
    if (done.length) return {text: done.length === 1 ? `${done[0][1].name} is done 🧺` : `${done.length} loads ready 🧺`, active: true};
    return {text: sts.some(x => x.mode === 'paused') ? 'Paused' : 'All quiet', active: false};
  }

  _carState(car) {
    const s = id => id && this._hass.states[id], e = car.e;
    const loc = s(e.location)?.state, home = !loc || loc === 'home';
    const bat = Math.round(parseFloat(s(e.battery)?.state));
    const cs = s(e.charging)?.state?.toLowerCase(), chg = cs ? ['on', 'charging', 'true'].includes(cs) : s(e.charge_switch)?.state === 'on';
    const lock = s(e.lock)?.state, sleep = !chg && vehAsleep(s(e.awake));
    return {bat: isNaN(bat) ? null : bat, chg, text: !home ? (loc === 'not_home' ? 'Away' : `At ${cap(loc)}`) : chg ? 'Charging' : sleep ? 'Asleep' : lock === 'locked' ? 'Locked' : lock === 'unlocked' ? 'Unlocked' : 'Home'};
  }

  /* every car is a tile with its picture (Tesla View's car once it's set up), like the other tiles: tap one to open it */
  _carTiles(touch) {
    return this._cars.map((car, i) => { const st = this._carState(car);
      const text = `${st.bat != null ? `${st.bat}% · ` : ''}${st.text}`;
      return touch
        ? `<button class="ts-tile${st.chg ? ' on' : ''}" data-a="cat" data-c="car" data-i="${i}"><span class="ts-carart" data-minicar="${i}"></span><span class="ts-l">${esc(car.name)}</span><span class="ts-s">${esc(text)}</span></button>`
        : `<button class="tile${st.chg ? ' on' : ''}" data-a="cat" data-c="car" data-i="${i}"><span class="t-carart" data-minicar="${i}"></span><b>${esc(car.name)}</b><span>${esc(text)}</span></button>`; }).join('');
  }

  /* car_pictures: true shows a little card for every car, with its picture */
  _carCards() {
    if (this._config.car_pictures !== true || !this._carHere()) return '';
    return `<div class="cars">${this._cars.map((car, i) => { const st = this._carState(car), c = car.cfg;
      return `<button class="carc${st.chg ? ' chg' : ''}" data-a="cat" data-c="car" data-i="${i}" aria-label="${esc(car.name)}">
        <span class="carc-art" data-minicar="${i}"></span>
        <span class="carc-t"><b>${esc(car.name)}</b><span>${st.bat != null ? `${st.bat}% · ` : ''}${esc(st.text)}</span></span>
        ${st.bat != null ? `<span class="carc-bar"><i style="width:${Math.max(3, Math.min(100, st.bat))}%"></i></span>` : ''}</button>`; }).join('')}</div>`;
  }
  _carHere() { return this._hasCar() && (this._room < 0 || /garage|driveway|carport|car/i.test(this._config.rooms[this._room]?.name || '')); }
  _garage() { return false; }

  _carInfo() {
    if (this._garage()) {
      const home = this._cars.filter(e => { const l = e.location && this._hass.states[e.location]?.state; return !l || l === 'home'; }).length;
      const chg = this._cars.some(e => ['on', 'charging', 'true'].includes(String(e.charging && this._hass.states[e.charging]?.state).toLowerCase()));
      return {bat: null, chg, garage: true, text: `${home} of ${this._cars.length} home${chg ? ' · Charging' : ''}`};
    }
    const st = id => id && this._hass.states[id], e = this._carE, bat = Math.round(parseFloat(st(e.battery)?.state));
    const cs = st(e.charging)?.state?.toLowerCase(), chg = cs ? ['on', 'charging', 'true'].includes(cs) : st(e.charge_switch)?.state === 'on';
    const lock = st(e.lock)?.state, sleep = !chg && vehAsleep(st(e.awake));
    return {bat: isNaN(bat) ? null : bat, chg, text: [isNaN(bat) ? '' : `${bat}%`, chg ? 'Charging' : sleep ? 'Asleep' : lock === 'locked' ? 'Locked' : lock === 'unlocked' ? 'Unlocked' : ''].filter(Boolean).join(' · ')};
  }

  _autoFill(hass) {
    if (!this._config || (!this._auto && !this._autoScenes)) return false;
    const ids = Object.keys(hass.states), key = [hass.areas, hass.entities, hass.devices, hass.floors, ids.length];
    if (this._regs && key.every((v, i) => v === this._regs[i])) return false;
    this._regs = key;
    const c = this._config, ents = hass.entities || {}, devs = hass.devices || {}, areas = hass.areas || {}, floors = hass.floors || {};
    const skip = new Set([c.exclude || []].flat().map(String));
    const shown = id => { const e = ents[id]; return !skip.has(id) && !(e && (e.hidden || e.entity_category)); };
    if (this._auto) {
      const by = {}, loose = [], cars = new Set(findCars(hass).map(x => x.device));
      ids.forEach(id => {
        const dom = id.split('.')[0];
        if (!DOMAIN_TYPE[dom] || dom === 'input_boolean' || !shown(id)) return;
        /* cars have their own tile: their locks, climate and covers aren't the house's */
        if (cars.has(ents[id]?.device_id)) return;
        /* only shades are shades: not garage doors, gates, doors or windows, and not a car's frunk or trunk */
        if (dom === 'cover') { const dc = hass.states[id].attributes.device_class;
          if (/frunk|trunk|tonneau|charge_?port|sunroof/.test(id) || (dc ? !['shade', 'blind', 'curtain', 'shutter', 'awning', 'window'].includes(dc) : /garage|gate|ratgdo|(^|[._])doors?($|_)/.test(id))) return; }
        const e = ents[id], aid = e?.area_id || devs[e?.device_id]?.area_id;
        if (aid && areas[aid]) (by[aid] = by[aid] || []).push({entity: id}); else loose.push({entity: id});
      });
      let rooms = Object.keys(by).map(aid => ({id: aid, name: areas[aid].name || aid, devices: pairShades(by[aid], hass), level: floors[areas[aid].floor_id]?.level ?? 99}));
      if (c.areas) {
        const want = [c.areas].flat().map(w => String(w).toLowerCase());
        rooms = want.map(w => rooms.find(r => r.id.toLowerCase() === w || r.name.toLowerCase() === w)).filter(Boolean);
      } else {
        rooms = rooms.filter(r => !skip.has(r.id) && !skip.has(r.name)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
        if (!rooms.length && loose.length) rooms = [{name: c.title || 'Home', devices: pairShades(loose, hass)}];
      }
      c.rooms = rooms.map(r => ({name: r.name, devices: r.devices}));
    }
    if (this._autoScenes) {
      const nm = id => hass.states[id].attributes.friendly_name || id;
      c.scenes = ids.filter(id => id.startsWith('scene.') && shown(id)).sort((a, b) => nm(a).localeCompare(nm(b))).slice(0, 12).map(entity => ({entity}));
    }
    return true;
  }

  getCardSize() { return 8; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }

  connectedCallback() { this._tick = setInterval(() => { if (this._view === 'camera' || this._config?.layout === 'touchscreen') this._render(); }, 10000); }
  disconnectedCallback() { clearInterval(this._tick); }

  _watched() {
    const c = this._config; if (!c) return [];
    const gn = typeof c.good_night === 'string' ? [c.good_night] : [];
    return [...c.rooms.flatMap(r => r.devices.flatMap(d => [d.entity, ...(d.entity2 ? [d.entity2] : [])])), ...c.scenes.map(s => s.entity), ...gn];
  }

  _schedule() {
    if (this._busy) { this._pending = true; return; }
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._render());
  }

  _dev(d, room) {
    const st = this._hass?.states[d.entity], st2 = d.entity2 ? this._hass?.states[d.entity2] : undefined;
    const type = d.type || DOMAIN_TYPE[d.entity.split('.')[0]] || 'switch';
    return {...d, type, st, st2, room, name: d.name || st?.attributes.friendly_name || d.entity};
  }

  _devices(cat) {
    const out = [];
    this._config.rooms.forEach((r, ri) => {
      if (this._room >= 0 && this._room !== ri) return;
      r.devices.forEach(d => { const x = this._dev(d, r.name);
        const ok = !cat || (cat === 'watch' ? x.type === 'media' && isTV(x) : cat === 'listen' ? x.type === 'media' && !isTV(x) : catOf(x.type) === cat);
        if (ok) out.push(x); });
    });
    return out;
  }

  _allDevices() { return this._config.rooms.flatMap(r => r.devices.map(d => this._dev(d, r.name))); }

  _unit() { return this._hass?.config?.unit_system?.temperature || '°'; }

  _isOn(x) {
    const s = x.st?.state;
    const open = st => !!st && (st.state === 'open' || st.state === 'opening' || st.attributes.current_position > 0);
    if (x.type === 'shade') return open(x.st) || open(x.st2);
    if (x.type === 'media') return s === 'playing';
    return s === 'on';
  }

  _status(x) {
    const st = x.st;
    if (!st) return 'Not found';
    if (st.state === 'unavailable' && !(x.st2 && x.st2.state !== 'unavailable')) return 'Unavailable';
    const a = st.attributes, u = this._unit();
    switch (x.type) {
      case 'light': return st.state === 'on' ? (a.brightness != null ? `On · ${Math.round(a.brightness / 2.55)}%` : 'On') : 'Off';
      case 'switch': return cap(st.state);
      case 'fan': return st.state === 'on' ? (a.percentage != null ? `On · ${a.percentage}%` : 'On') : 'Off';
      case 'shade': {
        const one = t => t.attributes.current_position != null && t.state !== 'closed' ? (t.attributes.current_position >= 100 ? 'Open' : `${t.attributes.current_position}% open`) : cap(t.state);
        if (!x.entity2) return one(st);
        const p = this._dsPreset(x);
        return p ? p[0] === 'Open' ? 'Open' : `${p[0]} mode` : `${x.labels?.[0] || 'Blackout'} ${one(st).toLowerCase()} · ${x.labels?.[1] || 'Sheer'} ${x.st2 ? one(x.st2).toLowerCase() : 'not found'}`;
      }
      case 'climate': return `${cap(st.state)}${a.temperature != null ? ` · set ${a.temperature}${u}` : ''}${a.current_temperature != null ? ` · now ${a.current_temperature}${u}` : ''}`;
      case 'media': return st.state === 'playing' ? (a.media_title ? `Playing · ${a.media_title}` : 'Playing') : cap(st.state);
      case 'lock': return cap(st.state);
      case 'camera': return 'Live';
      case 'alarm': return ALARM_LABEL[st.state] || cap(st.state);
    }
    return cap(st.state);
  }

  _catStatus(cat) {
    const L = this._devices(cat), on = L.filter(x => this._isOn(x)).length;
    switch (cat) {
      case 'light': case 'switch': return {text: on ? `${on} on` : 'All off', active: on > 0};
      case 'fan': return {text: on ? `${on} running` : 'All off', active: on > 0};
      case 'shade': return {text: on ? `${on} open` : 'All closed', active: on > 0};
      case 'climate': {
        const t = L.map(x => x.st?.attributes.temperature).filter(v => v != null);
        return {text: t.length ? `Set to ${Math.round(t.reduce((a, b) => a + b, 0) / t.length)}${this._unit()}` : `${L.length} thermostat${L.length === 1 ? '' : 's'}`, active: false};
      }
      case 'media': { const p = L.find(x => x.st?.state === 'playing'); return {text: p ? `Playing · ${p.name}` : 'Off', active: !!p}; }
      case 'security': {
        const unlocked = L.filter(x => x.type === 'lock' && x.st?.state === 'unlocked').length, al = L.find(x => x.type === 'alarm');
        const parts = [al ? this._status(al) : null, unlocked ? `${unlocked} unlocked` : (L.some(x => x.type === 'lock') ? 'Locked' : null)].filter(Boolean);
        return {text: parts.join(' · '), active: !!al && al.st?.state?.startsWith('armed') && !unlocked, warn: unlocked > 0 || al?.st?.state === 'triggered'};
      }
      case 'camera': return {text: `${L.length} live`, active: false};
      case 'car': { const i = this._carInfo(); return {text: i.text, active: i.chg}; }
      case 'laundry': return this._laundryStatus();
    }
    return {text: '', active: false};
  }

  /* which of Open, Day or Night a pair of shades is in right now */
  _dsPreset(x) {
    const pos = t => t && t.state !== 'unavailable' ? (t.attributes.current_position ?? (t.state === 'closed' ? 0 : 100)) : null, p1 = pos(x.st), p2 = pos(x.st2);
    return p1 == null || p2 == null ? null : DS_PRESETS.find(([, a, b]) => Math.abs(a - p1) < 6 && Math.abs(b - p2) < 6) || null;
  }

  _setPos(id, p) {
    const st = this._hass.states[id];
    if (st?.attributes.current_position != null) return this._call('cover', 'set_cover_position', {entity_id: id, position: p});
    return this._call('cover', p > 0 ? 'open_cover' : 'close_cover', {entity_id: id});
  }

  _call(domain, service, data) {
    return this._hass.callService(domain, service, data).catch(err => {
      this._toast(err?.message || `Could not run ${domain}.${service}`, true);
    });
  }

  _toast(msg, err) {
    this._flash = {msg, err}; this._render();
    clearTimeout(this._flashT); this._flashT = setTimeout(() => { this._flash = null; this._render(); }, 3000);
  }

  _onClick(e) {
    const el = e.target.closest('[data-a]');
    if (this._menu && !e.target.closest('.ts-menu, .ts-room, .ts-scrim')) { this._menu = false; if (!el) { this._render(); return; } }
    if (!el || !this._hass) return;
    const a = el.dataset.a, id = el.dataset.e, x = id ? this._dev({entity: id, type: el.dataset.t}, '') : null;
    switch (a) {
      case 'room': this._swap = +el.dataset.r < this._room ? -1 : 1; this._room = +el.dataset.r; this._menu = false; break;
      case 'roommenu': this._menu = !this._menu; break;
      case 'pickroom': this._swap = +el.dataset.r < this._room ? -1 : 1; this._room = +el.dataset.r; this._view = null; this._menu = false; break;
      case 'mp': this._call('media_player', el.dataset.v, {entity_id: id}); return;
      case 'cat': this._swap = 1; this._view = el.dataset.c; this._code = ''; this._msg = ''; if (el.dataset.i != null) this._carPick = +el.dataset.i; break;
      case 'back': this._swap = -1; this._view = null; break;
      case 'scene': this._call('scene', 'turn_on', {entity_id: el.dataset.e}).then(() => this._toast(`${el.dataset.n} is on`)); return;
      case 'goodnight': this._goodNight(); return;
      case 'all': this._all(el.dataset.v === 'on'); return;
      case 'toggle': this._call('homeassistant', 'toggle', {entity_id: id}); return;
      case 'fan': +el.dataset.v ? this._call('fan', 'set_percentage', {entity_id: id, percentage: +el.dataset.v}) : this._call('fan', 'turn_off', {entity_id: id}); return;
      case 'cover': this._call('cover', el.dataset.v, {entity_id: id}); return;
      case 'dsp': { const p = DS_PRESETS[+el.dataset.v]; if (p) { this._setPos(id, p[1]); this._setPos(el.dataset.e2, p[2]); } return; }
      case 'temp': {
        const at = x.st?.attributes || {}, step = at.target_temp_step || (this._unit().includes('F') ? 1 : 0.5);
        if (at.temperature == null) return;
        let t = +(at.temperature + step * +el.dataset.v).toFixed(1);
        if (at.min_temp != null) t = Math.max(at.min_temp, t);
        if (at.max_temp != null) t = Math.min(at.max_temp, t);
        this._call('climate', 'set_temperature', {entity_id: id, temperature: t}); return;
      }
      case 'play': this._call('media_player', 'media_play_pause', {entity_id: id}); return;
      case 'lock': this._call('lock', x.st?.state === 'locked' ? 'unlock' : 'lock', {entity_id: id}); return;
      case 'digit': if (this._code.length < 10) this._code += el.dataset.v; this._msg = ''; break;
      case 'clear': this._code = ''; this._msg = ''; break;
      case 'backspace': this._code = this._code.slice(0, -1); break;
      case 'arm': case 'disarm': this._alarm(x, a === 'arm' ? el.dataset.v : 'disarm'); return;
      case 'more': this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: id}, bubbles: true, composed: true})); return;
    }
    this._render();
  }

  _onChange(e) {
    const el = e.target;
    if (el.dataset.roomsel != null) { this._swap = +el.value < this._room ? -1 : 1; this._room = +el.value; this._view = this._view && this._devices(this._view).length ? this._view : null; this._render(); return; }
    if (!el.dataset.e || !this._hass) return;
    const id = el.dataset.e, v = +el.value;
    if (el.dataset.k === 'bri') this._call('light', 'turn_on', {entity_id: id, brightness_pct: v});
    if (el.dataset.k === 'vol') this._call('media_player', 'volume_set', {entity_id: id, volume_level: v / 100});
    if (el.dataset.k === 'pos') this._call('cover', 'set_cover_position', {entity_id: id, position: v});
  }

  _alarm(x, mode) {
    const at = x.st?.attributes || {}, needsCode = !!at.code_format && (mode === 'disarm' || at.code_arm_required !== false);
    if (needsCode && !this._code) { this._msg = 'Enter your code first'; this._err = true; this._render(); return; }
    const data = {entity_id: x.entity, ...(needsCode ? {code: this._code} : {})};
    const service = {home: 'alarm_arm_home', away: 'alarm_arm_away', night: 'alarm_arm_night', disarm: 'alarm_disarm'}[mode];
    this._code = '';
    this._hass.callService('alarm_control_panel', service, data)
      .then(() => { this._msg = mode === 'disarm' ? 'Disarmed. Welcome home' : 'Arming. Exit delay may apply'; this._err = false; this._render(); })
      .catch(() => { this._msg = 'That didn’t work. Check the code and try again'; this._err = true; this._render(); });
    this._render();
  }

  _all(on) {
    const L = this._devices(this._view), ids = t => L.filter(x => x.type === t && x.st && x.st.state !== 'unavailable').flatMap(x => [x.entity, ...(x.entity2 ? [x.entity2] : [])]);
    const run = (t, domain, service) => { const e = ids(t); if (e.length) this._call(domain, service, {entity_id: e}); };
    if (this._view === 'light') run('light', 'light', on ? 'turn_on' : 'turn_off');
    if (this._view === 'switch') run('switch', 'homeassistant', on ? 'turn_on' : 'turn_off');
    if (this._view === 'fan') run('fan', 'fan', on ? 'turn_on' : 'turn_off');
    if (this._view === 'shade') run('shade', 'cover', on ? 'open_cover' : 'close_cover');
    if (this._view === 'security') run('lock', 'lock', on ? 'lock' : 'unlock');
  }

  _goodNight() {
    const g = this._config.good_night;
    if (typeof g === 'string') { this._call('script', 'turn_on', {entity_id: g}).then(() => this._toast('Good night 🌙')); this._showNight(); return; }
    const opt = {...GN_DEFAULT, ...(typeof g === 'object' && g ? g : {})}, all = this._allDevices();
    const ids = t => all.filter(x => x.type === t && x.st).flatMap(x => [x.entity, ...(x.entity2 ? [x.entity2] : [])]);
    const run = (on, t, domain, service, data = {}) => { const e = ids(t); if (on && e.length) this._call(domain, service, {entity_id: e, ...data}); };
    run(opt.lights, 'light', 'light', 'turn_off');
    run(opt.switches, 'switch', 'homeassistant', 'turn_off');
    run(opt.fans, 'fan', 'fan', 'turn_off');
    run(opt.shades, 'shade', 'cover', 'close_cover');
    run(opt.media, 'media', 'media_player', 'media_pause');
    run(opt.locks, 'lock', 'lock', 'lock');
    if (opt.temperature != null) run(true, 'climate', 'climate', 'set_temperature', {temperature: opt.temperature});
    if (opt.alarm) all.filter(x => x.type === 'alarm' && x.st?.state === 'disarmed' && x.st.attributes.code_arm_required === false)
      .forEach(x => this._call('alarm_control_panel', 'alarm_arm_home', {entity_id: x.entity}));
    this._showNight();
    this._toast('Good night 🌙');
  }

  _showNight() {
    if (this._config.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this._night = true; this._render(); setTimeout(() => { this._night = false; this._render(); }, 2400);
  }

  _row(x, showRoom) {
    const st = x.st, a = st?.attributes || {}, id = esc(x.entity), gone = t => !t || t.state === 'unavailable', dead = gone(st) && (!x.entity2 || gone(x.st2));
    const btn = (act, inner, extra = '', cls = 'btn') => `<button class="${cls}" data-a="${act}" data-e="${id}" data-t="${x.type}" ${extra}>${inner}</button>`;
    let ctl = '', more = '';
    if (!dead) switch (x.type) {
      case 'light':
        ctl = btn('toggle', '', `aria-label="Turn ${esc(x.name)} ${st.state === 'on' ? 'off' : 'on'}"`, 'sw');
        if (st.state === 'on' && a.brightness != null) more = `<input type="range" min="1" max="100" value="${Math.round(a.brightness / 2.55)}" data-e="${id}" data-k="bri" aria-label="${esc(x.name)} brightness">`;
        break;
      case 'switch': ctl = btn('toggle', '', `aria-label="Turn ${esc(x.name)} ${st.state === 'on' ? 'off' : 'on'}"`, 'sw'); break;
      case 'fan': {
        const p = st.state === 'on' ? (a.percentage ?? 100) : 0;
        more = `<div class="seg">${[['Off', 0], ['Low', 33], ['Med', 66], ['High', 100]].map(([l, v]) => btn('fan', l, `data-v="${v}"`, `pbtn${(v === 0 ? p === 0 : Math.abs(p - v) < 17) ? ' on' : ''}`)).join('')}</div>`;
        break;
      }
      case 'shade':
        if (x.entity2) {
          const cur = this._dsPreset(x), id2 = esc(x.entity2), lab = x.labels || ['Blackout', 'Sheer'];
          more = `<div class="seg">${DS_PRESETS.map(([l, , , icon], k) => btn('dsp', `<ha-icon icon="${icon}"></ha-icon>${l}`, `data-v="${k}" data-e2="${id2}"`, `pbtn dsp${cur?.[0] === l ? ' on' : ''}`)).join('')}</div>` +
            [[x.entity, x.st, lab[0]], [x.entity2, x.st2, lab[1]]].map(([e, t, l]) => { const eid = esc(e), ta = t?.attributes || {};
              const b2 = (v, icon, al) => `<button class="ibtn" data-a="cover" data-e="${eid}" data-v="${v}" aria-label="${al} ${esc(l)}"><ha-icon icon="${icon}"></ha-icon></button>`;
              return `<div class="dsl"><span>${esc(l)}</span>${t && t.state !== 'unavailable' ? b2('open_cover', 'mdi:arrow-up', 'Open') + b2('stop_cover', 'mdi:stop', 'Stop') + b2('close_cover', 'mdi:arrow-down', 'Close') : '<small>Unavailable</small>'}</div>` +
                (ta.current_position != null ? `<input type="range" min="0" max="100" value="${ta.current_position}" data-e="${eid}" data-k="pos" aria-label="${esc(l)} position">` : ''); }).join('');
          break;
        }
        ctl = btn('cover', '<ha-icon icon="mdi:arrow-up"></ha-icon>', 'data-v="open_cover" aria-label="Open"', 'ibtn') + btn('cover', '<ha-icon icon="mdi:stop"></ha-icon>', 'data-v="stop_cover" aria-label="Stop"', 'ibtn') + btn('cover', '<ha-icon icon="mdi:arrow-down"></ha-icon>', 'data-v="close_cover" aria-label="Close"', 'ibtn');
        if (a.current_position != null) more = `<input type="range" min="0" max="100" value="${a.current_position}" data-e="${id}" data-k="pos" aria-label="${esc(x.name)} position">`;
        break;
      case 'climate':
        if (a.temperature != null) ctl = btn('temp', '<ha-icon icon="mdi:minus"></ha-icon>', 'data-v="-1" aria-label="Lower"', 'ibtn') + `<span class="val">${a.temperature}°</span>` + btn('temp', '<ha-icon icon="mdi:plus"></ha-icon>', 'data-v="1" aria-label="Raise"', 'ibtn');
        break;
      case 'media':
        ctl = btn('play', `<ha-icon icon="${st.state === 'playing' ? 'mdi:pause' : 'mdi:play'}"></ha-icon>`, `aria-label="${st.state === 'playing' ? 'Pause' : 'Play'}"`, 'ibtn big');
        if (a.volume_level != null) more = `<input type="range" min="0" max="100" value="${Math.round(a.volume_level * 100)}" data-e="${id}" data-k="vol" aria-label="${esc(x.name)} volume">`;
        break;
      case 'lock': ctl = btn('lock', st.state === 'locked' ? 'Unlock' : 'Lock', '', `pbtn${st.state === 'locked' ? '' : ' on'}`); break;
      case 'camera': more = a.entity_picture ? `<img class="cam" alt="${esc(x.name)}" src="${esc(a.entity_picture)}&t=${Math.floor(Date.now() / 10000)}" data-a="more" data-e="${id}">` : ''; break;
    }
    return `<div class="row${this._isOn(x) ? ' on' : ''}${dead ? ' dead' : ''}">
      <button class="ico" data-a="more" data-e="${id}" aria-label="More about ${esc(x.name)}"><ha-icon icon="${esc(x.icon || a.icon || TYPE_ICON[x.type])}"></ha-icon></button>
      <div class="nm"><b>${esc(x.name)}</b><span>${showRoom ? esc(x.room) + ' · ' : ''}${esc(this._status(x))}</span></div>
      <div class="ctl">${ctl}</div>${more ? `<div class="more">${more}</div>` : ''}</div>`;
  }

  _keypad(x) {
    const st = x.st, a = st?.attributes || {}, id = esc(x.entity), needsCode = !!a.code_format;
    const k = (act, inner, extra = '', cls = '') => `<button class="${cls}" data-a="${act}" data-e="${id}" data-t="alarm" ${extra}>${inner}</button>`;
    const state = st?.state || 'unavailable', armed = state.startsWith('armed'), err = this._err; this._err = false;
    const dots = Array.from({length: Math.max(4, this._code.length)}, (_, n) => `<i class="${n < this._code.length ? '' : 'e'}"></i>`).join('');
    return `<div class="kp"><div class="kp-top"><span class="ico"><ha-icon icon="mdi:shield-home"></ha-icon></span><div><b>${esc(x.name)}</b><span class="kp-st ${armed ? 'armed' : state === 'disarmed' ? '' : 'busy'}">${esc(this._status(x))}</span></div></div>
      ${needsCode ? `<div class="dots${err ? ' err' : ''}">${dots}</div>
      <div class="kp-msg${err ? ' err' : ''}" role="status">${esc(this._msg || (armed ? 'Enter your code to disarm' : 'Choose a mode to arm'))}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => k('digit', n, `data-v="${n}"`)).join('')}${k('clear', 'Clear', '', 'sm')}${k('digit', 0, 'data-v="0"')}${k('backspace', '<ha-icon icon="mdi:backspace-outline"></ha-icon>', 'aria-label="Delete last digit"', 'sm')}</div>`
      : `<div class="kp-msg" role="status">${esc(this._msg || '')}</div>`}
      <div class="seg">${k('arm', 'Arm home', 'data-v="home"', `pbtn${state === 'armed_home' ? ' on' : ''}`)}${k('arm', 'Arm away', 'data-v="away"', `pbtn${state === 'armed_away' ? ' on' : ''}`)}${k('disarm', 'Disarm', '', `pbtn${state === 'disarmed' ? ' on' : ''}`)}</div></div>`;
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;
    this._pending = false;
    const c = this._config, rooms = c.rooms, ri = this._room < rooms.length ? this._room : -1;
    const opts = [[-1, 'All rooms'], ...rooms.map((r, i) => [i, r.name])];
    const pick = c.room_picker === 'dropdown' || (c.room_picker !== 'chips' && rooms.length > 6);
    const chips = pick
      ? `<label class="roomsel"><ha-icon icon="mdi:door-open"></ha-icon><span class="vh">Room</span><select data-roomsel aria-label="Room">${opts.map(([i, n]) => `<option value="${i}" ${ri === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><ha-icon icon="mdi:chevron-down"></ha-icon></label>`
      : `<div class="chips">${opts.map(([i, n]) => `<button class="chip${ri === i ? ' on' : ''}" data-a="room" data-r="${i}">${esc(n)}</button>`).join('')}</div>`;
    let body = '';
    if (!this._hass) body = '<p class="hint">Connecting to Home Assistant…</p>';
    else if (!rooms.length) body = '<p class="hint">No rooms yet. Give your devices an area in Settings › Areas, labels & zones, and they show up here by themselves.</p>';
    else if (this._view === 'quick') {
      body = `<div class="head"><div><div class="title">Shortcuts</div></div></div><div class="quick">${this._quickButtons()}</div>`;
    }
    else if (this._view === 'car' && this._hasCar()) {
      const tag = this._garage() ? 'dashboard-studio-garage' : 'dashboard-studio-vehicle';
      body = `${c.layout === 'touchscreen' ? '' : '<div class="head"><button class="ibtn" data-a="back" aria-label="Back"><ha-icon icon="mdi:chevron-left"></ha-icon></button></div>'}<${tag} class="hub-car"></${tag}>`;
    }
    else if (this._view === 'laundry' && this._laundryHere().length) {
      body = `${c.layout === 'touchscreen' ? '' : '<div class="head"><button class="ibtn" data-a="back" aria-label="Back"><ha-icon icon="mdi:chevron-left"></ha-icon></button><div><div class="title">Laundry</div></div></div>'}<div class="hub-laundry"></div>`;
    }
    else if (this._view && this._devices(this._view).length) {
      const cat = CATS.find(x => x[0] === this._view) || TOUCH.find(x => x[0] === this._view), L = this._devices(this._view);
      const all = {light: ['All on', 'All off'], fan: ['All on', 'All off'], switch: ['All on', 'All off'], shade: ['Open all', 'Close all'], security: ['Lock all', 'Unlock all']}[this._view];
      const alarms = L.filter(x => x.type === 'alarm'), rest = L.filter(x => x.type !== 'alarm');
      const rows = rest.length ? `<div class="list">${rest.map(x => this._row(x, ri < 0)).join('')}</div>` : '';
      body = `<div class="head"><button class="ibtn" data-a="back" aria-label="Back"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <div><div class="title">${cat[1]}</div><div class="sub">${ri >= 0 ? esc(rooms[ri].name) : 'All rooms'} · ${L.length} device${L.length === 1 ? '' : 's'}</div></div>
        ${all ? `<div class="all"><button class="pbtn" data-a="all" data-v="on">${all[0]}</button><button class="pbtn" data-a="all" data-v="off">${all[1]}</button></div>` : ''}</div>
        ${alarms.length ? `<div class="sec"><div class="kps">${alarms.map(x => this._keypad(x)).join('')}</div>${rows}</div>` : rows}`;
    } else if (c.layout === 'touchscreen') {
      this._view = null;
      body = this._touchHome();
    } else {
      this._view = null;
      const cats = CATS.filter(([k]) => k === 'car' ? c.car_pictures !== true && this._carHere() : k === 'laundry' ? this._laundryHere().length : this._devices(k).length), cars = this._carCards();
      const quick = (c.good_night !== false ? `<button class="gn" data-a="goodnight"><ha-icon icon="mdi:weather-night"></ha-icon><span><b>Good night</b><small>Lights off, lock up and settle in</small></span></button>` : '') +
        c.scenes.map(s => { const on = this._hass.states[s.entity]; return `<button class="scene" data-a="scene" data-e="${esc(s.entity)}" data-n="${esc(s.name || on?.attributes.friendly_name || s.entity)}"><ha-icon icon="${esc(s.icon || on?.attributes.icon || 'mdi:palette')}"></ha-icon>${esc(s.name || on?.attributes.friendly_name || s.entity)}</button>`; }).join('');
      body = `${quick ? `<div class="quick">${quick}</div>` : ''}${cars}
        ${cats.length ? `<div class="tiles">${cats.map(([k, label, icon]) => { if (k === 'car') return this._carTiles(false); const s = this._catStatus(k);
          return `<button class="tile${s.active ? ' on' : ''}${s.warn ? ' warn' : ''}" data-a="cat" data-c="${k}"><span class="t-ico"><ha-icon icon="${icon}"></ha-icon></span><b>${label}</b><span>${esc(s.text)}</span></button>`; }).join('')}</div>`
        : cars ? '' : '<p class="hint">No devices in this room yet.</p>'}`;
    }
    const title = this._view ? '' : `<div class="title big">${esc(ri >= 0 ? rooms[ri].name : (c.title || 'Home'))}</div>`;
    const night = this._night ? `<div class="night"><ha-icon icon="mdi:weather-night"></ha-icon><b>Good night</b><span>Sleep well. The house is settling in.</span></div>` : '';
    const flash = this._flash ? `<div class="flash${this._flash.err ? ' err' : ''}" role="status">${esc(this._flash.msg)}</div>` : '';
    if (c.layout === 'touchscreen') {
      const name = ri >= 0 ? rooms[ri].name : (c.title || 'Home');
      const top = `<div class="ts-top"><button class="ts-ib" data-a="${this._view ? 'back' : 'room'}" data-r="-1" aria-label="${this._view ? 'Back' : 'All rooms'}"><ha-icon icon="${this._view ? 'mdi:chevron-left' : 'mdi:home-outline'}"></ha-icon></button>
        <button class="ts-room" data-a="roommenu" aria-haspopup="listbox" aria-expanded="${!!this._menu}">${esc(name)}<ha-icon icon="mdi:chevron-down"></ha-icon></button>
        ${c.good_night !== false ? `<button class="ts-ib" data-a="goodnight" aria-label="Good night"><ha-icon icon="mdi:weather-night"></ha-icon></button>` : '<span></span>'}</div>`;
      const menu = this._menu ? `<button class="ts-scrim" data-a="roommenu" aria-label="Close the room list"></button><div class="ts-menu" role="listbox" aria-label="Rooms">${opts.map(([i, n]) => `<button class="${i === ri ? 'on' : ''}" role="option" aria-selected="${i === ri}" data-a="pickroom" data-r="${i}">${esc(n)}</button>`).join('')}</div>` : '';
      const wid = c.weather_entity || Object.keys(this._hass?.states || {}).find(k => k.startsWith('weather.')), w = wid && this._hass?.states[wid];
      const wx = w ? `<span class="ts-wx"><ha-icon icon="${WX_ICON[w.state] || 'mdi:weather-partly-cloudy'}"></ha-icon>${w.attributes.temperature != null ? Math.round(w.attributes.temperature) + '°' : esc(cap(w.state))}</span>` : '<span></span>';
      const clock = `<span>${new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</span>`;
      const op = Math.max(0, Math.min(100, Number(c.opacity ?? 0) || 0));
      const rr = Number(c.room_radius ?? 30), rad = rr >= 30 ? 99 : Math.max(0, rr);
      const cls = ['ts', c.touch_style === 'theme' ? 'ts-theme' : '', op < 40 ? 'clear' : '', c.icon_background === false ? 'noicobg' : '', c.full_height ? 'full' : '', c.calm ? 'calm' : '', this._ic()].filter(Boolean).join(' ');
      this._paint(`<style>${STYLE}${TOUCH_STYLE}${this._hasCar() ? CAR_STYLE : ''}</style><ha-card class="${cls}" style="--t-op:${op}%;--t-rr:${rad}px">${top}${menu}<div class="ts-body">${body}</div><div class="ts-bottom">${clock}${wx}</div>${night}${flash}</ha-card>`);
      return;
    }
    this._paint(`<style>${STYLE}${this._hasCar() ? CAR_STYLE : ''}</style><ha-card class="${[c.calm ? 'calm' : '', this._ic()].filter(Boolean).join(' ')}">${title}${chips}${body}${night}${flash}</ha-card>`);
  }

  _anim() { return {...ANIM_DEFAULT, ...(this._config.animations || {})}; }
  _still() { return !!this._config.calm || reducedMotion(); }

  /* a layer beside the card keeps touch ripples alive while the card redraws */
  _paint(html) {
    if (!this._root) {
      this.shadowRoot.innerHTML = '<div></div><div class="fxl" aria-hidden="true"></div>';
      this._root = this.shadowRoot.firstChild; this._fxl = this.shadowRoot.lastChild;
    }
    this._root.innerHTML = html;
    const card = this._root.querySelector('ha-card'), an = this._anim();
    const veh = card.querySelector('dashboard-studio-vehicle');
    if (veh) { veh.setConfig({...(this._cars?.[this._carPick || 0]?.cfg || this._carCfg()), bare: true, calm: !!this._config.calm}); veh.hass = this._hass; }
    const ls = card.querySelector('.hub-laundry'); if (ls) ls.append(this._laundryCard());
    const gar = card.querySelector('dashboard-studio-garage');
    if (gar) { gar.setConfig({name: 'Garage', ...(this._config.garage_door ? {door: this._config.garage_door} : {}), bare: true, calm: !!this._config.calm}); gar.hass = this._hass; }
    /* each little car card keeps its own render (Tesla View when it's installed), so redraws don't reload it */
    card.querySelectorAll('[data-minicar]').forEach(slot => {
      const k = slot.dataset.minicar, car = this._cars?.[+k]; if (!car) return;
      const cfg = {...car.cfg, bare: true, mini: true, calm: !!this._config.calm}, sig = JSON.stringify(cfg);
      this._minis ||= {}; let v = this._minis[k];
      if (!v || v._sig !== sig) { v = document.createElement('dashboard-studio-vehicle'); v.setConfig(cfg); v._sig = sig; this._minis[k] = v; }
      slot.append(v); v.hass = this._hass;
    });
    card.classList.toggle('tap-press', an.tap === 'press' && !this._still());
    const on = new Map();
    card.querySelectorAll('.ts-tile, .tile, .row, .scene').forEach(el => {
      const k = el.dataset.c || el.dataset.e || el.querySelector('[data-e]')?.dataset.e; if (k) on.set(el.className.split(' ')[0] + k, [el, el.classList.contains('on')]);
    });
    if (this._swap) {
      if (!this._still() && an.page !== 'off') animPage(card.querySelector('.ts-body') || card, an.page, this._swap);
      this._swap = 0;
    } else if (this._prevOn && an.state !== 'off' && !this._still()) {
      const glow = getComputedStyle(card).getPropertyValue('--s-active').trim() || 'rgba(255,255,255,.5)';
      const host = this.getBoundingClientRect();
      on.forEach(([el, v], k) => {
        const was = this._prevOn.get(k); if (was === undefined || was === v) return;
        const t = el.querySelector('.ts-ico, .t-ico, .ico') || el;
        if (an.state === 'burst') { const r = t.getBoundingClientRect(); burst(this._fxl, r.left + r.width / 2 - host.left, r.top + r.height / 2 - host.top, `color-mix(in srgb, ${glow} 85%, transparent)`); animState(t, 'pop'); }
        else animState(t, an.state, `color-mix(in srgb, ${glow} 60%, transparent)`);
      });
    }
    this._prevOn = new Map([...on].map(([k, [, v]]) => [k, v]));
  }

  _tap(e) {
    const kind = this._config && this._anim().tap;
    if (!kind || kind === 'off' || kind === 'press' || this._still() || e.button > 0) return;
    const hit = e.target.closest('button, .row, .tile, .ts-tile, input, select'); if (!hit || !this._fxl) return;
    const host = this.getBoundingClientRect(), r = hit.getBoundingClientRect(), card = this._root.querySelector('ha-card');
    const c = getComputedStyle(card).getPropertyValue('--s-text').trim() || '#fff';
    tapFx(kind, this._fxl, e.clientX - host.left, e.clientY - host.top, Math.max(60, Math.min(260, Math.max(r.width, r.height) * 1.4)), `color-mix(in srgb, ${c} ${kind === 'sparkle' || kind === 'ring' ? 70 : 32}%, transparent)`);
  }

  _ic() { return 'ic-' + (['soft', 'accent', 'warm'].includes(this._config.icon_color) ? this._config.icon_color : 'soft'); }

  _quickButtons() {
    const c = this._config;
    return (c.good_night !== false ? `<button class="gn" data-a="goodnight"><ha-icon icon="mdi:weather-night"></ha-icon><span><b>Good night</b><small>Lights off, lock up and settle in</small></span></button>` : '') +
      c.scenes.map(s => { const on = this._hass.states[s.entity], n = s.name || on?.attributes.friendly_name || s.entity;
        return `<button class="scene" data-a="scene" data-e="${esc(s.entity)}" data-n="${esc(n)}"><ha-icon icon="${esc(s.icon || on?.attributes.icon || 'mdi:palette')}"></ha-icon>${esc(n)}</button>`; }).join('');
  }

  _nowPlaying() {
    const L = this._devices('media').filter(x => x.st); if (!L.length) return '';
    const live = x => !['off', 'unavailable', 'standby', 'unknown'].includes(x.st.state);
    const x = L.find(m => m.st.state === 'playing') || L.find(live) || L[0], st = x.st, a = st.attributes, id = esc(x.entity), on = live(x);
    const mp = (v, icon, label, cls = '') => `<button class="${cls}" data-a="mp" data-e="${id}" data-v="${v}" aria-label="${label}"><ha-icon icon="${icon}"></ha-icon></button>`;
    const art = a.entity_picture ? `<img src="${esc(a.entity_picture)}" alt="">` : `<ha-icon icon="${isTV(x) ? 'mdi:television-play' : 'mdi:music'}"></ha-icon><small>${esc(a.source || a.app_name || x.name)}</small>`;
    return `<div class="ts-np${on ? '' : ' off'}"><div class="ts-art">${art}</div>
      <div class="ts-npm"><div class="ts-src"><b>${esc(a.media_title || a.source || a.app_name || x.name)}</b><span>${esc(x.name)} · ${esc(x.room)} · ${esc(cap(st.state))}</span></div>
        ${a.volume_level != null ? `<div class="ts-vol"><ha-icon icon="mdi:volume-high"></ha-icon><input type="range" min="0" max="100" value="${Math.round(a.volume_level * 100)}" data-e="${id}" data-k="vol" aria-label="Volume"><span>${Math.round(a.volume_level * 100)}</span></div>` : ''}
        <div class="ts-tr">${mp('media_previous_track', 'mdi:skip-previous', 'Previous')}${mp('media_play_pause', st.state === 'playing' ? 'mdi:pause' : 'mdi:play', st.state === 'playing' ? 'Pause' : 'Play', 'big')}${mp('media_next_track', 'mdi:skip-next', 'Next')}</div></div>
      ${mp(on ? 'turn_off' : 'turn_on', 'mdi:power', `Turn ${x.name} ${on ? 'off' : 'on'}`, 'ts-pw')}</div>`;
  }

  _touchHome() {
    const c = this._config;
    const tiles = TOUCH.filter(([k]) => k === 'quick' ? (c.scenes.length || c.good_night !== false) : k === 'car' ? c.car_pictures !== true && this._carHere() : k === 'laundry' ? this._laundryHere().length : this._devices(k).length).map(([k, label, icon]) => {
      if (k === 'car') return this._carTiles(true);
      let s;
      if (k === 'quick') s = {text: c.scenes.length ? `${c.scenes.length} scene${c.scenes.length === 1 ? '' : 's'}` : 'Good night', active: false};
      else if (k === 'watch' || k === 'listen') { const p = this._devices(k).find(x => x.st?.state === 'playing'); s = {text: p ? `Playing · ${p.name}` : 'Off', active: !!p}; }
      else s = this._catStatus(k);
      const temps = k === 'climate' ? this._devices('climate').map(x => x.st?.attributes.current_temperature).filter(v => v != null) : [];
      const ci = k === 'car' ? this._carInfo() : null;
      if (ci) label = ci.garage ? 'Garage' : esc(this._carCfg().name || this._hass.states[this._carE.battery]?.attributes.friendly_name?.replace(/ battery( level)?$/i, '') || label);
      if (ci?.garage) icon = 'mdi:garage-variant';
      const ico = ci && ci.bat != null ? `<span class="ts-ring${ci.chg ? ' chg' : ''}"><b>${ci.bat}</b></span>` : temps.length ? `<span class="ts-ring"><b>${Math.round(temps.reduce((a, v) => a + v, 0) / temps.length)}</b></span>` : `<span class="ts-ico"><ha-icon icon="${icon}"></ha-icon></span>`;
      return `<button class="ts-tile${s.active ? ' on' : ''}${s.warn ? ' warn' : ''}" data-a="cat" data-c="${k}">${ico}<span class="ts-l">${label}</span><span class="ts-s">${esc(s.text)}</span></button>`;
    }).join('');
    const cars = this._carCards();
    return this._nowPlaying() + cars + (tiles ? `<div class="ts-tiles">${tiles}</div>` : cars ? '' : '<p class="hint">No devices in this room yet.</p>');
  }
}

const TOUCH_STYLE = `
ha-card.ts{padding:0;gap:0;display:flex;flex-direction:column;min-height:460px;overflow:hidden;color:#f3f3f3;
  background:linear-gradient(180deg,color-mix(in srgb,#46494e var(--t-op,100%),transparent) 0%,color-mix(in srgb,#2c2e32 var(--t-op,100%),transparent) 55%,color-mix(in srgb,#1d1e21 var(--t-op,100%),transparent) 100%);--ico-ink:#1d1e21;--s-text:#f3f3f3;--s-muted:rgba(255,255,255,.62);--s-line:rgba(255,255,255,.09);
  --s-muted:rgba(255,255,255,.72);--s-line:rgba(255,255,255,.08);--s-soft:rgba(255,255,255,.06);--s-soft2:rgba(255,255,255,.12);--t-bar:transparent;--t-tile:rgba(255,255,255,.06);--t-menu:#2b2d31}
ha-card.ts.ts-theme{color:var(--primary-text-color);background:color-mix(in srgb,var(--primary-background-color,#fff) var(--t-op,86%),transparent);--ico-ink:var(--primary-background-color,#fff);-webkit-backdrop-filter:blur(24px) saturate(1.3);backdrop-filter:blur(24px) saturate(1.3);
  --s-text:var(--primary-text-color,#1c1c1c);--s-muted:color-mix(in srgb,var(--primary-text-color,#1c1c1c) 72%,transparent);--s-line:color-mix(in srgb,var(--s-text) 10%,transparent);
  --s-soft:color-mix(in srgb,var(--s-text) 6%,transparent);--s-soft2:color-mix(in srgb,var(--s-text) 11%,transparent);--t-bar:transparent;--t-tile:color-mix(in srgb,var(--s-text) 7%,transparent);
  --t-menu:color-mix(in srgb,var(--primary-background-color,#fff) 96%,var(--s-text) 4%)}
ha-card.ts.ts-theme .ts-l,ha-card.ts.ts-theme .ts-room,ha-card.ts.ts-theme .ts-src b{text-shadow:0 1px 2px color-mix(in srgb,var(--primary-background-color,#fff) 60%,transparent)}
ha-card.ts.clear{box-shadow:none;border:none;-webkit-backdrop-filter:none;backdrop-filter:none;--t-tile:rgba(255,255,255,.08);--s-line:rgba(255,255,255,.16);text-shadow:0 1px 3px rgba(0,0,0,.55)}
ha-card.ts.ts-theme.clear{--t-tile:color-mix(in srgb,var(--primary-background-color,#fff) 30%,transparent);--s-line:color-mix(in srgb,var(--s-text) 12%,transparent);text-shadow:0 1px 2px color-mix(in srgb,var(--primary-background-color,#fff) 70%,transparent)}
ha-card.ts.clear :is(.ts-tile,.ts-np,.ts-room){background:var(--t-tile);border:1px solid var(--s-line);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4)}
ha-card.ts.clear :is(.ts-tile,.ts-room):hover{background:color-mix(in srgb,var(--t-tile) 80%,var(--s-text) 12%)}
ha-card.ts.clear .ts-menu{text-shadow:none}
ha-card.ts.full{min-height:calc(100vh - var(--header-height,56px) - 16px)}
.ts-top{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) 48px;align-items:center;height:60px;padding:6px 10px 0;background:var(--t-bar)}
.ts-room{justify-self:center;border:0;background:var(--s-soft2);display:flex;align-items:center;gap:8px;padding:9px 18px;border-radius:99px;font-size:18px;font-weight:600;max-width:100%;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-room:hover,.ts-room[aria-expanded="true"]{background:var(--s-soft2)}
.ts-room ha-icon{--mdc-icon-size:18px;opacity:.75}
.ts-ib{width:42px;height:42px;border-radius:50%;border:0;background:none;display:grid;place-items:center}
.ts-ib:hover{background:var(--s-soft2)}
.ts-menu{position:absolute;top:64px;left:50%;transform:translateX(-50%);z-index:6;width:min(300px,calc(100% - 24px));max-height:min(64%,400px);overflow:auto;background:var(--t-menu);color:var(--s-text);
  border:1px solid var(--s-line);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.5);padding:8px;display:flex;flex-direction:column;gap:2px;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
.ts-menu button{border:0;background:none;text-align:left;padding:13px 16px;border-radius:14px;font-size:15px;font-weight:500}
.ts-menu button:hover{background:var(--s-soft2)}
.ts-menu button.on{background:var(--s-accent);color:var(--s-on);font-weight:600}
.ts-scrim{position:absolute;inset:0;z-index:5;border:0;padding:0;background:rgba(0,0,0,.35);cursor:default}
.ts-body{flex:1;padding:14px;display:flex;flex-direction:column;gap:14px;min-height:0}
.ts-body .head>.ibtn:first-child{display:none}
.ts-np{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:16px;align-items:center;padding:16px;border-radius:calc(var(--s-r)*.8 + 6px);background:var(--t-tile);border:1px solid var(--s-line)}
.ts-np.off{opacity:.65}
.ts-art{width:120px;height:92px;border-radius:16px;background:#0d0e10;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.35)}
.ts-art img{width:100%;height:100%;object-fit:cover}
.ts-art ha-icon{--mdc-icon-size:36px}
.ts-art small{font-size:11px;opacity:.7;max-width:94%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-npm{min-width:0;display:flex;flex-direction:column;gap:10px}
.ts-src{display:flex;flex-direction:column;min-width:0}
.ts-src b{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-src span{font-size:12px;color:var(--s-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-vol{display:flex;align-items:center;gap:10px}
.ts-vol input{flex:1}
.ts-vol span{min-width:3ch;font-size:12px;font-variant-numeric:tabular-nums;text-align:center;background:var(--s-soft2);border-radius:99px;padding:2px 8px}
.ts-tr{display:flex;justify-content:center;gap:18px}
.ts-tr button{width:42px;height:42px;border-radius:50%;border:0;background:none;display:grid;place-items:center}
.ts-tr button.big{width:48px;height:48px;background:var(--s-soft2)}
.ts-tr button:hover{background:var(--s-soft2)}
.ts-pw{align-self:end;width:42px;height:42px;border-radius:50%;border:1px solid var(--s-line);background:none;display:grid;place-items:center}
.ts-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));grid-auto-rows:140px;gap:10px}
.ts-tile{aspect-ratio:1.1;border:1px solid var(--s-line);background:var(--t-tile);border-radius:calc(var(--s-r)*.8 + 6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;min-width:0;transition:transform .15s ease,background .2s}
.ts-tile:hover{background:var(--s-soft2);transform:translateY(-2px)}
.ts-ico{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--s-soft2);box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
.ts-ico ha-icon{--mdc-icon-size:28px}
.ts-room{border-radius:var(--t-rr,99px)}
ha-card.ts.noicobg .ts-ico{background:none;box-shadow:none;color:var(--s-muted)}
ha-card.ts.noicobg .ts-ico ha-icon{--mdc-icon-size:36px}
ha-card.ts.noicobg .ts-tile.on .ts-ico{background:none;box-shadow:none;color:var(--s-active);filter:drop-shadow(0 0 10px color-mix(in srgb,var(--s-active) 45%,transparent))}
ha-card.ts.noicobg .ts-tile.warn .ts-ico{background:none;color:#ff8a7a}
.ts-tile.on .ts-ico{background:var(--s-active);color:var(--s-active-ink);box-shadow:0 0 20px color-mix(in srgb,var(--s-active) 32%,transparent)}
.ts-tile.warn .ts-ico{background:#ff8a7a;color:#3a0c05}
.ts-ring{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;border:3px solid var(--s-accent);background:rgba(0,0,0,.35);color:#fff;box-shadow:0 0 16px color-mix(in srgb,var(--s-accent) 35%,transparent)}
.ts-ring b{font-size:20px;font-weight:600}
.ts-l{font-size:14.5px;font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-tile{aspect-ratio:auto;height:100%;min-height:0;overflow:hidden;line-height:1.3}
.ts-ring{box-sizing:border-box}
.ts-s{font-size:12px;color:var(--s-muted);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-bottom{display:flex;justify-content:space-between;align-items:center;padding:12px 20px 14px;background:var(--t-bar);font-size:16px;font-weight:500;font-variant-numeric:tabular-nums}
.ts-wx{display:flex;align-items:center;gap:6px}
@media (max-width:520px){.ts-np{grid-template-columns:minmax(0,1fr) auto}.ts-art{display:none}}
`;

const STYLE = `
:host{display:block;position:relative}
.hub-laundry{display:block;width:100%;max-width:640px;margin:0 auto;--primary-text-color:var(--s-text);--secondary-text-color:var(--s-muted)}
.hub-car{display:block;width:100%;max-width:640px;margin:0 auto;--primary-text-color:var(--s-text);--secondary-text-color:var(--s-muted)}
.ts-carart{display:block;width:100%;height:58px;flex:none}
.t-carart{display:block;width:100%;height:64px;margin-bottom:auto}
.ts-carart dashboard-studio-vehicle,.t-carart dashboard-studio-vehicle{display:block;height:100%}
.cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.carc{border:1px solid var(--s-line);background:var(--t-tile,var(--s-soft));border-radius:calc(var(--s-r)*.8 + 6px);padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;text-align:left;min-width:0;overflow:hidden;transition:transform .15s}
.carc:active{transform:scale(.98)}
.carc-art{display:block;height:96px;margin:0 -4px;overflow:hidden}
.carc-art dashboard-studio-vehicle{display:block;height:100%}
.carc-art .car,.carc-art .car-photo{width:100%;height:100%}
.carc-art .car-photo img{width:100%;height:100%;object-fit:contain}
.carc-art svg{width:100%;height:100%}
.carc-t{display:flex;flex-direction:column;min-width:0}
.carc-t b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.carc-t span{font-size:12.5px;color:var(--s-muted)}
.carc-bar{height:5px;border-radius:99px;background:var(--s-soft2);overflow:hidden}
.carc-bar i{display:block;height:100%;border-radius:99px;background:var(--s-text);opacity:.8}
.carc.chg .carc-bar i{background:#4ade80;opacity:1}
.ts-ring.chg{border-color:#4ade80;box-shadow:0 0 16px rgba(74,222,128,.45)}
.fxl{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:var(--ha-card-border-radius,12px);z-index:9}
ha-card.tap-press :is(button,.row):active{transform:scale(.94);transition:transform .08s}
ha-card.tap-press button{transition:transform .2s cubic-bezier(.3,1.6,.5,1)}
ha-card.ic-soft{--s-active:var(--s-text);--s-active-ink:var(--ico-ink,var(--primary-background-color,#1d1e21))}
ha-card.ic-accent{--s-active:var(--s-accent);--s-active-ink:var(--s-on)}
ha-card.ic-warm{--s-active:var(--state-light-active-color,#ffc94d);--s-active-ink:#3a2a00}
:host{--s-text:var(--primary-text-color,#1c1c1c);--s-muted:var(--secondary-text-color,#6b6b6b);--s-accent:var(--primary-color,#03a9f4);
  --s-on:var(--text-primary-color,#fff);--s-active:var(--s-text);--s-active-ink:var(--ico-ink,var(--primary-background-color,#1d1e21));--s-r:var(--ha-card-border-radius,12px);
  --s-line:var(--ha-card-border-color,var(--divider-color,rgba(0,0,0,.12)));--s-soft:color-mix(in srgb,var(--s-text) 6%,transparent);--s-soft2:color-mix(in srgb,var(--s-text) 11%,transparent)}
ha-card{padding:16px;display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden;color:var(--s-text)}
button{font:inherit;color:inherit;cursor:pointer}
ha-icon{--mdc-icon-size:20px;display:inline-flex}
.title{font-size:20px;font-weight:600;letter-spacing:-.01em;line-height:1.2}
.title.big{font-size:24px}
.sub,.hint{font-size:12.5px;color:var(--s-muted);margin:0}
.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.chips::-webkit-scrollbar{display:none}
.chip{border:1px solid var(--s-line);background:var(--s-soft);border-radius:99px;padding:8px 15px;font-weight:600;font-size:13px;white-space:nowrap;flex:none}
.chip.on{background:var(--s-accent);color:var(--s-on);border-color:transparent}
.roomsel{position:relative;display:flex;align-items:center;gap:8px;align-self:flex-start;max-width:100%;border:1px solid var(--s-line);background:var(--s-soft);border-radius:99px;padding:0 12px}
.roomsel select{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-weight:600;font-size:14px;padding:9px 22px 9px 0;margin-right:-22px;cursor:pointer;min-width:0;max-width:60vw}
.roomsel select option{color:#111}
.roomsel ha-icon:last-child{pointer-events:none;--mdc-icon-size:18px}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.quick{display:flex;gap:8px;flex-wrap:wrap}
.gn{display:flex;align-items:center;gap:10px;border:0;border-radius:calc(var(--s-r)*.8);padding:10px 16px 10px 12px;background:linear-gradient(135deg,#2b2f6b,#121433);color:#fff;text-align:left}
.gn ha-icon{color:#ffd88a;--mdc-icon-size:22px}
.gn b{display:block;font-size:14px}.gn small{font-size:11.5px;opacity:.78}
.scene{border:1px solid var(--s-line);background:var(--s-soft);border-radius:calc(var(--s-r)*.8);padding:10px 14px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}
.scene ha-icon{--mdc-icon-size:18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.tile{aspect-ratio:1;border:1px solid var(--s-line);background:var(--s-soft);border-radius:var(--s-r);padding:16px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:3px;min-width:0;transition:transform .15s,background .2s}
.tile:hover{transform:translateY(-2px);background:var(--s-soft2)}
.t-ico{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:var(--s-soft2);margin-bottom:auto}
.t-ico ha-icon{--mdc-icon-size:24px}
.tile b{font-size:15px}.tile>span:last-child{font-size:12.5px;color:var(--s-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.tile.on{background:color-mix(in srgb,var(--s-active) 12%,transparent);border-color:color-mix(in srgb,var(--s-active) 35%,transparent)}
.tile.on .t-ico{background:var(--s-active);color:var(--s-active-ink)}
.tile.warn .t-ico{background:#ff8a7a;color:#3a0c05}
.head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.all{display:flex;gap:8px;margin-left:auto}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px 12px;padding:12px;border-radius:calc(var(--s-r)*.8);background:var(--s-soft);border:1px solid var(--s-line)}
.row.on{background:color-mix(in srgb,var(--s-active) 10%,transparent)}
.row.dead{opacity:.55}
.ico{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--s-soft2);border:0;flex:none}
.row.on .ico{background:var(--s-active);color:var(--s-active-ink)}
.nm{min-width:0;display:flex;flex-direction:column;gap:2px}
.nm b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.nm span{font-size:12px;color:var(--s-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctl{display:flex;align-items:center;gap:6px}
.more{grid-column:1/-1;min-width:0}
.dsl{display:flex;align-items:center;gap:6px;margin-top:10px}
.dsl span{flex:1;font-size:13px;font-weight:600;color:var(--s-muted)}
.dsl small{font-size:12px;color:var(--s-muted)}
.pbtn.dsp{display:flex;align-items:center;justify-content:center;gap:5px}
.pbtn.dsp ha-icon{--mdc-icon-size:17px}
.val{font-weight:600;min-width:3ch;text-align:center;font-variant-numeric:tabular-nums}
.ibtn{width:34px;height:34px;border-radius:50%;border:0;background:var(--s-soft2);display:grid;place-items:center;flex:none}
.ibtn.big{width:44px;height:44px;background:var(--s-accent);color:var(--s-on)}
.pbtn{border:0;height:36px;padding:0 14px;border-radius:calc(var(--s-r)*.6);background:var(--s-soft2);font-weight:600;font-size:12.5px;white-space:nowrap;flex:1}
.pbtn.on{background:var(--s-accent);color:var(--s-on)}
.seg{display:flex;gap:6px}
.sw{width:42px;height:24px;border-radius:99px;border:0;background:var(--s-soft2);position:relative;padding:0;flex:none}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--s-text);transition:transform .2s}
.row.on .sw{background:var(--s-active)}
.row.on .sw::after{transform:translateX(18px);background:var(--s-active-ink)}
input[type=range]{width:100%;accent-color:var(--s-active);margin:0}
.cam{width:100%;border-radius:calc(var(--s-r)*.6);display:block;cursor:pointer}
.sec{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:14px;align-items:start}
@media (max-width:700px){.sec{grid-template-columns:minmax(0,1fr)}}
.kps{display:flex;flex-direction:column;gap:12px}
.kp{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:var(--s-r);background:var(--s-soft);border:1px solid var(--s-line)}
.kp-top{display:flex;align-items:center;gap:12px}
.kp-top b{display:block}
.kp-st{font-size:12.5px;font-weight:600;color:var(--s-muted)}
.kp-st.armed{color:#2fb36d}.kp-st.busy{color:#e8892c}
.dots{display:flex;justify-content:center;gap:10px;min-height:14px}
.dots i{width:12px;height:12px;border-radius:50%;background:var(--s-text)}
.dots i.e{background:transparent;border:1.5px solid var(--s-muted)}
.dots.err{animation:shake .4s}
@keyframes shake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.kp-msg{text-align:center;font-size:12.5px;color:var(--s-muted);min-height:1.4em}
.kp-msg.err{color:#e5484d}
.pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pad button{height:52px;border:0;border-radius:calc(var(--s-r)*.6);background:var(--s-soft2);font-size:20px;font-weight:600;display:grid;place-items:center}
.pad button.sm{font-size:12.5px}
.night{position:absolute;inset:0;z-index:4;display:grid;place-items:center;align-content:center;gap:8px;background:rgba(8,10,30,.86);color:#fff;text-align:center;animation:fade 2.4s ease forwards;pointer-events:none;padding:16px}
.night ha-icon{--mdc-icon-size:48px;color:#ffd88a}.night b{font-size:28px}.night span{opacity:.75}
@keyframes fade{0%{opacity:0}15%{opacity:1}70%{opacity:1}100%{opacity:0}}
.flash{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:var(--s-text);color:var(--card-background-color,#fff);padding:8px 14px;border-radius:10px;font-size:13px;font-weight:500;z-index:5;max-width:calc(100% - 32px)}
.flash.err{background:#e5484d;color:#fff}
.calm *,.calm{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
button:focus-visible{outline:2px solid var(--s-accent);outline-offset:2px}
`;

/*
 * Dashboard Studio effects card
 * Puts a moving background behind the dashboard and adds card effects to the other cards on the view.
 * The card itself is invisible outside edit mode. Add one per view.
 *
 *   type: custom:dashboard-studio-fx
 *   background: aurora        # off, aurora, stars, snow, rain, bokeh, waves, sky, hue, weather
 *   weather_entity: weather.home
 *   strength: 70              # 10 to 100
 *   speed: 1                  # 0.25 to 2
 *   layer: behind             # behind the cards, or front (over them, taps pass through)
 *   critters: auto            # a fun theme's critters: auto follows the theme in use, or name one (duck, zoo, halloween…), or off
 *   card_effects:
 *     float_in: true
 *     tilt: false
 *     glowing_edges: false
 *     light_glow: true
 */
const FX_NAMES = {off: 'Off', aurora: 'Aurora', stars: 'Starry night', snow: 'Snowfall', rain: 'Rain', bokeh: 'Bokeh lights', waves: 'Waves', sky: 'Sky by time of day', hue: 'Color shift', weather: 'Follows the weather'};
const HA_WEATHER = {
  sunny: 'sunny', 'clear-night': 'night', partlycloudy: 'partly', cloudy: 'cloudy', fog: 'cloudy', windy: 'cloudy', 'windy-variant': 'cloudy',
  rainy: 'rain', pouring: 'rain', hail: 'rain', lightning: 'storm', 'lightning-rainy': 'storm', snowy: 'snow', 'snowy-rainy': 'snow', exceptional: 'cloudy'
};
const rnd = (a, b) => a + Math.random() * (b - a);
function parseRGB(c) {
  c = String(c || '').trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return p.slice(0, 3); }
  return null;
}
const alpha = (c, a) => { const p = parseRGB(c) || [255, 255, 255]; return `rgba(${p.map(Math.round).join(',')},${a})`; };
const luma = c => { const p = parseRGB(c) || [0, 0, 0]; return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255; };

/* each effect has init(W, H, P) and draw(ctx, state, W, H, t, P); t is seconds, already scaled by speed */
const ENG = {
  aurora: {init: (W, H, P) => ({b: [P.acc, P.act, P.dark ? '#7b5cff' : '#ff9ec7', P.dark ? '#00c2a8' : '#9be7ff'].map((c, i) => ({c, ph: i * 1.7, r: Math.max(W, H) * rnd(.35, .55)}))}),
    draw(x, s, W, H, t) { for (const b of s.b) { const cx = W * (.5 + .42 * Math.sin(t * .13 + b.ph)), cy = H * (.5 + .36 * Math.cos(t * .11 + b.ph * 1.3));
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, b.r); g.addColorStop(0, alpha(b.c, .42)); g.addColorStop(1, alpha(b.c, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); } }},
  stars: {init: (W, H, P) => ({s: Array.from({length: Math.min(400, Math.round(W * H / 9000))}, () => ({x: rnd(0, W), y: rnd(0, H), r: rnd(.4, 1.6) * P.dpr, f: rnd(.5, 2), p: rnd(0, 6)})), shoot: null, next: 3}),
    draw(x, s, W, H, t, P) {
      x.fillStyle = P.fg; for (const a of s.s) { x.globalAlpha = .25 + .75 * Math.abs(Math.sin(t * a.f + a.p)); x.beginPath(); x.arc(a.x, a.y, a.r, 0, 7); x.fill(); } x.globalAlpha = 1;
      if (t > s.next && !s.shoot) { s.shoot = {x: rnd(W * .3, W), y: rnd(0, H * .35), t0: t}; s.next = t + rnd(4, 9); }
      if (s.shoot) { const k = (t - s.shoot.t0) / .9; if (k > 1) s.shoot = null; else {
        const len = 150 * P.dpr, sx = s.shoot.x - k * W * .3, sy = s.shoot.y + k * H * .2, g = x.createLinearGradient(sx, sy, sx + len, sy - len * .6);
        g.addColorStop(0, alpha(P.fg, .9 * (1 - k))); g.addColorStop(1, alpha(P.fg, 0)); x.strokeStyle = g; x.lineWidth = 2 * P.dpr; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + len, sy - len * .6); x.stroke(); } } }},
  snow: {init: (W, H, P) => ({f: Array.from({length: Math.min(350, Math.round(W * H / 11000))}, () => ({x: rnd(0, W), y: rnd(0, H), r: rnd(1, 3.2) * P.dpr, v: rnd(.4, 1.1), p: rnd(0, 6)}))}),
    draw(x, s, W, H, t, P) { x.fillStyle = P.fg; for (const f of s.f) { const y = (f.y + t * f.v * 60 * P.dpr) % (H + 10), xx = f.x + Math.sin(t * .8 + f.p) * 14 * P.dpr;
      x.globalAlpha = .35 + f.r / (5 * P.dpr); x.beginPath(); x.arc(xx, y, f.r, 0, 7); x.fill(); } x.globalAlpha = 1; }},
  rain: {init: (W, H, P) => ({d: Array.from({length: Math.min(500, Math.round(W * H / 7000))}, () => ({x: rnd(0, W), y: rnd(0, H), l: rnd(10, 22) * P.dpr, v: rnd(6, 10)}))}),
    draw(x, s, W, H, t, P) { x.strokeStyle = alpha(P.fg, .32); x.lineWidth = 1.2 * P.dpr; x.beginPath();
      for (const d of s.d) { const y = (d.y + t * d.v * 90 * P.dpr) % (H + 30) - 30, xx = ((d.x - y * .15) % W + W) % W; x.moveTo(xx, y); x.lineTo(xx - d.l * .15, y + d.l); } x.stroke(); }},
  bokeh: {init: (W, H, P) => ({o: Array.from({length: 22}, (_, i) => ({x: rnd(0, W), y: rnd(0, H), r: rnd(20, 70) * P.dpr, v: rnd(.2, .6), c: [P.acc, P.act, P.fg][i % 3], p: rnd(0, 6)}))}),
    draw(x, s, W, H, t, P) { for (const o of s.o) { const span = H + o.r * 2, y = ((o.y - t * o.v * 40 * P.dpr) % span + span) % span - o.r, xx = o.x + Math.sin(t * .3 + o.p) * 30 * P.dpr;
      const g = x.createRadialGradient(xx, y, 0, xx, y, o.r); g.addColorStop(0, alpha(o.c, .3)); g.addColorStop(.7, alpha(o.c, .12)); g.addColorStop(1, alpha(o.c, 0));
      x.fillStyle = g; x.beginPath(); x.arc(xx, y, o.r, 0, 7); x.fill(); } }},
  waves: {init: () => ({}), draw(x, s, W, H, t, P) {
    [[P.acc, .16, .66, 1], [P.act, .13, .75, 1.4], [P.fg, .07, .84, .8]].forEach(([c, a, base, f], i) => {
      x.fillStyle = alpha(c, a); x.beginPath(); x.moveTo(0, H);
      for (let px = 0; px <= W; px += 8 * P.dpr) x.lineTo(px, H * base + Math.sin(px / W * Math.PI * (2 + i) + t * f + i) * H * .035 + Math.sin(px / W * 9 + t * f * 1.7) * H * .01);
      x.lineTo(W, H); x.closePath(); x.fill(); }); }},
  sky: {init: () => ({}), draw(x, s, W, H) {
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    const k = h >= 5 && h < 7 ? ['#3a4a8c', '#ffb38a'] : h >= 7 && h < 17 ? ['#5aa8f0', '#cfe9ff'] : h >= 17 && h < 19.5 ? ['#3b2a6b', '#ff8a5c'] : ['#070b1e', '#1d2650'];
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, k[0]); g.addColorStop(1, k[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const day = h >= 6 && h < 19, f = day ? (h - 6) / 13 : ((h + 24 - 19) % 24) / 11;
    const cx = W * (.08 + .84 * f), cy = H * (.5 - Math.sin(f * Math.PI) * .42), r = Math.min(W, H) * .05;
    const gl = x.createRadialGradient(cx, cy, 0, cx, cy, r * 5); gl.addColorStop(0, day ? 'rgba(255,240,180,0.7)' : 'rgba(220,230,255,0.4)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gl; x.fillRect(0, 0, W, H); x.fillStyle = day ? '#fff4c2' : '#e8eeff'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }},
  hue: {init: () => ({}), draw(x, s, W, H, t) { const a = (t * 18) % 360, g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsla(${a},75%,58%,.6)`); g.addColorStop(.5, `hsla(${a + 60},75%,58%,.6)`); g.addColorStop(1, `hsla(${a + 120},75%,58%,.6)`); x.fillStyle = g; x.fillRect(0, 0, W, H); }},
  sun: {init: () => ({}), draw(x, s, W, H, t, P) { const cx = W * .86, cy = H * .1, R = Math.min(W, H) * .7;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(255,214,120,0.55)'); g.addColorStop(1, 'rgba(255,214,120,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save(); x.translate(cx, cy); x.rotate(t * .05); x.strokeStyle = 'rgba(255,225,150,0.08)'; x.lineWidth = 26 * P.dpr;
    for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(R, 0); x.stroke(); } x.restore(); }},
  moon: {init: () => ({}), draw(x, s, W, H) { const cx = W * .84, cy = H * .13, r = Math.min(W, H) * .045;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 6); g.addColorStop(0, 'rgba(220,230,255,0.45)'); g.addColorStop(1, 'rgba(220,230,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#eef2ff'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }},
  clouds: {init: (W, H) => ({c: Array.from({length: 7}, () => ({x: rnd(0, W), y: rnd(H * .02, H * .45), s: rnd(.6, 1.3) * Math.min(W, H) * .11, v: rnd(.3, .8)}))}),
    draw(x, s, W, H, t, P) { x.fillStyle = P.dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.7)';
      for (const c of s.c) { const span = W + c.s * 5, cx = ((c.x + t * c.v * 20 * P.dpr) % span) - c.s * 2.5;
        [[0, 0, 1], [c.s * .8, -c.s * .25, .8], [c.s * 1.5, 0, .9], [c.s * .7, c.s * .2, .85]].forEach(([dx, dy, k]) => { x.beginPath(); x.arc(cx + dx, c.y + dy, c.s * k * .6, 0, 7); x.fill(); }); } }},
  /* one slow, soft flash every 6 to 11 seconds: never a strobe */
  lightning: {init: () => ({next: rnd(4, 8), at: -9}),
    draw(x, s, W, H, t) { if (t > s.next) { s.at = t; s.next = t + rnd(6, 11); } const k = t - s.at; if (k >= 0 && k < .5) { x.fillStyle = `rgba(255,255,255,${(.16 * (1 - k / .5)).toFixed(3)})`; x.fillRect(0, 0, W, H); } }}
};
const combo = (...ks) => ({init: (W, H, P) => ks.map(k => ENG[k].init(W, H, P)), draw: (x, s, W, H, t, P) => ks.forEach((k, i) => ENG[k].draw(x, s[i], W, H, t, P))});
Object.assign(ENG, {w_sunny: combo('sun'), w_partly: combo('sun', 'clouds'), w_cloudy: combo('clouds', 'clouds'), w_rain: combo('clouds', 'rain'),
  w_storm: combo('clouds', 'rain', 'lightning'), w_snow: combo('clouds', 'snow'), w_night: combo('stars', 'moon')});

/* walk every shadow root below a node; used to find the other cards on the page */
function deepAll(root, test, out = [], depth = 0) {
  if (!root || depth > 30) return out;
  for (const n of root.querySelectorAll('*')) { if (test(n)) out.push(n); if (n.shadowRoot) deepAll(n.shadowRoot, test, out, depth + 1); }
  return out;
}
const inDialog = path => path.some(n => n.tagName && /DIALOG/.test(n.tagName));

/* @critters-start: generated by tools/sync_critters.py from the Studio. Edit there, then run the script. */
const CRIT_CSS = `.pond{position:absolute; left:0; right:0; bottom:0; height:76px; background:radial-gradient(14px 6px at 50% 0, transparent 98%, #8fd0d6 100%) 0 0 / 28px 12px repeat-x, linear-gradient(180deg, #8fd0d6, #5fb3bf)}
.swimmer{position:absolute; bottom:22px; display:flex; align-items:flex-end; gap:2px; animation:swim 26s linear infinite}
.swimmer svg{display:block; width:100%; height:auto}
.duck{width:54px; animation:bob 1.6s ease-in-out infinite}
.duckling{width:28px; animation:bob 1.4s ease-in-out infinite; animation-delay:calc(var(--i) * -.3s)}
@keyframes swim{from{left:-150px} to{left:calc(100% + 20px)}}
@keyframes bob{50%{transform:translateY(-4px) rotate(-3deg)}}
.calm .swimmer{animation:none; left:40%}
.say{position:absolute; z-index:4; transform:translate(-50%, -100%); background:#fff; color:#2b2410; font:700 13px/1 system-ui, sans-serif; padding:7px 10px; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,.18); pointer-events:none; animation:pop 1.3s ease forwards; white-space:nowrap}
@keyframes pop{0%{opacity:0; margin-top:6px} 15%{opacity:1; margin-top:0} 80%{opacity:1} 100%{opacity:0; margin-top:-10px}}
.petal{position:absolute; top:-4%; width:13px; height:10px; background:#ffb7cf; border-radius:12px 0 12px 0; opacity:.9; animation:fall linear infinite}
.petal.caught{background:#ff5d93; transform:scale(1.8) !important}
@keyframes fall{from{top:-4%; transform:translateX(0) rotate(0)} to{top:104%; transform:translateX(70px) rotate(540deg)}}
.bubble{position:absolute; bottom:-14px; aspect-ratio:1; border-radius:50%; border:1.5px solid rgba(180,240,255,.45); animation:rise linear infinite}
@keyframes rise{to{bottom:105%; transform:translateX(18px)}}
.whale{position:absolute; top:38%; width:150px; opacity:.5; animation:whale 48s linear infinite; animation-delay:-28s}
.whale svg{display:block; width:100%}
@keyframes whale{0%{left:-200px} 45%{left:calc(100% + 40px)} 100%{left:calc(100% + 40px)}}
.strip{position:absolute; left:0; right:0; bottom:0; height:76px}
.strip.grass{background:radial-gradient(8px 8px at 50% 100%, #9ccf74 98%, transparent 100%) 0 0 / 16px 10px repeat-x, linear-gradient(180deg, transparent 9px, #9ccf74 9px, #6fa24c)}
.strip.pool{background:repeating-linear-gradient(90deg, rgba(255,255,255,.3) 0 2px, transparent 2px 44px), radial-gradient(14px 6px at 50% 0, transparent 98%, #4fcbe8 100%) 0 0 / 28px 12px repeat-x, linear-gradient(180deg, #4fcbe8, #1ea5d0)}
.strip.sand{background:radial-gradient(14px 6px at 50% 0, transparent 98%, #7fd3ea 100%) 0 0 / 28px 12px repeat-x, linear-gradient(180deg, transparent 10px, #7fd3ea 10px 22px, #ffffff 22px 25px, #f1d9a6 25px, #e6c58a)}
.strip.sea{background:radial-gradient(14px 6px at 50% 0, transparent 98%, #6fb6cf 100%) 0 0 / 28px 12px repeat-x, linear-gradient(180deg, #6fb6cf, #3f8aa8)}
.walker{position:absolute; bottom:22px; animation:swim 36s linear infinite; animation-delay:-14s}
.walker svg, .tube svg, .flyby svg, .crab svg, .sealion svg, .leaf svg{display:block; width:100%; height:auto}
.elephant{width:78px; animation:bob 1.3s ease-in-out infinite}
.tube{width:60px; animation:bob 1.8s ease-in-out infinite}
.slide{position:absolute; right:-50px; top:-50px; width:230px; height:230px; border-radius:50%; border:22px solid #ff8fb3; border-left-color:transparent; border-bottom-color:transparent; opacity:.45}
.leaf{position:absolute; top:-24px; width:190px; opacity:.5; transform-origin:0 0; animation:sway 7s ease-in-out infinite}
.leaf.r{left:auto; right:-24px; transform-origin:100% 0; animation-delay:-3s}
.leaf.l{left:-24px}
.leaf.r svg{transform:scaleX(-1)}
@keyframes sway{50%{transform:rotate(5deg)}}
.flyby{position:absolute; top:24%; width:72px; animation:fly 32s linear infinite; animation-delay:-24s}
.flyby svg{animation:bob .5s ease-in-out infinite}
@keyframes fly{0%{left:-100px} 40%{left:calc(100% + 40px)} 100%{left:calc(100% + 40px)}}
.crab{position:absolute; bottom:8px; width:50px; animation:scuttle 16s ease-in-out infinite alternate}
.crab svg{animation:wiggle .35s ease-in-out infinite}
@keyframes scuttle{0%{left:6%} 45%{left:38%} 55%{left:44%} 100%{left:82%}}
@keyframes wiggle{50%{transform:rotate(5deg)}}
.rain{position:absolute; top:-20%; width:1px; height:64px; background:linear-gradient(transparent, rgba(0,240,255,.55)); animation:drop linear infinite}
@keyframes drop{to{top:110%}}
.star{position:absolute; width:2px; height:2px; border-radius:50%; background:#fff; animation:twinkle ease-in-out infinite}
@keyframes twinkle{50%{opacity:.15; transform:scale(.6)}}
.shoot{position:absolute; width:120px; height:2px; background:linear-gradient(90deg, transparent, #fff); transform:rotate(18deg); opacity:0; animation:shoot 11s ease-in infinite; animation-delay:-4s}
@keyframes shoot{0%{left:-10%; top:6%; opacity:0} 3%{opacity:1} 10%{left:65%; top:36%; opacity:0} 100%{left:65%; top:36%; opacity:0}}
.cove{position:absolute; bottom:10px; left:8%; width:110px; height:100px}
.rock{position:absolute; bottom:0; left:0; width:110px; height:34px; border-radius:50% 50% 12px 12px / 80% 80% 12px 12px; background:linear-gradient(180deg, #9aa0a8, #6b7078)}
.sealion{position:absolute; bottom:22px; left:20px; width:70px; transform-origin:50% 100%; animation:sway 4s ease-in-out infinite}
.ball{position:absolute; left:71px; top:2px; width:22px; height:22px; border-radius:50%; background:conic-gradient(#ff5d6c 0 25%, #fff 0 50%, #3fa7d6 0 75%, #ffd21f 0); box-shadow:inset -3px -3px 0 rgba(0,0,0,.12); animation:ballspin 2.4s linear infinite}
@keyframes ballspin{to{transform:rotate(360deg)}}
.flake{position:absolute; top:-4%; border-radius:50%; background:#fff; opacity:.85; animation:snowfall linear infinite}
@keyframes snowfall{to{top:104%; transform:translateX(40px)}}
.lights{position:absolute; top:0; left:0; right:0; height:30px; display:flex; justify-content:space-around; background:radial-gradient(60% 14px at 50% 0, transparent 92%, rgba(30,60,40,.8) 94%, transparent 100%) 0 -4px / 8.3% 20px repeat-x}
.bulb{width:10px; height:14px; margin-top:8px; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:var(--c); box-shadow:0 0 12px var(--c); animation:blinkb 1.8s ease-in-out infinite; animation-delay:var(--d)}
@keyframes blinkb{50%{opacity:.35; box-shadow:none}}
.strip.snowy{background:radial-gradient(14px 8px at 50% 0, transparent 98%, #f1f6ff 100%) 0 0 / 28px 12px repeat-x, linear-gradient(180deg, transparent 10px, #f1f6ff 10px, #d9e4f3)}
.strip.dusk{background:linear-gradient(180deg, transparent, rgba(16,8,24,.85) 45%)}
.strip.glow{background:linear-gradient(180deg, transparent, rgba(40,8,20,.7) 55%)}
.gift, .pumpkin, .menorah, .diya, .lantern, .heartb{display:block}
.gift svg, .pumpkin svg, .menorah svg, .diya svg, .lantern svg, .heartb svg{display:block; width:100%; height:auto}
.gift{position:absolute; bottom:14px; left:12%; width:52px; animation:bob 2.4s ease-in-out infinite}
.pumpkin{position:absolute; bottom:8px; right:10%; width:66px; filter:drop-shadow(0 0 14px rgba(255,140,30,.55)); animation:bob 3s ease-in-out infinite}
.bat{width:46px}
.menorah{position:absolute; bottom:6px; left:50%; width:150px; margin-left:-75px; filter:drop-shadow(0 0 16px rgba(255,200,90,.4))}
.flame{transform-box:fill-box; transform-origin:50% 100%; animation:flick .9s ease-in-out infinite alternate}
.flame:nth-of-type(2n){animation-duration:.7s}
@keyframes flick{to{transform:scaleY(.8) scaleX(1.12); opacity:.82}}
.diyas{position:absolute; bottom:10px; left:0; right:0; display:flex; justify-content:space-around; align-items:flex-end}
.diya{width:44px; filter:drop-shadow(0 0 10px rgba(255,170,40,.55))}
.lantern{position:absolute; top:-6px; width:44px; transform-origin:50% 0; animation:sway 5s ease-in-out infinite}
.heartb{position:absolute; bottom:-30px; animation:rise linear infinite}
.bunny{width:52px; animation:hop .9s ease-in-out infinite}
@keyframes hop{0%,100%{transform:translateY(0)} 40%{transform:translateY(-16px) rotate(-4deg)}}
.eggs{position:absolute; bottom:6px; left:0; right:0; display:flex; justify-content:space-around; align-items:flex-end; pointer-events:none}
.eggs i{width:16px; height:21px; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:var(--c); box-shadow:inset 0 -5px 0 rgba(255,255,255,.45)}
.calm :is(.walker, .crab){left:40%}
.calm .flyby{left:68%}
.calm *{animation:none !important}`;
const CR_DUCK = '<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="30" cy="32" rx="22" ry="13" fill="#ffd21f"/><path d="M9 30c-5-2-7-7-4-10 3 3 7 4 10 4z" fill="#ffd21f"/><circle cx="44" cy="16" r="10" fill="#ffd21f"/><path d="M53 15l10 2.5-10 4z" fill="#ff8a00"/><circle cx="46.5" cy="13" r="1.8" fill="#222"/><path d="M20 30c6 6 16 6 21 0" fill="none" stroke="#e8b400" stroke-width="2" stroke-linecap="round"/></svg>';
const CR_WHALE = '<svg viewBox="0 0 120 50" aria-hidden="true"><path d="M8 28c0-12 18-20 44-20 22 0 40 8 46 16l12-10c2 6 0 12-4 16 4 4 6 10 4 16l-12-10c-8 10-26 14-46 14C24 50 8 42 8 28z" fill="#0b2a44"/><circle cx="26" cy="24" r="2" fill="#7fd6ff"/></svg>';
const CR_ELEPHANT = '<svg viewBox="0 0 80 56" aria-hidden="true"><g fill="#8e9aa6"><ellipse cx="34" cy="28" rx="24" ry="16"/><rect x="14" y="34" width="8" height="18" rx="3"/><rect x="26" y="36" width="8" height="16" rx="3"/><rect x="38" y="36" width="8" height="16" rx="3"/><rect x="48" y="34" width="8" height="18" rx="3"/><circle cx="60" cy="22" r="12"/><path d="M68 26c6 4 8 12 4 20l-4-2c3-6 2-11-3-14z"/></g><ellipse cx="55" cy="22" rx="7" ry="9" fill="#a9b4be"/><circle cx="64" cy="19" r="1.8" fill="#222"/><path d="M10 26c-4 2-5 6-3 9" stroke="#8e9aa6" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const CR_TUBE = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="25" y="10" width="10" height="16" rx="5" fill="#ffb36b"/><circle cx="30" cy="8" r="6" fill="#ffcf9e"/><path d="M24 7a6 6 0 0 1 12 0z" fill="#5a3a22"/><ellipse cx="30" cy="28" rx="26" ry="10" fill="#ff5d8f"/><ellipse cx="30" cy="26" rx="12" ry="4" fill="#3fc6e8"/><path d="M9 27a22 8 0 0 1 8-6M43 21a22 8 0 0 1 8 6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
const CR_LEAF = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0C40 5 80 30 95 90 60 80 20 55 0 0z" fill="#1f7a4d"/><path d="M0 0C35 25 60 50 95 90M30 22l-6 18M52 40l-4 22M72 60l-2 18M30 22l16-6M52 40l18-4" stroke="#145236" stroke-width="2" fill="none"/></svg>';
const CR_PARROT = '<svg viewBox="0 0 70 44" aria-hidden="true"><path d="M10 30 0 42l16-5z" fill="#2f6bd8"/><ellipse cx="30" cy="27" rx="18" ry="9" fill="#e8343e"/><path d="M22 23 34 3l8 18z" fill="#ffc21a"/><path d="M26 25 40 7l4 16z" fill="#2fb36b"/><circle cx="48" cy="20" r="9" fill="#e8343e"/><path d="M55 16c6 0 9 4 7 9-2-3-5-4-8-3z" fill="#f6e7c8"/><circle cx="50" cy="18" r="3.4" fill="#fff"/><circle cx="50" cy="18" r="1.8" fill="#222"/></svg>';
const CR_CRAB = '<svg viewBox="0 0 60 40" aria-hidden="true"><g stroke="#d9452b" stroke-width="3" stroke-linecap="round" fill="none"><path d="M15 26 4 32M15 30 6 37M45 26l11 6M45 30l9 7M17 18 9 9M43 18l8-9M25 16v-3M35 16v-3"/></g><circle cx="8" cy="7" r="5" fill="#ef5a3c"/><circle cx="52" cy="7" r="5" fill="#ef5a3c"/><ellipse cx="30" cy="25" rx="17" ry="11" fill="#ef5a3c"/><circle cx="25" cy="11" r="4" fill="#fff"/><circle cx="35" cy="11" r="4" fill="#fff"/><circle cx="25" cy="11" r="2" fill="#222"/><circle cx="35" cy="11" r="2" fill="#222"/><path d="M25 27q5 4 10 0" stroke="#9c2a16" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const CR_ROCKET = '<svg viewBox="0 0 70 30" aria-hidden="true"><path d="M0 15 12 9v12z" fill="#ff9d2e"/><path d="M4 15 12 11v8z" fill="#ffe14d"/><path d="M12 8h34c10 0 18 3 22 7-4 4-12 7-22 7H12z" fill="#eef1f8"/><circle cx="46" cy="15" r="4.5" fill="#5fc8ff" stroke="#9aa6c0" stroke-width="2"/><path d="M20 8 14 0h10l8 8zM20 22l-6 8h10l8-8z" fill="#ff5d6c"/></svg>';
const CR_SEALION = '<svg viewBox="0 0 70 70" aria-hidden="true"><path d="M10 66c0-18 8-32 22-40 4-10 10-16 18-16 8 0 12 5 12 10 0 4-4 6-8 6-2 10-4 22-2 40z" fill="#6b4e3d"/><path d="M28 50c-8 2-16 8-20 16h18z" fill="#5a4033"/><path d="M34 46c6 4 12 10 14 20H36z" fill="#5a4033"/><circle cx="52" cy="16" r="1.8" fill="#111"/><circle cx="61" cy="19" r="1.6" fill="#222"/><path d="M57 22l8 1M57 23l7 3" stroke="#3a2a20" stroke-width="1" stroke-linecap="round"/></svg>';
const CR_GIFT = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="18" width="40" height="28" rx="3" fill="#e8344a"/><rect x="2" y="12" width="44" height="10" rx="3" fill="#ff5163"/><rect x="21" y="12" width="6" height="34" fill="#ffd24d"/><path d="M24 12c-6-10-16-6-10 0zM24 12c6-10 16-6 10 0z" fill="none" stroke="#ffd24d" stroke-width="3.5" stroke-linejoin="round"/></svg>';
const CR_PUMPKIN = '<svg viewBox="0 0 64 56" aria-hidden="true"><path d="M30 10c0-5 3-8 7-9l2 3c-3 1-5 3-5 6z" fill="#4c7a2e"/><ellipse cx="20" cy="32" rx="16" ry="21" fill="#e86a12"/><ellipse cx="44" cy="32" rx="16" ry="21" fill="#e86a12"/><ellipse cx="32" cy="32" rx="14" ry="23" fill="#ff8a1f"/><path d="M18 26l6-6 5 6zM35 26l6-6 5 6z" fill="#ffd84d"/><path d="M16 38c6 8 26 8 32 0l-5 2-3-3-4 4-4-4-4 4-4-4-3 3z" fill="#ffd84d"/></svg>';
const CR_BAT = '<svg viewBox="0 0 60 28" aria-hidden="true"><path d="M30 10c2-3 4-3 5 0 6-6 14-8 25-6-6 3-8 8-8 14-4-4-9-4-12 0-2-3-5-4-10-2-5-2-8-1-10 2-3-4-8-4-12 0 0-6-2-11-8-14 11-2 19 0 25 6 1-3 3-3 5 0z" fill="#1a0f24"/><circle cx="28" cy="12" r="1" fill="#ffb347"/><circle cx="32" cy="12" r="1" fill="#ffb347"/></svg>';
const CR_MENORAH = (() => { let c = ''; for (let i = 0; i < 9; i++) { const x = 10 + i * 12.5, mid = i === 4, top = mid ? 18 : 26; c += `<rect x="${x-2.5}" y="${top}" width="5" height="${mid ? 16 : 10}" rx="1" fill="#e9eefc"/><path class="flame" d="M${x} ${top-11}c3 4 4 6 0 10-4-4-3-6 0-10z" fill="#ffc84a"/>`; } return `<svg viewBox="0 0 120 80" aria-hidden="true"><g fill="none" stroke="#c9d3ee" stroke-width="3.5" stroke-linecap="round"><path d="M60 34v36"/>${[0,1,2,3].map(i => { const w = 50 - i * 12.5; return `<path d="M${60-w} 36c0 18 ${w*2} 18 ${w*2} 0"/>`; }).join('')}</g><rect x="38" y="68" width="44" height="7" rx="3" fill="#c9d3ee"/>${c}</svg>`; })();
const CR_DIYA = '<svg viewBox="0 0 48 40" aria-hidden="true"><path class="flame" d="M24 4c5 6 6 10 0 16-6-6-5-10 0-16z" fill="#ffc23a"/><path d="M24 9c2 3 2 5 0 8-2-3-2-5 0-8z" fill="#fff3c4"/><path d="M4 22h40c-2 10-10 16-20 16S6 32 4 22z" fill="#c4521c"/><path d="M8 26h32" stroke="#ffcf6b" stroke-width="2.5" stroke-dasharray="3 3"/></svg>';
const CR_LANTERN = '<svg viewBox="0 0 44 90" aria-hidden="true"><path d="M22 0v18" stroke="#ffc845" stroke-width="1.5"/><rect x="14" y="16" width="16" height="5" rx="1.5" fill="#ffc845"/><ellipse cx="22" cy="42" rx="20" ry="22" fill="#e8262f"/><path d="M22 20v44M12 23c-6 12-6 26 0 38M32 23c6 12 6 26 0 38" stroke="#b5141c" stroke-width="1.5" fill="none"/><rect x="14" y="62" width="16" height="5" rx="1.5" fill="#ffc845"/><path d="M18 67v18M22 67v20M26 67v18" stroke="#ffc845" stroke-width="1.5"/></svg>';
const CR_HEART = c => `<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21 2.5 11.5A5.5 5.5 0 0 1 12 3.8a5.5 5.5 0 0 1 9.5 7.7z" fill="${c}"/></svg>`;
const CR_BUNNY = '<svg viewBox="0 0 56 56" aria-hidden="true"><ellipse cx="24" cy="38" rx="17" ry="13" fill="#f4f1f8"/><circle cx="9" cy="36" r="5" fill="#ffffff"/><circle cx="40" cy="28" r="10" fill="#f4f1f8"/><ellipse cx="37" cy="10" rx="3.6" ry="12" fill="#f4f1f8"/><ellipse cx="45" cy="11" rx="3.6" ry="12" fill="#f4f1f8" transform="rotate(14 45 11)"/><ellipse cx="37" cy="10" rx="1.6" ry="8" fill="#ffc4d6"/><circle cx="44" cy="26" r="1.7" fill="#222"/><circle cx="49.5" cy="30" r="1.6" fill="#ff8fb0"/><ellipse cx="30" cy="50" rx="7" ry="3" fill="#e4dfee"/></svg>';
function critterHTML(fun, calm) {
  const r = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
  let h = '';
  if (fun === 'duck') {
    h = `<div class="pond"><div class="swimmer">${false ? [3,2,1].map(i => `<span class="duckling" style="--i:${i}">${CR_DUCK}</span>`).join('') : ''}<button class="duck" data-egg="duck" aria-label="Duck">${CR_DUCK}</button></div></div>`;
  } else if (fun === 'sakura' && !calm) {
    h = Array.from({length:14}, () => `<button class="petal" data-egg="petal" tabindex="-1" aria-label="Petal" style="left:${r(0,96)}%; animation-duration:${r(9,17)}s; animation-delay:-${r(0,16)}s"></button>`).join('');
  } else if (fun === 'ocean' && !calm) {
    h = Array.from({length:12}, () => `<i class="bubble" style="left:${r(0,98)}%; width:${r(4,12)}px; animation-duration:${r(7,14)}s; animation-delay:-${r(0,14)}s"></i>`).join('') +
      `<button class="whale" data-egg="whale" tabindex="-1" aria-label="Whale">${CR_WHALE}</button>`;
  } else if (fun === 'zoo') {
    h = `<div class="strip grass"><div class="walker"><button class="elephant" data-egg="elephant" aria-label="Elephant">${CR_ELEPHANT}</button></div></div>`;
  } else if (fun === 'water') {
    h = `<span class="slide"></span>` + (calm ? '' : Array.from({length:10}, () => `<i class="bubble" style="left:${r(0,98)}%; width:${r(4,10)}px; animation-duration:${r(8,15)}s; animation-delay:-${r(0,15)}s"></i>`).join('')) +
      `<div class="strip pool"><div class="swimmer"><button class="tube" data-egg="tube" aria-label="Tube">${CR_TUBE}</button></div></div>`;
  } else if (fun === 'tropical') {
    h = `<span class="leaf l">${CR_LEAF}</span><span class="leaf r">${CR_LEAF}</span><button class="flyby" data-egg="parrot" tabindex="-1" aria-label="Parrot">${CR_PARROT}</button>`;
  } else if (fun === 'beach') {
    h = `<div class="strip sand"><button class="crab" data-egg="crab" aria-label="Crab">${CR_CRAB}</button></div>`;
  } else if (fun === 'cyber' && !calm) {
    h = Array.from({length:26}, () => `<i class="rain" style="left:${r(0,99)}%; animation-duration:${r(.7,1.6)}s; animation-delay:-${r(0,2)}s"></i>`).join('');
  } else if (fun === 'space') {
    h = Array.from({length:calm ? 30 : 40}, () => `<i class="star" style="left:${r(0,99)}%; top:${r(0,99)}%; animation-duration:${r(2,6)}s; animation-delay:-${r(0,6)}s; opacity:${r(.4,1)}"></i>`).join('') +
      (calm ? '' : '<i class="shoot"></i>') + `<button class="flyby" data-egg="rocket" tabindex="-1" aria-label="Rocket" style="top:62%; width:76px; animation-duration:40s; animation-delay:-30s">${CR_ROCKET}</button>`;
  } else if (fun === 'easter') {
    const cols = ['#ffb3c9','#b9e3ff','#fff09a','#c9b6ff','#b6f0c8'];
    h = `<div class="strip grass"><div class="eggs">${Array.from({length:9}, (_, i) => `<i style="--c:${cols[i % 5]}"></i>`).join('')}</div><div class="walker" style="animation-duration:28s"><button class="bunny" data-egg="bunny" aria-label="Bunny">${CR_BUNNY}</button></div></div>`;
  } else if (fun === 'xmas') {
    const cols = ['#ff4d5e','#ffd24d','#4dd68a','#5fb8ff','#ff9be0'];
    h = `<div class="lights">${Array.from({length:12}, (_, i) => `<i class="bulb" style="--c:${cols[i % 5]}; --d:-${(i * .37).toFixed(2)}s"></i>`).join('')}</div>` +
      (calm ? '' : Array.from({length:30}, () => { const z = r(3,7); return `<i class="flake" style="left:${r(0,99)}%; width:${z}px; height:${z}px; animation-duration:${r(8,16)}s; animation-delay:-${r(0,16)}s"></i>`; }).join('')) +
      `<div class="strip snowy"><button class="gift" data-egg="gift" aria-label="Present">${CR_GIFT}</button></div>`;
  } else if (fun === 'halloween') {
    h = (calm ? '' : [[14, 26, -6], [30, 34, -20], [20, 30, -13]].map(([top, dur, del]) => `<span class="flyby bat" style="top:${top}%; animation-duration:${dur}s; animation-delay:${del}s">${CR_BAT}</span>`).join('')) +
      `<div class="strip dusk"><button class="pumpkin" data-egg="pumpkin" aria-label="Pumpkin">${CR_PUMPKIN}</button></div>`;
  } else if (fun === 'hanukkah') {
    h = `<div class="strip"><button class="menorah" data-egg="menorah" aria-label="Menorah">${CR_MENORAH}</button></div>`;
  } else if (fun === 'diwali') {
    h = Array.from({length:calm ? 18 : 26}, () => `<i class="star" style="left:${r(0,99)}%; top:${r(0,80)}%; background:#ffd27a; animation-duration:${r(2,5)}s; animation-delay:-${r(0,5)}s"></i>`).join('') +
      `<div class="strip glow"><div class="diyas">${Array.from({length:7}, (_, i) => i === 3 ? `<button class="diya" data-egg="diya" aria-label="Diya" style="width:54px">${CR_DIYA}</button>` : `<span class="diya">${CR_DIYA}</span>`).join('')}</div></div>`;
  } else if (fun === 'lunar') {
    h = [6, 24, 76, 92].map((x, i) => `<button class="lantern" data-egg="lantern" tabindex="-1" aria-label="Lantern" style="left:${x}%; width:${i % 3 ? 36 : 44}px; animation-delay:-${i * 1.3}s">${CR_LANTERN}</button>`).join('');
  } else if (fun === 'valentine' && !calm) {
    const cols = ['#ff7aa2','#ff4d82','#ffb3c9','#e0306a'];
    h = Array.from({length:12}, (_, i) => `<button class="heartb" data-egg="heart" tabindex="-1" aria-label="Heart" style="left:${r(0,96)}%; width:${r(14,30)}px; animation-duration:${r(10,18)}s; animation-delay:-${r(0,18)}s; opacity:${r(.45,.9)}">${CR_HEART(cols[i % 4])}</button>`).join('');
  } else if (fun === 'sealion') {
    h = `<div class="strip sea"><div class="cove"><span class="rock"></span><button class="sealion" data-egg="sealion" aria-label="Sea lion">${CR_SEALION}</button><span class="ball"></span></div></div>`;
  }
  return h;
}
/* @critters-end */
/* Studio theme names, without the "Studio " prefix, and the critters each one brings */
const CRIT_THEMES = {'Duck Pond': 'duck', 'Sakura': 'sakura', 'Ocean Depth': 'ocean', 'Safari Zoo': 'zoo', 'Splash Park': 'water', 'Tropical': 'tropical', 'Beach Day': 'beach',
  'Cyberpunk': 'cyber', 'Deep Space': 'space', 'Sea Lion Cove': 'sealion', 'Easter': 'easter', 'Christmas': 'xmas', 'Halloween': 'halloween', 'Hanukkah': 'hanukkah',
  'Diwali': 'diwali', 'Lunar New Year': 'lunar', 'Valentine’s': 'valentine'};
/* what a critter says when tapped, and its sound */
const CRIT_SAY = {whale: ['Whale hello there!'], duck: ['Quack!', [[0, 640, 320, .13], [.17, 600, 300, .14]]], elephant: ['Pfffrrrt! 🎺', [[0, 280, 560, .45]]],
  tube: ['Wheee!', [[0, 400, 900, .5]], 'sine'], parrot: ['Squawk! Pretty bird!', [[0, 1400, 900, .12], [.16, 1500, 1000, .12]], 'square'], crab: ['Pinch pinch! 🦀'],
  rocket: ['To the stars! 🚀', [[0, 120, 900, .9]], 'sine'], sealion: ['Arf arf! 🦭', [[0, 420, 260, .09], [.15, 440, 260, .09]]],
  gift: ['Ho ho ho! 🎁', [[0, 784, 784, .12], [.14, 988, 988, .12], [.28, 1175, 1175, .25]], 'sine'], pumpkin: ['Boo! 🎃', [[0, 220, 110, .6]], 'triangle'],
  menorah: ['Chag sameach! 🕎', [[0, 659, 659, .2], [.22, 880, 880, .3]], 'sine'], diya: ['Happy Diwali! 🪔'],
  lantern: ['Happy Lunar New Year! 🧧', [[0, 523, 523, .15], [.18, 784, 784, .25]], 'sine'], heart: ['Love is love 💖'], bunny: ['Some bunny loves you! 🐰']};
const STRIP_FUNS = new Set(['duck', 'zoo', 'water', 'beach', 'sealion', 'easter', 'xmas', 'halloween', 'hanukkah', 'diwali']);
let critAudio = null;
function critTone(seq, type = 'sawtooth') {
  try {
    critAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = critAudio.currentTime;
    seq.forEach(([at, f1, f2, dur]) => {
      const o = critAudio.createOscillator(), g = critAudio.createGain(), fl = critAudio.createBiquadFilter();
      o.type = type; o.frequency.setValueAtTime(f1, t + at); o.frequency.exponentialRampToValueAtTime(f2, t + at + dur);
      fl.type = 'bandpass'; fl.frequency.value = type === 'square' ? 1800 : 1100; fl.Q.value = 2;
      g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(.2, t + at + .02); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      o.connect(fl).connect(g).connect(critAudio.destination); o.start(t + at); o.stop(t + at + dur + .02);
    });
  } catch (e) { /* no sound is fine */ }
}

class DashboardStudioFx extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._t = 0; this._last = 0; this._anims = []; this._glowed = new Set();
    this._onMove = e => this._tilt(e);
    this._onLeave = () => this._untilt();
    this._onResize = () => { clearTimeout(this._rt); this._rt = setTimeout(() => { this._start(true); this._crit(true); }, 150); };
    this._onVis = () => { if (!document.hidden) this._start(true); };
    this._onTap = e => this._tap(e);
    this._watch = new Map();
  }

  static getStubConfig() { return {background: 'aurora', strength: 70, card_effects: {float_in: true, light_glow: true}}; }

  setConfig(config) {
    const bg = config?.background ?? 'aurora';
    if (!FX_NAMES[bg]) throw new Error(`background must be one of: ${Object.keys(FX_NAMES).join(', ')}`);
    this._config = {strength: 70, speed: 1, layer: 'behind', ...config, background: bg,
      card_effects: {float_in: true, tilt: false, glowing_edges: false, light_glow: true, ...(config.card_effects || {})},
      animations: {...ANIM_DEFAULT, ...(config.animations || {})}};
    this._renderStub();
    if (this.isConnected) { this._start(true); this._crit(true); }
  }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    this._crit();
    const w = this._config?.weather_entity;
    if (!old || (w && old.states[w] !== hass.states[w])) this._start();
    /* cards whose device just turned on or off get a little pop */
    const kind = this._config?.animations?.state;
    if (old && kind && kind !== 'off' && !this._quiet()) this._watch.forEach((cards, id) => {
      const a = old.states[id]?.state, b = hass.states[id]?.state;
      if (a && b && a !== b) cards.forEach(c => {
        if (!c.isConnected) return;
        if (kind !== 'burst') return animState(c, kind, alpha(this._palette().act, .6));
        const r = c.getBoundingClientRect(), layer = document.createElement('div');
        layer.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;z-index:9999`;
        document.body.append(layer); burst(layer, r.width / 2, r.height / 2, alpha(this._palette().act, .9), 14, 70); animState(c, 'pop');
        setTimeout(() => layer.remove(), 1000);
      });
    });
  }

  _scanCards() {
    const m = new Map();
    deepAll(document.body, n => /^HUI-.*-CARD$/.test(n.tagName) && (n._config || n.config)?.entity).forEach(el => {
      const card = el.shadowRoot?.querySelector('ha-card'), id = (el._config || el.config).entity;
      if (card) m.set(id, [...(m.get(id) || []), card]);
    });
    this._watch = m;
  }

  _view() {
    let n = this;
    while (n) { if (/^HUI-.*-VIEW$/.test(n.tagName || '')) return n; n = n.parentNode || n.host; }
    return null;
  }

  _tap(e) {
    if (this._config?.animations?.tap === 'off' || this._quiet() || e.button > 0) return;
    const path = e.composedPath(); if (inDialog(path)) return;
    const card = path.find(n => n.tagName === 'HA-CARD'); if (!card || card.getRootNode() === this.shadowRoot) return;
    if (path.some(n => n.tagName === 'DASHBOARD-STUDIO-HUB')) return;
    if (this._config.animations.tap === 'press') { card.animate([{transform: 'scale(1)'}, {transform: 'scale(.97)'}, {transform: 'scale(1)'}], {duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)'}); return; }
    const r = card.getBoundingClientRect(), cs = getComputedStyle(card), kind = this._config.animations.tap;
    const layer = document.createElement('div');
    layer.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${cs.borderRadius};overflow:hidden;pointer-events:none;z-index:9999`;
    document.body.append(layer);
    tapFx(kind, layer, e.clientX - r.left, e.clientY - r.top, Math.max(80, Math.min(320, Math.max(r.width, r.height) * 1.2)), alpha(this._palette().fg, kind === 'sparkle' || kind === 'ring' ? .7 : .28));
    setTimeout(() => layer.remove(), 1000);
  }

  set editMode(v) { this._edit = !!v; this._renderStub(); }
  set preview(v) { this._prev = !!v; this._renderStub(); }

  getCardSize() { return this._edit || this._prev ? 1 : 0; }
  getGridOptions() { return {columns: 12, rows: 'auto'}; }

  _quiet() { return !!this._config?.calm || matchMedia('(prefers-reduced-motion: reduce)').matches; }

  _renderStub() {
    if (!this._config) return;
    const show = this._edit || this._prev;
    const fx = Object.entries(this._config.card_effects).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
    this.style.display = show ? '' : 'none';
    this.shadowRoot.innerHTML = show ? `<style>ha-card{padding:12px 16px;display:flex;align-items:center;gap:12px;font-size:13px}
      ha-icon{color:var(--primary-color)} b{display:block;font-size:14px} span{color:var(--secondary-text-color)}</style>
      <ha-card><ha-icon icon="mdi:creation"></ha-icon><div><b>Dashboard Studio effects</b>
      <span>${esc(FX_NAMES[this._config.background])}${fx.length ? ' · ' + esc(fx.join(', ')) : ''}${this._config.critters && this._config.critters !== 'off' ? ' · critters' : ''}. This card is hidden outside edit mode.</span></div></ha-card>` : '';
  }

  connectedCallback() {
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('pointermove', this._onMove, {passive: true});
    document.addEventListener('pointerleave', this._onLeave);
    document.addEventListener('pointerdown', this._onTap, {capture: true, passive: true});
    this._start(true);
    requestAnimationFrame(() => this._crit(true));
    const pg = this._config?.animations?.page;
    if (pg && pg !== 'off' && !this._quiet()) requestAnimationFrame(() => { const v = this._view(); if (v) this._anims.push(animPage(v, pg, 1)); });
    clearTimeout(this._fit); this._fit = setTimeout(() => { this._cardFx(true); this._scanCards(); }, 350);
    this._glowTick = setInterval(() => { this._lightGlow(); this._scanCards(); }, 2000);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerleave', this._onLeave);
    document.removeEventListener('pointerdown', this._onTap, {capture: true});
    clearInterval(this._glowTick); clearTimeout(this._fit); this._watch.clear();
    this._critOff(); this._critSig = undefined;
    cancelAnimationFrame(this._raf); this._raf = 0;
    this._canvas?.remove(); this._canvas = null;
    if (this._restoreBg !== undefined) { document.documentElement.style.removeProperty('--lovelace-background'); this._restoreBg = undefined; }
    this._anims.forEach(a => a.cancel()); this._anims = [];
    this._untilt();
    this._glowed.forEach(c => { c.style.removeProperty('box-shadow'); }); this._glowed.clear();
  }

  /* critters live in their own layer over the view, so they look the same as in the Studio */
  _critKey() {
    const c = this._config?.critters;
    if (!c || c === 'off') return '';
    if (c !== 'auto') return c;
    const name = this._hass?.selectedTheme?.theme || this._hass?.themes?.theme || '';
    return CRIT_THEMES[String(name).replace(/^Studio /, '')] || '';
  }

  _crit(force) {
    if (!this.isConnected || !this._config) return;
    const key = this._critKey(), calm = this._quiet(), sig = key + '|' + calm;
    if (!force && sig === this._critSig) return;
    this._critSig = sig;
    if (!key) return this._critOff();
    if (!this._critHost) {
      const h = this._critHost = document.createElement('div');
      h.attachShadow({mode: 'open'}).addEventListener('click', e => this._critTap(e));
      document.body.append(h);
    }
    const v = this._view(), r = v?.getBoundingClientRect(), ok = r && r.width > 0;
    this._critHost.style.cssText = `position:fixed;left:${ok ? Math.max(0, r.left) : 0}px;top:${ok ? Math.max(0, r.top) : 0}px;right:${ok ? Math.max(0, innerWidth - r.right) : 0}px;bottom:0;pointer-events:none;z-index:3`;
    this._critHost.shadowRoot.innerHTML = `<style>${CRIT_CSS}
      .fun{position:absolute;inset:0;overflow:hidden;pointer-events:none}
      .fun button{pointer-events:auto;border:0;padding:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}</style>
      <div class="fun${calm ? ' calm' : ''}">${critterHTML(key, calm)}</div>`;
    /* room at the bottom so the last cards aren't hidden behind the pond, grass or sand */
    if (v) { if (this._padView === undefined) this._padView = v.style.paddingBottom; v.style.paddingBottom = STRIP_FUNS.has(key) ? '84px' : this._padView; }
  }

  _critOff() {
    this._critHost?.remove(); this._critHost = null;
    const v = this._view();
    if (v && this._padView !== undefined) { v.style.paddingBottom = this._padView; this._padView = undefined; }
  }

  _critTap(e) {
    const egg = e.composedPath().find(n => n.dataset?.egg); if (!egg) return;
    const [text, seq, type] = CRIT_SAY[egg.dataset.egg] || [];
    if (seq && !this._config.calm) critTone(seq, type);
    if (egg.dataset.egg === 'petal') { egg.classList.add('caught'); setTimeout(() => egg.classList.remove('caught'), 900); }
    if (!text || !this._critHost) return;
    const r = egg.getBoundingClientRect(), hr = this._critHost.getBoundingClientRect(), b = document.createElement('span');
    b.className = 'say'; b.textContent = text;
    b.style.left = (r.left - hr.left + r.width / 2) + 'px'; b.style.top = (r.top - hr.top - 8) + 'px';
    this._critHost.shadowRoot.querySelector('.fun').append(b); setTimeout(() => b.remove(), 1300);
  }

  _palette() {
    const cs = getComputedStyle(this);
    const acc = cs.getPropertyValue('--primary-color').trim() || '#03a9f4';
    const act = cs.getPropertyValue('--state-light-active-color').trim() || acc;
    const bg = cs.getPropertyValue('--primary-background-color').trim() || '#ffffff';
    const dark = luma(bg) < .5;
    return {acc, act, dark, fg: dark ? '#ffffff' : (cs.getPropertyValue('--primary-text-color').trim() || '#212121')};
  }

  _key() {
    const bg = this._config.background;
    if (bg !== 'weather') return bg;
    const st = this._hass?.states[this._config.weather_entity];
    return 'w_' + (HA_WEATHER[st?.state] || 'partly');
  }

  _start(force) {
    if (!this.isConnected || !this._config) return;
    const key = this._key(), sig = key + '|' + this._config.layer;
    if (!force && sig === this._sig) return;
    this._sig = sig;
    cancelAnimationFrame(this._raf); this._raf = 0;
    if (key === 'off') { this._canvas?.remove(); this._canvas = null; return; }
    const behind = this._config.layer !== 'front';
    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      this._canvas.setAttribute('aria-hidden', 'true');
      document.body.append(this._canvas);
    }
    const c = this._canvas;
    if (behind) {
      /* move the theme's background onto the canvas, then let the view show through to it */
      const root = document.documentElement, cs = getComputedStyle(root);
      if (this._restoreBg === undefined) this._restoreBg = cs.getPropertyValue('--lovelace-background');
      const base = this._restoreBg.trim() || cs.getPropertyValue('--primary-background-color').trim();
      root.style.setProperty('--lovelace-background', 'transparent');
      c.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;background:${base}`;
    } else {
      c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:5;pointer-events:none';
    }
    const P = {...this._palette(), dpr: Math.min(1.5, devicePixelRatio || 1)};
    const W = c.width = Math.round(innerWidth * P.dpr), H = c.height = Math.round(innerHeight * P.dpr);
    const eng = ENG[key]; if (!eng) return;
    const st = eng.init(W, H, P), x = c.getContext('2d');
    const op = Math.max(.1, Math.min(1, (this._config.strength ?? 70) / 100)), speed = Math.max(.25, Math.min(2, +this._config.speed || 1));
    const frame = now => {
      this._t += Math.min(50, now - (this._last || now)) / 1000 * speed; this._last = now;
      x.clearRect(0, 0, W, H); x.globalAlpha = 1; x.save(); x.globalAlpha = op; eng.draw(x, st, W, H, this._t, P); x.restore();
      this._raf = !this._quiet() && !document.hidden && this.isConnected ? requestAnimationFrame(frame) : 0;
    };
    this._last = 0; frame(performance.now());
  }

  _cards() {
    return deepAll(document.body, n => n.tagName === 'HA-CARD' && n.getRootNode() !== this.shadowRoot)
      .filter(c => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  }

  _cardFx() {
    const fx = this._config?.card_effects || {}; if (!this.isConnected || this._quiet()) return;
    const cards = this._cards();
    if (fx.float_in) cards.slice(0, 40).forEach((c, i) => this._anims.push(c.animate(
      [{opacity: 0, transform: 'translateY(18px) scale(.97)'}, {opacity: 1, transform: 'none'}],
      {duration: 550, delay: Math.min(i, 16) * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'})));
    if (fx.glowing_edges) {
      const acc = this._palette().acc;
      cards.forEach((c, i) => this._anims.push(c.animate(
        [{boxShadow: `0 0 0 1px ${alpha(acc, .15)}, 0 0 0 ${alpha(acc, 0)}`}, {boxShadow: `0 0 0 1.5px ${alpha(acc, .55)}, 0 0 22px ${alpha(acc, .3)}`}],
        {duration: 3200, delay: (i % 6) * 400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out'})));
    }
  }

  _tilt(e) {
    if (!this._config?.card_effects?.tilt || e.pointerType === 'touch' || this._quiet()) return;
    const path = e.composedPath();
    if (inDialog(path)) return this._untilt();
    const card = path.find(n => n.tagName === 'HA-CARD');
    if (this._tilted && this._tilted !== card) this._untilt();
    if (!card || card.getRootNode() === this.shadowRoot) return;
    const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.transition = 'transform .2s ease';
    card.style.transform = `perspective(900px) rotateX(${((.5 - py) * 6).toFixed(2)}deg) rotateY(${((px - .5) * 8).toFixed(2)}deg)`;
    this._tilted = card;
  }

  _untilt() { if (this._tilted) { this._tilted.style.removeProperty('transform'); this._tilted = null; } }

  _lightGlow() {
    if (!this._hass || !this._config?.card_effects?.light_glow) return;
    const now = new Set();
    deepAll(document.body, n => /^HUI-.*-CARD$/.test(n.tagName) && (n._config || n.config)?.entity?.startsWith('light.')).forEach(el => {
      const st = this._hass.states[(el._config || el.config).entity], card = el.shadowRoot?.querySelector('ha-card');
      if (!card) return;
      if (st?.state === 'on') {
        const rgb = st.attributes.rgb_color, c = rgb ? `rgb(${rgb.join(',')})` : this._palette().act;
        const k = st.attributes.brightness != null ? .25 + .55 * st.attributes.brightness / 255 : .6;
        card.style.boxShadow = `0 14px 60px -8px ${alpha(c, k.toFixed(2))}`;
        now.add(card);
      }
    });
    this._glowed.forEach(c => { if (!now.has(c)) c.style.removeProperty('box-shadow'); });
    this._glowed = now;
  }
}

/*
 * Dashboard Studio dual shade card
 * One window with two motorized shades: day/night (two fabrics) or top down, bottom up (two rails).
 *
 *   type: custom:dashboard-studio-dual-shade
 *   name: Bedroom Shades
 *   style: daynight           # or tdbu
 *   shades:
 *     - entity: cover.bedroom_shade_night
 *       name: Blackout
 *     - entity: cover.bedroom_shade_day
 *       name: Light filtering
 *   presets:                  # optional, these are the defaults for daynight
 *     - name: Day
 *       positions: [100, 0]
 *
 * Positions follow Home Assistant: 100 is open, 0 is closed.
 */
const DS_STYLES = {
  daynight: {labels: ['Blackout', 'Light filtering'], presets: [['Open', 100, 100, 'mdi:blinds-open'], ['Day', 100, 0, 'mdi:weather-sunny'], ['Night', 0, 0, 'mdi:weather-night']]},
  tdbu: {labels: ['Top rail', 'Bottom rail'], presets: [['Open', 100, 100, 'mdi:blinds-open'], ['Privacy', 50, 0, 'mdi:eye-off-outline'], ['Closed', 100, 0, 'mdi:blinds']]}
};
const SUPPORT_SET_POSITION = 4;

class DashboardStudioDualShade extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
    this.shadowRoot.addEventListener('change', e => this._onChange(e));
    this.shadowRoot.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) this._busy = true; });
    window.addEventListener('pointerup', () => { if (this._busy) { this._busy = false; if (this._pending) this._render(); } });
  }

  static getStubConfig() {
    return {name: 'Shades', style: 'daynight', shades: [{entity: 'cover.shade_night', name: 'Blackout'}, {entity: 'cover.shade_day', name: 'Light filtering'}]};
  }

  setConfig(config) {
    const shades = (config?.shades || []).map(x => typeof x === 'string' ? {entity: x} : x).filter(x => x && x.entity);
    if (shades.length !== 2) throw new Error('Add exactly two entries under "shades", one for each motor.');
    const style = DS_STYLES[config.style] ? config.style : 'daynight';
    const presets = Array.isArray(config.presets)
      ? config.presets.map(p => [p.name, +p.positions?.[0], +p.positions?.[1], p.icon || 'mdi:blinds']).filter(p => p[0] && !isNaN(p[1]) && !isNaN(p[2]))
      : DS_STYLES[style].presets;
    this._config = {...config, style, shades, presets};
    this._render();
  }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (!old || this._config?.shades.some(x => old.states[x.entity] !== hass.states[x.entity])) {
      if (this._busy) { this._pending = true; return; }
      this._render();
    }
  }

  getCardSize() { return 5; }
  getGridOptions() { return {columns: 6, min_columns: 6}; }

  _pos(i) {
    const st = this._hass?.states[this._config.shades[i].entity];
    if (!st) return null;
    if (st.attributes.current_position != null) return st.attributes.current_position;
    return st.state === 'closed' ? 0 : 100;
  }

  _move(i, position) {
    const ent = this._config.shades[i].entity, st = this._hass.states[ent];
    if (!st) return Promise.resolve();
    const canSet = (st.attributes.supported_features & SUPPORT_SET_POSITION) || st.attributes.current_position != null;
    const call = canSet ? ['set_cover_position', {entity_id: ent, position}] : [position >= 50 ? 'open_cover' : 'close_cover', {entity_id: ent}];
    return this._hass.callService('cover', ...call).catch(err => this._toast(err?.message || 'That shade didn’t respond'));
  }

  _toast(msg) {
    this._flash = msg; this._render();
    clearTimeout(this._ft); this._ft = setTimeout(() => { this._flash = null; this._render(); }, 3000);
  }

  _onClick(e) {
    const el = e.target.closest('[data-a]'); if (!el || !this._hass) return;
    const i = +el.dataset.i, ent = this._config.shades[i]?.entity;
    switch (el.dataset.a) {
      case 'preset': { const p = this._config.presets[+el.dataset.p]; this._move(0, p[1]); this._move(1, p[2]); break; }
      case 'open': case 'close': case 'stop':
        this._hass.callService('cover', `${el.dataset.a}_cover`, {entity_id: ent}).catch(err => this._toast(err?.message || 'That shade didn’t respond'));
        break;
      case 'more': this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: ent}, bubbles: true, composed: true})); break;
    }
  }

  _onChange(e) {
    if (e.target.dataset.i == null) return;
    this._move(+e.target.dataset.i, +e.target.value);
  }

  _render() {
    if (!this._config) return;
    this._pending = false;
    const c = this._config, labels = DS_STYLES[c.style].labels;
    const p = [this._pos(0), this._pos(1)], known = p.every(v => v != null);
    const state = v => v == null ? 'Not found' : v <= 0 ? 'Closed' : v >= 100 ? 'Open' : `${v}% open`;
    const status = i => { const st = this._hass?.states[c.shades[i].entity]; return st && ['opening', 'closing'].includes(st.state) ? cap(st.state) + '…' : state(p[i]); };
    const active = known ? c.presets.findIndex(x => x[1] === p[0] && x[2] === p[1]) : -1;
    let win = '';
    if (known) {
      if (c.style === 'tdbu') { const y1 = 100 - p[0], y2 = Math.max(y1, 100 - p[1]); win = `<i class="f f2 rails" style="top:${y1}%;height:${y2 - y1}%"></i>`; }
      else win = `<i class="f f2" style="height:${100 - p[1]}%"></i><i class="f f1" style="height:${100 - p[0]}%"></i>`;
    }
    const row = i => {
      const name = c.shades[i].name || labels[i], dead = p[i] == null, id = esc(c.shades[i].entity);
      return `<div class="row${dead ? ' dead' : ''}"><div class="nm" data-a="more" data-i="${i}"><b>${esc(name)}</b><span>${esc(status(i))}</span></div>
        <div class="ctl">${['open:mdi:arrow-up:Open', 'stop:mdi:stop:Stop', 'close:mdi:arrow-down:Close'].map(x => { const [a, ...r] = x.split(':'), label = r.pop();
          return `<button class="ibtn" data-a="${a}" data-i="${i}" aria-label="${label} ${esc(name)}" ${dead ? 'disabled' : ''}><ha-icon icon="${r.join(':')}"></ha-icon></button>`; }).join('')}</div>
        ${dead ? '' : `<input type="range" min="0" max="100" value="${p[i]}" data-i="${i}" aria-label="${esc(name)} position" data-e="${id}">`}</div>`;
    };
    this.shadowRoot.innerHTML = `<style>${DS_STYLE}</style><ha-card>
      <div class="top"><b class="title">${esc(c.name || 'Shades')}</b><span class="pill">${active >= 0 ? esc(c.presets[active][0]) : known ? 'Custom' : '…'}</span></div>
      <div class="win${c.style === 'tdbu' ? ' tdbu' : ''}" aria-hidden="true">${win}</div>
      ${row(0)}${row(1)}
      <div class="presets">${c.presets.map((x, k) => `<button class="pbtn${k === active ? ' on' : ''}" data-a="preset" data-p="${k}"><ha-icon icon="${esc(x[3])}"></ha-icon>${esc(x[0])}</button>`).join('')}</div>
      ${this._flash ? `<div class="flash" role="status">${esc(this._flash)}</div>` : ''}</ha-card>`;
  }
}

const DS_STYLE = `
:host{--s-text:var(--primary-text-color,#1c1c1c);--s-muted:var(--secondary-text-color,#6b6b6b);--s-accent:var(--primary-color,#03a9f4);--s-on:var(--text-primary-color,#fff);
  --s-r:var(--ha-card-border-radius,12px);--s-line:var(--ha-card-border-color,var(--divider-color,rgba(0,0,0,.12)));--s-soft2:color-mix(in srgb,var(--s-text) 11%,transparent)}
ha-card{padding:16px;display:flex;flex-direction:column;gap:12px;position:relative;color:var(--s-text)}
button{font:inherit;color:inherit;cursor:pointer}
ha-icon{--mdc-icon-size:18px;display:inline-flex}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.title{font-size:16px;font-weight:600}
.pill{font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;background:var(--s-soft2)}
.win{height:120px;border-radius:calc(var(--s-r)*.5);position:relative;overflow:hidden;border:1px solid var(--s-line);background:linear-gradient(180deg,#a9d3ff,#e8f3ff)}
.win::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(90deg,transparent calc(50% - 1px),rgba(255,255,255,.75) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px))}
.f{position:absolute;left:0;right:0;top:0;display:block;transition:height .5s ease,top .5s ease}
.f2{background:repeating-linear-gradient(180deg,rgba(255,255,255,.62) 0 8px,rgba(220,226,235,.55) 8px 10px);box-shadow:0 2px 3px rgba(0,0,0,.12)}
.f1{z-index:1;background:repeating-linear-gradient(180deg,#353a46 0 8px,#22252d 8px 10px);box-shadow:0 2px 5px rgba(0,0,0,.3)}
.rails{border-top:4px solid #8a8f99;border-bottom:4px solid #8a8f99}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:center}
.row.dead{opacity:.55}
.nm{min-width:0;cursor:pointer}
.nm b{display:block;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm span{font-size:12px;color:var(--s-muted)}
.ctl{display:flex;gap:4px}
.ibtn{width:32px;height:32px;border-radius:50%;border:0;background:var(--s-soft2);display:grid;place-items:center}
.ibtn:disabled{opacity:.4;cursor:default}
input[type=range]{grid-column:1/-1;width:100%;margin:0;accent-color:var(--s-accent)}
.presets{display:flex;gap:8px}
.pbtn{flex:1;min-width:0;height:38px;border:0;border-radius:calc(var(--s-r)*.6);background:var(--s-soft2);font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.pbtn.on{background:var(--s-accent);color:var(--s-on)}
.flash{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:#e5484d;color:#fff;padding:7px 12px;border-radius:9px;font-size:12.5px;z-index:3;max-width:calc(100% - 24px)}
button:focus-visible{outline:2px solid var(--s-accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.f{transition:none}}
`;

/* side view of each Tesla, front to the right, drawn to its real proportions: the body line from the front bumper over the roof
   to the rear, where the wheels sit, the side glass, and the lids that open. The ground is at y 150 */
const CAR_SHAPES = {
  model_3: {R: 25.5, wheels: [97, 317], wheel: 'aero', yb: 131,
    top: [[382, 117], [380, 105], [371, 98], [342, 92], [300, 86], [264, 58], [242, 47], [212, 40], [182, 41], [152, 47], [120, 62], [94, 76], [70, 82], [44, 86], [27, 92], [22, 104]],
    rear: [[22, 120], [27, 131]], front: [[375, 131], [382, 125]],
    glass: [[294, 86], [264, 60], [242, 50], [212, 44], [182, 45], [154, 50], [126, 63], [100, 78]], sill: [[112, 81], [200, 84], [294, 86]], pillars: [205], doors: [262, 205, 128],
    hood: [[300, 86], [340, 92], [370, 98], [379, 104]], trunk: [[94, 76], [70, 82], [44, 86], [28, 91]],
    head: [[368, 99], [381, 106]], tail: [[23, 95], [42, 90]], port: [36, 98], mirror: [290, 83], handles: [[236, 93], [168, 91]]},
  model_y: {R: 27, wheels: [98, 317], wheel: 'aero', yb: 130, cladding: true,
    top: [[383, 112], [381, 99], [371, 92], [340, 86], [302, 80], [264, 50], [240, 36], [208, 29], [172, 30], [142, 35], [114, 46], [88, 59], [64, 70], [44, 75], [30, 79], [24, 86], [22, 100]],
    rear: [[22, 119], [27, 130]], front: [[376, 130], [383, 122]],
    glass: [[296, 80], [264, 52], [240, 39], [208, 33], [172, 34], [144, 39], [118, 49], [96, 60], [84, 66]], sill: [[92, 70], [205, 76], [296, 80]], pillars: [208, 122], doors: [264, 208, 126],
    hood: [[300, 80], [338, 86], [370, 92], [380, 99]], trunk: [[114, 46], [88, 59], [64, 70], [44, 75], [30, 79]],
    head: [[368, 93], [381, 100]], tail: [[24, 88], [44, 82]], port: [36, 92], mirror: [292, 77], handles: [[238, 87], [170, 85]]},
  model_s: {R: 25.8, wheels: [100, 314], wheel: 'turbine', yb: 131,
    top: [[382, 118], [380, 106], [368, 99], [336, 93], [298, 88], [262, 60], [238, 50], [205, 46], [172, 47], [140, 53], [110, 68], [84, 80], [62, 85], [40, 88], [26, 94], [22, 106]],
    rear: [[22, 121], [27, 131]], front: [[375, 131], [382, 126]],
    glass: [[294, 88], [262, 62], [238, 53], [205, 50], [172, 51], [142, 57], [114, 70], [98, 80]], sill: [[112, 83], [204, 86], [294, 88]], pillars: [204, 140], doors: [262, 204, 140],
    hood: [[298, 88], [336, 93], [368, 99], [379, 106]], trunk: [[110, 68], [84, 80], [62, 85], [40, 88], [27, 94]],
    head: [[366, 100], [380, 107]], tail: [[24, 97], [44, 92]], port: [36, 100], mirror: [290, 85], handles: [[234, 95], [170, 93]]},
  model_x: {R: 26.5, wheels: [102, 314], wheel: 'turbine', yb: 130, cladding: true,
    top: [[382, 113], [380, 100], [369, 92], [336, 86], [304, 80], [264, 46], [238, 33], [200, 29], [160, 30], [128, 35], [102, 47], [78, 60], [56, 70], [38, 75], [26, 80], [22, 96]],
    rear: [[22, 119], [27, 130]], front: [[375, 130], [382, 122]],
    glass: [[298, 80], [264, 49], [238, 36], [200, 33], [160, 34], [130, 39], [106, 49], [86, 60], [76, 66]], sill: [[84, 70], [205, 75], [298, 80]], pillars: [210, 126], doors: [262, 210, 130],
    hood: [[302, 80], [334, 86], [368, 92], [380, 100]], trunk: [[102, 47], [78, 60], [56, 70], [38, 75], [26, 80]],
    head: [[368, 93], [381, 101]], tail: [[24, 90], [42, 84]], port: [36, 94], mirror: [294, 77], handles: [[238, 87], [172, 85]]},
  cybertruck: {R: 28, wheels: [85, 326], wheel: 'cyber', yb: 128, sharp: true, cladding: true,
    top: [[385, 110], [385, 99], [381, 93], [212, 37], [24, 87], [22, 93]],
    rear: [[22, 114], [24, 128]], front: [[380, 128], [385, 122]],
    glass: [[284, 65], [212, 42], [146, 59]], sill: [[150, 71], [280, 71]], pillars: [214], doors: [284, 214, 146],
    hood: [[284, 61], [381, 93]], trunk: [[146, 55], [24, 87]],
    head: [[372, 90], [385, 97]], tail: [[22, 93], [32, 90]], port: [34, 100], mirror: [280, 66], handles: []}
};
const CAR_MODELS = {sedan: 'model_3', suv: 'model_y', cyber: 'cybertruck', truck: 'cybertruck'};
const CAR_PAINT = {pearl_white: '#eef0f2', solid_black: '#141518', midnight_silver: '#3e4247', stealth_grey: '#5b5f64', quicksilver: '#b9bdc3', deep_blue: '#1f3b70', ultra_red: '#a5121d', stainless: '#a7abb0'};
const carMix = (hex, to, t) => {
  const p = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, x => x + x); const n = parseInt(h, 16); return isNaN(n) ? [217, 220, 225] : [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const a = p(CAR_PAINT[hex] || hex), b = p(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
};
/* The default car picture, until Tesla View or a 3D Tesla is set up.
 * It is a render of the Dodge Challenger model at https://www.thingiverse.com/thing:3163692, licensed CC BY-NC-SA 4.0
 * (https://creativecommons.org/licenses/by-nc-sa/4.0/). Changed: rendered as a picture with dark wheels and windows, and tinted
 * to your paint color. These two pictures (CLAY_CAR and CLAY_MASK) are shared under CC BY-NC-SA 4.0, not the license of the rest of this file. */
const CLAY_CAR = 'data:image/webp;base64,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';
const CLAY_MASK = 'data:image/webp;base64,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';
function clayCar(o) {
  const paint = CAR_PAINT[o.color] || (/^#|^rgb/.test(o.color || '') ? o.color : CAR_PAINT.pearl_white);
  const cls = ['car-photo', 'car-clay', o.charging && 'charging', o.sentry && 'sentry', o.climate && 'climate ' + o.climate].filter(Boolean).join(' ');
  return `<div class="${cls}" style="--paint:${paint}"><img src="${CLAY_CAR}" alt="${esc(o.label || 'Car')}"><i class="clay-paint"></i><i class="clay-shine"></i><i class="cp-glow"></i><i class="cp-eye"></i><i class="cp-air"></i></div>`;
}
function carSVG(o, uid) {
  const s = CAR_SHAPES[CAR_MODELS[o.model] || o.model] || CAR_SHAPES.model_y, c = o.color || '#d9dce1', id = 'car' + uid, G = 150, R = s.R, yb = s.yb;
  const f = n => +n.toFixed(1);
  /* a smooth line through the points (straight for the Cybertruck) */
  const line = (pts, start = true) => (start ? `M${pts[0][0]} ${pts[0][1]}` : '') + (s.sharp ? pts.slice(1).map(p => ` L${p[0]} ${p[1]}`).join('') : pts.slice(0, -1).map((p1, i) => {
    const p0 = pts[i - 1] || p1, p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    return ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`; }).join(''));
  const wy = G - R, A = R + 3.2, dy = yb - wy, dx = f(Math.sqrt(Math.max(1, A * A - dy * dy)));
  const [wr, wf] = s.wheels;
  /* round wheel arches, or the Cybertruck's angular ones */
  const arch = x => s.sharp ? ` L${f(x - A - 3)} ${yb} L${f(x - A * .72)} ${f(wy - A * .82)} L${f(x + A * .72)} ${f(wy - A * .82)} L${f(x + A + 3)} ${yb}`
    : ` L${f(x - dx)} ${yb} A${A} ${A} 0 1 1 ${f(x + dx)} ${yb}`;
  const body = line(s.top) + s.rear.map(p => ` L${p[0]} ${p[1]}`).join('') + arch(wr) + arch(wf) + s.front.map(p => ` L${p[0]} ${p[1]}`).join('') + ' Z';
  const glass = line(s.glass) + s.sill.map(p => ` L${p[0]} ${p[1]}`).join('') + ' Z';
  const gx = s.glass.map(p => p[0]).concat(s.sill.map(p => p[0])), gy = s.glass.map(p => p[1]).concat(s.sill.map(p => p[1]));
  const air = [Math.min(...gx) + 12, Math.min(...gy) + 4, Math.max(...gx) - Math.min(...gx) - 24, Math.max(...gy) - Math.min(...gy) - 6];
  const belt = s.sill[s.sill.length - 1][1];
  const beltAt = x => { const [a, b] = [s.sill[0], s.sill[s.sill.length - 1]]; return f(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])); };
  /* wheels: a tire with a soft sidewall, then the model's own wheel */
  const rim = x => {
    const k = R * .74;
    if (s.wheel === 'cyber') return `<circle cx="${x}" cy="${wy}" r="${f(k)}" fill="#3b3e44" stroke="#5a5e65" stroke-width="1"/>`
      + Array.from({length: 8}, (_, i) => `<line x1="${x}" y1="${wy}" x2="${f(x + Math.cos(i * Math.PI / 4) * k)}" y2="${f(wy + Math.sin(i * Math.PI / 4) * k)}" stroke="#2a2c31" stroke-width="1.4"/>`).join('')
      + `<polygon points="${Array.from({length: 6}, (_, i) => `${f(x + Math.cos(i * Math.PI / 3) * k * .32)},${f(wy + Math.sin(i * Math.PI / 3) * k * .32)}`).join(' ')}" fill="#4a4e55" stroke="#2a2c31" stroke-width="1"/>`;
    if (s.wheel === 'turbine') return `<circle cx="${x}" cy="${wy}" r="${f(k)}" fill="url(#${id}rim)" stroke="#2b2e33" stroke-width="1"/>`
      + Array.from({length: 10}, (_, i) => `<path d="M${x} ${f(wy - k * .3)} L${f(x - k * .08)} ${f(wy - k * .92)} L${f(x + k * .1)} ${f(wy - k * .92)} Z" fill="#202227" transform="rotate(${i * 36 + 8} ${x} ${wy})"/>`).join('')
      + `<circle cx="${x}" cy="${wy}" r="${f(k * .26)}" fill="url(#${id}rim)" stroke="#202227" stroke-width="1"/>`;
    return `<circle cx="${x}" cy="${wy}" r="${f(k)}" fill="url(#${id}rim)" stroke="#2b2e33" stroke-width="1"/><circle cx="${x}" cy="${wy}" r="${f(k * .9)}" fill="#2a2d33"/>`
      + Array.from({length: 5}, (_, i) => `<path d="M${f(x - k * .16)} ${f(wy - k * .3)} Q${x} ${f(wy - k * .42)} ${f(x + k * .16)} ${f(wy - k * .3)} L${f(x + k * .3)} ${f(wy - k * .84)} Q${x} ${f(wy - k * .95)} ${f(x - k * .3)} ${f(wy - k * .84)} Z" fill="url(#${id}rim)" opacity=".85" transform="rotate(${i * 72 + 14} ${x} ${wy})"/>`).join('')
      + `<circle cx="${x}" cy="${wy}" r="${f(k * .2)}" fill="#1d1f24" stroke="#8d939b" stroke-width=".8"/>`;
  };
  const wheel = x => `<ellipse cx="${x}" cy="${G - .5}" rx="${f(R * .95)}" ry="3.6" fill="#000" opacity=".55"/><circle cx="${x}" cy="${wy}" r="${R}" fill="url(#${id}tire)"/>`
    + `<circle cx="${x}" cy="${wy}" r="${f(R - 2.4)}" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="1.6"/>${rim(x)}`
    + `<path d="M${f(x - R * .62)} ${f(wy - R * .5)} A${f(R * .8)} ${f(R * .8)} 0 0 1 ${f(x + R * .2)} ${f(wy - R * .78)}" stroke="#fff" stroke-opacity=".14" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const [ax, ay, aw, ah] = air, airC = o.climate === 'heat' ? '#ff9a5c' : '#7cc8ff';
  const waves = [0, 1, 2].map(i => { const y = ay + ah * (.35 + i * .25); let d = `M${f(ax)} ${f(y)}`; for (let x = 0; x < aw; x += 24) d += ' q 6 -5 12 0 t 12 0'; return `<path class="car-air" d="${d}" stroke="${airC}" style="animation-delay:${i * .5}s"/>`; }).join('');
  const [px, py] = s.port, chg = o.charging && (o.charger === 'supercharger' || o.charger === 'wall') ? o.charger : '';
  /* a Supercharger stall or a Wall Connector stands next to the car while it charges */
  const plug = chg === 'supercharger' ? [-41, 92] : [-47, 99];
  const cd = chg ? `M${px} ${py} C${px - 18} ${py + 44} ${plug[0] + 22} ${plug[1] + 46} ${plug[0]} ${plug[1]}` : `M${px} ${py} C${px - 14} ${py + 12} ${px - 26} ${py + 30} ${px - 30} 152`;
  const lamp = o.charging ? '#4ade80' : '#7cc8ff';
  const station = chg === 'supercharger'
    ? `<g class="car-station"><rect x="-68" y="142" width="40" height="6" rx="2" fill="#8c9199"/><path d="M-63 144 L-63 52 Q-63 26 -48 26 Q-33 26 -33 52 L-33 144 Z" fill="#eceef1" stroke="#c4c8ce" stroke-width="1"/>
      <path d="M-57 136 L-57 56 Q-57 36 -48 36 Q-39 36 -39 56 L-39 136 Z" fill="#23262c"/><rect class="car-lamp" x="-50" y="42" width="4" height="26" rx="2" fill="${lamp}"/><circle cx="-41" cy="92" r="4" fill="#3a3d43"/></g>`
    : chg === 'wall' ? `<g class="car-station"><rect x="-74" y="18" width="10" height="130" fill="#000" opacity=".12"/><rect x="-62" y="62" width="26" height="40" rx="11" fill="#eceef1" stroke="#c4c8ce" stroke-width="1"/>
      <rect x="-58" y="66" width="18" height="16" rx="7" fill="#2a2d33"/><rect class="car-lamp" x="-54" y="86" width="10" height="3" rx="1.5" fill="${lamp}"/><circle cx="-47" cy="99" r="3.4" fill="#3a3d43"/></g>` : '';
  const cable = o.charging ? `${station}<path d="${cd}" stroke="#26282d" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path class="car-flow" d="${cd}" stroke="#4ade80" stroke-width="2.4" fill="none" stroke-dasharray="4 10" stroke-linecap="round"/>` : '';
  const cls = ['car', o.charging && 'charging', o.climate && 'climate', o.sentry && 'sentry', o.lights && 'lights'].filter(Boolean).join(' ');
  const gTop = Math.min(...s.top.map(p => p[1]));
  /* the shoulder: a crisp highlight where the side turns toward the sky, and the horizon reflected just under it */
  const shoulder = `M${wf + A + 6} ${f(belt + 9)} C${f(wf - 40)} ${f(belt + 5)} ${f(wr + 40)} ${f(beltAt(wr) + 4)} ${f(s.rear[0][0] + 8)} ${f(beltAt(wr) + 6)}`;
  const cut = x => `<path d="M${x} ${beltAt(x)} C${x - 1} ${f((beltAt(x) + yb) / 2)} ${x - 2} ${yb - 6} ${x - 3} ${yb - 2}" stroke="#000" stroke-opacity=".3" stroke-width="1.1" fill="none"/><path d="M${x + 1.2} ${beltAt(x)} C${x} ${f((beltAt(x) + yb) / 2)} ${x - 1} ${yb - 6} ${x - 2} ${yb - 2}" stroke="#fff" stroke-opacity=".12" stroke-width=".8" fill="none"/>`;
  return `<svg class="${cls}" viewBox="${chg ? '-80 0 480 154' : '0 0 400 154'}" role="img" aria-label="${o.label || 'Car'}">
    <defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${gTop}) scale(1 ${G - gTop})">
        <stop offset="0" stop-color="${carMix(c, '#ffffff', .42)}"/><stop offset=".3" stop-color="${carMix(c, '#ffffff', .2)}"/><stop offset=".5" stop-color="${carMix(c, '#ffffff', .08)}"/>
        <stop offset=".54" stop-color="${carMix(c, '#000000', .22)}"/><stop offset=".6" stop-color="${carMix(c, '#ffffff', .03)}"/><stop offset=".78" stop-color="${carMix(c, '#000000', .1)}"/><stop offset="1" stop-color="${carMix(c, '#000000', .55)}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f93a8"/><stop offset=".35" stop-color="#2a3644"/><stop offset=".7" stop-color="#0e131a"/><stop offset="1" stop-color="#161d26"/></linearGradient>
      <radialGradient id="${id}rim" cx=".38" cy=".32"><stop offset="0" stop-color="#e2e5e9"/><stop offset=".55" stop-color="#9aa0a8"/><stop offset="1" stop-color="#50545b"/></radialGradient>
      <radialGradient id="${id}tire" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#1c1d21"/><stop offset=".9" stop-color="#121316"/><stop offset="1" stop-color="#060708"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c"><path d="${glass}"/></clipPath><clipPath id="${id}bc"><path d="${body}"/></clipPath></defs>
    <ellipse cx="202" cy="${G - 1}" rx="184" ry="6" fill="#000" opacity=".32"/>
    ${cable}
    ${[wr, wf].map(x => `<circle cx="${x}" cy="${wy}" r="${f(A - .5)}" fill="#0a0b0d"/>`).join('')}
    <path d="${body}" fill="url(#${id}b)"/>
    <path d="${body}" fill="url(#${id}s)"/>
    <g clip-path="url(#${id}bc)">
      <path d="${shoulder}" stroke="#fff" stroke-opacity=".38" stroke-width="1.6" fill="none"/>
      <path d="${line(s.top)}" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" fill="none" transform="translate(0 1.2)"/>
      ${s.cladding ? `<rect x="0" y="${yb - 7}" width="400" height="12" fill="#121316" opacity=".88"/>` : `<rect x="0" y="${yb - 5}" width="400" height="8" fill="#000" opacity=".28"/>`}
      ${[wr, wf].map(x => s.sharp ? '' : `<circle cx="${x}" cy="${wy}" r="${f(A + 2.5)}" fill="none" stroke="${s.cladding ? '#121316' : '#000'}" stroke-opacity="${s.cladding ? .9 : .22}" stroke-width="${s.cladding ? 6 : 3}"/>`).join('')}
    </g>
    ${s.sharp ? [wr, wf].map(x => `<path d="M${f(x - A - 3)} ${yb} L${f(x - A * .72)} ${f(wy - A * .82)} L${f(x + A * .72)} ${f(wy - A * .82)} L${f(x + A + 3)} ${yb}" stroke="#121316" stroke-width="7" fill="none" stroke-linejoin="round"/>`).join('') : ''}
    ${s.doors.map(cut).join('')}
    <path d="${glass}" fill="url(#${id}g)" stroke="#07090c" stroke-width="2.6" stroke-linejoin="round"/>
    <g clip-path="url(#${id}c)" fill="none" stroke-width="2" stroke-linecap="round">${waves}
      <path d="M${ax - 20} ${ay + ah + 8} L${ax + aw * .28} ${ay - 10} L${ax + aw * .42} ${ay - 10} L${ax + aw * .1} ${ay + ah + 8} Z" fill="#fff" opacity=".07" stroke="none"/>
      <path d="M${ax + aw * .5} ${ay + ah + 8} L${ax + aw * .74} ${ay - 10} L${ax + aw * .8} ${ay - 10} L${ax + aw * .56} ${ay + ah + 8} Z" fill="#fff" opacity=".05" stroke="none"/></g>
    ${s.pillars.map(x => `<path d="M${x - 3} ${f(Math.min(...gy) - 2)} L${x + 3} ${f(Math.min(...gy) - 2)} L${x + 3} ${beltAt(x)} L${x - 3} ${beltAt(x)} Z" fill="#07090c" clip-path="url(#${id}c)"/>`).join('')}
    <path d="M${s.mirror[0]} ${s.mirror[1]} l1.5 -6.5 c3 -2 9 -2 11.5 .5 l-1 5.5 c-4 1.5 -8.5 1.5 -12 .5 Z" fill="${carMix(c, '#000000', .15)}" stroke="#07090c" stroke-width="1"/>
    ${s.handles.map(([x, y]) => `<rect x="${x}" y="${y}" width="20" height="3" rx="1.5" fill="#000" opacity=".32"/><rect x="${x}" y="${y - .5}" width="20" height="1" rx=".5" fill="#fff" opacity=".4"/>`).join('')}
    <rect x="${f(wf - A - 9)}" y="${f(beltAt(wf - A) + 16)}" width="6" height="2.4" rx="1.2" fill="#0a0b0d" opacity=".8"/>
    ${o.frunk ? `<path d="${line(s.hood)}" stroke="#000" stroke-opacity=".55" stroke-width="3" fill="none"/>` : ''}${o.trunk ? `<path d="${line(s.trunk)}" stroke="#000" stroke-opacity=".55" stroke-width="3" fill="none"/>` : ''}
    <path class="car-lid hood${o.frunk ? ' open' : ''}" d="${line(s.hood)}" style="transform-origin:${s.hood[0][0]}px ${s.hood[0][1]}px" stroke="${carMix(c, '#ffffff', .35)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path class="car-lid trunk${o.trunk ? ' open' : ''}" d="${line(s.trunk)}" style="transform-origin:${s.trunk[0][0]}px ${s.trunk[0][1]}px" stroke="${carMix(c, '#ffffff', .35)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M${s.head[0].join(' ')} L${s.head[1].join(' ')}" stroke="#0a0c10" stroke-width="6" stroke-linecap="round"/><path class="car-head" d="M${s.head[0].join(' ')} L${s.head[1].join(' ')}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M${s.tail[0].join(' ')} L${s.tail[1].join(' ')}" stroke="#2a0507" stroke-width="6" stroke-linecap="round"/><path class="car-tail" d="M${s.tail[0].join(' ')} L${s.tail[1].join(' ')}" stroke-width="2.6" stroke-linecap="round"/>
    <circle class="car-port${o.port || o.charging ? ' open' : ''}" cx="${px}" cy="${py}" r="3.6"/>
    <circle class="car-eye" cx="${s.pillars[0] + 3}" cy="${f(belt - 12)}" r="3.4"/>
    ${[wr, wf].map(wheel).join('')}
  </svg>`;
}

/* the car: your own picture if you set one, otherwise the drawing. Charging, sentry and climate show on both */
const TESLA_MODELS = ['model_3', 'model_y', 'model_s', 'model_x', 'cybertruck'];
/* a Tesla model shows that Tesla; any other car (or none picked) shows the rendered car picture */
function carVisual(o, uid) {
  if (!o.image) return o.drawing || TESLA_MODELS.includes(o.model) ? carSVG(o, uid) : clayCar(o);
  const cls = ['car-photo', o.charging && 'charging', o.sentry && 'sentry', o.climate && 'climate ' + o.climate].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="${String(o.image).replace(/"/g, '&quot;')}" alt="${o.label || 'Car'}"><i class="cp-glow"></i><i class="cp-eye"></i><i class="cp-air"></i></div>`;
}
/* real 3D cars: a GLB file you made yourself from your own copy of the Tesla app with Tesla Model Extractor.
   three.js loads only when a card uses a 3D model. Closures follow the car: time 0 is closed, the end of a clip is open */
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0';
let threeLoad;
const loadThree = () => threeLoad = threeLoad || Promise.all([
  import(`${THREE_CDN}/+esm`), import(`${THREE_CDN}/examples/jsm/loaders/GLTFLoader.js/+esm`), import(`${THREE_CDN}/examples/jsm/environments/RoomEnvironment.js/+esm`)
]).then(([T, G, E]) => ({T, GLTFLoader: G.GLTFLoader, RoomEnvironment: E.RoomEnvironment}));
const glbFiles = new Map();
const CAR_CLIPS = {frunk: /hood|frunk/i, trunk: /trunk|liftgate|tailgate|tonneau/i, charge_port: /charge.?port/i, windows: /window/i};

class Car3D {
  constructor(url, angle) {
    this.url = url; this.state = {}; this.actions = {}; this.yaw = (angle ?? 35) * Math.PI / 180; this.pitch = .16;
    this.el = document.createElement('div'); this.el.className = 'v3d-stage';
    this.ready = this._init().catch(err => { this.error = err; throw err; });
  }

  async _init() {
    const {T, GLTFLoader, RoomEnvironment} = await loadThree();
    if (!glbFiles.has(this.url)) glbFiles.set(this.url, new Promise((ok, bad) => new GLTFLoader().load(this.url, ok, undefined, bad)));
    let gltf;
    try { gltf = await glbFiles.get(this.url); } catch (err) { glbFiles.delete(this.url); throw err; }
    this.T = T;
    const r = this.renderer = new T.WebGLRenderer({antialias: true, alpha: true});
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.el.append(r.domElement);
    const scene = this.scene = new T.Scene(), pm = new T.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    const model = gltf.scene.clone(true), box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), mid = box.getCenter(new T.Vector3());
    model.position.set(-mid.x, -box.min.y, -mid.z);
    const stage = new T.Group(); stage.add(model); scene.add(stage);
    /* a soft shadow under the car */
    const sc = document.createElement('canvas'); sc.width = sc.height = 128; const g = sc.getContext('2d'), rg = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    const sh = new T.Mesh(new T.PlaneGeometry(size.x * 1.25, size.z * 1.25), new T.MeshBasicMaterial({map: new T.CanvasTexture(sc), transparent: true, depthWrite: false}));
    sh.rotation.x = -Math.PI / 2; sh.position.y = .002; scene.add(sh);
    const len = Math.max(size.x, size.z);
    this.dist = len * 1.85; this.target = new T.Vector3(0, size.y * .42, 0);
    this.cam = new T.PerspectiveCamera(26, 2, len / 200, len * 30);
    this.mixer = new T.AnimationMixer(model); this.clock = new T.Clock();
    Object.entries(CAR_CLIPS).forEach(([k, re]) => {
      const clip = gltf.animations.find(a => re.test(a.name)); if (!clip) return;
      const a = this.mixer.clipAction(clip); a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true;
      a.time = this.state[k] ? clip.duration : 0; this.actions[k] = a;
    });
    this.mixer.update(0);
    /* drag sideways to turn the car */
    let px = null;
    this.el.addEventListener('pointerdown', e => { px = e.clientX; this.el.setPointerCapture(e.pointerId); this.dragging = true; this._kick(); });
    this.el.addEventListener('pointermove', e => { if (px == null) return; this.yaw -= (e.clientX - px) * .01; px = e.clientX; this._kick(); });
    const up = () => { px = null; this.dragging = false; };
    this.el.addEventListener('pointerup', up); this.el.addEventListener('pointercancel', up);
    this.ro = new ResizeObserver(() => this._size()); this.ro.observe(this.el);
    this._size();
  }

  _size() {
    if (!this.renderer) return;
    const w = this.el.clientWidth || 300, h = this.el.clientHeight || 200;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this._kick();
  }

  /* open or close the frunk, trunk, charge port and windows to match the car */
  set(state, animate = true) {
    Object.entries(this.actions).forEach(([k, a]) => {
      const open = !!state[k]; if (open === !!this.state[k] && a.time !== undefined) return;
      const end = a.getClip().duration;
      if (!animate) { a.paused = true; a.time = open ? end : 0; return; }
      a.enabled = true; a.paused = false; a.timeScale = open ? 1 : -1;
      if (open && a.time >= end) a.time = 0;
      if (!open && a.time <= 0) a.time = end;
    });
    this.state = {...state};
    if (this.mixer && !animate) this.mixer.update(0);
    this._kick();
  }

  _kick() { if (!this._raf && this.renderer) this._raf = requestAnimationFrame(() => this._frame()); }

  _frame() {
    this._raf = 0;
    const dt = Math.min(.05, this.clock.getDelta());
    this.mixer.update(dt);
    const c = Math.cos(this.pitch);
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * c * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * c * this.dist);
    this.cam.lookAt(this.target);
    this.renderer.render(this.scene, this.cam);
    if (this.dragging || Object.values(this.actions).some(a => !a.paused && a.isRunning())) this._kick();
  }

  dispose() { cancelAnimationFrame(this._raf); this.ro?.disconnect(); this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.el.remove(); }
}
const CAR_STYLE = `
.car{width:100%;height:auto;display:block;overflow:visible}
.car .car-lid{transition:transform .7s cubic-bezier(.3,1.3,.5,1),stroke-opacity .4s;stroke-opacity:.4}
.car .car-lid.open{stroke-opacity:1}
.car .car-lid.hood.open{transform:rotate(-17deg)}
.car .car-lid.trunk.open{transform:rotate(17deg)}
.car .car-head{stroke:#f4f6ff;opacity:.45;transition:opacity .4s,filter .4s}
.car.lights .car-head{opacity:1;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 12px #cfe0ff)}
.car .car-tail{stroke:#ff4a4a;opacity:.55}
.car .car-port{fill:#2b2d31;transition:fill .3s}
.car .car-port.open{fill:#9be7b0}
.car.charging .car-lamp{animation:carPulse 1.4s ease-in-out infinite;filter:drop-shadow(0 0 5px #4ade80)}
.car.charging .car-port{fill:#4ade80;filter:drop-shadow(0 0 6px #4ade80);animation:carPulse 1.4s ease-in-out infinite}
.car .car-flow{animation:carFlow .9s linear infinite}
.car .car-air{opacity:0}
.car.climate .car-air{animation:carAir 2.4s ease-in-out infinite}
.car .car-eye{fill:#ff3b3b;opacity:0}
.car.sentry .car-eye{filter:drop-shadow(0 0 5px #ff3b3b);animation:carEye 1.6s ease-in-out infinite}
@keyframes carPulse{50%{opacity:.45}}
@keyframes carFlow{to{stroke-dashoffset:28}}
@keyframes carAir{0%{opacity:0;transform:translateY(6px)}40%{opacity:.85}100%{opacity:0;transform:translateY(-10px)}}
@keyframes carEye{50%{opacity:1}}
.car-photo{position:relative}
.car-photo img{display:block;width:100%;max-height:230px;object-fit:contain;position:relative;z-index:1}
.car-photo i{position:absolute;pointer-events:none;opacity:0}
.car-clay{width:min(100%,553px);aspect-ratio:900/374;margin:0 auto}
.car-clay img{position:absolute;inset:0;width:100%;height:100%;max-height:none}
.car-clay i.clay-paint,.car-clay i.clay-shine{inset:0;z-index:2;-webkit-mask:url(${CLAY_MASK}) center/100% 100% no-repeat;mask:url(${CLAY_MASK}) center/100% 100% no-repeat}
.car-clay i.clay-paint{opacity:1;background:var(--paint);mix-blend-mode:multiply}
.car-clay i.clay-shine{opacity:.3;background:url(${CLAY_CAR}) center/100% 100%;mix-blend-mode:screen}
.mini .car-clay{width:auto;height:100%;max-width:100%}
.car-photo .cp-glow{left:12%;right:12%;bottom:2%;height:16px;border-radius:50%;background:#4ade80;filter:blur(14px)}
.car-photo.charging .cp-glow{opacity:.75;animation:carPulse 1.6s ease-in-out infinite}
.car-photo .cp-eye{z-index:2;top:10%;left:50%;width:9px;height:9px;margin-left:-4px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 10px #ff3b3b}
.car-photo.sentry .cp-eye{animation:carEye 1.6s ease-in-out infinite}
.car-photo .cp-air{left:25%;right:25%;top:0;height:55%;border-radius:50%;background:radial-gradient(closest-side,#7cc8ff,transparent);filter:blur(18px)}
.car-photo.climate.heat .cp-air{background:radial-gradient(closest-side,#ff9a5c,transparent)}
.car-photo.climate .cp-air{animation:cpAir 3s ease-in-out infinite}
@keyframes cpAir{50%{opacity:.4}}
@media (prefers-reduced-motion: reduce){.car *,.car-photo *{animation:none!important;transition:none!important}}
.v3d{min-height:180px}
.v3d-stage{position:relative;z-index:1;height:clamp(180px,28vw,260px);cursor:grab;touch-action:pan-y}
.v3d-stage:active{cursor:grabbing}
.v3d-stage canvas{display:block;width:100%;height:100%}
.v3d-wait{display:grid;place-items:center;height:200px;font-size:13px;opacity:.6}
`;

/*
 * Dashboard Studio vehicle card
 * A Tesla app style card: the car in its paint color, battery and range, charging, and one-tap controls.
 * Leave out "entities" and it finds the car by itself (Tesla Fleet, Teslemetry, Tessie and similar).
 *
 *   type: custom:dashboard-studio-vehicle
 *   name: Model Y
 *   model: model_y            # model_3, model_s, model_x, model_y or cybertruck; car (or left out on a car that is not a Tesla) shows the rendered car picture
 *   color: pearl_white        # a paint name, or any color like '#a5121d'
 *   device: <device id>       # optional: which car, when you have more than one (the visual editor lists them)
 *   charger: auto             # auto, supercharger, wall_connector or none: drawn next to the car while it charges
 *   reversed: [frunk, trunk]  # optional: closures your car reports the wrong way round
 *   vehicle: my_model_y       # optional: the car's name in its entity IDs
 *   image: /local/my-car.png  # optional: your own picture instead of the rendered car
 *   model_url: /local/tesla/model_y.glb   # optional: a real 3D car you made with Tesla Model Extractor
 *   tesla_view: false         # optional: when Tesla View is installed the card shows it; false keeps the picture
 *   drawing: true             # optional: the flat drawing in place of the rendered car picture
 *   tesla_view_look: transparent   # transparent shows just the car; dark fades the app's dark box; light is the app's light mode
 *   tesla_view_brightness: 1.25
 *   tesla_view_paint: Quicksilver   # optional: a paint from your car pack; left out, the pack paint that matches color is used
 *   entities:                 # optional: set any of these by hand
 *     battery: sensor.my_model_y_battery_level
 */
const VEH_KEYS = {
  battery: [/^sensor\..*_battery_level$/, /^sensor\..*_battery$/],
  range: [/^sensor\..*_battery_range$/, /^sensor\..*_range$/],
  charging: [/^binary_sensor\..*_charging$/, /^sensor\..*_charging(_state)?$/, /^binary_sensor\..*_charger$/],
  charge_switch: [/^switch\..*_charge$/, /^switch\..*_charger$/, /^switch\..*_charging$/],
  charge_power: [/^sensor\..*_charger_power$/, /^sensor\..*_charge_rate$/, /^sensor\..*_charging_power$/],
  time_to_full: [/^sensor\..*_time_to_full(_charge)?$/],
  charge_limit: [/^number\..*_charge_limit$/, /^sensor\..*_charge_limit(_soc)?$/],
  lock: [/^lock\..*_(door_)?lock$/, /^lock\..*_doors?$/, /^lock\./],
  climate: [/^climate\./],
  inside: [/^sensor\..*_inside_temp(erature)?$/],
  outside: [/^sensor\..*_outside_temp(erature)?$/],
  frunk: [/^cover\..*_frunk$/],
  trunk: [/^cover\..*_trunk$/],
  charge_port: [/^cover\..*_charge_port(_door)?$/],
  sentry: [/^switch\..*_sentry(_mode)?$/],
  shift: [/^sensor\..*_shift_state$/],
  awake: [/^binary_sensor\..*_status$/, /^sensor\..*_(vehicle_)?state$/, /^binary_sensor\..*_(asleep|sleeping)$/],
  wake: [/^button\..*_wake(_up)?$/],
  fast_charger: [/^binary_sensor\..*_fast_charger(_present)?$/, /^sensor\..*_fast_charger_(type|brand)$/],
  location: [/^device_tracker\..*_location$/, /^device_tracker\./]
};
/* asleep: Tesla Fleet and Teslemetry report a "status" connectivity sensor (off when asleep), others a state or asleep sensor */
function vehAsleep(st) {
  if (!st || st.state === 'unavailable' || st.state === 'unknown') return false;
  const s = String(st.state).toLowerCase(), id = st.entity_id || '';
  if (/_(asleep|sleeping)$/.test(id)) return s === 'on';
  if (id.startsWith('binary_sensor.')) return s === 'off';
  return s === 'asleep' || s === 'offline' || s === 'sleeping';
}
const VEH_PLATFORMS = ['tesla_fleet', 'teslemetry', 'tessie', 'tesla_custom', 'mytesla', 'tesla', 'rivian', 'kia_uvo', 'hyundai_kia_connect', 'bmw_connected_drive', 'mercedesme', 'volvo', 'volvooncall',
  'polestar_api', 'fordpass', 'volkswagen_we_connect_id', 'volkswagencarnet', 'audiconnect', 'renault', 'nissan_leaf', 'smartcar', 'subaru', 'toyota', 'mazda', 'mg_saic', 'skodaconnect'];
/* only a car has these: a smart lock or a phone has a battery and maybe a lock, but never a frunk, a charge port or a range */
const CAR_HINT = /_(frunk|trunk|tailgate|tonneau|charge_port|charge_cable|charge_limit|charge_port_door|odometer|range|estimated_range|battery_range|ev_range|tire_pressure|tpms|sentry|sentry_mode|fuel_level)(_|$)/;
/* phones, tablets and watches from the Home Assistant app report charging and a battery too, but they're never cars */
const NOT_CAR_PLATFORMS = ['mobile_app'];

function findVehicle(hass, cfg) {
  const ids = Object.keys(hass.states), ents = hass.entities || {};
  let pool = null;
  if (cfg.device) pool = ids.filter(id => ents[id]?.device_id === cfg.device);
  else if (cfg.vehicle) pool = ids.filter(id => id.split('.')[1].startsWith(cfg.vehicle + '_') || id.split('.')[1] === cfg.vehicle);
  else {
    /* the first car-like device: from a Tesla integration, or one with a battery level and a lock */
    const dev = Object.values(ents).find(e => VEH_PLATFORMS.includes(e.platform) && /_battery_level$/.test(e.entity_id))?.device_id;
    if (dev) pool = ids.filter(id => ents[id]?.device_id === dev);
    else {
      const bat = ids.find(id => { if (!/^sensor\..*_battery_level$/.test(id)) return false; const pre = id.split('.')[1].replace(/_battery_level$/, '');
        return ids.some(x => x.split('.')[1].startsWith(pre + '_') && CAR_HINT.test(x.split('.')[1])); });
      if (bat) { const pre = bat.split('.')[1].replace(/_battery_level$/, ''); pool = ids.filter(id => id.split('.')[1].startsWith(pre)); }
    }
  }
  const out = {};
  Object.entries(VEH_KEYS).forEach(([k, tests]) => { for (const t of tests) { const hit = (pool || []).find(id => t.test(id)); if (hit) { out[k] = hit; break; } } });
  return {...out, ...(cfg.entities || {})};
}

/* Tesla View (github.com/koenhendriks/tesla-view) renders the car the way the Tesla app does.
   When it's installed and has an asset pack, the vehicle card shows it in place of the drawing */
let tvPacks, tvAsked = 0, tvIndex = null;
/* our model names, a device's model ("Model C" is the Cybertruck) and Tesla View's pack models, all as one key */
const CAR_KEY = [[/cyber|model ?c\b/i, 'cybertruck'], [/model ?3|highland/i, 'model_3'], [/model ?y|juniper|bayberry/i, 'model_y'], [/model ?s\b/i, 'model_s'], [/model ?x\b/i, 'model_x']];
const carKey = t => (CAR_KEY.find(([re]) => re.test(String(t || '').replace(/_/g, ' '))) || [])[1];
/* a see-through Tesla View: Tesla View paints a solid box, so give its canvas an alpha channel before it starts
   (only for the Tesla View cards this card makes), then clear its background once it has loaded */
let tvClearPatched = false;
function allowClearTeslaView() {
  if (tvClearPatched) return; tvClearPatched = true;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (/webgl/.test(type) && this.getRootNode?.()?.host?.dataset?.dsClear === '1') attrs = {...(attrs || {}), alpha: true, premultipliedAlpha: true};
    return orig.call(this, type, attrs);
  };
}
function clearTeslaView(tv, tries = 0) {
  return new Promise(done => {
    const go = n => {
      const r = tv.renderer, sc = tv.scene;
      if (r && sc && tv.vehicle) {
        if (!r.getContext?.().getContextAttributes?.()?.alpha) return done(false);
        tv.applyTheme = function () { this.scene.background = null; this.renderer.setClearColor(0x000000, 0); this.wake?.(50); };
        tv.applyTheme(); return done(true);
      }
      if (n > 60) return done(false);
      setTimeout(() => go(n + 1), 250);
    };
    go(tries);
  });
}
/* the pack model that matches the car: by id, codename, alias or name */
function tvModelFor(key) {
  const models = Object.entries(tvIndex?.models || {}); if (!key || !models.length) return null;
  const hit = models.find(([id, m]) => [id, m.codename, m.name, ...(m.aliases || []), m.api_match?.model_key].some(v => carKey(v) === key));
  return hit ? hit[0] : null;
}
/* only a yes is kept: a no is asked again after a minute, so a car added later still shows up */
const teslaViewReady = () => {
  if (!tvPacks || (tvPacks.no && Date.now() - tvAsked > 60000)) {
    tvAsked = Date.now();
    tvPacks = fetch('/tesla_view_assets/index.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null)
      .then(i => { tvIndex = i; return !!i && Object.keys(i.models || {}).length > 0; }).catch(() => false).then(ok => { if (!ok) tvPacks.no = true; return ok; });
  }
  return tvPacks;
};
/* your paint in Tesla View: its exact paint name when you picked one, else the pack paint that matches the card's paint color */
const TV_PAINT_WORDS = {pearl_white: ['pearlwhite', 'white'], solid_black: ['solidblack', 'diamondblack', 'obsidian', 'black'], midnight_silver: ['midnightsilver', 'silver'],
  stealth_grey: ['stealthgrey', 'stealthgray', 'grey', 'gray'], quicksilver: ['quicksilver'], deep_blue: ['deepblue', 'marineblue', 'blue'], ultra_red: ['ultrared', 'red'], stainless: ['stainless', 'steel']};
const tvPaints = () => [...new Set(Object.values(tvIndex?.packs || {}).flatMap(p => p.paints || []))];
function tvPaintFor(c) {
  if (c.tesla_view_paint) return c.tesla_view_paint;
  const all = tvPaints(), n = t => String(t).toLowerCase().replace(/[^a-z]/g, '');
  for (const w of TV_PAINT_WORDS[c.color] || []) { const hit = all.find(p => n(p).includes(w)); if (hit) return hit; }
  return undefined;
}
/* Tesla View's card can load after this one, so wait for it for a little while */
const teslaViewCard = () => Promise.race([customElements.whenDefined('tesla-view-card').then(() => true), new Promise(ok => setTimeout(() => ok(false), 20000))]);

class DashboardStudioVehicle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._uid = Math.random().toString(36).slice(2, 8);
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
  }

  static getStubConfig() { return {color: 'pearl_white'}; }
  static getConfigElement() { return document.createElement('dashboard-studio-vehicle-editor'); }

  setConfig(config) { this._modelSet = !!config?.model; this._config = {model: 'car', color: 'pearl_white', ...config}; this._e = this._hass ? findVehicle(this._hass, this._config) : null; this._render(); }

  connectedCallback() { clearTimeout(this._drop); }
  /* free the 3D view when the card goes away for good */
  disconnectedCallback() { clearTimeout(this._drop); this._drop = setTimeout(() => { this._3d?.dispose(); this._3d = null; }, 1500); }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (this._tv) this._tv.hass = hass;
    const fresh = !this._e;
    if (!this._e || old?.entities !== hass.entities) {
      this._e = findVehicle(hass, this._config);
      const dev = this._config.device || hass.entities?.[this._e.battery]?.device_id, k = carKey(hass.devices?.[dev]?.model);
      if (!this._modelSet && k) this._config = {...this._config, model: k};
    }
    if (fresh || !old || Object.values(this._e).some(id => old.states[id] !== hass.states[id])) this._render();
  }

  getCardSize() { return 6; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }

  _s(k) { const id = this._e?.[k]; return id ? this._hass?.states[id] : undefined; }
  _n(k) { const v = parseFloat(this._s(k)?.state); return isNaN(v) ? null : v; }

  _charging() {
    const s = this._s('charging')?.state?.toLowerCase();
    if (s) return s === 'on' || s === 'charging' || s === 'true';
    return this._s('charge_switch')?.state === 'on';
  }

  _timeLeft() {
    const st = this._s('time_to_full'); if (!st) return '';
    let h = parseFloat(st.state);
    if (st.attributes.device_class === 'timestamp' || isNaN(h) || /T/.test(st.state)) { const t = Date.parse(st.state); if (isNaN(t)) return ''; h = (t - Date.now()) / 3.6e6; }
    else if (/min/.test(st.attributes.unit_of_measurement || '')) h /= 60;
    if (!(h > 0)) return '';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return hh ? `${hh} h ${mm} min` : `${mm} min`;
  }

  /* which charger to draw: set by hand, or a Supercharger when the car reports a fast charger, else a Wall Connector */
  _charger() {
    const want = this._config.charger || 'auto';
    if (want === 'none') return '';
    if (want === 'supercharger' || want === 'wall_connector') return want === 'supercharger' ? 'supercharger' : 'wall';
    const st = this._s('fast_charger')?.state?.toLowerCase() || '';
    return st === 'on' || st === 'true' || /super|tesla/.test(st) ? 'supercharger' : 'wall';
  }

  _status() {
    const shift = this._s('shift')?.state;
    if (shift && /^[DR]$/i.test(shift)) return 'Driving';
    if (this._charging()) return 'Charging';
    const loc = this._s('location')?.state, lock = this._s('lock')?.state;
    const where = loc === 'home' ? 'Parked at home' : loc && loc !== 'not_home' && loc !== 'unknown' ? `Parked at ${cap(loc)}` : 'Parked';
    return [where, vehAsleep(this._s('awake')) ? 'Asleep' : '', lock ? (lock === 'locked' ? 'Locked' : 'Unlocked') : ''].filter(Boolean).join(' · ');
  }

  _onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || !this._hass) return;
    const k = b.dataset.a, id = this._e[k], st = this._s(k);
    const call = (d, s, data) => this._hass.callService(d, s, data).catch(err => this._toast(err?.message || `Could not run ${d}.${s}`));
    if (b.dataset.a === 'more') { this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: this._e.battery || this._e.lock}, bubbles: true, composed: true})); return; }
    if (!id) return;
    if (k === 'lock') return call('lock', st?.state === 'locked' ? 'unlock' : 'lock', {entity_id: id});
    if (k === 'climate') return call('climate', st && st.state !== 'off' ? 'turn_off' : 'turn_on', {entity_id: id});
    if (k === 'sentry' || k === 'charge_switch') return call('switch', 'toggle', {entity_id: id});
    if (k === 'wake') { this._toast('Waking your car. Fresh info arrives in a moment', true); return call('button', 'press', {entity_id: id}); }
    if (['frunk', 'trunk', 'charge_port'].includes(k)) return call('cover', st?.state === 'open' ? 'close_cover' : 'open_cover', {entity_id: id});
  }

  _toast(msg, ok) { this._msg = msg; this._msgOk = !!ok; this._render(); clearTimeout(this._mt); this._mt = setTimeout(() => { this._msg = ''; this._render(); }, 3500); }

  _render() {
    if (!this._config) return;
    const c = this._config, h = this._hass;
    if (!h) { this.shadowRoot.innerHTML = `<style>${VEH_STYLE}</style><ha-card><p class="hint">Connecting to Home Assistant…</p></ha-card>`; return; }
    if (!this._e || !Object.keys(this._e).length) {
      this.shadowRoot.innerHTML = `<style>${VEH_STYLE}</style><ha-card><p class="hint">No car found yet. Add your car's integration (like Tesla Fleet, Teslemetry or Tessie), or set <code>vehicle:</code> to the car's name in its entity IDs.</p></ha-card>`; return;
    }
    const bat = this._n('battery'), lim = this._n('charge_limit'), chg = this._charging(), rng = this._s('range');
    const clim = this._s('climate'), climOn = clim && clim.state !== 'off', lockS = this._s('lock')?.state;
    const inT = this._n('inside') ?? clim?.attributes.current_temperature, outT = this._n('outside');
    const heat = climOn && (clim.state === 'heat' || clim.attributes.hvac_action === 'heating' || (inT != null && clim.attributes.temperature > inT));
    /* some cars report a closure the wrong way round: `reversed` flips it, here and in Tesla View */
    const flip = new Set([c.reversed || []].flat());
    const open = k => { const st = this._s(k)?.state; return st === undefined ? false : (st === 'open' || st === 'opening') !== flip.has(k); };
    if (c.tesla_view !== false && this._tvOk === undefined) {
      this._tvOk = null;
      teslaViewCard().then(has => has && teslaViewReady()).then(ok => {
        this._tvOk = !!ok; if (ok) this._render();
        else setTimeout(() => { if (this._tvOk === false) { this._tvOk = undefined; if (this.isConnected) this._render(); } }, 60000);
      });
    }
    const useTv = this._tvOk === true && c.tesla_view !== false;
    const url = !useTv && (c.model_url || c.glb), use3d = url && !(this._3d?.url === url && this._3d.error);
    const flags = [chg && 'charging', this._s('sentry')?.state === 'on' && 'sentry', climOn && 'climate ' + (heat ? 'heat' : 'cool')].filter(Boolean).join(' ');
    const car = useTv ? '<div class="v-tv" data-tv></div>' : use3d ? `<div class="car-photo v3d ${flags}" data-v3d>${this._3d?.renderer ? '' : '<div class="v3d-wait">Loading your 3D car…</div>'}<i class="cp-glow"></i><i class="cp-eye"></i><i class="cp-air"></i></div>`
      : (url ? '<p class="hint v-3derr">Couldn’t load the 3D car, so here is the drawing. Check the model_url.</p>' : '') + carVisual({image: c.image, model: c.model, color: c.color, charger: this._charger(), charging: chg, climate: climOn ? (heat ? 'heat' : 'cool') : '', sentry: this._s('sentry')?.state === 'on',
      lights: lockS === 'unlocked' || climOn, frunk: open('frunk'), trunk: open('trunk'), port: open('charge_port'), label: c.name || 'Car'}, this._uid);
    const name = c.name || h.states[this._e.battery]?.attributes.friendly_name?.replace(/ battery( level)?$/i, '') || (c.vehicle ? cap(c.vehicle) : 'My car');
    const pw = this._n('charge_power'), left = this._timeLeft();
    const chgText = chg ? ['Charging', pw ? `${pw} ${this._s('charge_power').attributes.unit_of_measurement || 'kW'}` : '', left ? `${left} left${lim ? ` to ${lim}%` : ''}` : ''].filter(Boolean).join(' · ') : (lim ? `Charge limit ${lim}%` : '');
    const btn = (k, icon, label, on) => this._e[k] ? `<button data-a="${k}" class="${on ? 'on' : ''}" aria-pressed="${!!on}"><span><ha-icon icon="${icon}"></ha-icon></span>${label}</button>` : '';
    const ctl = [
      btn('lock', lockS === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant', lockS === 'locked' ? 'Locked' : 'Unlocked', lockS === 'unlocked'),
      btn('climate', 'mdi:fan', climOn ? (heat ? 'Heating' : 'Cooling') : 'Climate', climOn),
      btn('frunk', 'mdi:car-select', 'Frunk', open('frunk')), btn('trunk', 'mdi:car-back', 'Trunk', open('trunk')),
      btn('charge_port', 'mdi:ev-station', 'Charge port', open('charge_port')),
      btn('charge_switch', 'mdi:flash', chg ? 'Stop charging' : 'Charge', chg),
      btn('sentry', 'mdi:shield-car', 'Sentry', this._s('sentry')?.state === 'on'),
      vehAsleep(this._s('awake')) ? btn('wake', 'mdi:sleep-off', 'Wake', false) : ''
    ].join('');
    const u = h.config?.unit_system?.temperature || '°', temp = v => v == null ? '' : `${Math.round(v)}${u.replace(/[CF]$/, '')}`;
    const info = [inT != null ? `Inside ${temp(inT)}` : '', outT != null ? `Outside ${temp(outT)}` : ''].filter(Boolean).join(' · ')
      + (vehAsleep(this._s('awake')) ? `${inT != null || outT != null ? '. ' : ''}Asleep: this is what it said before it fell asleep${this._e.wake ? '. Tap Wake for fresh info' : ''}` : '');
    /* mini: just the car, for the little car cards on the Control hub */
    this.shadowRoot.innerHTML = c.mini ? `<style>${VEH_STYLE}${CAR_STYLE}</style><ha-card class="bare mini${c.calm ? ' calm' : ''}"><div class="v-car">${car}</div></ha-card>` : `<style>${VEH_STYLE}${CAR_STYLE}</style><ha-card class="${[c.calm ? 'calm' : '', c.bare ? 'bare' : ''].filter(Boolean).join(' ')}">
      <div class="v-top"><button class="v-name" data-a="more"><b>${esc(name)}</b><span>${esc(this._status())}</span></button>
        ${bat != null ? `<div class="v-bat${chg ? ' chg' : ''}"><b>${Math.round(bat)}</b>%${chg ? '<ha-icon icon="mdi:lightning-bolt"></ha-icon>' : ''}</div>` : ''}</div>
      <div class="v-car">${car}</div>
      ${bat != null ? `<div class="v-range"><div class="v-bar${chg ? ' chg' : ''}"><i style="width:${Math.max(2, Math.min(100, bat))}%"></i>${lim ? `<em style="left:${lim}%"></em>` : ''}</div>
        <div class="v-rl"><span>${rng ? `${esc(Math.round(parseFloat(rng.state)) || rng.state)} ${esc(rng.attributes.unit_of_measurement || '')}` : ''}</span><span>${esc(chgText)}</span></div></div>` : ''}
      ${ctl ? `<div class="v-ctl">${ctl}</div>` : ''}
      ${info ? `<div class="v-info">${esc(info)}</div>` : ''}
      ${this._msg ? `<div class="v-msg${this._msgOk ? ' ok' : ''}" role="status">${esc(this._msg)}</div>` : ''}</ha-card>`;
    const tvSlot = useTv && this.shadowRoot.querySelector('[data-tv]');
    if (tvSlot) {
      /* hand Tesla View the car's device, plus every entity this card found, so it maps the same things.
         While the car charges, its charging camera shows the charge cable from the app */
      const own = typeof c.tesla_view === 'object' ? c.tesla_view : {}, cam = own.camera || (chg ? 'charging' : 'parked');
      const look = ['dark', 'light', 'transparent'].includes(c.tesla_view_look) ? c.tesla_view_look : 'transparent';
      if (this._tv && this._tvLook !== look) { this._tv.remove(); this._tv = null; this._tvClear = undefined; }  // the canvas can't change its alpha later
      const paint = tvPaintFor(c);
      if (!this._tv || this._tvCam !== cam || this._tvPaint !== paint) {
        const e = this._e, dev = c.device || h.entities?.[e.battery]?.device_id || h.entities?.[e.lock]?.device_id;
        /* tell Tesla View which car: its own setting, else the car's device model, else the model picked here */
        const tvModel = own.model || tvModelFor(carKey(h.devices?.[dev]?.model)) || tvModelFor(carKey(c.model));
        const ents = Object.fromEntries([['frunk', e.frunk], ['trunk', e.trunk], ['charge_port', e.charge_port], ['charging', e.charging], ['lock', e.lock]].filter(([, v]) => v));
        if (!this._tv) {
          this._tv = document.createElement('tesla-view-card'); this._tvLook = look;
          if (look === 'transparent') { allowClearTeslaView(); this._tv.dataset.dsClear = '1'; this._tvClear = null; }
        }
        const states = Object.fromEntries([...flip].filter(k => ['frunk', 'trunk', 'charge_port'].includes(k)).map(k => [k, {on: ['closed', 'closing']}]));
        this._tv.setConfig({type: 'custom:tesla-view-card', ...(dev ? {device_id: dev} : {}), ...(tvModel ? {model: tvModel} : {}), entities: ents, ...(Object.keys(states).length ? {states} : {}), hotspots: true,
          theme: look === 'light' ? 'light' : 'dark', aspect_ratio: '16:9', ...(paint ? {paint} : {}), ...own, camera: cam});
        this._tvCam = cam; this._tvPaint = paint;
      }
      this._tv.hass = h;
      /* Tesla View draws on a solid box: lift the car a little, and fade the box's edges into this card */
      const lift = Math.max(.6, Math.min(2, Number(c.tesla_view_brightness ?? 1.25) || 1.25));
      tvSlot.classList.toggle('blend', look === 'dark' || (look === 'transparent' && this._tvClear === false));
      if (look === 'transparent' && this._tvClear === null) {
        this._tvClear = undefined;
        clearTeslaView(this._tv).then(ok => { this._tvClear = ok; if (!ok) console.warn('Dashboard Studio: Tesla View can’t be made see-through here, so it fades into the card instead'); this._render(); });
      }
      this._tv.style.filter = lift === 1 ? '' : `brightness(${lift})`;
      tvSlot.append(this._tv);
      if (this._tvNote) tvSlot.insertAdjacentHTML('beforeend', `<p class="v-tvnote">${esc(this._tvNote)}</p>`);
      if (!this._tvChecked) {
        /* look inside Tesla View once it has loaded: a car file without wheels or lighting looks empty and dark */
        this._tvChecked = true;
        setTimeout(() => {
          const t = this._tv, miss = [];
          if (t?.vehicle && !t.vehicle.wheelName) miss.push('wheels');
          if (t?.scene && t.vehicle && !t.scene.environment) miss.push('lighting');
          if (t?.error) miss.push(String(t.error));
          this._tvNote = miss.length ? `Tesla View couldn’t find the ${miss.join(' or the ')} in your car file, so the car looks ${miss.includes('lighting') ? 'dark' : 'unfinished'}.` : '';
          if (miss.length) { console.warn('Dashboard Studio: Tesla View is missing', miss.join(', ')); this._render(); }
        }, 12000);
      }
    }
    const slot = use3d && this.shadowRoot.querySelector('[data-v3d]');
    if (slot) {
      if (!this._3d || this._3d.url !== url) {
        this._3d?.dispose(); this._3d = new Car3D(url, c.model_angle); this._3dLive = false;
        this._3d.ready.then(() => this._render(), err => { console.warn('Dashboard Studio: could not load', url, err); this._render(); });
      }
      slot.prepend(this._3d.el);
      this._3d.set({frunk: open('frunk'), trunk: open('trunk'), charge_port: open('charge_port') || chg, windows: open('windows')}, this._3dLive);
      if (this._3d.renderer) this._3dLive = true;
    }
  }
}

const VEH_STYLE = `
:host{--v-text:var(--primary-text-color,#1c1c1c);--v-muted:var(--secondary-text-color,#6b6b6b);--v-accent:var(--primary-color,#03a9f4);--v-soft:color-mix(in srgb,var(--v-text) 8%,transparent)}
ha-card{padding:18px;display:flex;flex-direction:column;gap:12px;color:var(--v-text);position:relative;overflow:hidden}
button{font:inherit;color:inherit;cursor:pointer}
.hint{margin:0;color:var(--v-muted);line-height:1.5}
.v-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.v-name{border:0;background:none;padding:0;text-align:left;display:flex;flex-direction:column;gap:2px}
.v-name b{font-size:24px;font-weight:600;letter-spacing:-.01em}
.v-name span{font-size:13.5px;color:var(--v-muted)}
.v-bat{display:flex;align-items:center;gap:2px;font-size:15px;color:var(--v-muted)}
.v-bat b{font-size:26px;font-weight:600;color:var(--v-text);font-variant-numeric:tabular-nums}
.v-bat.chg ha-icon{color:#4ade80;--mdc-icon-size:20px}
.v-car{margin:0 -6px}
.v-range{display:flex;flex-direction:column;gap:6px}
.v-bar{position:relative;height:10px;border-radius:99px;background:var(--v-soft);overflow:hidden}
.v-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--v-text);opacity:.85;transition:width .8s ease}
.v-bar.chg i{background:linear-gradient(90deg,#22c55e,#4ade80,#86efac,#4ade80);background-size:200% 100%;opacity:1;animation:vShine 2s linear infinite}
.v-bar em{position:absolute;top:1px;bottom:1px;width:2px;background:var(--v-muted);border-radius:2px}
.v-rl{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--v-muted)}
.v-rl span:first-child{color:var(--v-text);font-weight:600;font-size:15px}
.v-ctl{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 4px}
.v-ctl button{width:72px}
.v-ctl button{border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--v-muted);padding:4px 0}
.v-ctl button span{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--v-soft);color:var(--v-text);transition:background .2s,transform .15s}
.v-ctl button:active span{transform:scale(.92)}
.v-ctl button.on{color:var(--v-text)}
.v-ctl button.on span{background:var(--v-accent);color:var(--text-primary-color,#fff)}
.v-info{font-size:12.5px;color:var(--v-muted);text-align:center}
.v-msg.ok{background:#2b2f3a}
.v-msg{position:absolute;left:12px;right:12px;bottom:12px;background:#b3261e;color:#fff;border-radius:10px;padding:8px 12px;font-size:13px}
@keyframes vShine{to{background-position:-200% 0}}
ha-card.calm *{animation:none!important;transition:none!important}
ha-card.bare{background:none;box-shadow:none;border:none;padding:4px 0 0}
.v-3derr{font-size:12px}
.v-tv{margin:0 -6px}
.v-tv.blend tesla-view-card{-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent),linear-gradient(180deg,transparent,#000 9%,#000 91%,transparent);-webkit-mask-composite:source-in;
  mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent),linear-gradient(180deg,transparent,#000 9%,#000 91%,transparent);mask-composite:intersect;border-radius:14px}
.v-tvnote{font-size:12px;color:var(--v-muted);text-align:center;margin-top:-4px}
ha-card.mini{padding:0;gap:0;pointer-events:none;height:100%;justify-content:center}
.mini .v-car,.mini .v-tv{margin:0}
.mini .v-tvnote,.mini .v-3derr{display:none}
.v-tv tesla-view-card{display:block;--ha-card-background:transparent;--card-background-color:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0}
`;

/*
 * Dashboard Studio garage card
 * Every car in its own bay: parked when it's home, an empty bay with where it is when it's away.
 * A garage door slides over the bays, and tapping a car opens its vehicle card.
 *
 *   type: custom:dashboard-studio-garage
 *   name: Garage
 *   door: cover.garage_door   # optional
 *   cars:                     # optional: leave out to use every car Home Assistant knows
 *     - device: <device id>
 *       name: Cybie
 *       model: cybertruck
 *       color: stainless
 */
/* every car-like device: from a Tesla integration, or with a battery level and a lock, climate or frunk */
function findCars(hass) {
  const ents = Object.values(hass.entities || {}), by = {};
  ents.forEach(e => { if (e.device_id && hass.states[e.entity_id]) (by[e.device_id] = by[e.device_id] || []).push(e); });
  return Object.entries(by).filter(([, es]) => es.some(e => /_battery_level$/.test(e.entity_id) && e.entity_id.startsWith('sensor.')) &&
      !es.some(e => NOT_CAR_PLATFORMS.includes(e.platform)) && (es.some(e => VEH_PLATFORMS.includes(e.platform)) || es.some(e => CAR_HINT.test(e.entity_id.split('.')[1]))))
    .map(([id]) => ({device: id}));
}

class DashboardStudioGarage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._uid = Math.random().toString(36).slice(2, 7);
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
  }

  static getStubConfig() { return {name: 'Garage'}; }
  static getConfigElement() { return document.createElement('dashboard-studio-garage-editor'); }

  setConfig(config) { this._config = {name: 'Garage', ...config}; this._cars = null; this._open = null; this._render(); }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (!this._cars || old?.entities !== hass.entities) this._find();
    const v = this.shadowRoot.querySelector('dashboard-studio-vehicle'); if (v) v.hass = hass;
    const watch = [this._config.door, ...this._cars.flatMap(c => Object.values(c.e))].filter(Boolean);
    if (!old || watch.some(id => old.states[id] !== hass.states[id])) this._render();
  }

  getCardSize() { return 6; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }

  _find() {
    const h = this._hass, list = this._config.cars?.length ? this._config.cars : findCars(h);
    this._cars = list.map((c, i) => {
      const cfg = typeof c === 'string' ? {device: c} : c, e = findVehicle(h, cfg);
      const dev = cfg.device || h.entities?.[e.battery]?.device_id, d = h.devices?.[dev] || {};
      const name = cfg.name || d.name_by_user || d.name || h.states[e.battery]?.attributes.friendly_name?.replace(/ battery( level)?$/i, '') || `Car ${i + 1}`;
      return {cfg: {...cfg, ...(dev ? {device: dev} : {}), name, model: cfg.model || carKey(d.model) || 'car'}, e, name, i};
    });
  }

  _state(car) {
    const s = id => id && this._hass.states[id], e = car.e;
    const loc = s(e.location)?.state, home = !loc || loc === 'home';
    const bat = Math.round(parseFloat(s(e.battery)?.state));
    const cs = s(e.charging)?.state?.toLowerCase(), chg = cs ? ['on', 'charging', 'true'].includes(cs) : s(e.charge_switch)?.state === 'on';
    const sleep = vehAsleep(s(e.awake)), lock = s(e.lock)?.state;
    const where = home ? '' : loc === 'not_home' ? 'Away' : `At ${cap(loc)}`;
    return {home, bat: isNaN(bat) ? null : bat, chg, text: home ? [chg ? 'Charging' : sleep ? 'Asleep' : lock === 'locked' ? 'Locked' : lock === 'unlocked' ? 'Unlocked' : ''].filter(Boolean).join('') : where};
  }

  _onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || !this._hass) return;
    if (b.dataset.a === 'car') { this._open = +b.dataset.i; this._render(); return; }
    if (b.dataset.a === 'back') { this._open = null; this._render(); return; }
    if (b.dataset.a === 'door' && this._config.door) this._hass.callService('cover', 'toggle', {entity_id: this._config.door}).catch(() => {});
  }

  _render() {
    if (!this._config) return;
    const c = this._config, h = this._hass;
    if (!h || !this._cars) { this.shadowRoot.innerHTML = `<style>${GARAGE_STYLE}</style><ha-card><p class="hint">Connecting to Home Assistant…</p></ha-card>`; return; }
    if (!this._cars.length) { this.shadowRoot.innerHTML = `<style>${GARAGE_STYLE}</style><ha-card><p class="hint">No cars found yet. Add your car's integration (like Tesla Fleet, Teslemetry or Tessie), or list them under <code>cars</code>.</p></ha-card>`; return; }
    if (this._open != null && this._cars[this._open]) {
      const car = this._cars[this._open];
      this.shadowRoot.innerHTML = `<style>${GARAGE_STYLE}</style><ha-card class="detail${c.bare ? ' bare' : ''}"><div class="g-head"><button class="g-back" data-a="back" aria-label="Back to the garage"><ha-icon icon="mdi:chevron-left"></ha-icon></button><b>${esc(c.name)}</b></div><dashboard-studio-vehicle></dashboard-studio-vehicle></ha-card>`;
      const v = this.shadowRoot.querySelector('dashboard-studio-vehicle');
      v.setConfig({...car.cfg, bare: true, calm: !!c.calm}); v.hass = h;
      return;
    }
    const door = c.door && h.states[c.door], ds = door?.state, shut = ds === 'closed' || ds === 'closing';
    const sts = this._cars.map(car => this._state(car)), home = sts.filter(x => x.home).length;
    const bays = this._cars.map((car, i) => {
      const st = sts[i];
      const art = st.home ? carVisual({image: car.cfg.image, model: car.cfg.model, color: car.cfg.color || 'pearl_white', charging: st.chg, charger: st.chg ? 'wall' : '', label: car.name}, this._uid + i)
        : `<div class="g-away"><ha-icon icon="mdi:map-marker-outline"></ha-icon><span>${esc(st.text)}</span></div>`;
      return `<button class="g-bay${st.home ? '' : ' away'}${st.chg ? ' chg' : ''}" data-a="car" data-i="${i}" aria-label="${esc(car.name)}"><span class="g-light"></span>${art}
        <span class="g-name"><b>${esc(car.name)}</b><span>${st.bat != null ? `${st.bat}%` : ''}${st.bat != null && st.text ? ' · ' : ''}${esc(st.home ? st.text : 'Away')}</span></span></button>`;
    }).join('');
    this.shadowRoot.innerHTML = `<style>${GARAGE_STYLE}${CAR_STYLE}</style><ha-card class="${[c.calm ? 'calm' : '', c.bare ? 'bare' : ''].filter(Boolean).join(' ')}">
      <div class="g-head"><div><b>${esc(c.name)}</b><span>${home} of ${this._cars.length} home${door ? ` · Door ${esc(cap(ds))}` : ''}</span></div>
        ${door ? `<button class="g-doorbtn${shut ? '' : ' on'}" data-a="door"><ha-icon icon="${shut ? 'mdi:garage' : 'mdi:garage-open'}"></ha-icon>${shut ? 'Open' : 'Close'}</button>` : ''}</div>
      <div class="g-scene" style="--n:${Math.min(3, this._cars.length)}"><div class="g-bays">${bays}</div>
        ${door ? `<div class="g-door${shut ? ' shut' : ''}${ds === 'opening' || ds === 'closing' ? ' moving' : ''}" aria-hidden="true"></div>` : ''}</div></ha-card>`;
  }
}

const GARAGE_STYLE = `
:host{--g-text:var(--primary-text-color,#1c1c1c);--g-muted:var(--secondary-text-color,#6b6b6b)}
ha-card{padding:18px;display:flex;flex-direction:column;gap:14px;color:var(--g-text);overflow:hidden}
ha-card.detail{gap:6px}
ha-card.bare{background:none;box-shadow:none;border:none;padding:4px 0 0}
button{font:inherit;color:inherit;cursor:pointer}
.hint{margin:0;color:var(--g-muted);line-height:1.5}
.g-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.g-head>div,.g-head{min-width:0}
.g-head b{font-size:22px;font-weight:600;display:block}
.g-head span{font-size:13px;color:var(--g-muted)}
.g-back{border:0;background:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;margin-right:auto}
.detail .g-head{justify-content:flex-start}
.detail .g-head b{font-size:15px;color:var(--g-muted);font-weight:500}
.g-doorbtn{border:0;border-radius:99px;padding:8px 14px;display:flex;align-items:center;gap:6px;background:color-mix(in srgb,var(--g-text) 9%,transparent);font-weight:600;font-size:13px}
.g-doorbtn.on{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
.g-scene{position:relative;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#1b1d22,#23262c);padding:14px 10px 10px}
.g-bays{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:8px}
.g-bay{position:relative;border:0;background:linear-gradient(180deg,transparent 64%,rgba(255,255,255,.05) 64%,rgba(0,0,0,.2));color:#f1f2f4;display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 4px 6px;min-width:0;border-radius:12px;transition:background .2s}
.g-bay:hover{background-color:rgba(255,255,255,.04)}
.g-bay:nth-child(3n+1)::before{display:none}
.g-head .d-pbtn{flex:none}
.g-bay+.g-bay::before{content:"";position:absolute;left:-5px;top:30%;bottom:8%;width:2px;background:repeating-linear-gradient(180deg,#e9c46a 0 8px,transparent 8px 14px);opacity:.45}
.g-light{position:absolute;top:0;left:22%;right:22%;height:4px;border-radius:4px;background:#fff;box-shadow:0 0 18px 4px rgba(255,255,255,.35),0 30px 60px 20px rgba(255,255,255,.06)}
.g-bay.away .g-light{opacity:.25;box-shadow:none}
.g-bay .car,.g-bay .car-photo{width:100%}
.g-away{height:clamp(70px,12vw,110px);width:90%;border:2px dashed rgba(255,255,255,.18);border-radius:18px 40px 12px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,.55);font-size:12px;margin-top:4px}
.g-away ha-icon{--mdc-icon-size:20px}
.g-name{display:flex;flex-direction:column;align-items:center;min-width:0;max-width:100%}
.g-name b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.g-name span{font-size:12px;color:rgba(255,255,255,.65)}
.g-bay.chg .g-name span{color:#86efac}
.g-door{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,#d9dce1 0 22px,#bfc3c9 22px 24px,#e6e8eb 24px 26px);opacity:.92;transform:translateY(-94%);transition:transform 1.6s cubic-bezier(.45,.05,.3,1);border-bottom:6px solid #9aa0a8;box-shadow:0 8px 20px rgba(0,0,0,.35)}
.g-door.shut{transform:none}
.g-door::after{content:"";position:absolute;left:44%;right:44%;bottom:18px;height:8px;border-radius:4px;background:#8c9199}
ha-card.calm *{animation:none!important;transition:none!important}
`;

/* visual editor for the garage card */
class DashboardStudioGarageEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }
  _render() {
    if (!this._config || !this._hass) return;
    if (!customElements.get('ha-form')) { this.innerHTML = '<p>Use the code editor to set up this card.</p>'; return; }
    if (!this._form) {
      this.innerHTML = '<p style="margin:0 0 12px;color:var(--secondary-text-color)">Leave Cars empty to show every car Home Assistant knows.</p>';
      const f = this._form = document.createElement('ha-form');
      const L = {name: 'Name', door: 'Garage door', cars: 'Cars', calm: 'Turn off animations'};
      f.computeLabel = s => L[s.name] || s.name;
      f.schema = [{name: 'name', selector: {text: {}}}, {name: 'door', selector: {entity: {domain: 'cover'}}},
        {name: 'cars', selector: {device: {multiple: true, filter: ['tesla_fleet', 'teslemetry', 'tessie', 'tesla_custom'].map(integration => ({integration}))}}},
        {name: 'calm', selector: {boolean: {}}}];
      f.addEventListener('value-changed', e => {
        const next = {...e.detail.value};
        /* keep each car's own settings (name, model, paint) when the list changes */
        if (Array.isArray(next.cars)) next.cars = next.cars.map(c => typeof c === 'string' ? ((this._config.cars || []).find(x => x?.device === c) || {device: c}) : c);
        Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null || (Array.isArray(next[k]) && !next[k].length)) delete next[k]; });
        this._config = next; this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: next}, bubbles: true, composed: true}));
      });
      this.appendChild(f);
    }
    this._form.hass = this._hass;
    this._form.data = {...this._config, cars: (this._config.cars || []).map(c => typeof c === 'string' ? c : c.device).filter(Boolean)};
  }
}

/*
 * Dashboard Studio header card: the greeting, the date, a big clock and chips for the house,
 * the same as the Greeting block in the Studio.
 *
 *   type: custom:dashboard-studio-header
 *   name: Alex                 # optional, added to the greeting
 *   climate: climate.house     # optional: the inside temperature chip (default: the first thermostat)
 *   alarm: alarm_control_panel.home   # optional (default: the first alarm panel)
 */
class DashboardStudioHeader extends HTMLElement {
  constructor() { super(); this.attachShadow({mode: 'open'}); }
  static getStubConfig() { return {}; }
  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (!old || this._sig() !== this._last) this._render();
  }
  getCardSize() { return 2; }
  getGridOptions() { return {columns: 'full', rows: 'auto'}; }
  connectedCallback() { this._tick = setInterval(() => this._render(), 20000); }
  disconnectedCallback() { clearInterval(this._tick); }

  _facts() {
    const h = this._hass, c = this._config, ids = Object.keys(h.states);
    /* the house, not the cars: skip thermostats and locks that belong to a car */
    const cars = new Set(findCars(h).map(x => x.device)), home = id => !cars.has(h.entities?.[id]?.device_id);
    const lights = ids.filter(id => id.startsWith('light.') && h.states[id].state === 'on').length;
    const clim = h.states[c.climate || ids.find(id => id.startsWith('climate.') && home(id))];
    const locks = ids.filter(id => id.startsWith('lock.') && home(id)).map(id => h.states[id].state);
    const alarm = h.states[c.alarm || ids.find(id => id.startsWith('alarm_control_panel.'))];
    return {lights, inside: clim?.attributes.current_temperature, locks, alarm: alarm?.state};
  }
  _sig() { if (!this._hass) return ''; const f = this._facts(); return JSON.stringify(f) + new Date().getMinutes(); }

  _render() {
    if (!this._config || !this._hass) return;
    this._last = this._sig();
    const f = this._facts(), d = new Date(), hr = d.getHours();
    const g = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const unit = (this._hass.config?.unit_system?.temperature || '°').replace(/[CF]$/, '');
    const open = f.locks.filter(s => s !== 'locked').length;
    const ALARM = {disarmed: 'Alarm off', armed_home: 'Armed home', armed_away: 'Armed away', armed_night: 'Armed night', triggered: 'Alarm triggered!'};
    const chip = (icon, text) => `<span class="chip"><ha-icon icon="${icon}"></ha-icon>${esc(text)}</span>`;
    this.shadowRoot.innerHTML = `<style>${HEADER_STYLE}</style><ha-card>
      <div class="row"><div><div class="greet">${g}${this._config.name ? ', ' + esc(this._config.name) : ''}</div><div class="date">${esc(d.toLocaleDateString([], {weekday: 'long', day: 'numeric', month: 'long'}))}</div></div>
        <div class="time">${esc(d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}))}</div></div>
      <div class="chips">${chip('mdi:lightbulb-outline', `${f.lights} light${f.lights === 1 ? '' : 's'} on`)}
        ${f.inside != null ? chip('mdi:thermometer', `${Math.round(f.inside)}${unit} inside`) : ''}
        ${f.locks.length ? chip(open ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline', open ? `${open} unlocked` : 'Doors locked') : ''}
        ${f.alarm ? chip('mdi:shield-home-outline', ALARM[f.alarm] || cap(f.alarm)) : ''}</div></ha-card>`;
  }
}
const HEADER_STYLE = `
ha-card{background:none;border:none;box-shadow:none;padding:6px 4px 10px;color:var(--primary-text-color)}
.row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.greet{font-size:clamp(28px,4.2vw,46px);font-weight:700;letter-spacing:-.02em;line-height:1.1}
.date{color:var(--secondary-text-color);font-size:15px;margin-top:6px}
.time{font-size:clamp(34px,5.4vw,64px);font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:99px;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--ha-card-border-color,var(--divider-color));font-size:13px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.chip ha-icon{--mdc-icon-size:15px;color:var(--primary-color)}
`;

/*
 * Dashboard Studio weather card: now, a 5 day forecast, and live readings from a Tempest station.
 *
 *   type: custom:dashboard-studio-weather
 *   entity: weather.home        # a weather entity (WeatherFlow Cloud gives one for a Tempest)
 *   station: <device id>        # optional: a Tempest from the local WeatherFlow integration, for live readings
 * Leave both out and the card picks your weather entity and Tempest by itself.
 */
const TEMPEST_PLATFORMS = ['weatherflow', 'weatherflow_cloud'];
const STATION_KEYS = {
  temperature: [/_air_temperature$/, /_temperature$/], humidity: [/_relative_humidity$/, /_humidity$/],
  wind: [/_wind_speed_average$/, /_wind_speed$/], gust: [/_wind_gust$/], direction: [/_wind_direction(_average)?$/],
  rain: [/_precipitation_today$/, /_rain_today$/, /_precipitation$/], rate: [/_rain_rate$/, /_precipitation_rate$/],
  uv: [/_uv(_index)?$/], pressure: [/_sea_level_pressure$/, /_station_pressure$/, /_pressure$/], lightning: [/_lightning_count$/]
};
function tempestStations(hass) {
  const by = {};
  Object.values(hass.entities || {}).forEach(e => { if (TEMPEST_PLATFORMS.includes(e.platform) && e.device_id && e.entity_id.startsWith('sensor.')) (by[e.device_id] = by[e.device_id] || []).push(e.entity_id); });
  return by;
}
class DashboardStudioWeather extends HTMLElement {
  constructor() { super(); this.attachShadow({mode: 'open'}); this._fc = null; }
  static getStubConfig() { return {}; }
  static getConfigElement() { return document.createElement('dashboard-studio-weather-editor'); }
  setConfig(config) { this._config = config || {}; this._pick = null; this._unsub?.(); this._unsub = null; this._fc = null; this._render(); }
  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (!this._pick || old?.entities !== hass.entities) this._choose();
    if (this.isConnected) this._subscribe();
    const ids = [this._pick.entity, ...Object.values(this._pick.s)].filter(Boolean);
    if (!old || ids.some(id => old.states[id] !== hass.states[id])) this._render();
  }
  getCardSize() { return 4; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }
  connectedCallback() { if (this._hass) this._subscribe(); }
  disconnectedCallback() { this._unsub?.(); this._unsub = null; this._subFor = null; }

  _choose() {
    const h = this._hass, c = this._config, ids = Object.keys(h.states), ents = h.entities || {};
    const weathers = ids.filter(id => id.startsWith('weather.'));
    const entity = c.entity && h.states[c.entity] ? c.entity
      : weathers.find(id => TEMPEST_PLATFORMS.includes(ents[id]?.platform)) || weathers.find(id => id === c.entity) || weathers[0];
    const stations = tempestStations(h), sid = c.station && stations[c.station] ? c.station : c.station === false ? null : Object.keys(stations)[0];
    const pool = sid ? stations[sid] : [], s = {};
    Object.entries(STATION_KEYS).forEach(([k, tests]) => { for (const t of tests) { const hit = pool.find(id => t.test(id)); if (hit) { s[k] = hit; break; } } });
    this._pick = {entity, station: sid, s};
  }

  _subscribe() {
    const e = this._pick?.entity, conn = this._hass?.connection;
    if (!e || !conn || this._subFor === e) return;
    this._unsub?.(); this._subFor = e;
    conn.subscribeMessage(m => { this._fc = m.forecast || []; this._render(); }, {type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: e})
      .then(u => { if (this._subFor === e) this._unsub = u; else u(); }).catch(() => { this._fc = this._hass.states[e]?.attributes.forecast || []; this._render(); });
  }

  _render() {
    if (!this._config || !this._hass || !this._pick) return;
    const h = this._hass, c = this._config, w = this._pick.entity && h.states[this._pick.entity], st = k => this._pick.s[k] && h.states[this._pick.s[k]];
    if (!w && !this._pick.station) { this.shadowRoot.innerHTML = `<style>${WEATHER_STYLE}</style><ha-card><p class="hint">No weather yet. Add a weather integration, or a Tempest with WeatherFlow.</p></ha-card>`; return; }
    const num = x => { const v = parseFloat(x?.state); return isNaN(v) ? null : v; };
    const deg = v => v == null ? '–' : `${Math.round(v)}°`;
    const now = num(st('temperature')) ?? w?.attributes.temperature;
    const raining = (num(st('rate')) || 0) > 0;
    const cond = w?.state || (raining ? 'rainy' : 'partlycloudy');
    const fc = (this._fc || []).slice(0, 6), today = fc[0];
    const label = {sunny: 'Sunny', 'clear-night': 'Clear', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', rainy: 'Rainy', pouring: 'Pouring', snowy: 'Snowy', 'snowy-rainy': 'Sleet', lightning: 'Lightning', 'lightning-rainy': 'Storms', fog: 'Fog', windy: 'Windy', 'windy-variant': 'Windy', hail: 'Hail', exceptional: 'Unusual'}[cond] || cap(cond);
    const unitOf = k => st(k)?.attributes.unit_of_measurement || '';
    const chips = [
      st('wind') ? ['mdi:weather-windy', `${Math.round(num(st('wind')))} ${unitOf('wind')}${st('gust') ? ` · gusts ${Math.round(num(st('gust')))}` : ''}`] : w?.attributes.wind_speed != null ? ['mdi:weather-windy', `${Math.round(w.attributes.wind_speed)} ${w.attributes.wind_speed_unit || ''}`] : null,
      st('humidity') ? ['mdi:water-percent', `${Math.round(num(st('humidity')))}%`] : w?.attributes.humidity != null ? ['mdi:water-percent', `${Math.round(w.attributes.humidity)}%`] : null,
      st('rain') ? ['mdi:weather-pouring', `${num(st('rain'))} ${unitOf('rain')} today`] : null,
      st('uv') ? ['mdi:sun-wireless-outline', `UV ${num(st('uv'))}`] : w?.attributes.uv_index != null ? ['mdi:sun-wireless-outline', `UV ${w.attributes.uv_index}`] : null,
      st('lightning') && num(st('lightning')) > 0 ? ['mdi:flash', `${num(st('lightning'))} strikes`] : null
    ].filter(Boolean);
    const days = fc.slice(today && new Date(today.datetime).toDateString() === new Date().toDateString() ? 1 : 0).slice(0, 5);
    this.shadowRoot.innerHTML = `<style>${WEATHER_STYLE}</style><ha-card>
      <div class="lbl">${esc(c.name || 'Weather')}${this._pick.station ? '<span class="live">Live from Tempest</span>' : ''}</div>
      <div class="main"><ha-icon icon="${WX_ICON[cond] || 'mdi:weather-partly-cloudy'}"></ha-icon><div><div class="big">${deg(now)}</div>
        <div class="sub">${esc(label)}${today ? ` · H ${deg(today.temperature)} L ${deg(today.templow)}` : ''}</div></div></div>
      ${chips.length ? `<div class="chips">${chips.map(([i, t]) => `<span class="chip"><ha-icon icon="${i}"></ha-icon>${esc(t)}</span>`).join('')}</div>` : ''}
      ${days.length && c.forecast !== false ? `<div class="fc">${days.map(d => `<div><span>${esc(new Date(d.datetime).toLocaleDateString([], {weekday: 'short'}))}</span><ha-icon icon="${WX_ICON[d.condition] || 'mdi:weather-partly-cloudy'}"></ha-icon><b>${deg(d.temperature)}</b><span>${deg(d.templow)}</span></div>`).join('')}</div>` : ''}
    </ha-card>`;
  }
}
const WEATHER_STYLE = `
ha-card{padding:18px;display:flex;flex-direction:column;gap:12px;color:var(--primary-text-color)}
.hint{margin:0;color:var(--secondary-text-color)}
.lbl{font-size:13px;color:var(--secondary-text-color);display:flex;align-items:center;gap:8px}
.live{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,var(--primary-color) 18%,transparent);color:var(--primary-text-color)}
.main{display:flex;align-items:center;gap:14px}
.main ha-icon{--mdc-icon-size:52px;color:var(--primary-color)}
.big{font-size:46px;font-weight:700;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.sub{font-size:13.5px;color:var(--secondary-text-color);margin-top:4px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:99px;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent);font-size:12.5px}
.chip ha-icon{--mdc-icon-size:15px;color:var(--primary-color)}
.fc{display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:8px}
.fc div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);font-size:12.5px}
.fc span{color:var(--secondary-text-color)}
.fc ha-icon{--mdc-icon-size:20px;color:var(--primary-color)}
`;
class DashboardStudioWeatherEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }
  _render() {
    if (!this._config || !this._hass) return;
    if (!customElements.get('ha-form')) { this.innerHTML = '<p>Use the code editor to set up this card.</p>'; return; }
    if (!this._form) {
      const f = this._form = document.createElement('ha-form');
      const L = {name: 'Label', entity: 'Weather (for the forecast)', station: 'Tempest station (for live readings)', forecast: 'Show the 5 day forecast'};
      f.computeLabel = s => L[s.name] || s.name;
      f.schema = [{name: 'name', selector: {text: {}}}, {name: 'entity', selector: {entity: {domain: 'weather'}}},
        {name: 'station', selector: {device: {filter: TEMPEST_PLATFORMS.map(integration => ({integration}))}}}, {name: 'forecast', selector: {boolean: {}}}];
      f.addEventListener('value-changed', e => {
        const next = {...e.detail.value}; Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null) delete next[k]; });
        if (next.forecast === true) delete next.forecast;
        this._config = next; this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: next}, bubbles: true, composed: true}));
      });
      this.innerHTML = '<p style="margin:0 0 12px;color:var(--secondary-text-color)">Leave these empty and the card picks your weather and Tempest by itself.</p>';
      this.appendChild(f);
    }
    this._form.hass = this._hass; this._form.data = {forecast: true, ...this._config};
  }
}

/* visual editor for the vehicle card */
class DashboardStudioVehicleEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }
  _render() {
    if (!this._config || !this._hass) return;
    if (!customElements.get('ha-form')) { this.innerHTML = '<p>Use the code editor to set up this card.</p>'; return; }
    /* the Tesla View paints come from your car pack: ask for them once, then add the picker */
    if (!tvIndex && !this._tvAsk) { this._tvAsk = true; teslaViewReady().then(ok => { if (ok && tvPaints().length && this._form) { this._form = null; this._render(); } }); }
    if (!this._form) {
      this.innerHTML = '<p style="margin:0 0 12px;color:var(--secondary-text-color)">The card finds your car by itself. With more than one car, pick which one under Your car.</p>';
      const f = this._form = document.createElement('ha-form');
      const L = {reversed: 'These show open when they are closed', battery: 'Battery', range: 'Range', lock: 'Lock', climate: 'Climate', frunk: 'Frunk', trunk: 'Trunk', charge_port: 'Charge port',
        charging: 'Charging', charge_switch: 'Charge on/off', sentry: 'Sentry mode', awake: 'Awake or asleep', wake: 'Wake button', inside: 'Inside temperature', outside: 'Outside temperature', location: 'Location', tesla_view_look: 'Tesla View look', tesla_view_paint: 'Tesla View paint (every paint in your car pack)', tesla_view_brightness: 'Tesla View brightness', name: 'Name', device: 'Your car', charger: 'Charger to show while charging', model: 'Model', color: 'Paint', vehicle: "Or: the car's name in its entity IDs (like my_model_y)", image: 'Car picture (optional, a link like /local/my-car.png)', model_url: '3D car from Tesla Model Extractor (optional, like /local/tesla/model_y.glb)', calm: 'Turn off animations'};
      f.computeLabel = s => L[s.name] || s.name;
      f.schema = [{name: 'device', selector: {device: {filter: ['tesla_fleet', 'teslemetry', 'tessie', 'tesla_custom'].map(integration => ({integration}))}}},
        {name: 'name', selector: {text: {}}}, {name: 'model', selector: opt(['car', 'Other car (rendered picture)'], ['model_3', 'Model 3'], ['model_y', 'Model Y'], ['model_s', 'Model S'], ['model_x', 'Model X'], ['cybertruck', 'Cybertruck'])},
        {name: 'color', selector: opt(...Object.keys(CAR_PAINT).map(k => [k, cap(k)]))}, {name: 'tesla_view_look', selector: opt(['transparent', 'See-through (just the car)'], ['dark', 'Blend into the card (app dark mode)'], ['light', 'Light (app light mode)'])},
        ...(tvPaints().length ? [{name: 'tesla_view_paint', selector: opt(['', 'Match the paint above'], ...tvPaints().map(p => [p, p.replace(/([a-z])([A-Z])/g, '$1 $2')]))}] : []),
        {name: 'tesla_view_brightness', selector: {number: {min: .6, max: 2, step: .05, mode: 'slider'}}},
        {name: 'reversed', selector: {select: {multiple: true, mode: 'list', options: [{value: 'frunk', label: 'Frunk'}, {value: 'trunk', label: 'Trunk'}, {value: 'charge_port', label: 'Charge port'}]}}},
        {name: 'entities', type: 'expandable', title: 'Entities (found by itself: change any)', schema: [
          ['battery', 'sensor'], ['range', 'sensor'], ['lock', 'lock'], ['climate', 'climate'], ['frunk', 'cover'], ['trunk', 'cover'], ['charge_port', 'cover'],
          ['charging', ['binary_sensor', 'sensor']], ['charge_switch', 'switch'], ['sentry', 'switch'], ['awake', ['binary_sensor', 'sensor']], ['wake', 'button'], ['inside', 'sensor'], ['outside', 'sensor'], ['location', 'device_tracker']
        ].map(([n, domain]) => ({name: n, selector: {entity: {domain}}}))},
        {name: 'charger', selector: opt(['auto', 'Find it by itself'], ['supercharger', 'Supercharger'], ['wall_connector', 'Wall Connector'], ['none', 'Only the cable'])},
        {name: 'vehicle', selector: {text: {}}}, {name: 'image', selector: {text: {}}}, {name: 'model_url', selector: {text: {}}}, {name: 'calm', selector: {boolean: {}}}];
      f.addEventListener('value-changed', e => {
        const next = {...e.detail.value}; Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null) delete next[k]; });
        this._config = next; this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: next}, bubbles: true, composed: true}));
      });
      this.appendChild(f);
    }
    /* show what the card found, so you can see it and change any one */
    const found = findVehicle(this._hass, this._config);
    this._form.hass = this._hass; this._form.data = {model: 'car', color: 'pearl_white', ...this._config, entities: {...found, ...(this._config.entities || {})}};
  }
}

/* visual editor for the hub card: the simple choices, with rooms filled from areas */
const HUB_LABELS = {
  title: 'Home name', layout: 'Layout', touch_style: 'Look', opacity: 'Background strength (0 is see-through)', icon_color: 'Icon color when on',
  icon_background: 'Circle behind icons', room_radius: 'Room button roundness (30 is fully round)',
  areas: 'Rooms to show (leave empty for every area)', weather_entity: 'Weather', good_night: 'Good night script (leave empty to let the card do it)',
  full_height: 'Fill the screen', calm: 'Turn off animations'
};
const opt = (...pairs) => ({select: {mode: 'dropdown', options: pairs.map(([value, label]) => ({value, label}))}});

class DashboardStudioHubEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }

  _schema() {
    const c = this._config || {}, touch = c.layout === 'touchscreen';
    return [
      {name: 'title', selector: {text: {}}},
      {name: 'layout', selector: opt(['touchscreen', 'Touchscreen'], ['tiles', 'Tiles'])},
      ...(touch ? [
        {name: 'touch_style', selector: opt(['dark', 'Dark'], ['theme', 'Follow my theme'])},
        {name: 'opacity', selector: {number: {min: 0, max: 100, step: 5, mode: 'slider', unit_of_measurement: '%'}}},
        {name: 'room_radius', selector: {number: {min: 0, max: 30, step: 2, mode: 'slider', unit_of_measurement: 'px'}}},
        {name: 'icon_background', selector: {boolean: {}}}
      ] : []),
      {name: 'icon_color', selector: opt(['soft', 'Soft white'], ['accent', 'My theme color'], ['warm', 'Warm yellow'])},
      ...(Array.isArray(c.rooms) && c.rooms.length ? [] : [{name: 'areas', selector: {area: {multiple: true}}}]),
      ...(touch ? [{name: 'weather_entity', selector: {entity: {domain: 'weather'}}}] : []),
      ...(c.good_night == null || typeof c.good_night === 'string' ? [{name: 'good_night', selector: {entity: {domain: 'script'}}}] : []),
      ...(touch ? [{name: 'full_height', selector: {boolean: {}}}] : []),
      {name: 'calm', selector: {boolean: {}}}
    ];
  }

  _render() {
    if (!this._config || !this._hass) return;
    if (!customElements.get('ha-form')) { this.innerHTML = '<p>Use the code editor to set up this card.</p>'; return; }
    const hand = Array.isArray(this._config.rooms) && this._config.rooms.length;
    if (!this._form) {
      this.innerHTML = '<p class="note" style="margin:0 0 12px;color:var(--secondary-text-color)"></p>';
      this._form = document.createElement('ha-form');
      this._form.computeLabel = s => HUB_LABELS[s.name] || s.name;
      this._form.addEventListener('value-changed', e => {
        const next = {...e.detail.value};
        Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null || (Array.isArray(next[k]) && !next[k].length)) delete next[k]; });
        this._config = next; this._form.schema = this._schema();
        this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: next}, bubbles: true, composed: true}));
      });
      this.appendChild(this._form);
    }
    this.querySelector('.note').textContent = hand
      ? 'This card uses the rooms written in its code. To fill rooms from your areas instead, remove "rooms" in the code editor.'
      : 'Rooms fill in from your Home Assistant areas, and scenes from your scenes. Nothing else to set up.';
    this._form.hass = this._hass;
    this._form.data = {layout: 'tiles', touch_style: 'dark', opacity: 0, icon_color: 'soft', room_radius: 30, icon_background: true, ...this._config};
    this._form.schema = this._schema();
  }
}

/*
 * Dashboard Studio laundry card
 * Your washer and dryer: what they're doing, the time left, and a happy "Done" when a load is ready.
 * It finds your machines by itself: Samsung SmartThings, LG ThinQ, Home Connect (Bosch, Siemens), Miele,
 * GE, Whirlpool, or a smart plug's power reading.
 *
 *   type: custom:dashboard-studio-laundry
 *   name: Laundry
 *   machines:                 # optional: leave out to use every washer and dryer it finds
 *     - device: <device id>   # pick it in the visual editor
 *       name: Washer
 *       kind: washer          # washer, dryer, or combo (one machine that washes and dries, like an LG WashCombo)
 *       # optional, when the card guesses wrong:
 *       status: sensor.washer_machine_state
 *       stage: sensor.washer_job_state
 *       remaining: sensor.washer_remaining_time
 *       finish: sensor.washer_completion_time
 *       progress: sensor.washer_progress
 *       power: sensor.washer_power
 *       door: binary_sensor.washer_door
 */
const LAUNDRY_ROLES = ['status', 'stage', 'remaining', 'finish', 'progress', 'power', 'door', 'running'];
const isLaundry = t => /wash|dryer|laundry|lavadora|secadora/i.test(t) && !/dish/i.test(t);
const L_WORD = /washer|washing|dryer|wash_?combo|washtower|wash_?tower|lavadora|secadora/i;
const L_SENSORISH = /battery|signal|rssi|linkquality|temperature|humidity|leak|water|moisture|flood|window|door|motion|occupancy|presence|contact|illuminance|lux|tamper|vibration|update|firmware/;
/* a washer or dryer: its name says so, or it's in the laundry room and reports a cycle.
   A leak, temperature or window sensor in the laundry room is not a machine */
function isLaundryDevice(hass, text, ids) {
  if (/dish/i.test(text + ids.join(' ')) || !ids.some(id => /^(sensor|binary_sensor)\./.test(id))) return false;
  if (ids.every(id => L_SENSORISH.test(id.split('.')[1]) || ['temperature', 'humidity', 'moisture', 'battery', 'signal_strength', 'illuminance', 'door', 'window', 'motion', 'occupancy', 'opening', 'problem', 'safety', 'tamper'].includes(hass.states[id]?.attributes.device_class))) return false;
  if (L_WORD.test(text) || ids.some(id => L_WORD.test(id.split('.')[1]))) return true;
  const r = laundryRoles(hass, ids.filter(id => !L_SENSORISH.test(id.split('.')[1])));
  return /laundry/i.test(text) && !!(r.stage || r.remaining || r.finish || r.progress || (r.status && /machine_state|operation_state|current_status|appliance_state/.test(r.status)));
}
/* one machine that washes and then dries: its name says so, or it has both spin and dry settings */
const L_COMBO = /combo|washer[\s_-]?dryer|wash[\s_-]?(and[\s_-]?)?dry|all[\s_-]?in[\s_-]?one/i;
const laundryKind = (name, ids) => L_COMBO.test(name) || L_COMBO.test(ids.join(' ')) || (ids.some(i => /spin/.test(i)) && ids.some(i => /dry_?level|drying|dry_?time/.test(i))) ? 'combo'
  : /dry/i.test(name || ids.join(' ')) && !/wash/i.test(name) ? 'dryer' : 'washer';
/* the entities that say what a machine is doing, picked from one device's entities */
function laundryRoles(hass, ids) {
  const st = id => hass.states[id], dc = id => st(id)?.attributes.device_class, unit = id => st(id)?.attributes.unit_of_measurement || '';
  const obj = id => id.split('.')[1], sensors = ids.filter(id => id.startsWith('sensor.'));
  const pick = (list, ...tests) => { for (const t of tests) { const f = list.find(t); if (f) return f; } return undefined; };
  return {
    finish: pick(sensors, id => dc(id) === 'timestamp' && /complet|finish|end|done|ready/.test(obj(id)), id => dc(id) === 'timestamp' && !/start|last|updated/.test(obj(id))),
    remaining: pick(sensors, id => /remain|time_left|left/.test(obj(id)) && dc(id) !== 'timestamp', id => dc(id) === 'duration' && !/total|initial|running|elapsed|run_time/.test(obj(id))),
    progress: pick(sensors, id => unit(id) === '%' && /progress|percent/.test(obj(id))),
    stage: pick(sensors, id => /job_state|stage|phase|cycle_state|process_state|run_state|step/.test(obj(id))),
    status: pick(sensors, id => /machine_state|operation_state|current_status|appliance_state/.test(obj(id)), id => /(^|_)(status|state)$/.test(obj(id)) && !/door|lid|job|wifi|signal|battery/.test(obj(id))),
    power: pick(sensors, id => dc(id) === 'power' || /^k?W$/.test(unit(id))),
    door: pick(ids.filter(id => id.startsWith('binary_sensor.')), id => dc(id) === 'door' || /door|lid/.test(obj(id))),
    running: pick(ids.filter(id => id.startsWith('binary_sensor.')), id => dc(id) === 'running' || /running|(^|_)active$/.test(obj(id)))
  };
}
/* every washer and dryer: a device whose name or entities say laundry */
function findLaundry(hass) {
  const by = {}, loose = {};
  Object.values(hass.entities || {}).forEach(e => { if (!hass.states[e.entity_id] || e.hidden || e.entity_category) return;
    if (e.device_id) (by[e.device_id] ||= []).push(e.entity_id);
    else { const m = e.entity_id.split('.')[1].match(/^(.*?(washer|washing_machine|dryer))/); if (m && !/dish/.test(m[1])) (loose[m[1]] ||= []).push(e.entity_id); } });
  const out = [];
  Object.entries(by).forEach(([dev, ids]) => {
    const d = hass.devices?.[dev] || {}, name = d.name_by_user || d.name || '';
    if (!isLaundryDevice(hass, `${name} ${d.model || ''}`, ids)) return;
    const nice = name.replace(/\s*\b(smart\s*)?(plug|outlet|power|energy)\b\s*/ig, ' ').trim() || name;
    /* a stacked washer and dryer that is one device (like an LG WashTower) is two machines */
    const wIds = ids.filter(i => /(^|_)washer(_|$)/.test(i.split('.')[1]) && !/dryer/.test(i)), dIds = ids.filter(i => /(^|_)dryer(_|$)/.test(i.split('.')[1]));
    if (!L_COMBO.test(nice) && wIds.some(i => /status|state/.test(i)) && dIds.some(i => /status|state/.test(i))) {
      out.push({device: dev, sub: 'washer', name: `${nice} washer`, kind: 'washer', ids: wIds}, {device: dev, sub: 'dryer', name: `${nice} dryer`, kind: 'dryer', ids: dIds});
      return;
    }
    out.push({device: dev, name: nice, kind: laundryKind(nice, ids), ids});
  });
  Object.entries(loose).forEach(([k, ids]) => out.push({name: cap(k), kind: laundryKind(k, ids), ids}));
  /* washers first, dryers last; the two halves of a stacked pair stay together */
  return out.sort((a, b) => (!a.sub && a.kind === 'dryer') - (!b.sub && b.kind === 'dryer'));
}
const L_NORM = s => String(s ?? '').split('.').pop().toLowerCase().replace(/[\s-]+/g, '_');
const L_DONE = /^(end|finish|finished|complete|completed|done|cycle_?complete|program_?finished)$/;
const L_PAUSE = /^(pause|paused|pausing)$/;
const L_RUN = /^(run|running|on|wash|washing|rinse|rinsing|spin|spinning|dry|drying|cool|cooling|cool_?down|wrinkle_?prevent|wrinkle_?care|steam|steaming|soak|soaking|pre_?wash|detecting|weight_?sensing|heating|in_?progress|active|operating|busy|delayed_?start|delay|delay_?wash|reservation|refresh)$/;
const L_STAGE = {wash: 'Washing', washing: 'Washing', main_wash: 'Washing', rinse: 'Rinsing', rinsing: 'Rinsing', spin: 'Spinning', spinning: 'Spinning', dry: 'Drying', drying: 'Drying',
  cool: 'Cooling down', cooling: 'Cooling down', cool_down: 'Cooling down', cooldown: 'Cooling down', wrinkle_prevent: 'Wrinkle care', wrinkleprevent: 'Wrinkle care', wrinkle_care: 'Wrinkle care',
  steam: 'Steaming', steaming: 'Steaming', soak: 'Soaking', soaking: 'Soaking', prewash: 'Pre-wash', pre_wash: 'Pre-wash', detecting: 'Weighing the load', weight_sensing: 'Weighing the load',
  heating: 'Heating', delay: 'Waiting to start', delay_wash: 'Waiting to start', delayed_start: 'Waiting to start', delayedstart: 'Waiting to start', reservation: 'Waiting to start', refresh: 'Refreshing'};
function lMinutes(st) {
  if (!st || ['unknown', 'unavailable', ''].includes(st.state)) return null;
  const s = String(st.state), u = (st.attributes.unit_of_measurement || 'min').toLowerCase();
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/); if (hms) return +hms[1] * 60 + +hms[2] + (hms[3] ? +hms[3] / 60 : 0);
  const n = parseFloat(s); if (isNaN(n)) return null;
  return u.startsWith('h') ? n * 60 : u === 's' || u.startsWith('sec') ? n / 60 : u === 'd' ? n * 1440 : n;
}
/* the machine drawing: a front loader whose drum tumbles while it runs, with the progress as a ring round the door */
function laundryArt(kind, mode, prog, uid) {
  const C = 2 * Math.PI * 27, dry = kind === 'dryer' || kind === 'combo-dry';
  const inside = dry
    ? `<g class="lw-drum"><circle cx="14" cy="-6" r="5" fill="#ff9fbf"/><circle cx="-12" cy="8" r="6" fill="#8fd3ff"/><rect x="-6" y="-16" width="10" height="7" rx="3" fill="#ffd36e"/><circle cx="2" cy="12" r="4" fill="#b9a6ff"/></g>`
    : `<g class="lw-drum"><path d="M-22 6c8-5 14 5 22 0s14-5 22 0v20h-44z" fill="#5fc0ff" opacity=".55"/><circle cx="12" cy="-8" r="5" fill="#ff9fbf"/><rect x="-14" y="-10" width="10" height="7" rx="3" fill="#ffd36e"/><circle cx="-2" cy="10" r="4" fill="#fff" opacity=".8"/></g>`;
  return `<svg class="lw-art ${mode}${dry ? ' dry' : ''}" viewBox="0 0 100 112" aria-hidden="true">
    <defs><clipPath id="lw${uid}"><circle cx="50" cy="66" r="22"/></clipPath><radialGradient id="lg${uid}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#cfe6ff" stop-opacity=".18"/><stop offset="1" stop-color="#8aa7c4" stop-opacity=".1"/></radialGradient></defs>
    <rect x="8" y="4" width="84" height="104" rx="12" class="lw-body"/>
    <rect x="8" y="4" width="84" height="22" rx="12" class="lw-panel"/><rect x="8" y="18" width="84" height="8" class="lw-panel"/>
    <circle cx="74" cy="15" r="5.5" class="lw-knob"/><rect x="20" y="12" width="26" height="6" rx="3" class="lw-screen"/><circle cx="56" cy="15" r="2" class="lw-led"/>
    ${kind.startsWith('combo') ? '<g aria-hidden="true"><circle cx="62" cy="15" r="2.4" fill="#f59e0b"/><path d="M66.5 12.2c1.2 1.6 1.8 2.5 1.8 3.2a1.8 1.8 0 0 1-3.6 0c0-.7.6-1.6 1.8-3.2z" fill="#38bdf8"/></g>' : ''}<circle cx="50" cy="66" r="31" class="lw-rim"/>
    <circle cx="50" cy="66" r="27" class="lw-track"/>
    <circle cx="50" cy="66" r="27" class="lw-prog${(prog ?? 0) > 0 ? '' : ' zero'}" stroke-dasharray="${(C * Math.max(0, Math.min(1, prog ?? 0))).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 66)"/>
    <circle cx="50" cy="66" r="22" class="lw-glass"/>
    <g clip-path="url(#lw${uid})"><g transform="translate(50 66)">${inside}</g><circle cx="50" cy="66" r="22" fill="url(#lg${uid})"/></g>
    ${mode === 'done' ? '<g class="lw-done"><circle cx="78" cy="94" r="11"/><path d="M73 94l3.5 3.5 7-7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>' : ''}
  </svg>`;
}
const LAUNDRY_STYLE = `
:host{--l-text:var(--primary-text-color,#1c1c1c);--l-muted:var(--secondary-text-color,#6b6b6b);--l-accent:var(--primary-color,#03a9f4);--l-soft:color-mix(in srgb,var(--l-text) 7%,transparent)}
ha-card{padding:18px;display:flex;flex-direction:column;gap:14px;color:var(--l-text)}
ha-card.bare{background:none;box-shadow:none;border:none;padding:4px 0 0}
button{font:inherit;color:inherit;cursor:pointer}
.l-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.l-head b{font-size:20px;font-weight:600}
.l-head span{font-size:13px;color:var(--l-muted)}
.l-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.lm{border:0;background:var(--l-soft);border-radius:18px;padding:14px 12px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:0;transition:transform .15s}
.lm:active{transform:scale(.98)}
.lm.done{background:color-mix(in srgb,#22c55e 13%,transparent)}
.lm b{font-size:15px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lm .l-st{font-size:13px;font-weight:600}
.lm .l-sub{font-size:12px;color:var(--l-muted);min-height:1.3em}
.lm.done .l-st{color:#16a34a}
.lw-art{width:min(120px,100%);height:auto;overflow:visible}
.lw-body{fill:color-mix(in srgb,var(--l-text) 4%,#f4f6f9);stroke:color-mix(in srgb,var(--l-text) 14%,transparent);stroke-width:1.2}
.lw-panel{fill:color-mix(in srgb,var(--l-text) 8%,#e9edf2)}
.lw-knob{fill:#fff;stroke:color-mix(in srgb,var(--l-text) 22%,transparent);stroke-width:1.4}
.lw-screen{fill:#1d2733}
.running .lw-screen{fill:#123b52}
.lw-led{fill:#9aa3ad}
.running .lw-led{fill:#4ade80}
.done .lw-led{fill:#22c55e}
.lw-rim{fill:#dfe5ec;stroke:#c3ccd6;stroke-width:1.5}
.lw-track{fill:none;stroke:color-mix(in srgb,var(--l-text) 10%,transparent);stroke-width:4}
.lw-prog{fill:none;stroke:var(--l-accent);stroke-width:4;stroke-linecap:round;transition:stroke-dasharray .8s ease}
.dry .lw-prog{stroke:#f59e0b}
.lw-art.done .lw-prog{stroke:#22c55e}
.lw-prog.zero{opacity:0}
.lw-glass{fill:#2b3a4a}
.dry.running .lw-glass{fill:#4a3424}
.lw-drum{transform-box:view-box}
.running .lw-drum{animation:lwSpin 2.4s linear infinite}
.running.dry .lw-drum{animation:lwTumble 3s ease-in-out infinite}
.lw-done circle{fill:#22c55e}
.lw-done{animation:lwPop .5s cubic-bezier(.3,1.6,.5,1)}
@keyframes lwSpin{to{transform:rotate(360deg)}}
@keyframes lwTumble{0%{transform:rotate(0)}40%{transform:rotate(200deg)}60%{transform:rotate(170deg)}100%{transform:rotate(360deg)}}
@keyframes lwPop{from{transform:scale(0);transform-origin:78px 94px}to{transform:scale(1)}}
.hint{margin:0;color:var(--l-muted);line-height:1.5}
ha-card.calm *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;
const LDONE_KEY = 'dashboard-studio-laundry-done';
class DashboardStudioLaundry extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._uid = Math.random().toString(36).slice(2, 7);
    this._was = {}; this._total = {};
    try { this._doneAt = JSON.parse(localStorage.getItem(LDONE_KEY)) || {}; } catch (e) { this._doneAt = {}; }
    this.shadowRoot.addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: b.dataset.e}, bubbles: true, composed: true})); });
  }

  static getStubConfig() { return {name: 'Laundry'}; }
  static getConfigElement() { return document.createElement('dashboard-studio-laundry-editor'); }

  setConfig(config) { this._config = {name: 'Laundry', ...config}; this._machines = null; this._render(); }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (!this._machines || old?.entities !== hass.entities) this._find();
    const watch = this._machines.flatMap(m => Object.values(m.r).filter(Boolean));
    if (!old || watch.some(id => old.states[id] !== hass.states[id])) this._render();
  }

  connectedCallback() { this._tick = setInterval(() => this._render(), 30000); }
  disconnectedCallback() { clearInterval(this._tick); }
  getCardSize() { return 4; }
  getGridOptions() { return {columns: 6, min_columns: 4}; }

  _find() {
    const h = this._hass, found = findLaundry(h), list = this._config.machines?.length ? this._config.machines : found;
    this._machines = list.map((m, i) => {
      const f = m.device ? found.find(x => x.device === m.device && (!m.sub || x.sub === m.sub)) : m.ids ? m : null;
      const ids = f?.ids || (m.device ? Object.values(h.entities || {}).filter(e => e.device_id === m.device).map(e => e.entity_id) : []);
      const auto = laundryRoles(h, ids), r = {};
      LAUNDRY_ROLES.forEach(k => { r[k] = m[k] || auto[k]; });
      const kind = m.kind || f?.kind || 'washer';
      return {key: (m.device || f?.device || (r.status || r.remaining || r.power || `m${i}`)) + (m.sub || f?.sub ? ':' + (m.sub || f.sub) : ''), name: m.name || f?.name || (kind === 'dryer' ? 'Dryer' : 'Washer'), kind, r};
    });
  }

  /* what one machine is doing right now */
  _state(m) {
    const s = id => id && this._hass.states[id], r = m.r;
    const status = L_NORM(s(r.status)?.state), stage = L_NORM(s(r.stage)?.state);
    const watts = parseFloat(s(r.power)?.state), runBin = s(r.running)?.state === 'on';
    let mode = 'idle';
    if (L_DONE.test(status) || L_DONE.test(stage)) mode = 'done';
    else if (L_PAUSE.test(status) || L_PAUSE.test(stage)) mode = 'paused';
    else if (L_RUN.test(status) || (stage && L_RUN.test(stage) && !/^(none|off|idle|stop|ready)$/.test(status)) || runBin || (!r.status && !r.stage && watts > 5)) mode = 'running';
    if (['unavailable', 'unknown'].includes(s(r.status)?.state) && mode === 'idle' && !r.power) mode = 'off';
    /* time left: the finish time when the machine gives one, else its countdown */
    let left = null;
    const fin = s(r.finish)?.state, ft = fin && Date.parse(fin);
    if (ft && !isNaN(ft) && ft > Date.now() - 60000) left = Math.max(0, (ft - Date.now()) / 60000);
    if (left == null) left = lMinutes(s(r.remaining));
    if (mode !== 'running' && mode !== 'paused') left = null;
    /* a finished load stays "done" until the door opens, the next load starts, or three hours pass */
    const k = m.key, now = Date.now();
    if (mode === 'running') { delete this._doneAt[k]; if (left != null) this._total[k] = Math.max(this._total[k] || 0, left); }
    if (mode === 'done' && !this._doneAt[k]) this._doneAt[k] = now;
    if (mode === 'idle' && this._was[k] === 'running') this._doneAt[k] = now;
    if (s(r.door)?.state === 'on' || (this._doneAt[k] && now - this._doneAt[k] > 3 * 3600e3)) delete this._doneAt[k];
    if (mode !== 'running' && mode !== 'paused' && this._doneAt[k]) mode = 'done';
    if (mode !== 'running') delete this._total[k];
    this._was[k] = mode === 'done' ? 'idle' : mode;
    try { localStorage.setItem(LDONE_KEY, JSON.stringify(this._doneAt)); } catch (e) { /* fine */ }
    const pct = parseFloat(s(r.progress)?.state);
    const prog = mode === 'done' ? 1 : mode === 'running' || mode === 'paused' ? (!isNaN(pct) ? pct / 100 : left != null && this._total[k] ? 1 - left / this._total[k] : null) : 0;
    const word = L_STAGE[stage] || L_STAGE[status] || (m.kind === 'dryer' ? 'Drying' : 'Washing');
    const drying = m.kind === 'dryer' || (m.kind === 'combo' && /Drying|Cooling|Wrinkle/.test(word));
    return {mode, left, prog, word, drying};
  }

  _render() {
    if (!this._config) return;
    const c = this._config, h = this._hass;
    const card = (inner, cls = '') => `<style>${LAUNDRY_STYLE}</style><ha-card class="${[cls, c.calm ? 'calm' : '', c.bare ? 'bare' : ''].filter(Boolean).join(' ')}">${inner}</ha-card>`;
    if (!h || !this._machines) { this.shadowRoot.innerHTML = card('<p class="hint">Connecting to Home Assistant…</p>'); return; }
    if (!this._machines.length) { this.shadowRoot.innerHTML = card(`<div class="l-head"><b>${esc(c.name)}</b></div><p class="hint">No washer or dryer found yet. Add its integration (like SmartThings, LG ThinQ or Home Connect), or list it under <code>machines</code>.</p>`); return; }
    const sts = this._machines.map(m => this._state(m));
    const clock = mins => new Date(Date.now() + mins * 60000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    const dur = mins => mins >= 60 ? `${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min` : `${Math.max(1, Math.round(mins))} min`;
    const tiles = this._machines.map((m, i) => {
      const st = sts[i], dry = m.kind === 'dryer', combo = m.kind === 'combo';
      const line = st.mode === 'running' ? `${st.word}${st.left != null ? ` · ${dur(st.left)} left` : ''}` : st.mode === 'paused' ? 'Paused' : st.mode === 'done' ? (combo ? 'Done! Clean and dry 🧺' : dry ? 'Done! Time to fold 🧺' : 'Done! Ready to move 🧺') : st.mode === 'off' ? 'Offline' : 'Ready';
      const sub = st.mode === 'running' && st.left != null ? `Done at ${clock(st.left)}` : st.mode === 'done' && this._doneAt[m.key] ? `Finished at ${new Date(this._doneAt[m.key]).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}` : '';
      return `<button class="lm ${st.mode}" data-e="${esc(m.r.status || m.r.stage || m.r.remaining || m.r.power || '')}" aria-label="${esc(m.name)}: ${esc(line)}">
        ${laundryArt(m.kind === 'combo' ? (st.drying && st.mode === 'running' ? 'combo-dry' : 'combo') : m.kind, st.mode, st.prog, this._uid + i)}<b>${esc(m.name)}</b><span class="l-st">${esc(line)}</span><span class="l-sub">${esc(sub)}</span></button>`;
    }).join('');
    const running = sts.filter(x => x.mode === 'running'), done = sts.filter(x => x.mode === 'done').length;
    const soon = running.filter(x => x.left != null).sort((a, b) => a.left - b.left)[0];
    const summary = soon ? `Next one done at ${clock(soon.left)}` : running.length ? `${running.length} running` : done ? `${done} load${done === 1 ? '' : 's'} ready` : 'All quiet';
    this.shadowRoot.innerHTML = card(`<div class="l-head"><b>${esc(c.name)}</b><span>${esc(summary)}</span></div><div class="l-grid">${tiles}</div>`);
  }
}

class DashboardStudioLaundryEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { const first = !this._hass; this._hass = hass; if (first) this._render(); else if (this._form) this._form.hass = hass; }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = s => ({name: 'Name', machines: 'Machines'})[s.name] || s.name;
      this._form.addEventListener('value-changed', e => this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: {...this._config, ...e.detail.value}}, bubbles: true, composed: true})));
      const note = document.createElement('p');
      note.style.cssText = 'margin:12px 0 0;color:var(--secondary-text-color);font-size:13px;line-height:1.5';
      note.textContent = 'Your washer and dryer are found by themselves. To pick them yourself, or fix a guess, add them under machines in the code editor.';
      this.append(this._form, note);
    }
    this._form.hass = this._hass;
    this._form.schema = [{name: 'name', selector: {text: {}}}];
    this._form.data = {name: this._config.name || 'Laundry'};
  }
}

if (!customElements.get('dashboard-studio-hub')) customElements.define('dashboard-studio-hub', DashboardStudioHub);
if (!customElements.get('dashboard-studio-laundry')) customElements.define('dashboard-studio-laundry', DashboardStudioLaundry);
if (!customElements.get('dashboard-studio-laundry-editor')) customElements.define('dashboard-studio-laundry-editor', DashboardStudioLaundryEditor);
if (!customElements.get('dashboard-studio-dual-shade')) customElements.define('dashboard-studio-dual-shade', DashboardStudioDualShade);
if (!customElements.get('dashboard-studio-fx')) customElements.define('dashboard-studio-fx', DashboardStudioFx);
if (!customElements.get('dashboard-studio-vehicle')) customElements.define('dashboard-studio-vehicle', DashboardStudioVehicle);
if (!customElements.get('dashboard-studio-header')) customElements.define('dashboard-studio-header', DashboardStudioHeader);
if (!customElements.get('dashboard-studio-weather')) customElements.define('dashboard-studio-weather', DashboardStudioWeather);
if (!customElements.get('dashboard-studio-weather-editor')) customElements.define('dashboard-studio-weather-editor', DashboardStudioWeatherEditor);
if (!customElements.get('dashboard-studio-garage')) customElements.define('dashboard-studio-garage', DashboardStudioGarage);
if (!customElements.get('dashboard-studio-garage-editor')) customElements.define('dashboard-studio-garage-editor', DashboardStudioGarageEditor);
if (!customElements.get('dashboard-studio-vehicle-editor')) customElements.define('dashboard-studio-vehicle-editor', DashboardStudioVehicleEditor);
if (!customElements.get('dashboard-studio-hub-editor')) customElements.define('dashboard-studio-hub-editor', DashboardStudioHubEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'dashboard-studio-hub')) {
  window.customCards.push({type: 'dashboard-studio-hub', name: 'Dashboard Studio hub', description: 'Touchscreen-style home screen with rooms, device tiles, scenes, an alarm keypad and a Good night button.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-dual-shade')) {
  window.customCards.push({type: 'dashboard-studio-dual-shade', name: 'Dashboard Studio dual shade', description: 'One window, two shade motors: day/night honeycomb or top down, bottom up. With Open, Day and Night presets.', preview: false});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-weather')) {
  window.customCards.push({type: 'dashboard-studio-weather', name: 'Dashboard Studio weather', description: 'Now, a 5 day forecast, and live readings from a Tempest weather station.', preview: true});
  window.customCards.push({type: 'dashboard-studio-header', name: 'Dashboard Studio greeting', description: 'A greeting, the date, a big clock and chips for lights, temperature, locks and the alarm.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-garage')) {
  window.customCards.push({type: 'dashboard-studio-garage', name: 'Dashboard Studio garage', description: 'All your cars in a garage: parked when home, an empty bay when away, with the garage door. Tap a car for its vehicle card.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-vehicle')) {
  window.customCards.push({type: 'dashboard-studio-vehicle', name: 'Dashboard Studio vehicle', description: 'Tesla app style car card: your car in its paint color, battery and range, charging, and lock, climate, frunk, trunk, charge port and sentry controls.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-laundry')) {
  window.customCards.push({type: 'dashboard-studio-laundry', name: 'Dashboard Studio laundry', description: 'Your washer and dryer: what they are doing, the time left, and a happy Done when a load is ready.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-fx')) {
  window.customCards.push({type: 'dashboard-studio-fx', name: 'Dashboard Studio effects', description: 'Moving backgrounds (including live weather) and card effects for the whole view. Invisible outside edit mode.', preview: false});
}
console.info(`%c DASHBOARD STUDIO %c ${STUDIO_VERSION} `, 'background:#4352f0;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#15171c;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px');
