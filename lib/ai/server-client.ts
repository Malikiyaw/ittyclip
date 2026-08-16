import { randomUUID } from "node:crypto";
import { getAiCache, setAiCache } from "@/lib/ai/cache";
import { recordAiUsage } from "@/lib/ai/usage";

export const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export type RunAiOptions<T> = {
  operation: string;
  messages: AiMessage[];
  validate: (value: unknown) => T;
  cacheKey?: string;
  cacheTtlMs?: number;
  primaryModel?: string;
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export class AiClientError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "UPSTREAM" | "TIMEOUT" | "INVALID_RESPONSE" | "VALIDATION",
    public readonly attempts = 0
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

function extractJson(content: string): unknown {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((n) => n >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
    }
    throw new AiClientError("AI returned invalid JSON.", "INVALID_RESPONSE");
  }
}

async function callModel(apiKey: string, model: string, messages: AiMessage[], timeoutMs: number, temperature: number, maxTokens: number, strictJson: boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(NVIDIA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, ...(strictJson ? { response_format: { type: "json_object" } } : {}) }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new AiClientError("AI request timed out.", "TIMEOUT");
      throw new AiClientError(error instanceof Error ? error.message : "AI request failed.", "UPSTREAM");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AiClientError(`AI provider returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`, "UPSTREAM");
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AiClientError("AI provider returned an empty response.", "INVALID_RESPONSE");
    return extractJson(content);
  } finally {
    clearTimeout(timer);
  }
}

export async function runAi<T>(options: RunAiOptions<T>) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const inputChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);

  if (options.cacheKey) {
    const cached = getAiCache<T>(options.cacheKey);
    if (cached !== undefined) {
      recordAiUsage({ requestId, operation: options.operation, model: "cache", status: "cache", startedAt, durationMs: Date.now() - startedAt, inputChars, outputChars: 0, attempts: 0 });
      return { value: cached, model: "cache", requestId, attempts: 0, cached: true };
    }
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new AiClientError("AI engine is not configured on this deployment.", "NOT_CONFIGURED");

  const primary = options.primaryModel ?? process.env.AI_PRIMARY_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1";
  const fallbacks = options.fallbackModels ?? [process.env.AI_FAST_MODEL ?? "openai/gpt-oss-120b"];
  const models = [primary, ...fallbacks.filter((m) => Boolean(m) && m !== primary)];
  const temperature = options.temperature ?? Number(process.env.AI_TEMPERATURE ?? 0.2);
  const maxTokens = options.maxTokens ?? Number(process.env.AI_MAX_TOKENS ?? 3500);
  const timeoutMs = options.timeoutMs ?? 95_000;
  let attempts = 0;
  let lastError: AiClientError | undefined;

  for (const model of models) {
    for (let retry = 0; retry < 2; retry++) {
      attempts += 1;
      try {
        const raw = await callModel(apiKey, model, options.messages, model === primary ? timeoutMs : Math.min(timeoutMs, 60_000), retry ? Math.min(0.7, temperature + 0.3) : temperature, maxTokens, retry === 0);
        let value: T;
        try { value = options.validate(raw); }
        catch (error) { throw new AiClientError(error instanceof Error ? error.message : "AI response failed validation.", "VALIDATION"); }
        if (options.cacheKey) setAiCache(options.cacheKey, value, options.cacheTtlMs);
        recordAiUsage({ requestId, operation: options.operation, model, status: "success", startedAt, durationMs: Date.now() - startedAt, inputChars, outputChars: JSON.stringify(value).length, attempts });
        return { value, model, requestId, attempts, cached: false };
      } catch (error) {
        lastError = error instanceof AiClientError ? error : new AiClientError(error instanceof Error ? error.message : "AI request failed.", "UPSTREAM");
      }
    }
  }

  recordAiUsage({ requestId, operation: options.operation, model: models[models.length - 1], status: "error", startedAt, durationMs: Date.now() - startedAt, inputChars, outputChars: 0, attempts });
  throw new AiClientError(lastError?.message ?? "AI analysis failed.", lastError?.code ?? "UPSTREAM", attempts);
}
