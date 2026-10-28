'use strict';
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

// Electron 22 (Windows 7) ships Node 16 without global fetch
function httpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 2000 }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

app.disableHardwareAcceleration();
let win = null, serverProc = null, quitting = false;
let CURRENT_PORT = 8787;

const logFile = () => path.join(app.getPath('userData'), 'ghiyabat-app.log');
function log(s) { try { fs.mkdirSync(path.dirname(logFile()), {recursive:true}); fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${s}\n`, 'utf8'); } catch (_) {} }

process.on('uncaughtException', e => log('uncaughtException: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => log('unhandledRejection: ' + String(e)));

function serverPath() { return path.join(app.getAppPath(), 'server', 'server.js'); }
function serverEnv(port) { return { ...process.env, ELECTRON_RUN_AS_NODE:'1', PORT:String(port), GHIYABAT_DATA:path.join(app.getPath('userData'),'data'), GHIYABAT_PUBLIC:path.join(app.getAppPath(),'server','public') }; }

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => { resolve(findAvailablePort(startPort + 1)); });
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function startServer() {
  if (serverProc) return waitForServer();
  CURRENT_PORT = await findAvailablePort(8787);
  log(`Using port: ${CURRENT_PORT}`);
  const f = serverPath();
  if (!fs.existsSync(f)) throw new Error('ملف السيرفر غير موجود: ' + f);
  // تشغيل السيرفر داخل نفس العملية (بدون child_process) لتفادي خطأ spawn على ويندوز 7
  try {
    const env = serverEnv(CURRENT_PORT);
    process.env.PORT = env.PORT;
    process.env.GHIYABAT_DATA = env.GHIYABAT_DATA;
    process.env.GHIYABAT_PUBLIC = env.GHIYABAT_PUBLIC;
    serverProc = { inProcess: true };
    require(f);
    log('SERVER started in-process on port ' + CURRENT_PORT);
  } catch (e) {
    serverProc = null;
    log('server start error: ' + (e && e.stack || e));
    throw e;
  }
  return waitForServer();
}

async function waitForServer() {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (!serverProc) throw new Error('توقف السيرفر أثناء التشغيل.');
    try { 
      return await httpJson(`http://127.0.0.1:${CURRENT_PORT}/api/ping`);
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`لم يستجب السيرفر على المنفذ ${CURRENT_PORT}.`);
}

function stopServer() { serverProc = null; return Promise.resolve(); }

function createWindow() {
  win = new BrowserWindow({ 
    width:1280, height:850, minWidth:360, minHeight:540, show:false, 
    title:'تسيير غيابات التلاميذ', backgroundColor:'#f3f6fb', 
    icon:path.join(__dirname,'build','icon.png'), 
    webPreferences:{ contextIsolation:true, nodeIntegration:false, preload: path.join(__dirname, 'preload.js') } 
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => { 
    if (/^(https?|sms|tel|mailto):/i.test(url)) shell.openExternal(url).catch(() => {}); 
    return { action: 'deny' }; 
  });
  win.webContents.on('will-navigate', (e, url) => { 
    if (!url.startsWith(`http://127.0.0.1:${CURRENT_PORT}`) && !url.startsWith('data:')) { 
      e.preventDefault(); 
      if (/^(https?|sms|tel|mailto):/i.test(url)) shell.openExternal(url).catch(() => {}); 
    } 
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('console-message', (_e, level, message, line, source) => { 
    if (level >= 2) log(`renderer: ${message} (${source}:${line})`); 
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => { 
    log(`did-fail-load ${code} ${desc} ${url}`); 
    if (code !== -3) {
      setTimeout(() => { if (win && !win.isDestroyed()) win.loadURL(`http://127.0.0.1:${CURRENT_PORT}`); }, 1000);
    }
  });
  win.loadURL(`http://127.0.0.1:${CURRENT_PORT}`);
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    try { 
      const info = await startServer(); 
      log('server ready: '+JSON.stringify(info)); 
      createWindow(); 
    }
    catch (e) { 
      log('startup failure: '+(e.stack||e)); 
      await dialog.showMessageBox({type:'error',title:'تعذر تشغيل السيرفر',message:'لم يتمكن التطبيق من تشغيل السيرفر المدمج.',detail:String(e)+'\n\nسجل الأخطاء: '+logFile()}); 
      app.quit(); 
    }
  });
  app.on('before-quit', e => { 
    if (!quitting) { 
      quitting = true; 
      if (serverProc) { 
        e.preventDefault(); 
        stopServer().finally(() => app.quit()); 
      } 
    } 
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
