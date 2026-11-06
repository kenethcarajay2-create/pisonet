const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv/config');
let gate = null;
let timer = null;
let switching = false;
const apiUrl = (process.env.PISONET_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const token = process.env.PISONET_DEVICE_TOKEN || '';
const isDev = !app.isPackaged;
const statePath = () => path.join(app.getPath('userData'), 'session.json');
function readState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { return null; } }
function saveState(value) { fs.writeFileSync(statePath(), JSON.stringify(value)); }
function isActive(s) { return !!s && ((s.type === 'admin' && s.mode === 'open') || (s.expiresAt && new Date(s.expiresAt).getTime() > Date.now())); }
async function api(route, method = 'GET', body) {
  if (token.length < 32) throw new Error('Configure PISONET_DEVICE_TOKEN in windows-client/.env');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(apiUrl + route, {
      method, headers: { 'content-type': 'application/json', 'x-device-token': token },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || `Server error ${response.status}`);
    return json;
  } finally { clearTimeout(timeout); }
}
function loadPage(win, page) {
  if (isDev) return win.loadURL(`http://127.0.0.1:5174/#/${page}`);
  return win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: `/${page}` });
}
function showGate() {
  if (timer && !timer.isDestroyed()) { timer.close(); timer = null; }
  if (!gate || gate.isDestroyed()) {
    gate = new BrowserWindow({ width: 900, height: 620, fullscreen: true, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    gate.on('closed', () => { gate = null; });
    loadPage(gate, 'gate');
  } else gate.show();
}
function showTimer() {
  if (gate && !gate.isDestroyed()) { gate.close(); gate = null; }
  if (!timer || timer.isDestroyed()) {
    const area = screen.getPrimaryDisplay().workArea;
    timer = new BrowserWindow({ width: 270, height: 145, x: area.x + area.width - 285, y: area.y + 10,
      frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    timer.on('closed', () => { timer = null; });
    loadPage(timer, 'timer');
  }
}
async function getSession() {
  try {
    const remote = await api('/device/session');
    saveState(remote.session);
    return remote.session;
  } catch (e) {
    const local = readState();
    if (isActive(local)) return local; // Demo offline fallback; not secure authorization.
    throw e;
  }
}
async function syncWindows() {
  if (switching) return;
  switching = true;
  try { const session = await getSession(); if (isActive(session)) showTimer(); else showGate(); }
  catch { showGate(); }
  finally { switching = false; }
}
app.whenReady().then(async () => {
  ipcMain.handle('pisonet:session', async () => ({ session: await getSession() }));
  ipcMain.handle('pisonet:redeem', async (_event, code) => {
    if (typeof code !== 'string' || code.length > 100) throw new Error('Invalid code');
    const result = await api('/device/redeem', 'POST', { code });
    saveState(result.session); showTimer(); return result;
  });
  ipcMain.handle('pisonet:adminStart', async (_event, details) => {
    if (!details || typeof details.password !== 'string' || details.password.length > 256) throw new Error('Invalid password');
    const result = await api('/device/admin/start', 'POST', details);
    saveState(result.session); showTimer(); return result;
  });
  ipcMain.handle('pisonet:adminEnd', async () => {
    const result = await api('/device/admin/end', 'POST', {});
    saveState(result.session); showGate(); return result;
  });
  await syncWindows();
  setInterval(syncWindows, 15000);
});
