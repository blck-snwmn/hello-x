const GROK_API_URL = "https://api.x.ai/v1/responses";
const MODEL = "grok-4-1-fast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResponseItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

export interface XSearchOptions {
  fromDate?: string; // ISO8601 e.g. "2026-01-01"
  toDate?: string;   // ISO8601 e.g. "2026-03-01"
  handles?: string[]; // e.g. ["@ui_shig"]
}

export async function askWithXSearch(
  question: string,
  options?: XSearchOptions,
): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROK_API_KEY is not set. Copy .env.example to .env and set your key."
    );
  }

  const xSearch: Record<string, unknown> = { type: "x_search" };
  if (options?.fromDate) xSearch.from_date = options.fromDate;
  if (options?.toDate) xSearch.to_date = options.toDate;
  if (options?.handles) xSearch.allowed_x_handles = options.handles;

  let prompt = question;
  if (options?.handles?.length) {
    const users = options.handles.join(", ");
    prompt = `以下のXユーザー(${users})の投稿を元に回答してください。\n\n${question}`;
  }

  const body = {
    model: MODEL,
    input: [{ role: "user", content: prompt }] satisfies Message[],
    tools: [xSearch],
  };

  const res = await fetch(GROK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { output?: ResponseItem[] };

  const outputItems: ResponseItem[] = data.output ?? [];
  const texts: string[] = [];
  for (const item of outputItems) {
    if (item.type === "message" && item.content) {
      for (const block of item.content) {
        if (block.type === "output_text" && block.text) {
          texts.push(block.text);
        }
      }
    }
  }

  if (texts.length === 0) {
    throw new Error("No text output from Grok API");
  }

  return texts.join("\n");
}
