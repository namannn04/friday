import fs from "fs";
import path from "path";
import type { AIActionPlan, AppSettings, ToolResult } from "@/types";
import { resolveUserPath, validatePathAccess } from "@/lib/paths";
import { getEffectiveAllowedFolders } from "@/lib/settings";

function walkDir(dir: string, maxDepth = 4, depth = 0): string[] {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      results.push(full);
      if (entry.isDirectory()) {
        results.push(...walkDir(full, maxDepth, depth + 1));
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

export async function searchFileTool(
  plan: AIActionPlan,
  settings: AppSettings
): Promise<ToolResult> {
  const args = plan.args;
  const query = String(args.query || args.fileName || args.name || "").toLowerCase();
  const folderHint = String(args.folder || args.folderPath || "Downloads");
  const extension = args.extension ? String(args.extension).toLowerCase() : "";
  const allowedFolders = getEffectiveAllowedFolders(settings);

  const folderPath = resolveUserPath(folderHint, folderHint);
  const check = validatePathAccess(folderPath, allowedFolders, folderHint);
  if (!check.ok) {
    return { success: false, message: check.reason || "Folder not allowed." };
  }

  const allFiles = walkDir(check.resolved).filter((f) => fs.statSync(f).isFile());
  let matches = allFiles.filter((f) => path.basename(f).toLowerCase().includes(query));

  if (extension) {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    matches = matches.filter((f) => f.toLowerCase().endsWith(ext));
  }

  matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (matches.length === 0) {
    return {
      success: true,
      message: `No files matching "${query}" found in ${folderHint}.`,
      data: { matches: [] },
    };
  }

  const list = matches.slice(0, 10).map((f) => ({
    name: path.basename(f),
    path: f,
    modified: new Date(fs.statSync(f).mtimeMs).toISOString(),
  }));

  return {
    success: true,
    message: `Found ${matches.length} file(s) matching "${query}" in ${folderHint}:\n${list
      .map((f) => `- ${f.name} (${f.modified})`)
      .join("\n")}`,
    data: { matches: list, latest: list[0] },
  };
}
