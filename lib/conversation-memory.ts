export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 16;
const history: ChatMessage[] = [];

export function getConversationHistory(): ChatMessage[] {
  return [...history];
}

export function addConversationTurn(user: string, assistant: string): void {
  history.push({ role: "user", content: user });
  history.push({ role: "assistant", content: assistant });
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

export function clearConversationHistory(): void {
  history.length = 0;
}
