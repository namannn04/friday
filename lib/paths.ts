import fs from "fs";
import os from "os";
import path from "path";

const BLOCKED_PATTERNS = [
  /^\/etc(\/|$)/,
  /^\/proc(\/|$)/,
  /^\/sys(\/|$)/,
  /^\/dev(\/|$)/,
  /^\/root(\/|$)/,
  /^\/var\/log(\/|$)/,
  /[/\\]system32[/\\]/i,
  /[/\\]program files[/\\]/i,
  /[/\\]windows[/\\]system/i,
  /[/\\]\.ssh[/\\]/i,
  /[/\\]\.gnupg[/\\]/i,
  /[/\\]\.aws[/\\]/i,
  /[/\\]\.config[/\\]google-chrome/i,
  /[/\\]id_rsa$/i,
  /[/\\]id_ed25519$/i,
  /[/\\]\.env$/i,
  /[/\\]node_modules[/\\]/i,
];

const BLOCKED_ROOTS = ["/", "C:\\", "C:/"];

export function resolveUserPath(input: string, folderHint?: string): string {
  const home = os.homedir();
  let resolved = input.trim();

  if (resolved.startsWith("~")) {
    resolved = path.join(home, resolved.slice(1));
  }

  const folderAliases: Record<string, string> = {
    desktop: path.join(home, "Desktop"),
    documents: path.join(home, "Documents"),
    downloads: path.join(home, "Downloads"),
    pictures: path.join(home, "Pictures"),
  };

  if (folderHint) {
    const hintKey = folderHint.toLowerCase();
    const alias = folderAliases[hintKey];
    if (alias) {
      const inputKey = resolved.toLowerCase();
      // "Downloads" + hint "Downloads" → ~/Downloads (not ~/Downloads/Downloads)
      if (inputKey === hintKey || inputKey === alias.toLowerCase()) {
        resolved = alias;
      } else if (!path.isAbsolute(resolved)) {
        resolved = path.join(alias, resolved);
      }
    }
  } else {
    for (const [alias, aliasPath] of Object.entries(folderAliases)) {
      if (resolved.toLowerCase() === alias) {
        resolved = aliasPath;
        break;
      }
      if (resolved.toLowerCase().startsWith(`${alias}/`) || resolved.toLowerCase().startsWith(`${alias}\\`)) {
        resolved = path.join(aliasPath, resolved.slice(alias.length + 1));
        break;
      }
    }
  }

  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(resolved);
  } else {
    resolved = path.resolve(resolved);
  }

  return resolved;
}

export function isBlockedPath(targetPath: string): { blocked: boolean; reason?: string } {
  const normalized = path.resolve(targetPath);

  if (BLOCKED_ROOTS.includes(normalized)) {
    return { blocked: true, reason: "Root directories are blocked." };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason: `Path matches blocked pattern: ${pattern}` };
    }
  }

  const basename = path.basename(normalized);
  if (basename.startsWith(".") && basename !== ".") {
    return { blocked: true, reason: "Hidden files and folders are blocked by default." };
  }

  return { blocked: false };
}

export function isWithinAllowedFolders(
  targetPath: string,
  allowedFolders: string[]
): boolean {
  const normalized = path.resolve(targetPath);
  return allowedFolders.some((folder) => {
    const allowed = path.resolve(folder);
    return normalized === allowed || normalized.startsWith(`${allowed}${path.sep}`);
  });
}

export function validatePathAccess(
  targetPath: string,
  allowedFolders: string[],
  folderHint?: string
): { ok: boolean; resolved: string; reason?: string } {
  const resolved = resolveUserPath(targetPath, folderHint || targetPath);
  const blocked = isBlockedPath(resolved);
  if (blocked.blocked) {
    return { ok: false, resolved, reason: blocked.reason };
  }
  if (!isWithinAllowedFolders(resolved, allowedFolders)) {
    return {
      ok: false,
      resolved,
      reason: "Path is outside allowed folders. Configure allowed folders in Settings.",
    };
  }
  if (!fs.existsSync(resolved)) {
    const parent = path.dirname(resolved);
    if (!isWithinAllowedFolders(parent, allowedFolders)) {
      return {
        ok: false,
        resolved,
        reason: "Parent directory is outside allowed folders.",
      };
    }
  }
  return { ok: true, resolved };
}

export const SAFE_TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".log"]);

export function isSafeTextExtension(filePath: string): boolean {
  return SAFE_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isSafeOpenExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const blocked = [".exe", ".sh", ".bat", ".cmd", ".msi", ".dmg", ".app", ".deb", ".rpm"];
  return !blocked.includes(ext);
}
