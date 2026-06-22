import fs from "fs";
import type { AIActionPlan, AppSettings, ToolResult } from "@/types";
import { resolveUserPath, validatePathAccess } from "@/lib/paths";
import { getEffectiveAllowedFolders } from "@/lib/settings";

export async function answerQuestionTool(plan: AIActionPlan): Promise<ToolResult> {
  return {
    success: true,
    message: plan.finalUserMessage,
    data: { question: plan.args.question || plan.finalUserMessage },
  };
}

export async function summarizeTextFileTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult> {
  const filePath = String(plan.args.filePath || plan.args.path || "");
  const folderHint = plan.args.folder ? String(plan.args.folder) : undefined;
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const resolved = resolveUserPath(filePath, folderHint);
  const check = validatePathAccess(resolved, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "File not allowed." };
  }

  if (!fs.existsSync(check.resolved)) {
    return { success: false, message: `File not found: ${check.resolved}` };
  }

  const content = fs.readFileSync(check.resolved, "utf-8");
  const preview = content.slice(0, 2000);
  const truncated = content.length > 2000;

  return {
    success: true,
    message: `File preview from ${check.resolved}${truncated ? " (truncated)" : ""}:\n\n${preview}`,
    data: { path: check.resolved, length: content.length, preview },
  };
}
