'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('GhiyabatDesktop', { platform: 'windows', printToPDF: (o) => ipcRenderer.invoke('ghiyabat:pdf', o) });
