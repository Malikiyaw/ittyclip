import type { Phase5Context, Phase5Operation } from "@/lib/ai/phase5";
import { aiHeaders } from "@/lib/ai/settings";

export async function requestPhase5<T>(operation: Phase5Operation, context: Phase5Context, extra = "", signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/ai/phase5", {
    method: "POST",
    headers: aiHeaders(),
    body: JSON.stringify({ operation, context, extra }),
    signal,
  });
  const data = await response.json().catch(() => null) as { error?: string; code?: string; value?: T } | null;
  if (!response.ok) throw new Error(data?.error || `Phase 5 AI request failed (${response.status})`);
  if (!data || !("value" in data)) throw new Error("Phase 5 AI returned an invalid response.");
  return data.value as T;
}
