const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pisonet', {
  redeem: code => ipcRenderer.invoke('pisonet:redeem', code),
  session: () => ipcRenderer.invoke('pisonet:session'),
  adminStart: details => ipcRenderer.invoke('pisonet:adminStart', details),
  adminEnd: () => ipcRenderer.invoke('pisonet:adminEnd')
});
