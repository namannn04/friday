import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "../types/electron.d";

const electronAPI: ElectronAPI = {
  processCommand: (request) => ipcRenderer.invoke("assistant:process-command", request),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => ipcRenderer.invoke("settings:update", settings),
  getLogs: () => ipcRenderer.invoke("logs:get"),
  clearLogs: () => ipcRenderer.invoke("logs:clear"),
  getSystemStatus: () => ipcRenderer.invoke("system:status"),
  getTools: () => ipcRenderer.invoke("tools:get"),
  speak: async (text: string) => {
    // TTS handled in renderer via Web Speech API
    return Promise.resolve();
  },
  transcribeAudio: (audioBuffer: ArrayBuffer) =>
    ipcRenderer.invoke("voice:transcribe", audioBuffer),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
