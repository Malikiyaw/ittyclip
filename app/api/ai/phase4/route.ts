import { NextResponse } from "next/server";
import { runPhase4, sanitizePhase4Context, type Phase4Operation, type Phase4Platform } from "@/lib/ai/phase4";
import { AiClientError } from "@/lib/ai/server-client";

export const runtime = "nodejs";
export const maxDuration = 120;
const OPERATIONS: Phase4Operation[] = ["hooks", "titles", "description", "hashtags", "platform"];
const PLATFORMS: Phase4Platform[] = ["tiktok", "youtube", "instagram"];

export async function POST(req: Request) {
  try {
    const raw = await req.json() as { operation?: unknown; platform?: unknown; context?: unknown };
    const operation = raw.operation as Phase4Operation;
    const platform = (PLATFORMS.includes(raw.platform as Phase4Platform) ? raw.platform : "tiktok") as Phase4Platform;
    if (!OPERATIONS.includes(operation)) return NextResponse.json({ error: "Unsupported Phase 4 operation." }, { status: 400 });
    const context = sanitizePhase4Context(raw.context);
    const result = await runPhase4(operation, context, platform);
    return NextResponse.json({ operation, platform, ...result });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid AI request." }, { status: 400 });
  }
}
