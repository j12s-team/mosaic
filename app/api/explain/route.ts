import { NextRequest, NextResponse } from "next/server";
import type { Basket } from "@/lib/types";

/**
 * Generate a ≤280-char tweet-style explanation of a basket. Uses Claude
 * Haiku when ANTHROPIC_API_KEY is set, falls back to a deterministic
 * template otherwise so the feature works offline.
 */
export async function POST(req: NextRequest) {
  let body: { basket?: Basket };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.basket) return NextResponse.json({ error: "basket required" }, { status: 400 });

  const text = await viaClaude(body.basket).then(
    (t) => t ?? deterministic(body.basket!),
  );
  return NextResponse.json({ text });
}

async function viaClaude(basket: Basket): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const constituents = basket.constituents
      .map((c) => `${c.symbol} ${(c.weight * 100).toFixed(0)}%`)
      .join(", ");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:
          "Write a single tweet (≤ 280 characters, no hashtags unless they fit naturally, no quotation marks) " +
          "explaining a crypto basket in human terms. Tone: confident, plain English, no jargon, no emojis. " +
          "Mention 1–2 concrete tickers and one risk/reward angle. End with: Built with Mosaic on SoSoValue + SoDEX.",
        messages: [
          {
            role: "user",
            content:
              `Thesis: ${basket.thesis.prompt}\n` +
              `Risk: ${basket.thesis.risk}\n` +
              `Constituents: ${constituents}\n` +
              `Risk score: ${basket.riskScore}/100\n` +
              `Reasoning: ${basket.reasoning.slice(0, 400)}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data.content?.[0]?.text;
    if (!text) return null;
    return text.trim().slice(0, 280);
  } catch {
    return null;
  }
}

function deterministic(basket: Basket): string {
  const top = basket.constituents
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => `$${c.symbol} ${(c.weight * 100).toFixed(0)}%`)
    .join(", ");
  const risk = basket.thesis.risk;
  const score = basket.riskScore;
  const benchmark = basket.benchmark?.symbol;
  const tail = benchmark ? ` Benched vs ${benchmark}.` : "";
  const body =
    `${capitalise(risk)}-risk crypto basket: ${top}. Risk score ${score}/100.${tail}` +
    ` Built with Mosaic on SoSoValue + SoDEX.`;
  return body.length <= 280 ? body : body.slice(0, 277) + "…";
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
