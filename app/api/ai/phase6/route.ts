import { NextResponse } from "next/server";
import { runPhase6, sanitizePhase6Context } from "@/lib/ai/phase6";
import { AiClientError } from "@/lib/ai/server-client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const raw = await req.json() as { request?: unknown; context?: unknown };
    if (typeof raw.request !== "string" || !raw.request.trim()) return NextResponse.json({ error: "request is required" }, { status: 400 });
    const context = sanitizePhase6Context(raw.context);
    const result = await runPhase6(context, raw.request);
    return NextResponse.json({ ...result.value, model: result.model, requestId: result.requestId, cached: result.cached, attempts: result.attempts });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : error.code === "VALIDATION" ? 422 : 502;
      return NextResponse.json({ error: error.message, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid AI request." }, { status: 400 });
  }
}
