'use strict';
const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
if (!app.isPackaged) require('dotenv').config({ path: path.join(__dirname, '../.env') });
const isDev = !app.isPackaged;
const configDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pisonet-cloud');
const configPath = path.join(configDir, 'config.json');
const maintenancePath = path.join(configDir, 'maintenance.lock');
const TIMER_SIZES = { compact: [270,130], add: [270,218], peek: [54,82] };
const IDLE = { displaySeconds: 30, closeSeconds: 300, shutdownSeconds: 600, shutdownGraceSeconds: 60 };
const hasLock = app.requestSingleInstanceLock();
let gate = null, timer = null, maintenance = null;
let switching = false, authorizedQuit = false, exitInProgress = false;
let syncInterval = null, idleMonitor = null, idleBuffer = '';
let lockMode = false, idleEnabled = false, lastIdle = 0;
let displayDone = false, closeDone = false, shutdownScheduled = false;
let lockStartedAt = Date.now();
let taskbarChild = null, desiredTaskbarAction = 'show', taskbarAppliedAction = null;
let taskbarRefreshInterval = null;
let maintenanceWasLocked = false;
let audioChild = null, desiredAudio = null;
let displayOffCooldownUntil = 0;
let lastGateFocusAttempt = 0;
let gateFocusTimer = null;
let lastKnownSession = null;
let syncInFlight = false;
const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
function helperPath(file) {
  const original = path.join(__dirname, file);
  return app.isPackaged ? original.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep) : original;
}
function readConfig() { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return {}; } }
function getApiConfig() { const c = readConfig(); return { apiUrl: String(c.apiUrl || process.env.PISONET_API_URL || 'https://pisonet-3.onrender.com/api').replace(/\/+$/, ''), token: String(c.deviceToken || process.env.PISONET_DEVICE_TOKEN || '').trim() }; }
const statePath = () => path.join(app.getPath('userData'), 'session.json');
function readState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { return null; } }
function saveState(s) { fs.mkdirSync(path.dirname(statePath()), { recursive:true }); fs.writeFileSync(statePath(), JSON.stringify(s)); }
function isActive(s) { return !!s && ((s.type === 'admin' && s.mode === 'open') || (s.expiresAt && new Date(s.expiresAt).getTime() > Date.now())); }
function runPS(file, args = []) {
  const child = spawn(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helperPath(file), ...args], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
  child.stderr.on('data', d => console.error(`[${file}] ${String(d).trim()}`));
  child.on('error', e => console.error(`[${file}] ${e.message}`));
  return child;
}
// Keep exactly one taskbar command running. A newer desired state always wins.
// The old implementation queued stale callbacks and could finish with 'hide'
// after a paid session had already requested 'show'.
function applyTaskbar(force = false) {
  if (process.platform !== 'win32') return;
  if (taskbarChild) return;
  const action = desiredTaskbarAction;
  if (!force && taskbarAppliedAction === action) return;
  const file = helperPath('taskbar-helper.ps1');
  if (!fs.existsSync(file)) {
    console.error('Taskbar helper missing:', file);
    taskbarAppliedAction = null;
    return;
  }
  const child = runPS('taskbar-helper.ps1', ['-Action', action]);
  taskbarChild = child;
  let completed = false;
  const finish = (success) => {
    if (completed) return;
    completed = true;
    if (taskbarChild === child) taskbarChild = null;
    taskbarAppliedAction = success ? action : null;
    // If the state changed while PowerShell ran, immediately apply the new one.
    if (desiredTaskbarAction !== action) applyTaskbar(true);
  };
  child.once('exit', code => {
    if (code !== 0) console.error(`Taskbar ${action} failed with exit code ${code}`);
    finish(code === 0);
  });
  child.once('error', () => finish(false));
}
// A SHOW command must finish before we unlock Windows or exit Electron.
// An asynchronous child can be terminated with its parent during app.quit().
function restoreTaskbarSync() {
  if (process.platform !== 'win32') return;
  desiredTaskbarAction = 'show';
  if (taskbarChild) {
    try { taskbarChild.kill(); } catch (error) { console.error('Cannot stop pending taskbar command:', error); }
    taskbarChild = null;
  }
  const file = helperPath('taskbar-helper.ps1');
  if (!fs.existsSync(file)) { console.error('Taskbar helper missing:', file); return; }
  const result = spawnSync(psExe,
    ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,'-Action','show'],
    { windowsHide:true, encoding:'utf8', timeout:10000 });
  if (result.error || result.status !== 0) {
    console.error('Synchronous taskbar restoration failed:', result.error || result.stderr || result.status);
    taskbarAppliedAction = null;
  } else taskbarAppliedAction = 'show';
}
function taskbar(action, force = false) {
  if (process.platform !== 'win32') return;
  if (action === 'show') { restoreTaskbarSync(); return; }
  desiredTaskbarAction = 'hide';
  applyTaskbar(force);
}

