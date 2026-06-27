/** Shared text cleanup for TTS (main + renderer) */
export function prepareTextForSpeech(text: string): string {
  let cleaned = text
    .replace(/\[Web Search\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^RESULT:\s*/i, "")
    .replace(/^Voice error:\s*/i, "")
    .trim();

  const lines = cleaned.split("\n").filter(Boolean);
  const bullets = lines.filter((l) => l.trim().startsWith("- "));

  if (bullets.length > 5) {
    const intro = lines.find((l) => !l.trim().startsWith("- ")) || "Here's what I found.";
    const count = bullets.length;
    const sample = bullets
      .slice(0, 2)
      .map((b) => b.replace(/^-\s*/, ""))
      .join(", ");
    return `${intro} I found ${count} items, including ${sample}. Check the screen for details.`;
  }

  if (cleaned.length > 500) {
    cleaned = `${cleaned.slice(0, 480).trim()}…`;
  }

  return cleaned;
}
