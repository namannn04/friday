import { v4 as uuidv4 } from "uuid";
import type {
  AIActionPlan,
  AppSettings,
  CommandResponse,
  PendingAction,
  ProcessCommandRequest,
  ToolResult,
} from "@/types";
import { logAction } from "@/lib/logger";
import { validateActionPlan } from "@/lib/safety";
import { loadSettings } from "@/lib/settings";
import { parseLocalCommand } from "@/lib/command-parser";
import { createAIProvider } from "@/services/ai";
import { chatWithOllama, humanizeToolResult, isCasualConversation } from "@/services/ai/conversation";
import { performWebSearch } from "@/services/search/web-search";
import { summarizeTextFileTool } from "@/tools/answer-question";
import { appendTextFileTool, createTextFileTool } from "@/tools/create-text-file";
import { listFolderTool } from "@/tools/list-folder";
import { openAppTool } from "@/tools/open-app";
import { openFileTool } from "@/tools/open-file";
import { searchFileTool } from "@/tools/search-file";
import { prepareTextForSpeech } from "@/lib/speech/text-for-speech";
import { speakOnLinux } from "@/services/speech/tts-linux";

const pendingActions = new Map<string, PendingAction>();

async function speakReply(settings: AppSettings, response: CommandResponse): Promise<CommandResponse> {
  if (settings.voiceEnabled === false) {
    return response;
  }

  const text = response.speakMessage || response.finalMessage;
  if (!text || response.status === "clarification") {
    return response;
  }

  const prepared = prepareTextForSpeech(text);
  if (!prepared) {
    return response;
  }

  try {
    await speakOnLinux(prepared);
    return { ...response, voiceSpoken: true };
  } catch {
    return response;
  }
}

export async function processCommand(
  request: ProcessCommandRequest
): Promise<CommandResponse> {
  const settings = loadSettings();
  const response = await executeProcessCommand(request, settings);
  return speakReply(settings, response);
}

