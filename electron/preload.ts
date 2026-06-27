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
  speak: (text: string) => ipcRenderer.invoke("tts:speak", text),
  transcribePcm: (pcmBuffer: ArrayBuffer) =>
    ipcRenderer.invoke("voice:transcribe-pcm", Buffer.from(pcmBuffer)),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
