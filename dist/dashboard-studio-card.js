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
const STUDIO_VERSION = '0.4.0';

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
  ['fan', 'Fans', 'mdi:fan'], ['switch', 'Outlets', 'mdi:power-socket-us']
];
const catOf = t => (t === 'lock' || t === 'alarm') ? 'security' : t;
const ALARM_LABEL = {
  disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away', armed_night: 'Armed night',
  armed_vacation: 'Armed vacation', armed_custom_bypass: 'Armed', arming: 'Arming…', pending: 'Entry delay…',
  disarming: 'Disarming…', triggered: 'Alarm triggered!'
};
const GN_DEFAULT = {lights: true, switches: true, fans: false, shades: true, media: true, locks: true, alarm: true};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

class DashboardStudioHub extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._room = -1; this._view = null; this._code = ''; this._msg = ''; this._err = false; this._busy = false;
    this.shadowRoot.addEventListener('click', e => this._onClick(e));
    this.shadowRoot.addEventListener('change', e => this._onChange(e));
    this.shadowRoot.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) this._busy = true; });
    window.addEventListener('pointerup', () => { if (this._busy) { this._busy = false; if (this._pending) this._render(); } });
  }

  static getStubConfig() {
    return {title: 'My Home', rooms: [{name: 'Living Room', devices: []}]};
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.rooms) || !config.rooms.length) throw new Error('Add at least one room under "rooms".');
    this._config = {
      ...config,
      rooms: config.rooms.map(r => ({name: r.name || 'Room', devices: (r.devices || []).map(d => typeof d === 'string' ? {entity: d} : d).filter(d => d && d.entity)})),
      scenes: (config.scenes || []).map(s => typeof s === 'string' ? {entity: s} : s).filter(s => s && s.entity)
    };
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!old || this._watched().some(e => old.states[e] !== hass.states[e]) || old.themes !== hass.themes) this._schedule();
  }

  getCardSize() { return 8; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }

  connectedCallback() { this._tick = setInterval(() => { if (this._view === 'camera') this._render(); }, 10000); }
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
      r.devices.forEach(d => { const x = this._dev(d, r.name); if (!cat || catOf(x.type) === cat) out.push(x); });
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
    const el = e.target.closest('[data-a]'); if (!el || !this._hass) return;
    const a = el.dataset.a, id = el.dataset.e, x = id ? this._dev({entity: id, type: el.dataset.t}, '') : null;
    switch (a) {
      case 'room': this._room = +el.dataset.r; break;
      case 'cat': this._view = el.dataset.c; this._code = ''; this._msg = ''; break;
      case 'back': this._view = null; break;
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
    const el = e.target; if (!el.dataset.e || !this._hass) return;
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
    const chips = `<div class="chips">${[[-1, 'All rooms'], ...rooms.map((r, i) => [i, r.name])].map(([i, n]) => `<button class="chip${ri === i ? ' on' : ''}" data-a="room" data-r="${i}">${esc(n)}</button>`).join('')}</div>`;
    let body = '';
    if (!this._hass) body = '<p class="hint">Connecting to Home Assistant…</p>';
    else if (this._view && this._devices(this._view).length) {
      const cat = CATS.find(x => x[0] === this._view), L = this._devices(this._view);
      const all = {light: ['All on', 'All off'], fan: ['All on', 'All off'], switch: ['All on', 'All off'], shade: ['Open all', 'Close all'], security: ['Lock all', 'Unlock all']}[this._view];
      const alarms = L.filter(x => x.type === 'alarm'), rest = L.filter(x => x.type !== 'alarm');
      const rows = rest.length ? `<div class="list">${rest.map(x => this._row(x, ri < 0)).join('')}</div>` : '';
      body = `<div class="head"><button class="ibtn" data-a="back" aria-label="Back"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <div><div class="title">${cat[1]}</div><div class="sub">${ri >= 0 ? esc(rooms[ri].name) : 'All rooms'} · ${L.length} device${L.length === 1 ? '' : 's'}</div></div>
        ${all ? `<div class="all"><button class="pbtn" data-a="all" data-v="on">${all[0]}</button><button class="pbtn" data-a="all" data-v="off">${all[1]}</button></div>` : ''}</div>
        ${alarms.length ? `<div class="sec"><div class="kps">${alarms.map(x => this._keypad(x)).join('')}</div>${rows}</div>` : rows}`;
    } else {
      this._view = null;
      const cats = CATS.filter(([k]) => this._devices(k).length);
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
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card class="${c.calm ? 'calm' : ''}">${title}${chips}${body}${night}${flash}</ha-card>`;
  }
}

const STYLE = `
:host{--s-text:var(--primary-text-color,#1c1c1c);--s-muted:var(--secondary-text-color,#6b6b6b);--s-accent:var(--primary-color,#03a9f4);
  --s-on:var(--text-primary-color,#fff);--s-active:var(--state-light-active-color,var(--primary-color,#ffb300));--s-r:var(--ha-card-border-radius,12px);
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
.tile.on{background:color-mix(in srgb,var(--s-active) 22%,transparent);border-color:color-mix(in srgb,var(--s-active) 50%,transparent)}
.tile.on .t-ico{background:var(--s-active);color:var(--s-on)}
.tile.warn .t-ico{background:#ff9f40;color:#2a1600}
.head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.all{display:flex;gap:8px;margin-left:auto}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px 12px;padding:12px;border-radius:calc(var(--s-r)*.8);background:var(--s-soft);border:1px solid var(--s-line)}
.row.on{background:color-mix(in srgb,var(--s-active) 16%,transparent)}
.row.dead{opacity:.55}
.ico{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--s-soft2);border:0;flex:none}
.row.on .ico{background:var(--s-active);color:var(--s-on)}
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
.row.on .sw::after{transform:translateX(18px);background:var(--s-on)}
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
  }

  static getStubConfig() { return {background: 'aurora', strength: 70, card_effects: {float_in: true, light_glow: true}}; }

  setConfig(config) {
    const bg = config?.background ?? 'aurora';
    if (!FX_NAMES[bg]) throw new Error(`background must be one of: ${Object.keys(FX_NAMES).join(', ')}`);
    this._config = {strength: 70, speed: 1, layer: 'behind', ...config, background: bg,
      card_effects: {float_in: true, tilt: false, glowing_edges: false, light_glow: true, ...(config.card_effects || {})}};
    this._renderStub();
    if (this.isConnected) this._start(true);
  }

  set hass(hass) {
    const old = this._hass; this._hass = hass;
    const w = this._config?.weather_entity;
    if (!old || (w && old.states[w] !== hass.states[w])) this._start();
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
    this._start(true);
    clearTimeout(this._fit); this._fit = setTimeout(() => this._cardFx(true), 350);
    this._glowTick = setInterval(() => this._lightGlow(), 2000);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerleave', this._onLeave);
    clearInterval(this._glowTick); clearTimeout(this._fit);
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

if (!customElements.get('dashboard-studio-hub')) customElements.define('dashboard-studio-hub', DashboardStudioHub);
if (!customElements.get('dashboard-studio-dual-shade')) customElements.define('dashboard-studio-dual-shade', DashboardStudioDualShade);
if (!customElements.get('dashboard-studio-fx')) customElements.define('dashboard-studio-fx', DashboardStudioFx);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'dashboard-studio-hub')) {
  window.customCards.push({type: 'dashboard-studio-hub', name: 'Dashboard Studio hub', description: 'Touchscreen-style home screen with rooms, device tiles, scenes, an alarm keypad and a Good night button.', preview: false});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-dual-shade')) {
  window.customCards.push({type: 'dashboard-studio-dual-shade', name: 'Dashboard Studio dual shade', description: 'One window, two shade motors: day/night honeycomb or top down, bottom up. With Open, Day and Night presets.', preview: false});
}
if (!window.customCards.some(c => c.type === 'dashboard-studio-fx')) {
  window.customCards.push({type: 'dashboard-studio-fx', name: 'Dashboard Studio effects', description: 'Moving backgrounds (including live weather) and card effects for the whole view. Invisible outside edit mode.', preview: false});
}
console.info(`%c DASHBOARD STUDIO %c ${STUDIO_VERSION} `, 'background:#4352f0;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#15171c;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px');
