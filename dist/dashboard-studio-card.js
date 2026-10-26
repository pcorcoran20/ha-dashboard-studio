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
const STUDIO_VERSION = '0.1.0';

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

if (!customElements.get('dashboard-studio-hub')) customElements.define('dashboard-studio-hub', DashboardStudioHub);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'dashboard-studio-hub')) {
  window.customCards.push({type: 'dashboard-studio-hub', name: 'Dashboard Studio hub', description: 'Touchscreen-style home screen with rooms, device tiles, scenes, an alarm keypad and a Good night button.', preview: false});
}
console.info(`%c DASHBOARD STUDIO %c ${STUDIO_VERSION} `, 'background:#4352f0;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px', 'background:#15171c;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px');
