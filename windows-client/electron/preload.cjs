
const {
  contextBridge,
  ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld('pisonet', {
  minimize: () =>
    ipcRenderer.invoke('pisonet:minimize'),

  setTimerMode: mode =>
    ipcRenderer.invoke('pisonet:timerMode', mode),

  onTimerMode: callback => {
    const handler = (_event, mode) => callback(mode);

    ipcRenderer.on(
      'pisonet:timerMode',
      handler
    );

    return () => {
      ipcRenderer.removeListener(
        'pisonet:timerMode',
        handler
      );
    };
  },

  redeem: code =>
    ipcRenderer.invoke('pisonet:redeem', code),

  session: () =>
    ipcRenderer.invoke('pisonet:session'),

  adminStart: details =>
    ipcRenderer.invoke(
      'pisonet:adminStart',
      details
    ),

  adminEnd: () =>
    ipcRenderer.invoke('pisonet:adminEnd'),

  exit: password =>
    ipcRenderer.invoke('pisonet:exit', password),

  cancelExit: () =>
    ipcRenderer.invoke('pisonet:cancelExit')
});
