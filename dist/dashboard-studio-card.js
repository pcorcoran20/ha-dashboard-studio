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
const STUDIO_VERSION = '1.1.1';

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
  ['fan', 'Fans', 'mdi:fan'], ['switch', 'Outlets', 'mdi:power-socket-us'], ['car', 'Car', 'mdi:car-electric']
];
const catOf = t => (t === 'lock' || t === 'alarm') ? 'security' : t;
/* touchscreen layout tiles, in screen order */
const TOUCH = [['watch', 'Watch', 'mdi:television'], ['listen', 'Listen', 'mdi:speaker'], ['light', 'Lighting', 'mdi:lightbulb'], ['climate', 'Comfort', 'mdi:thermostat'], ['car', 'Car', 'mdi:car-electric'],
  ['shade', 'Shades', 'mdi:blinds'], ['security', 'Security', 'mdi:shield-home'], ['camera', 'Cameras', 'mdi:cctv'], ['fan', 'Fans', 'mdi:fan'],
  ['switch', 'Outlets', 'mdi:power-socket-us'], ['quick', 'Shortcuts', 'mdi:gesture-tap-button']];
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
    if (this._carCfg() && (!this._carE || old?.entities !== hass.entities)) this._carE = findVehicle(hass, this._carCfg());
    const car = this._view === 'car' ? [] : Object.values(this._carE || {});
    if (filled || !old || [...this._watched(), ...car].some(e => old.states[e] !== hass.states[e]) || old.themes !== hass.themes) this._schedule();
    const v = this._root?.querySelector('dashboard-studio-vehicle'); if (v) v.hass = hass;
  }

  /* the car: found by itself unless vehicle is false. It shows on All rooms, and in a room that sounds like where it parks */
  _carCfg() { const v = this._config?.vehicle; return v === false ? null : typeof v === 'object' ? v : typeof v === 'string' ? {vehicle: v} : {}; }
  _hasCar() { return !!(this._carCfg() && this._carE?.battery); }
  _carHere() { return this._hasCar() && (this._room < 0 || /garage|driveway|carport|car/i.test(this._config.rooms[this._room]?.name || '')); }
  _carInfo() {
    const st = id => id && this._hass.states[id], e = this._carE, bat = Math.round(parseFloat(st(e.battery)?.state));
    const cs = st(e.charging)?.state?.toLowerCase(), chg = cs ? ['on', 'charging', 'true'].includes(cs) : st(e.charge_switch)?.state === 'on';
    const lock = st(e.lock)?.state;
    return {bat: isNaN(bat) ? null : bat, chg, text: [isNaN(bat) ? '' : `${bat}%`, chg ? 'Charging' : lock === 'locked' ? 'Locked' : lock === 'unlocked' ? 'Unlocked' : ''].filter(Boolean).join(' · ')};
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
      const by = {}, loose = [];
      ids.forEach(id => {
        const dom = id.split('.')[0];
        if (!DOMAIN_TYPE[dom] || dom === 'input_boolean' || !shown(id)) return;
        const e = ents[id], aid = e?.area_id || devs[e?.device_id]?.area_id;
        if (aid && areas[aid]) (by[aid] = by[aid] || []).push({entity: id}); else loose.push({entity: id});
      });
      let rooms = Object.keys(by).map(aid => ({id: aid, name: areas[aid].name || aid, devices: by[aid], level: floors[areas[aid].floor_id]?.level ?? 99}));
      if (c.areas) {
        const want = [c.areas].flat().map(w => String(w).toLowerCase());
        rooms = want.map(w => rooms.find(r => r.id.toLowerCase() === w || r.name.toLowerCase() === w)).filter(Boolean);
      } else {
        rooms = rooms.filter(r => !skip.has(r.id) && !skip.has(r.name)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
        if (!rooms.length && loose.length) rooms = [{name: c.title || 'Home', devices: loose}];
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
    return [...c.rooms.flatMap(r => r.devices.map(d => d.entity)), ...c.scenes.map(s => s.entity), ...gn];
  }

  _schedule() {
    if (this._busy) { this._pending = true; return; }
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._render());
  }

  _dev(d, room) {
    const st = this._hass?.states[d.entity];
    const type = d.type || DOMAIN_TYPE[d.entity.split('.')[0]] || 'switch';
    return {...d, type, st, room, name: d.name || st?.attributes.friendly_name || d.entity};
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
    if (x.type === 'shade') return s === 'open' || s === 'opening' || (x.st?.attributes.current_position > 0);
    if (x.type === 'media') return s === 'playing';
    return s === 'on';
  }

  _status(x) {
    const st = x.st;
    if (!st) return 'Not found';
    if (st.state === 'unavailable') return 'Unavailable';
    const a = st.attributes, u = this._unit();
    switch (x.type) {
      case 'light': return st.state === 'on' ? (a.brightness != null ? `On · ${Math.round(a.brightness / 2.55)}%` : 'On') : 'Off';
      case 'switch': return cap(st.state);
      case 'fan': return st.state === 'on' ? (a.percentage != null ? `On · ${a.percentage}%` : 'On') : 'Off';
      case 'shade': return a.current_position != null && st.state !== 'closed' ? (a.current_position >= 100 ? 'Open' : `${a.current_position}% open`) : cap(st.state);
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
    }
    return {text: '', active: false};
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
      case 'cat': this._swap = 1; this._view = el.dataset.c; this._code = ''; this._msg = ''; break;
      case 'back': this._swap = -1; this._view = null; break;
      case 'scene': this._call('scene', 'turn_on', {entity_id: el.dataset.e}).then(() => this._toast(`${el.dataset.n} is on`)); return;
      case 'goodnight': this._goodNight(); return;
      case 'all': this._all(el.dataset.v === 'on'); return;
      case 'toggle': this._call('homeassistant', 'toggle', {entity_id: id}); return;
      case 'fan': +el.dataset.v ? this._call('fan', 'set_percentage', {entity_id: id, percentage: +el.dataset.v}) : this._call('fan', 'turn_off', {entity_id: id}); return;
      case 'cover': this._call('cover', el.dataset.v, {entity_id: id}); return;
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
    const L = this._devices(this._view), ids = t => L.filter(x => x.type === t && x.st && x.st.state !== 'unavailable').map(x => x.entity);
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
    const ids = t => all.filter(x => x.type === t && x.st).map(x => x.entity);
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
    const st = x.st, a = st?.attributes || {}, id = esc(x.entity), dead = !st || st.state === 'unavailable';
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
      body = `${c.layout === 'touchscreen' ? '' : '<div class="head"><button class="ibtn" data-a="back" aria-label="Back"><ha-icon icon="mdi:chevron-left"></ha-icon></button></div>'}<dashboard-studio-vehicle class="hub-car"></dashboard-studio-vehicle>`;
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
      const cats = CATS.filter(([k]) => k === 'car' ? this._carHere() : this._devices(k).length);
      const quick = (c.good_night !== false ? `<button class="gn" data-a="goodnight"><ha-icon icon="mdi:weather-night"></ha-icon><span><b>Good night</b><small>Lights off, lock up and settle in</small></span></button>` : '') +
        c.scenes.map(s => { const on = this._hass.states[s.entity]; return `<button class="scene" data-a="scene" data-e="${esc(s.entity)}" data-n="${esc(s.name || on?.attributes.friendly_name || s.entity)}"><ha-icon icon="${esc(s.icon || on?.attributes.icon || 'mdi:palette')}"></ha-icon>${esc(s.name || on?.attributes.friendly_name || s.entity)}</button>`; }).join('');
      body = `${quick ? `<div class="quick">${quick}</div>` : ''}
        ${cats.length ? `<div class="tiles">${cats.map(([k, label, icon]) => { const s = this._catStatus(k);
          return `<button class="tile${s.active ? ' on' : ''}${s.warn ? ' warn' : ''}" data-a="cat" data-c="${k}"><span class="t-ico"><ha-icon icon="${icon}"></ha-icon></span><b>${label}</b><span>${esc(s.text)}</span></button>`; }).join('')}</div>`
        : '<p class="hint">No devices in this room yet.</p>'}`;
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
      this._paint(`<style>${STYLE}${TOUCH_STYLE}</style><ha-card class="${cls}" style="--t-op:${op}%;--t-rr:${rad}px">${top}${menu}<div class="ts-body">${body}</div><div class="ts-bottom">${clock}${wx}</div>${night}${flash}</ha-card>`);
      return;
    }
    this._paint(`<style>${STYLE}</style><ha-card class="${[c.calm ? 'calm' : '', this._ic()].filter(Boolean).join(' ')}">${title}${chips}${body}${night}${flash}</ha-card>`);
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
    if (veh) { veh.setConfig({...this._carCfg(), bare: true, calm: !!this._config.calm}); veh.hass = this._hass; }
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
    const tiles = TOUCH.filter(([k]) => k === 'quick' ? (c.scenes.length || c.good_night !== false) : k === 'car' ? this._carHere() : this._devices(k).length).map(([k, label, icon]) => {
      let s;
      if (k === 'quick') s = {text: c.scenes.length ? `${c.scenes.length} scene${c.scenes.length === 1 ? '' : 's'}` : 'Good night', active: false};
      else if (k === 'watch' || k === 'listen') { const p = this._devices(k).find(x => x.st?.state === 'playing'); s = {text: p ? `Playing · ${p.name}` : 'Off', active: !!p}; }
      else s = this._catStatus(k);
      const temps = k === 'climate' ? this._devices('climate').map(x => x.st?.attributes.current_temperature).filter(v => v != null) : [];
      const ci = k === 'car' ? this._carInfo() : null;
      if (ci) label = esc(this._carCfg().name || this._hass.states[this._carE.battery]?.attributes.friendly_name?.replace(/ battery( level)?$/i, '') || label);
      const ico = ci && ci.bat != null ? `<span class="ts-ring${ci.chg ? ' chg' : ''}"><b>${ci.bat}</b></span>` : temps.length ? `<span class="ts-ring"><b>${Math.round(temps.reduce((a, v) => a + v, 0) / temps.length)}</b></span>` : `<span class="ts-ico"><ha-icon icon="${icon}"></ha-icon></span>`;
      return `<button class="ts-tile${s.active ? ' on' : ''}${s.warn ? ' warn' : ''}" data-a="cat" data-c="${k}">${ico}<span class="ts-l">${label}</span><span class="ts-s">${esc(s.text)}</span></button>`;
    }).join('');
    return this._nowPlaying() + (tiles ? `<div class="ts-tiles">${tiles}</div>` : '<p class="hint">No devices in this room yet.</p>');
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
.hub-car{display:block;--primary-text-color:var(--s-text);--secondary-text-color:var(--s-muted)}
.ts-ring.chg{border-color:#4ade80;box-shadow:0 0 16px rgba(74,222,128,.45)}
.fxl{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:var(--ha-card-border-radius,12px);z-index:9}
ha-card.tap-press :is(button,.row):active{transform:scale(.94);transition:transform .08s}
ha-card.tap-press button{transition:transform .2s cubic-bezier(.3,1.6,.5,1)}
ha-card.ic-soft{--s-active:var(--s-text);--s-active-ink:var(--ico-ink,var(--card-background-color,var(--primary-background-color,#fff)))}
ha-card.ic-accent{--s-active:var(--s-accent);--s-active-ink:var(--s-on)}
ha-card.ic-warm{--s-active:var(--state-light-active-color,#ffc94d);--s-active-ink:#3a2a00}
:host{--s-text:var(--primary-text-color,#1c1c1c);--s-muted:var(--secondary-text-color,#6b6b6b);--s-accent:var(--primary-color,#03a9f4);
  --s-on:var(--text-primary-color,#fff);--s-active:var(--s-text);--s-active-ink:var(--ico-ink,var(--card-background-color,var(--primary-background-color,#fff)));--s-r:var(--ha-card-border-radius,12px);
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

class DashboardStudioFx extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._t = 0; this._last = 0; this._anims = []; this._glowed = new Set();
    this._onMove = e => this._tilt(e);
    this._onLeave = () => this._untilt();
    this._onResize = () => { clearTimeout(this._rt); this._rt = setTimeout(() => this._start(true), 150); };
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
    if (this.isConnected) this._start(true);
  }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
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
      <span>${esc(FX_NAMES[this._config.background])}${fx.length ? ' · ' + esc(fx.join(', ')) : ''}. This card is hidden outside edit mode.</span></div></ha-card>` : '';
  }

  connectedCallback() {
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('pointermove', this._onMove, {passive: true});
    document.addEventListener('pointerleave', this._onLeave);
    document.addEventListener('pointerdown', this._onTap, {capture: true, passive: true});
    this._start(true);
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
    cancelAnimationFrame(this._raf); this._raf = 0;
    this._canvas?.remove(); this._canvas = null;
    if (this._restoreBg !== undefined) { document.documentElement.style.removeProperty('--lovelace-background'); this._restoreBg = undefined; }
    this._anims.forEach(a => a.cancel()); this._anims = [];
    this._untilt();
    this._glowed.forEach(c => { c.style.removeProperty('box-shadow'); }); this._glowed.clear();
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

/* side view of a car, drawn like the Tesla app: paint color, open lids, charging, climate and sentry */
const CAR_SHAPES = {
  sedan: {body: 'M22 112 C20 100 28 92 46 89 L112 80 C138 62 168 50 206 49 C246 48 276 58 306 76 L352 83 C372 86 382 95 382 108 L382 116 C382 121 378 124 372 124 L30 124 C25 124 22 120 22 116 Z',
    glass: 'M126 80 C150 61 176 53 206 52 C240 51 266 60 296 77 Z', pillar: [212, 53, 79], belt: 'M48 94 C150 89 262 89 370 95',
    hood: 'M306 76 L352 83 C368 85 377 91 380 99', hoodAt: [306, 76], trunk: 'M112 80 L46 89 C34 91 27 96 24 103', trunkAt: [112, 80],
    wheels: [[100, 122], [306, 122]], r: 24, head: 'M362 93 L381 100', tail: 'M23 103 L42 97', port: [38, 100], eye: [214, 62], air: [140, 56, 150, 22],
    mirror: 'M284 78 L296 71 L304 73 L302 79 Z', handles: [[168, 92], [252, 92]], rocker: [62, 344, 117]},
  suv: {body: 'M22 112 C20 98 30 89 48 86 L108 76 C134 52 168 39 210 38 C252 38 284 50 312 72 L354 80 C373 84 382 93 382 107 L382 116 C382 121 378 124 372 124 L30 124 C25 124 22 120 22 116 Z',
    glass: 'M128 76 C152 54 180 45 210 45 C244 45 270 55 296 72 Z', pillar: [214, 46, 75], belt: 'M48 91 C150 86 262 86 372 92',
    hood: 'M312 72 L354 80 C370 83 378 90 381 98', hoodAt: [312, 72], trunk: 'M108 76 L48 86 C36 88 28 93 25 100', trunkAt: [108, 76],
    wheels: [[100, 122], [308, 122]], r: 25, head: 'M364 90 L381 97', tail: 'M24 99 L44 94', port: [38, 97], eye: [216, 51], air: [136, 46, 156, 26],
    mirror: 'M290 73 L302 66 L310 68 L308 74 Z', handles: [[170, 89], [256, 89]], rocker: [62, 345, 117]},
  cyber: {body: 'M20 108 L28 90 L204 34 L384 78 L386 110 L382 124 L24 124 Z',
    glass: 'M150 62 L204 43 L280 61 L274 70 L156 71 Z', pillar: [214, 46, 71], belt: 'M30 96 L382 92',
    hood: 'M280 61 L384 78', hoodAt: [280, 61], trunk: 'M120 61 L28 90', trunkAt: [120, 61],
    wheels: [[96, 121], [314, 121]], r: 25, head: 'M372 80 L386 82', tail: 'M22 96 L40 92', port: [34, 98], eye: [216, 50], air: [156, 46, 120, 24],
    mirror: 'M272 66 L284 60 L290 62 L288 68 Z', handles: [[176, 86], [258, 86]], rocker: [60, 350, 116]}
};
const CAR_MODELS = {model_3: 'sedan', model_s: 'sedan', model_y: 'suv', model_x: 'suv', cybertruck: 'cyber', sedan: 'sedan', suv: 'suv', truck: 'cyber'};
const CAR_PAINT = {pearl_white: '#eef0f2', solid_black: '#141518', midnight_silver: '#3e4247', stealth_grey: '#5b5f64', quicksilver: '#b9bdc3', deep_blue: '#1f3b70', ultra_red: '#a5121d', stainless: '#a7abb0'};
const carMix = (hex, to, t) => {
  const p = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, x => x + x); const n = parseInt(h, 16); return isNaN(n) ? [217, 220, 225] : [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const a = p(CAR_PAINT[hex] || hex), b = p(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
};
function carSVG(o, uid) {
  const s = CAR_SHAPES[CAR_MODELS[o.model] || o.model] || CAR_SHAPES.suv, c = o.color || '#d9dce1', id = 'car' + uid;
  /* aero style wheels: a tire, a metallic cover with five curved vents, and a center cap */
  const wheel = ([x, y]) => `<circle cx="${x}" cy="${y}" r="${s.r + 5}" fill="#07080a"/><circle cx="${x}" cy="${y}" r="${s.r}" fill="#141518"/>`
    + `<circle cx="${x}" cy="${y}" r="${(s.r * .72).toFixed(1)}" fill="url(#${id}rim)" stroke="#2b2e33" stroke-width="1"/>`
    + [0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${(y - s.r * .4).toFixed(1)}" rx="${(s.r * .17).toFixed(1)}" ry="${(s.r * .1).toFixed(1)}" fill="#1a1c20" transform="rotate(${a + 18} ${x} ${y})"/>`).join('')
    + `<circle cx="${x}" cy="${y}" r="${(s.r * .16).toFixed(1)}" fill="#24262b" stroke="#8d939b" stroke-width=".8"/><circle cx="${x - s.r * .25}" cy="${y - s.r * .3}" r="${(s.r * .5).toFixed(1)}" fill="#fff" opacity=".06"/>`;
  const [ax, ay, aw, ah] = s.air, airC = o.climate === 'heat' ? '#ff9a5c' : '#7cc8ff';
  const waves = [0, 1, 2].map(i => { const y = ay + ah * (.35 + i * .25); let d = `M${ax} ${y.toFixed(1)}`; for (let x = 0; x < aw; x += 24) d += ' q 6 -5 12 0 t 12 0'; return `<path class="car-air" d="${d}" stroke="${airC}" style="animation-delay:${i * .5}s"/>`; }).join('');
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
  return `<svg class="${cls}" viewBox="${chg ? '-80 0 480 154' : '0 0 400 154'}" role="img" aria-label="${o.label || 'Car'}">
    <defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${carMix(c, '#ffffff', .3)}"/><stop offset=".45" stop-color="${carMix(c, '#ffffff', 0)}"/><stop offset="1" stop-color="${carMix(c, '#000000', .42)}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2e3946"/><stop offset=".55" stop-color="#0e1218"/><stop offset="1" stop-color="#1b232d"/></linearGradient>
      <radialGradient id="${id}rim" cx=".4" cy=".35"><stop offset="0" stop-color="#d4d8dd"/><stop offset=".6" stop-color="#8c9199"/><stop offset="1" stop-color="#4b4f56"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".32" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset=".82" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c"><path d="${s.glass}"/></clipPath></defs>
    <ellipse cx="200" cy="146" rx="186" ry="7" fill="#000" opacity=".38"/>
    ${cable}
    <path d="${s.body}" fill="url(#${id}b)"/>
    <path d="${s.body}" fill="url(#${id}s)"/>
    <path d="M${s.rocker[0]} ${s.rocker[2]} L${s.rocker[1]} ${s.rocker[2]} L${s.rocker[1] - 4} 124 L${s.rocker[0] + 4} 124 Z" fill="#000" opacity=".28"/>
    <path d="${s.belt}" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" fill="none"/>
    <path d="${s.glass}" fill="url(#${id}g)" stroke="#0a0c10" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${s.mirror}" fill="${carMix(c, '#000000', .2)}" stroke="#0a0c10" stroke-width="1"/>
    ${s.handles.map(([x, y]) => `<rect x="${x}" y="${y}" width="18" height="2.6" rx="1.3" fill="#000" opacity=".3"/><rect x="${x}" y="${y - .6}" width="18" height="1.2" rx=".6" fill="#fff" opacity=".35"/>`).join('')}
    <g clip-path="url(#${id}c)" fill="none" stroke-width="2" stroke-linecap="round">${waves}<path d="${s.glass}" fill="#fff" opacity=".06" transform="translate(-30 -6)"/></g>
    <line x1="${s.pillar[0]}" y1="${s.pillar[1]}" x2="${s.pillar[0]}" y2="${s.pillar[2]}" stroke="${carMix(c, '#000000', .5)}" stroke-width="5"/>
    <line x1="${s.pillar[0]}" y1="${s.pillar[2]}" x2="${s.pillar[0] - 4}" y2="118" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>
    ${o.frunk ? `<path d="${s.hood}" stroke="#000" stroke-opacity=".55" stroke-width="3" fill="none"/>` : ''}${o.trunk ? `<path d="${s.trunk}" stroke="#000" stroke-opacity=".55" stroke-width="3" fill="none"/>` : ''}
    <path class="car-lid hood${o.frunk ? ' open' : ''}" d="${s.hood}" style="transform-origin:${s.hoodAt[0]}px ${s.hoodAt[1]}px" stroke="${carMix(c, '#ffffff', .35)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path class="car-lid trunk${o.trunk ? ' open' : ''}" d="${s.trunk}" style="transform-origin:${s.trunkAt[0]}px ${s.trunkAt[1]}px" stroke="${carMix(c, '#ffffff', .35)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="${s.head}" stroke="#0a0c10" stroke-width="6" stroke-linecap="round"/><path class="car-head" d="${s.head}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="${s.tail}" stroke="#2a0507" stroke-width="6" stroke-linecap="round"/><path class="car-tail" d="${s.tail}" stroke-width="2.6" stroke-linecap="round"/>
    <circle class="car-port${o.port || o.charging ? ' open' : ''}" cx="${px}" cy="${py}" r="3.6"/>
    <circle class="car-eye" cx="${s.eye[0]}" cy="${s.eye[1]}" r="3.4"/>
    ${s.wheels.map(wheel).join('')}
  </svg>`;
}

/* the car: your own picture if you set one, otherwise the drawing. Charging, sentry and climate show on both */
function carVisual(o, uid) {
  if (!o.image) return carSVG(o, uid);
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
 *   model: model_y            # model_3, model_s, model_x, model_y or cybertruck
 *   color: pearl_white        # a paint name, or any color like '#a5121d'
 *   device: <device id>       # optional: which car, when you have more than one (the visual editor lists them)
 *   charger: auto             # auto, supercharger, wall_connector or none: drawn next to the car while it charges
 *   vehicle: my_model_y       # optional: the car's name in its entity IDs
 *   image: /local/my-car.png  # optional: your own picture instead of the drawing
 *   model_url: /local/tesla/model_y.glb   # optional: a real 3D car you made with Tesla Model Extractor
 *   tesla_view: false         # optional: when Tesla View is installed the card shows it; false keeps the drawing
 *   tesla_view_look: dark     # dark blends Tesla View into the card; light is the app's light mode
 *   tesla_view_brightness: 1.25
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
  fast_charger: [/^binary_sensor\..*_fast_charger(_present)?$/, /^sensor\..*_fast_charger_(type|brand)$/],
  location: [/^device_tracker\..*_location$/, /^device_tracker\./]
};
const VEH_PLATFORMS = ['tesla_fleet', 'teslemetry', 'tessie', 'tesla_custom', 'mytesla', 'tesla'];

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
      const bat = ids.find(id => /^sensor\..*_battery_level$/.test(id) && ids.some(x => x.startsWith('lock.' + id.split('.')[1].replace(/_battery_level$/, ''))));
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
/* Tesla View's card can load after this one, so wait for it for a little while */
const teslaViewCard = () => Promise.race([customElements.whenDefined('tesla-view-card').then(() => true), new Promise(ok => setTimeout(() => ok(false), 20000))]);

class DashboardStudioVehicle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._uid = Math.random().toString(36).slice(2, 8);
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
  }

  static getStubConfig() { return {model: 'model_y', color: 'pearl_white'}; }
  static getConfigElement() { return document.createElement('dashboard-studio-vehicle-editor'); }

  setConfig(config) { this._modelSet = !!config?.model; this._config = {model: 'model_y', color: 'pearl_white', ...config}; this._e = null; this._render(); }

  connectedCallback() { clearTimeout(this._drop); }
  /* free the 3D view when the card goes away for good */
  disconnectedCallback() { clearTimeout(this._drop); this._drop = setTimeout(() => { this._3d?.dispose(); this._3d = null; }, 1500); }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    if (this._tv) this._tv.hass = hass;
    if (!this._e || old?.entities !== hass.entities) {
      this._e = findVehicle(hass, this._config);
      const dev = this._config.device || hass.entities?.[this._e.battery]?.device_id, k = carKey(hass.devices?.[dev]?.model);
      if (!this._modelSet && k) this._config = {...this._config, model: k};
    }
    if (!old || Object.values(this._e).some(id => old.states[id] !== hass.states[id])) this._render();
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
    return lock ? `${where} · ${lock === 'locked' ? 'Locked' : 'Unlocked'}` : where;
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
    if (['frunk', 'trunk', 'charge_port'].includes(k)) return call('cover', st?.state === 'open' ? 'close_cover' : 'open_cover', {entity_id: id});
  }

  _toast(msg) { this._msg = msg; this._render(); clearTimeout(this._mt); this._mt = setTimeout(() => { this._msg = ''; this._render(); }, 3000); }

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
    const open = k => this._s(k)?.state === 'open';
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
      btn('sentry', 'mdi:shield-car', 'Sentry', this._s('sentry')?.state === 'on')
    ].join('');
    const u = h.config?.unit_system?.temperature || '°', temp = v => v == null ? '' : `${Math.round(v)}${u.replace(/[CF]$/, '')}`;
    const info = [inT != null ? `Inside ${temp(inT)}` : '', outT != null ? `Outside ${temp(outT)}` : ''].filter(Boolean).join(' · ');
    this.shadowRoot.innerHTML = `<style>${VEH_STYLE}${CAR_STYLE}</style><ha-card class="${[c.calm ? 'calm' : '', c.bare ? 'bare' : ''].filter(Boolean).join(' ')}">
      <div class="v-top"><button class="v-name" data-a="more"><b>${esc(name)}</b><span>${esc(this._status())}</span></button>
        ${bat != null ? `<div class="v-bat${chg ? ' chg' : ''}"><b>${Math.round(bat)}</b>%${chg ? '<ha-icon icon="mdi:lightning-bolt"></ha-icon>' : ''}</div>` : ''}</div>
      <div class="v-car">${car}</div>
      ${bat != null ? `<div class="v-range"><div class="v-bar${chg ? ' chg' : ''}"><i style="width:${Math.max(2, Math.min(100, bat))}%"></i>${lim ? `<em style="left:${lim}%"></em>` : ''}</div>
        <div class="v-rl"><span>${rng ? `${esc(Math.round(parseFloat(rng.state)) || rng.state)} ${esc(rng.attributes.unit_of_measurement || '')}` : ''}</span><span>${esc(chgText)}</span></div></div>` : ''}
      ${ctl ? `<div class="v-ctl">${ctl}</div>` : ''}
      ${info ? `<div class="v-info">${esc(info)}</div>` : ''}
      ${this._msg ? `<div class="v-msg" role="status">${esc(this._msg)}</div>` : ''}</ha-card>`;
    const tvSlot = useTv && this.shadowRoot.querySelector('[data-tv]');
    if (tvSlot) {
      /* hand Tesla View the car's device, plus every entity this card found, so it maps the same things.
         While the car charges, its charging camera shows the charge cable from the app */
      const own = typeof c.tesla_view === 'object' ? c.tesla_view : {}, cam = own.camera || (chg ? 'charging' : 'parked');
      if (!this._tv || this._tvCam !== cam) {
        const e = this._e, dev = c.device || h.entities?.[e.battery]?.device_id || h.entities?.[e.lock]?.device_id;
        /* tell Tesla View which car: its own setting, else the car's device model, else the model picked here */
        const tvModel = own.model || tvModelFor(carKey(h.devices?.[dev]?.model)) || tvModelFor(carKey(c.model));
        const ents = Object.fromEntries([['frunk', e.frunk], ['trunk', e.trunk], ['charge_port', e.charge_port], ['charging', e.charging], ['lock', e.lock]].filter(([, v]) => v));
        this._tv = this._tv || document.createElement('tesla-view-card');
        this._tv.setConfig({type: 'custom:tesla-view-card', ...(dev ? {device_id: dev} : {}), ...(tvModel ? {model: tvModel} : {}), entities: ents, hotspots: true,
          theme: c.tesla_view_look === 'light' ? 'light' : 'dark', aspect_ratio: '16:9', ...own, camera: cam});
        this._tvCam = cam;
      }
      this._tv.hass = h;
      /* Tesla View draws on a solid box: lift the car a little, and fade the box's edges into this card */
      const lift = Math.max(.6, Math.min(2, Number(c.tesla_view_brightness ?? 1.25) || 1.25));
      tvSlot.classList.toggle('blend', c.tesla_view_look !== 'light' && c.tesla_view_blend !== false);
      this._tv.style.filter = lift === 1 ? '' : `brightness(${lift})`;
      tvSlot.append(this._tv);
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
.v-msg{position:absolute;left:12px;right:12px;bottom:12px;background:#b3261e;color:#fff;border-radius:10px;padding:8px 12px;font-size:13px}
@keyframes vShine{to{background-position:-200% 0}}
ha-card.calm *{animation:none!important;transition:none!important}
ha-card.bare{background:none;box-shadow:none;border:none;padding:4px 0 0}
.v-3derr{font-size:12px}
.v-tv{margin:0 -6px}
.v-tv.blend tesla-view-card{-webkit-mask-image:radial-gradient(ellipse 62% 60% at 50% 52%,#000 62%,transparent 100%);mask-image:radial-gradient(ellipse 62% 60% at 50% 52%,#000 62%,transparent 100%)}
.v-tv tesla-view-card{display:block;--ha-card-background:transparent;--card-background-color:transparent;--ha-card-box-shadow:none;--ha-card-border-width:0}
`;

/* visual editor for the vehicle card */
class DashboardStudioVehicleEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }
  _render() {
    if (!this._config || !this._hass) return;
    if (!customElements.get('ha-form')) { this.innerHTML = '<p>Use the code editor to set up this card.</p>'; return; }
    if (!this._form) {
      this.innerHTML = '<p style="margin:0 0 12px;color:var(--secondary-text-color)">The card finds your car by itself. With more than one car, pick which one under Your car.</p>';
      const f = this._form = document.createElement('ha-form');
      const L = {tesla_view_look: 'Tesla View look', tesla_view_brightness: 'Tesla View brightness', name: 'Name', device: 'Your car', charger: 'Charger to show while charging', model: 'Model', color: 'Paint', vehicle: "Or: the car's name in its entity IDs (like my_model_y)", image: 'Car picture (optional, a link like /local/my-car.png)', model_url: '3D car from Tesla Model Extractor (optional, like /local/tesla/model_y.glb)', calm: 'Turn off animations'};
      f.computeLabel = s => L[s.name] || s.name;
      f.schema = [{name: 'device', selector: {device: {filter: ['tesla_fleet', 'teslemetry', 'tessie', 'tesla_custom'].map(integration => ({integration}))}}},
        {name: 'name', selector: {text: {}}}, {name: 'model', selector: opt(['model_3', 'Model 3'], ['model_y', 'Model Y'], ['model_s', 'Model S'], ['model_x', 'Model X'], ['cybertruck', 'Cybertruck'])},
        {name: 'color', selector: opt(...Object.keys(CAR_PAINT).map(k => [k, cap(k)]))}, {name: 'tesla_view_look', selector: opt(['dark', 'Blend into the card (app dark mode)'], ['light', 'Light (app light mode)'])},
        {name: 'tesla_view_brightness', selector: {number: {min: .6, max: 2, step: .05, mode: 'slider'}}},
        {name: 'charger', selector: opt(['auto', 'Find it by itself'], ['supercharger', 'Supercharger'], ['wall_connector', 'Wall Connector'], ['none', 'Only the cable'])},
        {name: 'vehicle', selector: {text: {}}}, {name: 'image', selector: {text: {}}}, {name: 'model_url', selector: {text: {}}}, {name: 'calm', selector: {boolean: {}}}];
      f.addEventListener('value-changed', e => {
        const next = {...e.detail.value}; Object.keys(next).forEach(k => { if (next[k] === '' || next[k] == null) delete next[k]; });
        this._config = next; this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: next}, bubbles: true, composed: true}));
      });
      this.appendChild(f);
    }
    this._form.hass = this._hass; this._form.data = {model: 'model_y', color: 'pearl_white', ...this._config};
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

if (!customElements.get('dashboard-studio-hub')) customElements.define('dashboard-studio-hub', DashboardStudioHub);
if (!customElements.get('dashboard-studio-dual-shade')) customElements.define('dashboard-studio-dual-shade', DashboardStudioDualShade);
if (!customElements.get('dashboard-studio-fx')) customElements.define('dashboard-studio-fx', DashboardStudioFx);
if (!customElements.get('dashboard-studio-vehicle')) customElements.define('dashboard-studio-vehicle', DashboardStudioVehicle);
if (!customElements.get('dashboard-studio-vehicle-editor')) customElements.define('dashboard-studio-vehicle-editor', DashboardStudioVehicleEditor);
if (!customElements.get('dashboard-studio-hub-editor')) customElements.define('dashboard-studio-hub-editor', DashboardStudioHubEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'dashboard-studio-hub')) {
  window.customCards.push({type: 'dashboard-studio-hub', name: 'Dashboard Studio hub', description: 'Touchscreen-style home screen with rooms, device tiles, scenes, an alarm keypad and a Good night button.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-dual-shade')) {
  window.customCards.push({type: 'dashboard-studio-dual-shade', name: 'Dashboard Studio dual shade', description: 'One window, two shade motors: day/night honeycomb or top down, bottom up. With Open, Day and Night presets.', preview: false});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-vehicle')) {
  window.customCards.push({type: 'dashboard-studio-vehicle', name: 'Dashboard Studio vehicle', description: 'Tesla app style car card: your car in its paint color, battery and range, charging, and lock, climate, frunk, trunk, charge port and sentry controls.', preview: true});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-fx')) {
  window.customCards.push({type: 'dashboard-studio-fx', name: 'Dashboard Studio effects', description: 'Moving backgrounds (including live weather) and card effects for the whole view. Invisible outside edit mode.', preview: false});
}
console.info(`%c DASHBOARD STUDIO %c ${STUDIO_VERSION} `, 'background:#4352f0;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#15171c;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px');
