export type RiskLevel = "low" | "medium" | "high";

export type Intent =
  | "answer_question"
  | "web_search"
  | "search_file"
  | "open_file"
  | "create_text_file"
  | "append_text_file"
  | "list_folder"
  | "open_app";

export type ToolName =
  | "answer_question"
  | "web_search"
  | "search_file"
  | "open_file"
  | "create_text_file"
  | "append_text_file"
  | "list_folder"
  | "open_app";

export interface AIActionPlan {
  intent: Intent;
  toolName: ToolName;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  args: Record<string, unknown>;
  finalUserMessage: string;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  blocked?: boolean;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
}

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  command: string;
  tool?: ToolName;
  path?: string;
  riskLevel?: RiskLevel;
  result: "success" | "error" | "blocked" | "cancelled" | "pending";
  message: string;
}

export interface AppSettings {
  aiProvider: "ollama" | "openai" | "groq";
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  allowedFolders: string[];
  customWorkspaceFolder?: string;
  safetyMode: "strict" | "normal";
  voiceEnabled: boolean;
  voiceAutoSpeak: boolean;
  conversationMode: boolean;
  ttsRate: number;
}

export interface SystemStatus {
  ollamaOnline: boolean;
  ollamaModel: string;
  platform: string;
  allowedFolderCount: number;
  electronReady: boolean;
}

export interface PendingAction {
  id: string;
  plan: AIActionPlan;
  command: string;
  preview?: string;
  existingFile?: boolean;
}

export interface CommandResponse {
  id: string;
  command: string;
  interpretation?: string;
  plan?: AIActionPlan;
  toolName?: ToolName;
  requiresConfirmation: boolean;
  riskLevel?: RiskLevel;
  pendingActionId?: string;
  preview?: string;
  result?: ToolResult;
  finalMessage: string;
  speakMessage?: string;
  error?: string;
  fromWebSearch?: boolean;
  status: "completed" | "pending_confirmation" | "error" | "clarification";
  voiceSpoken?: boolean;
}

export interface ProcessCommandRequest {
  command: string;
  confirmed?: boolean;
  pendingActionId?: string;
  writeMode?: "append" | "rename" | "cancel";
  newFileName?: string;
  fromVoice?: boolean;
}
