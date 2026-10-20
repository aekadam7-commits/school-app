'use strict';
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('ghiyabatDesktop', { embeddedServer: true, appVersion: '1.0.0' });
