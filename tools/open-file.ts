import fs from "fs";
import { shell } from "electron";
import type { AIActionPlan, AppSettings, ToolResult } from "@/types";
import { resolveUserPath, validatePathAccess } from "@/lib/paths";
import { getEffectiveAllowedFolders } from "@/lib/settings";

export async function openFileTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult> {
  const args = plan.args;
  const filePath = String(args.filePath || args.path || "");
  const folderHint = args.folder ? String(args.folder) : undefined;
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const resolved = resolveUserPath(filePath, folderHint);
  const check = validatePathAccess(resolved, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "File path not allowed." };
  }

  if (!fs.existsSync(check.resolved)) {
    return { success: false, message: `File not found: ${check.resolved}` };
  }

  const error = await shell.openPath(check.resolved);
  if (error) {
    return { success: false, message: `Failed to open file: ${error}` };
  }

  return {
    success: true,
    message: `Opened file: ${check.resolved}`,
    data: { path: check.resolved },
  };
}
