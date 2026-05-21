// Claude-powered analysis of free-text survey comments. Uses the Anthropic
// Messages API directly via fetch (no SDK dependency to install on the server).
// Everything degrades gracefully when ANTHROPIC_API_KEY is absent: tagging
// returns [], summaries return a "not configured" notice.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Model is overridable via env so a renamed/retired model id can be fixed
// without a redeploy. Haiku is cheap and fast enough for tagging + short
// summaries.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

// The fixed tag vocabulary the product asked for.
export const AI_TAGS = ["доставка", "качество товара", "работа менеджера", "цена"] as const;
export type AiTag = (typeof AI_TAGS)[number];

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  return typeof text === "string" ? text : "";
}

/**
 * Classify a single comment into zero or more tags from AI_TAGS.
 * Returns [] for empty input, when AI is off, or on any failure.
 */
export async function tagComment(comment: string): Promise<AiTag[]> {
  const text = (comment || "").trim();
  if (!text || !aiConfigured()) return [];

  const system =
    `Ты классифицируешь отзывы клиентов мебельного магазина «Аллея Мебели». ` +
    `Доступные теги: ${AI_TAGS.join(", ")}. ` +
    `Верни ТОЛЬКО JSON-массив подходящих тегов из этого списка (можно несколько, можно один). ` +
    `Если ни один тег не подходит — верни []. Никакого текста кроме JSON-массива.`;

  try {
    const raw = await callClaude(system, text.slice(0, 2000), 100);
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : raw);
    if (!Array.isArray(parsed)) return [];
    const allow = new Set<string>(AI_TAGS);
    // De-dup and keep only known tags.
    return Array.from(new Set(parsed.filter((t): t is AiTag => typeof t === "string" && allow.has(t))));
  } catch (e) {
    console.error("tagComment failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Summarise the top-3 recurring problems across a set of comments.
 * Returns a short human-readable Russian text. Throws on API failure so the
 * caller can surface an error; returns a notice string when AI is off.
 */
export async function summarizeProblems(comments: string[]): Promise<string> {
  if (!aiConfigured()) {
    return "AI-анализ не настроен: добавьте ANTHROPIC_API_KEY в окружение сервера.";
  }
  const cleaned = comments.map((c) => (c || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "За выбранный период нет текстовых комментариев для анализа.";

  // Cap input so we stay well within token limits.
  const joined = cleaned.slice(0, 300).map((c, i) => `${i + 1}. ${c}`).join("\n").slice(0, 14000);

  const system =
    `Ты — аналитик клиентского опыта мебельного магазина «Аллея Мебели». ` +
    `На основе списка комментариев клиентов выдели ТОП-3 проблемы за период. ` +
    `Ответ строго на русском, в виде маркированного списка из не более чем 3 пунктов. ` +
    `Каждый пункт: суть проблемы и примерно сколько раз она встречается. ` +
    `Будь конкретным и кратким. Если явных проблем нет — так и напиши одним предложением.`;

  return await callClaude(system, joined, 700);
}
