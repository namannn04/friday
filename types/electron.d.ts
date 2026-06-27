import type {
  ActionLogEntry,
  AppSettings,
  CommandResponse,
  ProcessCommandRequest,
  SystemStatus,
  ToolDefinition,
} from "./index";

export interface ElectronAPI {
  processCommand: (request: ProcessCommandRequest) => Promise<CommandResponse>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getLogs: () => Promise<ActionLogEntry[]>;
  clearLogs: () => Promise<void>;
  getSystemStatus: () => Promise<SystemStatus>;
  getTools: () => Promise<ToolDefinition[]>;
  speak: (text: string) => Promise<boolean>;
  transcribePcm: (pcmBuffer: ArrayBuffer) => Promise<{ text: string; error?: string }>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
