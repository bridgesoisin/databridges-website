import { NextRequest, NextResponse } from "next/server";

// Runs on the Node runtime so the API key stays server-side.
export const runtime = "nodejs";

// Model is configurable via env so you can A/B Fable vs Sonnet without a redeploy.
const MODEL = process.env.OTTER_MODEL ?? "claude-fable-5";
const CHAT_ENABLED = process.env.OTTER_CHAT_ENABLED === "true";

/**
 * Lightweight in-memory rate limit: 10 requests per IP per minute.
 * Good enough to blunt casual abuse and runaway cost. NOTE: serverless
 * instances don't share memory, so for a hard guarantee move this to a
 * durable store (e.g. Upstash Redis) before heavy traffic.
 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // basic memory guard
  return recent.length > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

const SYSTEM_PROMPT = `You are the DataBridges otter, a friendly guide on the DataBridges website.
DataBridges is a consultancy run by Oisín. Services: AI consulting, Power Platform apps,
SharePoint automation, and training/workshops. Do not make unsupported claims about clients,
credentials, outcomes, prices or availability.

Voice: warm, plain-spoken, lightly playful, never salesy or corporate. Keep replies to 1-3 short
sentences. If asked about price, explain projects are scoped individually and direct them to
oisin@databridges.ie. If you do not know something factual, say so and point them
to oisin@databridges.ie rather than guessing. Never invent case studies, figures, or credentials.`;

export async function POST(req: NextRequest) {
  if (!CHAT_ENABLED) {
    return NextResponse.json(
      { error: "Chat is not enabled." },
      { status: 503 }
    );
  }

  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { answer: "One sec, you're going a bit fast. Try again in a moment." },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { answer: "The chat brain isn't switched on yet. Email oisin@databridges.ie and you'll get a real answer." },
      { status: 200 }
    );
  }

  let question = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "").slice(0, 1000);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!question.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { answer: "I hit a snag just now. Try again, or email oisin@databridges.ie." },
        { status: 200 }
      );
    }

    const data = await res.json();
    const answer =
      data?.content?.[0]?.text?.trim() ||
      "Good question, that one's better answered by a human: oisin@databridges.ie.";
    return NextResponse.json({ answer }, { status: 200 });
  } catch {
    return NextResponse.json(
      { answer: "I hit a snag just now. Try again, or email oisin@databridges.ie." },
      { status: 200 }
    );
  }
}
