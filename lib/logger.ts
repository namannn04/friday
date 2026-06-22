import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { ActionLogEntry, RiskLevel, ToolName } from "@/types";

const LOG_DIR = path.join(os.homedir(), ".friday-assistant");
const LOG_FILE = path.join(LOG_DIR, "action-logs.json");

let memoryLogs: ActionLogEntry[] = [];

function persistLogs(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(memoryLogs.slice(-500), null, 2), "utf-8");
}

function loadPersistedLogs(): void {
  try {
    if (fs.existsSync(LOG_FILE)) {
      memoryLogs = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    }
  } catch {
    memoryLogs = [];
  }
}

loadPersistedLogs();

export function addLog(entry: Omit<ActionLogEntry, "id" | "timestamp">): ActionLogEntry {
  const log: ActionLogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  memoryLogs.unshift(log);
  if (memoryLogs.length > 500) {
    memoryLogs = memoryLogs.slice(0, 500);
  }
  persistLogs();
  return log;
}

export function getLogs(): ActionLogEntry[] {
  return [...memoryLogs];
}

export function clearLogs(): void {
  memoryLogs = [];
  persistLogs();
}

export function logAction(params: {
  command: string;
  tool?: ToolName;
  path?: string;
  riskLevel?: RiskLevel;
  result: ActionLogEntry["result"];
  message: string;
}): ActionLogEntry {
  return addLog(params);
}
