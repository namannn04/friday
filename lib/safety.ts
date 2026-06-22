import type { AIActionPlan, AppSettings, SafetyCheckResult, ToolName } from "@/types";
import { isBlockedPath, isSafeOpenExtension, isSafeTextExtension, validatePathAccess } from "./paths";
import { getEffectiveAllowedFolders } from "./settings";

const BLOCKED_TOOLS = new Set<ToolName>([]);

const HIGH_RISK_INTENTS = new Set([
  "delete_file",
  "run_command",
  "install_software",
  "edit_system_settings",
  "send_email",
]);

const TOOL_DEFAULTS: Record<
  ToolName,
  { riskLevel: "low" | "medium" | "high"; requiresConfirmation: boolean }
> = {
  answer_question: { riskLevel: "low", requiresConfirmation: false },
  web_search: { riskLevel: "low", requiresConfirmation: false },
  search_file: { riskLevel: "low", requiresConfirmation: false },
  list_folder: { riskLevel: "low", requiresConfirmation: false },
  open_file: { riskLevel: "medium", requiresConfirmation: true },
  create_text_file: { riskLevel: "medium", requiresConfirmation: true },
  append_text_file: { riskLevel: "medium", requiresConfirmation: true },
  open_app: { riskLevel: "medium", requiresConfirmation: true },
};

export function getToolSafetyDefaults(toolName: ToolName) {
  return TOOL_DEFAULTS[toolName];
}

export function validateActionPlan(
  plan: AIActionPlan,
  settings: AppSettings
): SafetyCheckResult {
  const intent = plan.intent as string;
  if (HIGH_RISK_INTENTS.has(intent)) {
    return {
      allowed: false,
      reason: `Intent "${intent}" is blocked in v1 for safety.`,
      requiresConfirmation: false,
      riskLevel: "high",
    };
  }

  if (BLOCKED_TOOLS.has(plan.toolName)) {
    return {
      allowed: false,
      reason: `Tool "${plan.toolName}" is disabled.`,
      requiresConfirmation: false,
      riskLevel: "high",
    };
  }

  const defaults = TOOL_DEFAULTS[plan.toolName];
  if (!defaults) {
    return {
      allowed: false,
      reason: `Unknown tool: ${plan.toolName}`,
      requiresConfirmation: false,
      riskLevel: "high",
    };
  }

  if (plan.riskLevel === "high") {
    return {
      allowed: false,
      reason: "High-risk actions are blocked in v1.",
      requiresConfirmation: false,
      riskLevel: "high",
    };
  }

  const allowedFolders = getEffectiveAllowedFolders(settings);
  const args = plan.args;

  switch (plan.toolName) {
    case "search_file":
    case "list_folder": {
      const folder = String(args.folderPath || args.folder || args.directory || "");
      if (folder) {
        const check = validatePathAccess(folder, allowedFolders, folder);
        if (!check.ok) {
          return {
            allowed: false,
            reason: check.reason,
            requiresConfirmation: false,
            riskLevel: defaults.riskLevel,
          };
        }
      }
      break;
    }
    case "open_file": {
      const filePath = String(args.filePath || args.path || "");
      const folderHint = args.folder ? String(args.folder) : undefined;
      if (!filePath) {
        return { allowed: false, reason: "Missing file path.", requiresConfirmation: false, riskLevel: "medium" };
      }
      const check = validatePathAccess(filePath, allowedFolders, folderHint);
      if (!check.ok) {
        return { allowed: false, reason: check.reason, requiresConfirmation: false, riskLevel: "medium" };
      }
      if (!isSafeOpenExtension(check.resolved)) {
        return {
          allowed: false,
          reason: "Executable or installer files cannot be opened.",
          requiresConfirmation: false,
          riskLevel: "high",
        };
      }
      break;
    }
    case "create_text_file":
    case "append_text_file": {
      const filePath = String(args.filePath || args.path || "");
      const folderHint = args.folder ? String(args.folder) : undefined;
      if (!filePath) {
        return { allowed: false, reason: "Missing file path.", requiresConfirmation: false, riskLevel: "medium" };
      }
      const check = validatePathAccess(filePath, allowedFolders, folderHint);
      if (!check.ok) {
        return { allowed: false, reason: check.reason, requiresConfirmation: false, riskLevel: "medium" };
      }
      if (!isSafeTextExtension(check.resolved)) {
        return {
          allowed: false,
          reason: "Only .txt and .md files can be created or edited.",
          requiresConfirmation: false,
          riskLevel: "medium",
        };
      }
      break;
    }
    case "open_app": {
      const appName = String(args.appName || args.name || "");
      if (!appName) {
        return { allowed: false, reason: "Missing app name.", requiresConfirmation: false, riskLevel: "medium" };
      }
      const blockedApps = ["rm", "sudo", "chmod", "del", "format", "shutdown", "reboot"];
      if (blockedApps.some((b) => appName.toLowerCase().includes(b))) {
        return {
          allowed: false,
          reason: "Potentially destructive app/command names are blocked.",
          requiresConfirmation: false,
          riskLevel: "high",
        };
      }
      break;
    }
    default:
      break;
  }

  const requiresConfirmation =
    settings.safetyMode === "strict"
      ? defaults.requiresConfirmation || plan.requiresConfirmation
      : plan.requiresConfirmation && defaults.requiresConfirmation;

  return {
    allowed: true,
    requiresConfirmation,
    riskLevel: defaults.riskLevel,
  };
}

export function sanitizePathForLog(filePath: string): string {
  const blocked = isBlockedPath(filePath);
  if (blocked.blocked) return "[blocked path]";
  return filePath;
}
