'use strict';
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('GhiyabatDesktop', { platform: 'windows' });