// Audio changes are serialized. Restore the original mute state only if we muted it.
function setLockedAudio(locked) {
  if (process.platform !== 'win32') return;
  const desired = locked ? 'lock' : 'unlock';
  if (desiredAudio === desired) return;
  desiredAudio = desired;
  const runNext = () => {
    if (audioChild || !desiredAudio) return;
    const action = desiredAudio;
    if (!fs.existsSync(helperPath('audio-helper.ps1'))) {
      console.error('Audio helper missing; audio unchanged'); return;
    }
    const child = runPS('audio-helper.ps1', ['-Action', action, '-StatePath', path.join(configDir, 'audio-state.json')]);
    audioChild = child;
    const done = () => {
      if (audioChild !== child) return;
      audioChild = null;
      if (desiredAudio !== action) runNext();
    };
    child.once('exit', done);
    child.once('error', done);
  };
  runNext();
}
function restoreAudioSync() {
  if (process.platform !== 'win32') return;
  desiredAudio = 'unlock';
  const file = helperPath('audio-helper.ps1');
  if (!fs.existsSync(file)) return;
  const result = spawnSync(psExe, ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file,
    '-Action','unlock','-StatePath',path.join(configDir,'audio-state.json')],
    {windowsHide:true,encoding:'utf8',timeout:8000});
  if (result.error || result.status !== 0) console.error('Audio restoration failed:',result.error || result.stderr || result.status);
}
function cancelShutdown() {
  if (!shutdownScheduled || process.platform !== 'win32') return;
  shutdownScheduled = false;
  const child = spawn('shutdown.exe', ['/a'], { windowsHide:true, stdio:'ignore' });
  child.on('error', e => console.error('Cannot cancel shutdown:', e.message));
}
function resetIdleActions() { displayDone = false; closeDone = false; lastIdle = 0; }
function setIdleEnabled(enabled) {
  if (idleEnabled === enabled) return;
  idleEnabled = enabled;
  lockStartedAt = Date.now();
  resetIdleActions();
  if (!enabled) cancelShutdown();
}
function setLockMode(locked) {
  if (lockMode === locked) return; // Never re-enter fullscreen or reapply device state on every 15s sync.
  lockMode = locked;
  setLockedAudio(locked);
  setIdleEnabled(locked && !(maintenance && !maintenance.isDestroyed()));
  taskbar(locked ? 'hide' : 'show');
}
function onIdleSeconds(seconds) {
  if (!idleEnabled || !lockMode || (maintenance && !maintenance.isDestroyed())) return;
  if (!Number.isFinite(seconds) || seconds < 0) return;
  // Never count inactivity that happened before the kiosk entered locked mode.
  seconds = Math.min(seconds, Math.floor((Date.now() - lockStartedAt) / 1000));
  // The monitor reads actual system idle time. Any new input resets all thresholds.
  if (seconds < lastIdle) { resetIdleActions(); cancelShutdown(); }
  lastIdle = seconds;
  if (seconds >= IDLE.displaySeconds && !displayDone && Date.now() >= displayOffCooldownUntil) {
    displayDone = true;
    displayOffCooldownUntil = Date.now() + 60000; // Prevent repeated monitor power transitions after wake.
    const file = helperPath('idle-actions.ps1');
    if (fs.existsSync(file)) runPS('idle-actions.ps1', ['-Action','display-off']);
  }
  if (seconds >= IDLE.closeSeconds && !closeDone) {
    closeDone = true;
    const names = readConfig().idleCloseApps;
    const safeNames = Array.isArray(names) ? names.filter(x => typeof x === 'string' && /^[a-zA-Z0-9_. -]{1,80}$/.test(x)).slice(0,30) : [];
    if (safeNames.length) runPS('idle-actions.ps1', ['-Action','close-apps','-NamesJson', JSON.stringify(safeNames)]);
  }
  if (seconds >= IDLE.shutdownSeconds && !shutdownScheduled) {
    shutdownScheduled = true;
    const child = spawn('shutdown.exe', ['/s','/t', String(IDLE.shutdownGraceSeconds), '/c', 'PisoNet idle shutdown. Move mouse or redeem a voucher to cancel.'], { windowsHide:true, stdio:'ignore' });
    child.on('error', e => { shutdownScheduled = false; console.error('Cannot schedule shutdown:', e.message); });
  }
}
function startIdleMonitor() {
  if (process.platform !== 'win32' || idleMonitor) return;
  if (!fs.existsSync(helperPath('idle-monitor.ps1'))) { console.error('Idle monitor helper missing'); return; }
  idleMonitor = runPS('idle-monitor.ps1');
  idleMonitor.stdout.on('data', data => {
    idleBuffer += data.toString();
    let newline;
    while ((newline = idleBuffer.indexOf('\n')) !== -1) {
      const line = idleBuffer.slice(0,newline).trim(); idleBuffer = idleBuffer.slice(newline+1);
      if (/^\d+$/.test(line)) onIdleSeconds(Number(line));
    }
  });
  idleMonitor.on('exit', () => { idleMonitor = null; if (!authorizedQuit && !app.isQuitting) setTimeout(startIdleMonitor, 3000); });
}
async function api(route, method='GET', body) {
  const { apiUrl, token } = getApiConfig();
  if (token.length < 32) throw new Error('PisoNet device token is missing. Configure ' + configPath);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(apiUrl+route, { method, headers:{'content-type':'application/json','x-device-token':token}, body:body===undefined?undefined:JSON.stringify(body), signal:controller.signal });
    const json = await response.json(); if (!response.ok) throw new Error(json.error || `Server error ${response.status}`); return json;
  } catch(e) { if (e.name==='AbortError') throw new Error('Server request timed out.'); throw e; }
  finally { clearTimeout(timeout); }
}
function loadPage(win,page) { return isDev ? win.loadURL(`http://127.0.0.1:5174/#/${page}`) : win.loadFile(path.join(__dirname,'../dist/index.html'), {hash:`/${page}`}); }
function isMaintenanceShortcut(input) { return input.type==='keyDown' && input.control && input.shift && input.alt && String(input.key||'').toLowerCase()==='q'; }
function isAltF4(input) { return input.type==='keyDown' && input.alt && String(input.key||'').toLowerCase()==='f4'; }
function protectWindow(win) {
  win.on('close', e => { if (!authorizedQuit && !switching) e.preventDefault(); });
  win.webContents.on('before-input-event', (e,input) => { if (isAltF4(input)) e.preventDefault(); if (isMaintenanceShortcut(input)) { e.preventDefault(); showMaintenance(); } });
}
function closeForSwitch(win) { if (!win || win.isDestroyed()) return; const prior=switching; switching=true; try { win.close(); } finally { switching=prior; } }
function resizeTimer(mode) {
  if (!timer || timer.isDestroyed() || !TIMER_SIZES[mode]) return;
  const area=screen.getDisplayMatching(timer.getBounds()).workArea; const [width,height]=TIMER_SIZES[mode]; const b=timer.getBounds();
  timer.setBounds({x:area.x+area.width-width,y:Math.max(area.y,Math.min(b.y,area.y+area.height-height)),width,height});
  timer.webContents.send('pisonet:timerMode',mode);
}
// Keep the voucher window in the topmost Windows z-order, including when a
// browser was fullscreen at the instant a voucher expired. Do not repeatedly
// toggle kiosk/fullscreen: that can cause the flashing reported during videos.
function raiseGate(forceFocus = false) {
  if (!lockMode || !gate || gate.isDestroyed() || authorizedQuit ||
      (maintenance && !maintenance.isDestroyed())) return;
  if (gate.isMinimized()) gate.restore();
  gate.setAlwaysOnTop(true, 'screen-saver');
  if (!gate.isVisible()) gate.show();
  if (!forceFocus) return;
  const now = Date.now();
  if (now - lastGateFocusAttempt < 1200) return;
  lastGateFocusAttempt = now;
  gate.moveTop();
  gate.focus();
}
function showGate() {
  if (lockMode && gate && !gate.isDestroyed()) { raiseGate(false); return; }
  if (timer && !timer.isDestroyed()) { closeForSwitch(timer); timer=null; }
  if (!gate || gate.isDestroyed()) {
    gate = new BrowserWindow({width:900,height:620,show:false,fullscreen:true,kiosk:true,
      alwaysOnTop:true,autoHideMenuBar:true,minimizable:false,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    gate.setAlwaysOnTop(true, 'screen-saver');
    protectWindow(gate);
    gate.on('closed',()=>{gate=null;});
    gate.on('blur',()=>{
      if (gateFocusTimer) clearTimeout(gateFocusTimer);
      gateFocusTimer=setTimeout(()=>{gateFocusTimer=null;raiseGate(true);},200);
    });
    gate.once('ready-to-show',()=>{raiseGate(true);});
    loadPage(gate,'gate').catch(console.error);
  } else {
    gate.setFullScreen(true);
    if (!maintenance) gate.setKiosk(true);
    gate.setAlwaysOnTop(true,'screen-saver');
  }
  setLockMode(true);
  raiseGate(true);
}
function showTimer() {
  if (!lockMode && timer && !timer.isDestroyed()) return; // Do not disturb fullscreen games/videos.
  if (gateFocusTimer) {clearTimeout(gateFocusTimer); gateFocusTimer=null;}
  if (gate && !gate.isDestroyed()) { gate.setKiosk(false); closeForSwitch(gate); gate=null; }
  if (!timer || timer.isDestroyed()) {
    const area=screen.getPrimaryDisplay().workArea;
    timer = new BrowserWindow({width:270,height:130,x:area.x+area.width-270,y:area.y+12,frame:false,resizable:false,minimizable:false,alwaysOnTop:true,skipTaskbar:true,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    protectWindow(timer); timer.on('closed',()=>{timer=null;}); loadPage(timer,'timer').catch(console.error);
  }
  setLockMode(false);
}
function restoreAfterMaintenance() {
  if (!lockMode || !gate || gate.isDestroyed()) return;
  gate.setFullScreen(true); gate.setKiosk(true);
  gate.setAlwaysOnTop(true,'screen-saver');
  raiseGate(true); taskbar('hide', true);
}
function showMaintenance() {
  if (maintenance && !maintenance.isDestroyed()) { maintenance.show(); maintenance.focus(); return; }
  maintenanceWasLocked = lockMode;
  setIdleEnabled(false);
  // Keep the voucher screen fullscreen. Temporarily disable kiosk capture so dialog can receive input.
  if (maintenanceWasLocked && gate && !gate.isDestroyed()) { gate.setKiosk(false); gate.setFullScreen(true); }
  maintenance = new BrowserWindow({width:420,height:350,resizable:false,minimizable:false,maximizable:false,alwaysOnTop:true,autoHideMenuBar:true,title:'PisoNet Cloud Maintenance',
    parent:maintenanceWasLocked && gate && !gate.isDestroyed() ? gate : undefined, modal:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  maintenance.setMenu(null);
  maintenance.on('closed',()=>{ maintenance=null; if (!authorizedQuit) { restoreAfterMaintenance(); setIdleEnabled(lockMode); } });
  maintenance.loadFile(path.join(__dirname,'maintenance.html')).catch(console.error);
  maintenance.show(); maintenance.focus();
}
async function getSession() { try { const remote=await api('/device/session'); saveState(remote.session); lastKnownSession=remote.session; return remote.session; } catch(e) { const local=readState(); if (isActive(local)) {lastKnownSession=local; return local;} throw e; } }
async function syncWindows() {
  if (switching || syncInFlight || authorizedQuit) return; syncInFlight=true; switching=true;
  try { const session=await getSession(); if (isActive(session)) showTimer(); else showGate(); }
  catch(e) { console.error('Session sync failed:',e.message); showGate(); }
  finally { switching=false; syncInFlight=false; }
}
function isMaintenanceSender(e) { return maintenance && !maintenance.isDestroyed() && e.sender===maintenance.webContents; }
function cleanup() {
  setIdleEnabled(false); cancelShutdown();
  if (gateFocusTimer) {clearTimeout(gateFocusTimer);gateFocusTimer=null;}
  if (taskbarRefreshInterval) { clearInterval(taskbarRefreshInterval); taskbarRefreshInterval = null; }
  if (idleMonitor) { idleMonitor.kill(); idleMonitor=null; }
  if (syncInterval) clearInterval(syncInterval);
  globalShortcut.unregisterAll();
  restoreTaskbarSync();
  restoreAudioSync();
}
if (!hasLock) app.quit();
else {
  app.on('second-instance',()=>{const win=maintenance||gate||timer; if (win && !win.isDestroyed()) {win.show();win.focus();}});
  app.on('before-quit',e=>{if (!authorizedQuit) e.preventDefault(); else cleanup();});
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    fs.mkdirSync(configDir,{recursive:true});
    // An intentional restart of the application clears the authorized maintenance-exit marker.
    try { fs.unlinkSync(maintenancePath); } catch(e) { if (e.code!=='ENOENT') console.error(e); }
    // Cancel any pending shutdown from an earlier crashed instance on startup.
    if (process.platform==='win32') { const c=spawn('shutdown.exe',['/a'],{windowsHide:true,stdio:'ignore'}); c.on('error',()=>{}); }
    try { globalShortcut.register('Control+Shift+Alt+Q', showMaintenance); } catch(e) { console.error('Admin shortcut registration failed:',e); }
    ipcMain.handle('pisonet:minimize',()=>{resizeTimer('peek');return 'peek';});
    ipcMain.handle('pisonet:timerMode',(_e,mode)=>{if(!TIMER_SIZES[mode])throw new Error('Invalid timer mode');resizeTimer(mode);return mode;});
    ipcMain.handle('pisonet:session',async()=>({session:await getSession()}));
    ipcMain.handle('pisonet:redeem',async(_e,code)=>{if(typeof code!=='string'||code.length>100)throw new Error('Invalid code');const result=await api('/device/redeem','POST',{code});saveState(result.session);showTimer();return result;});
    ipcMain.handle('pisonet:adminStart',async(_e,details)=>{if(!details||typeof details.password!=='string'||details.password.length>256)throw new Error('Invalid password');const result=await api('/device/admin/start','POST',details);saveState(result.session);showTimer();return result;});
    ipcMain.handle('pisonet:adminEnd',async()=>{const result=await api('/device/admin/end','POST',{});saveState(result.session);showGate();return result;});
    ipcMain.handle('pisonet:exit',async(e,password)=>{
      if(!isMaintenanceSender(e))throw new Error('Unauthorized exit request');
      if(exitInProgress)throw new Error('Exit verification already in progress');
      if(typeof password!=='string'||!password||password.length>256)throw new Error('Invalid password');
      exitInProgress=true;
      try {
        const result=await api('/device/admin/verify-exit','POST',{password});
        if(result.authorized!==true)throw new Error('Exit not authorized');
        fs.writeFileSync(maintenancePath,JSON.stringify({since:new Date().toISOString()}),{mode:0o600});
        authorizedQuit=true; cleanup(); setImmediate(()=>app.quit()); return {authorized:true};
      } finally {exitInProgress=false;}
    });
    ipcMain.handle('pisonet:cancelExit',e=>{if(!isMaintenanceSender(e))throw new Error('Unauthorized request');maintenance.close();return {ok:true};});
    startIdleMonitor(); await syncWindows(); syncInterval=setInterval(syncWindows,15000);
    // Explorer can recreate its taskbar. Refresh while locked only; never re-hide during a paid session.
    taskbarRefreshInterval=setInterval(() => {
      if (lockMode && !authorizedQuit) {
        taskbar('hide', true);
        // Reassert z-order without changing fullscreen state. Only request focus
        // when Windows has actually placed another window in front.
        if (gate && !gate.isDestroyed() && !gate.isFocused()) raiseGate(true);
        else raiseGate(false);
      }
      // The local expiration check avoids waiting for a slow server poll when
      // a paid session ends while a fullscreen browser has focus.
      if (!lockMode && !syncInFlight && lastKnownSession && !isActive(lastKnownSession)) {
        showGate();
        syncWindows().catch(console.error);
      }
    }, 2000);
  }).catch(console.error);
}
