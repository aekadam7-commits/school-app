'use strict';
const { app, BrowserWindow, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
app.disableHardwareAcceleration();
const PORT = Number(process.env.GHIYABAT_PORT || 8787);
let win = null, serverProc = null, quitting = false;
const logFile = () => path.join(app.getPath('userData'), 'ghiyabat-app.log');
function log(s) { try { fs.mkdirSync(path.dirname(logFile()), {recursive:true}); fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${s}\n`, 'utf8'); } catch (_) {} }
process.on('uncaughtException', e => log('uncaughtException: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => log('unhandledRejection: ' + String(e)));
function serverPath() { return path.join(app.getAppPath(), 'server', 'server.js'); }
function serverEnv() { return { ...process.env, ELECTRON_RUN_AS_NODE:'1', PORT:String(PORT), GHIYABAT_DATA:path.join(app.getPath('userData'),'data'), GHIYABAT_PUBLIC:path.join(app.getAppPath(),'server','public') }; }
function startServer() {
  if (serverProc) return waitForServer();
  const f = serverPath();
  if (!fs.existsSync(f)) throw new Error('ملف السيرفر غير موجود: ' + f);
  serverProc = spawn(process.execPath, [f], { cwd:path.dirname(f), env:serverEnv(), windowsHide:true, stdio:['ignore','pipe','pipe'] });
  serverProc.stdout.on('data', d => log('SERVER ' + String(d).trim()));
  serverProc.stderr.on('data', d => log('SERVER ERROR ' + String(d).trim()));
  serverProc.on('error', e => { log('server spawn error: ' + e.stack); serverProc = null; });
  serverProc.on('exit', (code, signal) => { log(`server exited code=${code} signal=${signal}`); serverProc = null; if (!quitting && win && !win.isDestroyed()) win.webContents.send('server-stopped'); });
  return waitForServer();
}
async function waitForServer() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (!serverProc) throw new Error('توقف السيرفر أثناء التشغيل. راجع سجل التطبيق.');
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/ping`); if (r.ok) return await r.json(); } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`لم يستجب السيرفر على المنفذ ${PORT}. قد يكون المنفذ مستخدمًا من تطبيق آخر.`);
}
function stopServer() { return new Promise(resolve => { const p = serverProc; if (!p) return resolve(); serverProc = null; const timer = setTimeout(() => { try { p.kill(); } catch (_) {} resolve(); }, 2500); p.once('exit', () => { clearTimeout(timer); resolve(); }); try { p.kill(); } catch (_) { clearTimeout(timer); resolve(); } }); }
function createWindow() {
  win = new BrowserWindow({ width:1280, height:850, minWidth:360, minHeight:540, show:false, title:'تسيير غيابات التلاميذ', backgroundColor:'#f3f6fb', icon:path.join(__dirname,'build','icon.png'), webPreferences:{ contextIsolation:true, nodeIntegration:false } });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.on('console-message', (_e, level, message, line, source) => { if (level >= 2) log(`renderer: ${message} (${source}:${line})`); });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => { log(`did-fail-load ${code} ${desc} ${url}`); if (!win.isDestroyed()) win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<meta charset="utf-8"><body dir="rtl" style="font:16px Tahoma;padding:30px"><h2>تعذر فتح التطبيق</h2><p>${desc}</p><p>راجع سجل التطبيق: ${logFile()}</p></body>`)); });
  win.loadURL(`http://127.0.0.1:${PORT}`);
  win.on('closed', () => { win = null; });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    try { const info = await startServer(); log('server ready: '+JSON.stringify(info)); createWindow(); }
    catch (e) { log('startup failure: '+(e.stack||e)); await dialog.showMessageBox({type:'error',title:'تعذر تشغيل السيرفر',message:'لم يتمكن التطبيق من تشغيل السيرفر المدمج.',detail:String(e)+'\n\nسجل الأخطاء: '+logFile()}); app.quit(); }
  });
  app.on('before-quit', e => { if (!quitting) { quitting = true; if (serverProc) { e.preventDefault(); stopServer().finally(() => app.quit()); } } });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
