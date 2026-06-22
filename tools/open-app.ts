import { spawn } from "child_process";
import type { AIActionPlan, ToolResult } from "@/types";

const APP_ALIASES: Record<string, string[]> = {
  "visual studio code": ["code"],
  vscode: ["code"],
  "vs code": ["code"],
  firefox: ["firefox"],
  chrome: ["google-chrome", "chrome", "chromium"],
  terminal: ["gnome-terminal", "konsole", "xterm", "xfce4-terminal"],
  calculator: ["gnome-calculator", "kcalc"],
  files: ["nautilus", "dolphin", "thunar", "pcmanfm"],
  "file manager": ["nautilus", "dolphin", "thunar"],
};

export async function openAppTool(plan: AIActionPlan): Promise<ToolResult> {
  const appName = String(plan.args.appName || plan.args.name || "").toLowerCase().trim();
  if (!appName) {
    return { success: false, message: "No application name provided." };
  }

  const candidates = APP_ALIASES[appName] || [appName.replace(/\s+/g, "-")];

  for (const cmd of candidates) {
    try {
      const child = spawn(cmd, [], { detached: true, stdio: "ignore" });
      child.unref();
      return {
        success: true,
        message: `Opened application: ${appName} (${cmd})`,
        data: { command: cmd },
      };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    message: `Could not find application "${appName}". Known apps: ${Object.keys(APP_ALIASES).join(", ")}`,
  };
}
