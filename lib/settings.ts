import fs from "fs";
import os from "os";
import path from "path";
import type { AppSettings } from "@/types";

const SETTINGS_DIR = path.join(os.homedir(), ".friday-assistant");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

function defaultAllowedFolders(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "Downloads"),
    path.join(home, "Pictures"),
  ].filter((folder) => fs.existsSync(folder));
}

export function getDefaultSettings(): AppSettings {
  return {
    aiProvider: "ollama",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    ollamaModel: "llama3.2",
    allowedFolders: defaultAllowedFolders(),
    customWorkspaceFolder: process.cwd(),
    safetyMode: "strict",
    voiceEnabled: true,
    voiceAutoSpeak: true,
    conversationMode: true,
    ttsRate: 0.92,
  };
}

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...getDefaultSettings(),
        ...parsed,
        voiceEnabled: parsed.voiceEnabled ?? true,
        voiceAutoSpeak: parsed.voiceAutoSpeak ?? true,
        conversationMode: parsed.conversationMode ?? true,
      };
    }
  } catch {
    // fall through to defaults
  }
  return getDefaultSettings();
}

export function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const next = { ...current, ...partial };
  saveSettings(next);
  return next;
}

export function getEffectiveAllowedFolders(settings: AppSettings): string[] {
  const folders = [...settings.allowedFolders];
  if (settings.customWorkspaceFolder) {
    folders.push(settings.customWorkspaceFolder);
  }
  return [...new Set(folders.map((f) => path.resolve(f)))];
}
