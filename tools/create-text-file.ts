import fs from "fs";
import path from "path";
import type { AIActionPlan, AppSettings, ToolResult } from "@/types";
import { isSafeTextExtension, resolveUserPath, validatePathAccess } from "@/lib/paths";
import { getEffectiveAllowedFolders } from "@/lib/settings";

export async function createTextFileTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult & { existingFile?: boolean; preview?: string }> {
  const args = plan.args;
  const filePath = String(args.filePath || args.path || "notes.txt");
  const folderHint = args.folder ? String(args.folder) : "Documents";
  const content = String(args.content || "");
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const resolved = resolveUserPath(filePath, folderHint);
  const check = validatePathAccess(resolved, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "File path not allowed." };
  }

  if (!isSafeTextExtension(check.resolved)) {
    return { success: false, message: "Only .txt and .md files can be created." };
  }

  if (fs.existsSync(check.resolved)) {
    return {
      success: false,
      message: `File already exists: ${check.resolved}. Choose append, rename, or cancel.`,
      existingFile: true,
      preview: content,
      data: { path: check.resolved },
    };
  }

  fs.mkdirSync(path.dirname(check.resolved), { recursive: true });
  fs.writeFileSync(check.resolved, content, "utf-8");

  return {
    success: true,
    message: `Created file: ${check.resolved}`,
    preview: content,
    data: { path: check.resolved, bytes: content.length },
  };
}

export async function appendTextFileTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult & { preview?: string }> {
  const args = plan.args;
  const filePath = String(args.filePath || args.path || "");
  const folderHint = args.folder ? String(args.folder) : undefined;
  const content = String(args.content || "");
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const resolved = resolveUserPath(filePath, folderHint);
  const check = validatePathAccess(resolved, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "File path not allowed." };
  }

  if (!isSafeTextExtension(check.resolved)) {
    return { success: false, message: "Only .txt and .md files can be edited." };
  }

  if (!fs.existsSync(check.resolved)) {
    return { success: false, message: `File not found: ${check.resolved}` };
  }

  fs.appendFileSync(check.resolved, content, "utf-8");

  return {
    success: true,
    message: `Appended ${content.length} characters to ${check.resolved}`,
    preview: content,
    data: { path: check.resolved },
  };
}
