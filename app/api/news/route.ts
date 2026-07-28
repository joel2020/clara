// "Noticias de hoy" — current events in easy American English. We fetch the
// NPR top-stories RSS (facts/headlines), then have the model REWRITE each into
// one simple A2 sentence with a Spanish translation — our own wording, not the
// article text, so it's both level-appropriate and copyright-clean. Cached in
// memory for 6 hours: at most a few tiny model calls per day.

import OpenAI from "openai";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const FEED = "https://feeds.npr.org/1001/rss.xml";
const CACHE_MS = 6 * 60 * 60 * 1000;
const MODEL = "gpt-4o-mini";

interface NewsItem {
  en: string;
  es: string;
}

let cache: { at: number; items: NewsItem[] } | null = null;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string", description: "The story retold as ONE very simple A2 American English sentence." },
          es: { type: "string", description: "A natural Spanish translation of en." },
        },
        required: ["en", "es"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

function extractHeadlines(xml: string, max = 3): string[] {
  const out: string[] = [];
  // Titles inside <item> blocks; the first <title> in the doc is the channel's.
  const items = xml.split("<item>").slice(1);
  for (const chunk of items) {
    const m = chunk.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = m?.[1]?.trim();
    if (title) out.push(title);
    if (out.length >= max) break;
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  // This route spends OpenAI money on a cache miss (and the cache is per warm
  // serverless instance, not global), so it requires a signed-in, allowlisted
  // user like every other paid route. No origin check: browsers don't send an
  // Origin header on same-origin GETs, and the session is the real gate.
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "not_configured" }, { status: 503 });

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json({ items: cache.items, cached: true });
  }

  try {
    const rss = await fetch(FEED, { signal: AbortSignal.timeout(8000) });
    if (!rss.ok) throw new Error(String(rss.status));
    const headlines = extractHeadlines(await rss.text());
    if (!headlines.length) throw new Error("no headlines");

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      // Also raised for reasoning-capable models — see app/api/chat/route.ts. A
      // three-story rewrite needs far fewer than this, so the ceiling only ever
      // matters as headroom for internal reasoning.
      max_completion_tokens: 2000,
      messages: [
        {
          role: "system",
          content:
            "You rewrite news headlines for an adult A1-A2 English learner from Colombia. For each headline, retell the story as ONE very simple American English sentence (common words only, present tense where natural), plus a natural Spanish translation. Neutral tone; no opinions; no scary detail.",
        },
        { role: "user", content: headlines.map((h, i) => `${i + 1}. ${h}`).join("\n") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "easy_news", strict: true, schema: SCHEMA },
      },
    });

    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("empty");
    const parsed = JSON.parse(content) as { items: NewsItem[] };
    const items = (parsed.items ?? []).slice(0, 3).filter((i) => i.en && i.es);
    if (!items.length) throw new Error("no items");

    cache = { at: Date.now(), items };
    return Response.json({ items, cached: false });
  } catch {
    // Serve a stale cache over an error if we have one.
    if (cache) return Response.json({ items: cache.items, cached: true });
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
