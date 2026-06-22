import type { AIActionPlan, Intent, ToolName } from "@/types";

const FOLDERS: Record<string, string> = {
  download: "Downloads",
  downloads: "Downloads",
  document: "Documents",
  documents: "Documents",
  docs: "Documents",
  desktop: "Desktop",
  picture: "Pictures",
  pictures: "Pictures",
  photos: "Pictures",
  images: "Pictures",
};

const EXT_ALIASES: Record<string, string> = {
  pdf: ".pdf",
  pdfs: ".pdf",
  png: ".png",
  jpg: ".jpg",
  jpeg: ".jpeg",
  txt: ".txt",
  md: ".md",
  markdown: ".md",
  doc: ".doc",
  docx: ".docx",
  xls: ".xls",
  xlsx: ".xlsx",
  csv: ".csv",
  zip: ".zip",
  mp4: ".mp4",
  mp3: ".mp3",
};

const APP_ALIASES: Record<string, string> = {
  "vs code": "Visual Studio Code",
  vscode: "Visual Studio Code",
  "visual studio code": "Visual Studio Code",
  code: "Visual Studio Code",
  firefox: "Firefox",
  chrome: "Chrome",
  terminal: "Terminal",
  calculator: "Calculator",
  files: "Files",
  "file manager": "Files",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function plan(
  intent: Intent,
  toolName: ToolName,
  args: Record<string, unknown>,
  finalUserMessage: string,
  riskLevel: "low" | "medium" = "low",
  requiresConfirmation = false
): AIActionPlan {
  return {
    intent,
    toolName,
    args,
    finalUserMessage,
    riskLevel,
    requiresConfirmation,
  };
}

function extractFolder(text: string): string | undefined {
  for (const [key, value] of Object.entries(FOLDERS)) {
    const re = new RegExp(`\\b(my\\s+)?${key}\\b`, "i");
    if (re.test(text)) return value;
  }
  return undefined;
}

function extractExtension(text: string): string | undefined {
  const dotMatch = text.match(/\.([a-z0-9]{2,5})\b/i);
  if (dotMatch) return `.${dotMatch[1].toLowerCase()}`;

  for (const [key, ext] of Object.entries(EXT_ALIASES)) {
    if (new RegExp(`\\b${key}s?\\b`, "i").test(text)) return ext;
  }
  return undefined;
}

function extractFilename(text: string): string | undefined {
  const named = text.match(/\b([a-z0-9][\w.-]*\.[a-z0-9]{1,6})\b/i);
  if (named) return named[1];

  const called = text.match(/(?:called|named)\s+([a-z0-9][\w.-]*)/i);
  if (called) return called[1];

  return undefined;
}

/**
 * Fast local parser for common natural-language commands.
 * Runs before Ollama so simple requests work even when the model returns bad JSON.
 */
export function parseLocalCommand(command: string): AIActionPlan | null {
  const text = normalize(command);
  if (!text) return null;

  const folder = extractFolder(text) || "Downloads";
  const extension = extractExtension(text);
  const filename = extractFilename(text);

  // List files: "list all pdf in downloads", "show pdf files in my downloads"
  if (
    /\b(list|show|display|get)\b/.test(text) &&
    (/\b(files?|folders?|items?|all)\b/.test(text) || extension) &&
    !/\b(open|create|delete|remove)\b/.test(text)
  ) {
    const msg = extension
      ? `Listing ${extension} files in ${folder}.`
      : `Listing files in ${folder}.`;
    return plan("list_folder", "list_folder", { folderPath: folder, extension }, msg);
  }

  // Check existence: "check if resume.pdf exists in downloads"
  if (
    /\b(check|find|search|look\s+for|locate|does|is)\b/.test(text) &&
    (/\b(exist|exists|there|have|find|located)\b/.test(text) || filename) &&
    !/\b(google|web|internet)\b/.test(text)
  ) {
    const query = filename || text.replace(/.*\b(for|if|whether)\s+/i, "").split(/\s+(in|exists|exist)/)[0]?.trim() || "";
    if (query) {
      return plan(
        "search_file",
        "search_file",
        { query: query.replace(/^["']|["']$/g, ""), folder, extension },
        `Searching for "${query}" in ${folder}.`
      );
    }
  }

  // Search file by name: "find screenshots in downloads"
  if (/\b(find|search\s+for|look\s+for)\b/.test(text) && !/\b(google|web|internet)\b/.test(text)) {
    const match = text.match(/\b(?:find|search\s+for|look\s+for)\s+(.+?)(?:\s+in\s+|\s+from\s+|$)/i);
    const query = match?.[1]?.replace(/\b(my|all|the|a|an)\b/g, "").trim();
    if (query && query.length > 1) {
      return plan(
        "search_file",
        "search_file",
        { query, folder, extension },
        `Searching for "${query}" in ${folder}.`
      );
    }
  }

  // Web search: "search google for X", "google X"
  const webMatch =
    text.match(/\b(?:search\s+(?:the\s+)?(?:web|google|internet)\s+(?:for\s+)?)(.+)/i) ||
    text.match(/\bgoogle\s+(.+)/i) ||
    text.match(/\bweb\s+search\s+(?:for\s+)?(.+)/i);
  if (webMatch?.[1]) {
    const query = webMatch[1].replace(/[?.!]+$/, "").trim();
    return plan("web_search", "web_search", { query }, `Searching the web for "${query}".`);
  }

  // Open app: "open vscode", "open vs code"
  if (/\bopen\b/.test(text) && !filename && !extension) {
    for (const [alias, appName] of Object.entries(APP_ALIASES)) {
      if (text.includes(alias) || text.match(new RegExp(`\\bopen\\s+${alias}\\b`))) {
        return plan(
          "open_app",
          "open_app",
          { appName },
          `Opening ${appName}.`,
          "medium",
          true
        );
      }
    }
  }

  // Open latest screenshot/image
  if (/\bopen\b/.test(text) && /\b(latest|recent|newest|last)\b/.test(text) && /\b(screenshot|image|photo|picture)\b/.test(text)) {
    return plan(
      "search_file",
      "search_file",
      { query: "screenshot", folder: extractFolder(text) || "Pictures", extension: ".png" },
      "Finding your latest screenshot."
    );
  }

  // Open file: "open resume.pdf", "open my resume in downloads"
  if (/\bopen\b/.test(text) && (filename || /\b(file|document)\b/.test(text))) {
    const filePath = filename || text.replace(/^open\s+(my\s+)?/i, "").split(/\s+in\s+/)[0]?.trim();
    if (filePath) {
      return plan(
        "open_file",
        "open_file",
        { filePath, folder },
        `Opening ${filePath}.`,
        "medium",
        true
      );
    }
  }

  // Create file: "create ideas.md in documents"
  if (/\b(create|make|write|save)\b/.test(text) && (/\b(file|note|notes|document)\b/.test(text) || filename || /\.(txt|md)\b/.test(text))) {
    const filePath = filename || text.match(/\b(?:called|named)\s+([\w.-]+)/i)?.[1] || "notes.txt";
    const contentMatch = text.match(/\b(?:write|with|content|text|notes?)\s*[:\-]?\s*(.+)$/i);
    const content = contentMatch?.[1]?.trim() || "";
    return plan(
      "create_text_file",
      "create_text_file",
      { filePath, folder, content },
      `Creating ${filePath} in ${folder}.`,
      "medium",
      true
    );
  }

  // Summarize file
  if (/\b(summarize|summary|read)\b/.test(text) && (filename || /\bfile\b/.test(text))) {
    const filePath = filename || text.match(/\bfile\s+([\w.-]+)/i)?.[1];
    if (filePath) {
      return plan(
        "answer_question",
        "answer_question",
        { question: command, filePath, folder },
        `Reading summary of ${filePath}.`
      );
    }
  }

  // Shorthand: "downloads pdf" or "pdf in downloads"
  if (extension && extractFolder(text)) {
    if (/\b(list|show|all|files?)\b/.test(text) || text.split(" ").length <= 4) {
      return plan(
        "list_folder",
        "list_folder",
        { folderPath: folder, extension },
        `Listing ${extension} files in ${folder}.`
      );
    }
  }

  return null;
}

export function interpretCommand(command: string): AIActionPlan | null {
  return parseLocalCommand(command);
}
