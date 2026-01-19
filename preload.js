const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('minimize'),
  saveFile: (buffer, filename) =>
    ipcRenderer.invoke('save-file', buffer, filename),
  
  // ========== ฟีเจอร์ใหม่: อ่านไฟล์จากโฟลเดอร์ Music ==========
  loadMusicFiles: () => ipcRenderer.invoke('load-music-files'),
  readMusicFile: (filePath) => ipcRenderer.invoke('read-music-file', filePath)
});