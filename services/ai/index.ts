import type { AppSettings } from "@/types";
import type { AIProvider } from "./provider";
import { OllamaProvider } from "./ollama";

export function createAIProvider(settings: AppSettings): AIProvider {
  switch (settings.aiProvider) {
    case "ollama":
    default:
      return new OllamaProvider(settings.ollamaBaseUrl, settings.ollamaModel);
  }
}

export async function checkOllamaStatus(
  baseUrl: string,
  model: string
): Promise<{ online: boolean; model: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false, model };
    const data = (await res.json()) as { models?: { name: string }[] };
    const hasModel = data.models?.some((m) => m.name.startsWith(model));
    return { online: true, model: hasModel ? model : `${model} (not pulled)` };
  } catch {
    return { online: false, model };
  }
}
