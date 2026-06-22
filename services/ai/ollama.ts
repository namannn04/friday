import type { AIActionPlan } from "@/types";
import type { AIProvider } from "./provider";
import { buildSystemPrompt, parseAIResponse } from "./provider";

export class OllamaProvider implements AIProvider {
  name = "ollama";

  constructor(
    private baseUrl: string,
    private model: string
  ) {}

  async interpretCommand(command: string): Promise<AIActionPlan | null> {
    const systemPrompt = buildSystemPrompt();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: command },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
    };

    const content = data.message?.content || "";
    return parseAIResponse(content);
  }
}
