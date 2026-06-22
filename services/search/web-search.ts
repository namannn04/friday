import search from "duck-duck-scrape";
import type { ToolResult } from "@/types";

export async function performWebSearch(query: string): Promise<ToolResult> {
  try {
    const results = await search.search(query, { safeSearch: search.SafeSearchType.STRICT });

    if (!results.results?.length) {
      return {
        success: true,
        message: `No web results found for "${query}".`,
        data: { query, results: [] },
      };
    }

    const top = results.results.slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));

    const summary = top
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.description || ""}\n   ${r.url}`)
      .join("\n\n");

    return {
      success: true,
      message: `[Web Search] Results for "${query}":\n\n${summary}`,
      data: { query, results: top, fromWebSearch: true },
    };
  } catch (error) {
    return {
      success: false,
      message: `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
