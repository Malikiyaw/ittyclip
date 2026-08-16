import { NextResponse } from "next/server";
import { getAiCacheStats } from "@/lib/ai/cache";
import { getAiUsageSummary } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.NVIDIA_API_KEY),
    primaryModel: process.env.AI_PRIMARY_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
    fallbackModel: process.env.AI_FAST_MODEL ?? "openai/gpt-oss-120b",
    cache: getAiCacheStats(),
    usage: getAiUsageSummary(),
  });
}
