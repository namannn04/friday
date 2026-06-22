import fs from "fs";
import path from "path";
import type { AIActionPlan, AppSettings, ToolResult } from "@/types";
import { resolveUserPath, validatePathAccess } from "@/lib/paths";
import { getEffectiveAllowedFolders } from "@/lib/settings";

export async function listFolderTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult> {
  const args = plan.args;
  const folderHint = String(args.folderPath || args.folder || "Downloads");
  const extension = args.extension ? String(args.extension).toLowerCase() : "";
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const folderPath = resolveUserPath(folderHint, folderHint);
  const check = validatePathAccess(folderPath, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "Folder not allowed." };
  }

  if (!fs.existsSync(check.resolved) || !fs.statSync(check.resolved).isDirectory()) {
    return { success: false, message: `Folder not found: ${folderHint}` };
  }

  let files = fs.readdirSync(check.resolved).filter((f) => !f.startsWith("."));
  if (extension) {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    files = files.filter((f) => f.toLowerCase().endsWith(ext));
  }

  files.sort((a, b) => {
    const aPath = path.join(check.resolved, a);
    const bPath = path.join(check.resolved, b);
    return fs.statSync(bPath).mtimeMs - fs.statSync(aPath).mtimeMs;
  });

  return {
    success: true,
    message:
      files.length === 0
        ? `No files found in ${folderHint}${extension ? ` with extension ${extension}` : ""}.`
        : `Files in ${folderHint}${extension ? ` (${extension})` : ""}:\n${files
            .slice(0, 50)
            .map((f) => `- ${f}`)
            .join("\n")}`,
    data: { files: files.slice(0, 50).map((f) => path.join(check.resolved, f)) },
  };
}