async function executeProcessCommand(
  request: ProcessCommandRequest,
  settings: AppSettings
): Promise<CommandResponse> {
  const id = uuidv4();
  const command = request.command.trim();

  if (!command) {
    return {
      id,
      command,
      finalMessage: "Please enter a command.",
      requiresConfirmation: false,
      status: "error",
      error: "Empty command",
    };
  }

  if (request.pendingActionId && request.confirmed) {
    return executePendingAction(request.pendingActionId, request, settings, id);
  }

  const shouldHumanize = settings.conversationMode || request.fromVoice;

  // Pure casual chat — no tools needed
  if (isCasualConversation(command)) {
    try {
      const reply = await chatWithOllama(command, settings);
      logAction({ command, tool: "answer_question", result: "success", message: "Casual conversation" });
      return {
        id,
        command,
        toolName: "answer_question",
        interpretation: reply,
        requiresConfirmation: false,
        finalMessage: reply,
        speakMessage: reply,
        status: "completed",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      return {
        id,
        command,
        finalMessage: `I couldn't respond right now. ${message}`,
        speakMessage: "Sorry, I couldn't respond right now. Is Ollama running?",
        requiresConfirmation: false,
        status: "error",
        error: message,
      };
    }
  }

  let plan: AIActionPlan | null = parseLocalCommand(command);

  if (!plan) {
    try {
      const provider = createAIProvider(settings);
      plan = await provider.interpretCommand(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI service error";
      logAction({
        command,
        result: "error",
        message,
      });
      return {
        id,
        command,
        finalMessage: `AI error: ${message}. Is Ollama running? Try: ollama serve`,
        requiresConfirmation: false,
        status: "error",
        error: message,
      };
    }
  }

  // If Ollama returned bad JSON, try local parser again as safety net
  if (!plan) {
    plan = parseLocalCommand(command);
  }

  if (!plan) {
    logAction({ command, result: "error", message: "Could not interpret command" });
    // Fall back to conversational reply instead of dead-end clarification
    if (settings.conversationMode) {
      try {
        const reply = await chatWithOllama(command, settings);
        return {
          id,
          command,
          toolName: "answer_question",
          requiresConfirmation: false,
          finalMessage: reply,
          speakMessage: reply,
          status: "completed",
        };
      } catch {
        // fall through to examples
      }
    }
    return {
      id,
      command,
      finalMessage:
        "I couldn't understand that clearly. Try something like:\n" +
        '• "List all PDF files in Downloads"\n' +
        '• "Check if resume.pdf exists in Downloads"\n' +
        '• "Search Google for weather in Delhi"\n' +
        '• "Open VS Code"',
      requiresConfirmation: false,
      status: "clarification",
    };
  }


  const safety = validateActionPlan(plan, settings);
  if (!safety.allowed) {
    logAction({
      command,
      tool: plan.toolName,
      riskLevel: plan.riskLevel,
      result: "blocked",
      message: safety.reason || "Blocked by safety guard",
    });
    return {
      id,
      command,
      interpretation: plan.finalUserMessage,
      plan,
      toolName: plan.toolName,
      requiresConfirmation: false,
      riskLevel: plan.riskLevel,
      finalMessage: safety.reason || "Action blocked for safety.",
      status: "error",
      error: safety.reason,
    };
  }

  if (safety.requiresConfirmation && !request.confirmed) {
    const pendingId = uuidv4();
    const preview = buildPreview(plan);
    pendingActions.set(pendingId, {
      id: pendingId,
      plan,
      command,
      preview,
    });

    logAction({
      command,
      tool: plan.toolName,
      riskLevel: safety.riskLevel,
      result: "pending",
      message: "Awaiting user confirmation",
    });

    return {
      id,
      command,
      interpretation: plan.finalUserMessage,
      plan,
      toolName: plan.toolName,
      requiresConfirmation: true,
      riskLevel: safety.riskLevel,
      pendingActionId: pendingId,
      preview,
      finalMessage: plan.finalUserMessage,
      status: "pending_confirmation",
    };
  }

  const result = await executeTool(plan, settings, command);
  logAction({
    command,
    tool: plan.toolName,
    path: extractPath(plan),
    riskLevel: plan.riskLevel,
    result: result.success ? "success" : "error",
    message: result.message,
  });

  let finalMessage = result.message;
  let speakMessage = result.message;

  if (result.success && shouldHumanize && plan.toolName !== "answer_question") {
    try {
      const human = await humanizeToolResult(command, result.message, settings);
      finalMessage = human;
      speakMessage = human;
    } catch {
      speakMessage = result.message;
    }
  } else if (result.success && plan.toolName === "answer_question") {
    speakMessage = finalMessage;
  }

  return {
    id,
    command,
    interpretation: plan.finalUserMessage,
    plan,
    toolName: plan.toolName,
    requiresConfirmation: false,
    riskLevel: plan.riskLevel,
    result,
    finalMessage,
    speakMessage,
    fromWebSearch: plan.toolName === "web_search",
    status: result.success ? "completed" : "error",
    error: result.success ? undefined : result.message,
  };
}

async function executePendingAction(
  pendingActionId: string,
  request: ProcessCommandRequest,
  settings: AppSettings,
  id: string
): Promise<CommandResponse> {
  const pending = pendingActions.get(pendingActionId);
  if (!pending) {
    return {
      id,
      command: request.command,
      finalMessage: "Pending action expired. Please try again.",
      requiresConfirmation: false,
      status: "error",
    };
  }

  pendingActions.delete(pendingActionId);

  if (request.writeMode === "cancel") {
    logAction({
      command: pending.command,
      tool: pending.plan.toolName,
      result: "cancelled",
      message: "User cancelled",
    });
    return {
      id,
      command: pending.command,
      plan: pending.plan,
      toolName: pending.plan.toolName,
      requiresConfirmation: false,
      finalMessage: "Action cancelled.",
      status: "completed",
    };
  }

  let plan = pending.plan;

  if (request.writeMode === "append" && plan.toolName === "create_text_file") {
    plan = {
      ...plan,
      toolName: "append_text_file",
      intent: "append_text_file",
    };
  }

  if (request.writeMode === "rename" && request.newFileName) {
    plan = {
      ...plan,
      args: { ...plan.args, filePath: request.newFileName },
    };
  }

  const result = await executeTool(plan, settings, pending.command);
  const shouldHumanize = settings.conversationMode || request.fromVoice;

  if (
    !result.success &&
    plan.toolName === "create_text_file" &&
    "existingFile" in result &&
    result.existingFile
  ) {
    const fileResult = result as ToolResult & { existingFile?: boolean; preview?: string };
    const newPendingId = uuidv4();
    pendingActions.set(newPendingId, {
      id: newPendingId,
      plan,
      command: pending.command,
      preview: fileResult.preview,
      existingFile: true,
    });
    return {
      id,
      command: pending.command,
      plan,
      toolName: plan.toolName,
      requiresConfirmation: true,
      pendingActionId: newPendingId,
      preview: fileResult.preview,
      finalMessage: result.message,
      status: "pending_confirmation",
    };
  }

  logAction({
    command: pending.command,
    tool: plan.toolName,
    path: extractPath(plan),
    riskLevel: plan.riskLevel,
    result: result.success ? "success" : "error",
    message: result.message,
  });

  let finalMessage = result.message;
  let speakMessage = result.message;
  if (result.success && shouldHumanize) {
    try {
      const human = await humanizeToolResult(pending.command, result.message, settings);
      finalMessage = human;
      speakMessage = human;
    } catch {
      speakMessage = result.message;
    }
  }

  return {
    id,
    command: pending.command,
    plan,
    toolName: plan.toolName,
    requiresConfirmation: false,
    result,
    finalMessage,
    speakMessage,
    status: result.success ? "completed" : "error",
  };
}

async function executeTool(
  plan: AIActionPlan,
  settings: AppSettings,
  originalCommand?: string
): Promise<ToolResult> {
  switch (plan.toolName) {
    case "answer_question": {
      const question = String(plan.args.question || originalCommand || plan.finalUserMessage || "");
      if (question.toLowerCase().includes("summarize") && plan.args.filePath) {
        return summarizeTextFileTool(plan, settings);
      }
      try {
        const reply = await chatWithOllama(question, settings);
        return { success: true, message: reply, data: { question } };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Could not generate a reply.",
        };
      }
    }
    case "web_search":
      return performWebSearch(String(plan.args.query || plan.finalUserMessage));
    case "search_file":
      return searchFileTool(plan, settings);
    case "list_folder":
      return listFolderTool(plan, settings);
    case "open_file":
      return openFileTool(plan, settings);
    case "create_text_file":
      return createTextFileTool(plan, settings);
    case "append_text_file":
      return appendTextFileTool(plan, settings);
    case "open_app":
      return openAppTool(plan);
    default:
      return { success: false, message: `Unknown tool: ${plan.toolName}` };
  }
}

function buildPreview(plan: AIActionPlan): string {
  const args = plan.args;
  switch (plan.toolName) {
    case "open_file":
      return `Open file: ${args.filePath || args.path || "unknown"}`;
    case "create_text_file":
      return `Create file: ${args.filePath || args.path}\n\nContent preview:\n${String(args.content || "").slice(0, 500)}`;
    case "append_text_file":
      return `Append to: ${args.filePath || args.path}\n\nContent preview:\n${String(args.content || "").slice(0, 500)}`;
    case "open_app":
      return `Open application: ${args.appName || args.name}`;
    default:
      return plan.finalUserMessage;
  }
}

function extractPath(plan: AIActionPlan): string | undefined {
  const path = plan.args.filePath || plan.args.path || plan.args.folderPath || plan.args.folder;
  return path ? String(path) : undefined;
}

export function getPendingAction(id: string): PendingAction | undefined {
  return pendingActions.get(id);
}
