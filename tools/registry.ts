import type { ToolDefinition } from "@/types";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "answer_question",
    description: "Answer general questions without system access",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  {
    name: "web_search",
    description: "Search the web via DuckDuckGo and summarize results",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  {
    name: "search_file",
    description: "Search files in allowed folders by name or pattern",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  {
    name: "list_folder",
    description: "List files in an allowed folder, optionally filtered by extension",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  {
    name: "open_file",
    description: "Open a safe file with the OS default application",
    riskLevel: "medium",
    requiresConfirmation: true,
  },
  {
    name: "create_text_file",
    description: "Create a new .txt or .md file with provided content",
    riskLevel: "medium",
    requiresConfirmation: true,
  },
  {
    name: "append_text_file",
    description: "Append text to an existing .txt or .md file",
    riskLevel: "medium",
    requiresConfirmation: true,
  },
  {
    name: "open_app",
    description: "Open a known desktop application",
    riskLevel: "medium",
    requiresConfirmation: true,
  },
];

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}
