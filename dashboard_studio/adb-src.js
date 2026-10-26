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
// │   file     : adb-src.js                              │
// │   author   : Patrick (and the interns)               │
// │   hatched  : 2026-10-26                              │
// │   license  : Muscovy Public License (joke, see       │
// │              LICENSE file for the real one)          │
// │   status   : no ducks harmed. all fed. one is        │
// │              sitting on the keyboard.                │
// │                                                      │
// ╰──────────────────────────────────────────────────────╯

import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

const fail = (code, message) => Object.assign(new Error(message || code), {code});

/* copy an installed app's APK files off a phone over USB. onFile(name, size, stream) gets each file */
async function pullApp(pkg, onStatus, onFile) {
  const M = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!M) throw fail('no_webusb');
  onStatus('pick');
  const device = await M.requestDevice();
  if (!device) throw fail('no_device');
  let connection;
  try { connection = await device.connect(); }
  catch (e) { throw fail('busy', e?.message); }
  onStatus('allow');
  const transport = await AdbDaemonTransport.authenticate({serial: device.serial, connection, credentialStore: new AdbWebCredentialStore('Dashboard Studio')});
  const adb = new Adb(transport);
  try {
    onStatus('find');
    const out = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'path', pkg]);
    const paths = out.split('\n').map(l => l.trim()).filter(l => l.startsWith('package:')).map(l => l.slice(8));
    if (!paths.length) throw fail('not_installed');
    const sync = await adb.sync();
    try {
      for (const p of paths) {
        const st = await sync.stat(p);
        await onFile(p.split('/').pop(), Number(st.size), sync.read(p));
      }
    } finally { await sync.dispose(); }
    return {device: device.name || device.serial, files: paths.length};
  } finally { await adb.close(); }
}
window.StudioAdb = {supported: () => !!AdbDaemonWebUsbDeviceManager.BROWSER && window.isSecureContext, pullApp};
