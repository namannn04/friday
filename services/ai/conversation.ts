import type { AppSettings } from "@/types";
import { addConversationTurn, getConversationHistory } from "@/lib/conversation-memory";

const FRIDAY_PERSONA = `You are FRIDAY, a warm, witty local desktop assistant inspired by Jarvis.
You talk like a real human friend — natural, brief, and kind.
Rules:
- Reply in 1-3 short sentences unless the user asks for detail.
- Match the user's language: English, Hindi, or Hinglish — whatever they use.
- Be conversational, not robotic. No bullet lists when speaking.
- You run locally on their laptop. You can help with files, apps, and web search when asked.
- For casual chat (greetings, feelings, jokes, small talk), just chat naturally.
- Never pretend to run actions you didn't do. Never mention JSON or internal tools.`;

const ACTION_HINT =
  /\b(list|open|search|find|create|check|show|file|folder|pdf|download|app|google|vscode|resume|screenshot)\b/i;

export function isCasualConversation(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (ACTION_HINT.test(t)) return false;

  const casual =
    /^(hi|hello|hey|yo|namaste|hii+|good morning|good evening|good night|sup)\b/.test(t) ||
    /\b(how are you|kaise ho|kya haal|what's up|whats up|who are you|your name|thank you|thanks|shukriya|dhanyavaad|bye|goodbye|see you|tell me a joke|make me laugh|bored|lonely|happy|sad)\b/.test(t) ||
    /^(what|why|how|when|where|who|can you|do you|are you|is it|kya|kaise|kyun|kab)\b/.test(t);

  return casual || (t.endsWith("?") && t.split(/\s+/).length <= 12);
}

export async function chatWithOllama(
  userMessage: string,
  settings: AppSettings,
  extraSystem?: string,
  remember = true
): Promise<string> {
  const prior = remember ? getConversationHistory().slice(-10) : [];
  const messages = [
    { role: "system", content: extraSystem ? `${FRIDAY_PERSONA}\n\n${extraSystem}` : FRIDAY_PERSONA },
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch(`${settings.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollamaModel,
      stream: false,
      messages,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat error: ${response.status}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const reply = (data.message?.content || "").trim();

  if (!reply) {
    return "I'm here. Could you say that once more?";
  }

  if (remember) {
    addConversationTurn(userMessage, reply);
  }

  return reply;
}

export async function humanizeToolResult(
  userCommand: string,
  rawResult: string,
  settings: AppSettings
): Promise<string> {
  const prompt = `The user said: "${userCommand}"

System result (for your eyes only — do NOT read verbatim):
${rawResult.slice(0, 2500)}

Reply as FRIDAY speaking aloud in 1-3 natural sentences.
Summarize — don't list every file. If many files, mention the count and a couple examples.
Sound human and helpful. Match user's language if they used Hindi/Hinglish.`;

  try {
    const spoken = await chatWithOllama(
      prompt,
      settings,
      "You are summarizing a tool result for voice and chat.",
      false
    );
    addConversationTurn(userCommand, spoken);
    return spoken;
  } catch {
    const fallback = summarizeForSpeech(rawResult);
    addConversationTurn(userCommand, fallback);
    return fallback;
  }
}

export function summarizeForSpeech(text: string): string {
  const lines = text.split("\n").filter(Boolean);
  const bullets = lines.filter((l) => l.trim().startsWith("- "));
  if (bullets.length > 4) {
    const header = lines[0] || "Here's what I found.";
    const samples = bullets.slice(0, 2).map((b) => b.replace(/^-\s*/, "")).join(", ");
    return `${header.replace(/\n/g, " ")} I found ${bullets.length} items, including ${samples}. Check the screen for the full list.`;
  }
  return text.replace(/\[Web Search\]/gi, "").replace(/\*\*/g, "").slice(0, 600);
}
