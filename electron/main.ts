import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import path from "path";
import { clearLogs, getLogs } from "../lib/logger";
import { processCommand } from "../lib/orchestrator";
import { checkOllamaStatus } from "../services/ai";
import { loadSettings, saveSettings, updateSettings } from "../lib/settings";
import { transcribeAudioBuffer } from "../services/speech/vosk-stt";
import { getToolDefinitions } from "../tools/registry";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-speech-input");
}

function setupMediaPermissions(): void {
  const allow = new Set(["media", "audioCapture", "microphone", "videoCapture"]);

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allow.has(permission) || permission.startsWith("audio"));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return allow.has(permission) || permission.startsWith("audio");
  });
}

function normalizeAudioBuffer(data: ArrayBuffer | Uint8Array | Buffer): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (Buffer.isBuffer(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function createWindow(): void {
  const preloadPath =
    __dirname.endsWith(`${path.sep}dist-electron`) || __dirname.endsWith("/dist-electron")
      ? path.join(__dirname, "preload.js")
      : path.join(__dirname, "..", "dist-electron", "preload.js");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "FRIDAY Assistant",
    backgroundColor: "#0a1628",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("assistant:process-command", async (_event, request) => {
    return processCommand(request);
  });

  ipcMain.handle("settings:get", async () => loadSettings());

  ipcMain.handle("settings:update", async (_event, partial) => updateSettings(partial));

  ipcMain.handle("settings:save", async (_event, settings) => {
    saveSettings(settings);
    return loadSettings();
  });

  ipcMain.handle("logs:get", async () => getLogs());

  ipcMain.handle("logs:clear", async () => {
    clearLogs();
    return true;
  });

  ipcMain.handle("tools:get", async () => getToolDefinitions());

  ipcMain.handle("system:status", async () => {
    const settings = loadSettings();
    const ollama = await checkOllamaStatus(settings.ollamaBaseUrl, settings.ollamaModel);
    return {
      ollamaOnline: ollama.online,
      ollamaModel: ollama.model,
      platform: process.platform,
      allowedFolderCount: settings.allowedFolders.length,
      electronReady: true,
    };
  });

  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle("voice:transcribe", async (_event, audioBuffer: ArrayBuffer | Uint8Array | Buffer) => {
    try {
      const normalized = normalizeAudioBuffer(audioBuffer);
      return await transcribeAudioBuffer(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed";
      return { text: "", error: message };
    }
  });
}

app.whenReady().then(() => {
  setupMediaPermissions();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
