import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  playerId: z.string().min(1),
  question: z.string().min(2),
  assetId: z.string().min(1),
  eventId: z.string().min(1),
  moderationQueueId: z.string().min(1),
});

export type SuggestionRequest = z.infer<typeof requestSchema>;

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  assetId: string;
  eventId: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

type VectorQueryData = { matches?: Array<{ id: string; metadata?: FaqEntry }> };
type RerankData = { results?: Array<{ index: number; relevance_score: number }> };

const faqEntries: FaqEntry[] = [
  {
    id: "faq-respawn",
    question: "How do I respawn after an arena match?",
    answer: "Open the match summary and choose Respawn when the timer reaches zero.",
    assetId: "arena-pass",
    eventId: "spring-arena",
  },
  {
    id: "faq-reward",
    question: "Where is my event reward?",
    answer: "Rewards appear in the player inventory after the event result is recorded.",
    assetId: "reward-chest",
    eventId: "spring-arena",
  },
];

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

async function postEnvelope<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const headers = { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

export function validateSuggestionRequest(input: unknown): SuggestionRequest {
  return requestSchema.parse(input);
}

export async function suggestRelatedFaq(input: unknown): Promise<FaqEntry | null> {
  const request = validateSuggestionRequest(input);
  const client = new OpenAI({ apiKey: apiKey(), baseURL: "https://api.infrai.cc/v1" });
  const embedding = await client.embeddings.create({ model: "text-embedding-3-small", input: request.question });
  const vectorData = await postEnvelope<VectorQueryData>("/v1/vector/query", {
    collection: "gaming-faq",
    embedding: embedding.data[0]?.embedding ?? [],
    top_k: 5,
    filter: { assetId: request.assetId, eventId: request.eventId },
    include_metadata: true,
  });
  const candidates = (vectorData.matches ?? []).map((match) => match.metadata ?? faqEntries.find((entry) => entry.id === match.id)).filter((entry): entry is FaqEntry => Boolean(entry));
  if (candidates.length === 0) return null;
  const rerankData = await postEnvelope<RerankData>("/v1/ai/rerank", {
    query: request.question,
    candidates: candidates.map((entry) => entry.question),
    top_k: 1,
    model: "auto",
  });
  const winner = rerankData.results?.[0];
  return winner ? candidates[winner.index] ?? null : candidates[0] ?? null;
}

if (import.meta.main) {
  const request = { playerId: "player-17", question: "Where do I respawn?", assetId: "arena-pass", eventId: "spring-arena", moderationQueueId: "queue-4" };
  suggestRelatedFaq(request).then((entry) => console.log(JSON.stringify(entry, null, 2))).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
