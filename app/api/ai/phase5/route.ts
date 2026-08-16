import { NextResponse } from "next/server";
import { AiClientError, readAiRequestConfig } from "@/lib/ai/server-client";
import { runPhase5, sanitizePhase5Context, type Phase5Operation } from "@/lib/ai/phase5";

export const runtime = "nodejs";
export const maxDuration = 120;
const OPERATIONS: Phase5Operation[] = ["reframe", "audio", "scenes", "preflight"];

export async function POST(req: Request) {
  try {
    const raw = await req.json() as { operation?: unknown; context?: unknown; extra?: unknown };
    const operation = raw.operation as Phase5Operation;
    if (!OPERATIONS.includes(operation)) return NextResponse.json({ error: "Unsupported Phase 5 operation." }, { status: 400 });
    const context = sanitizePhase5Context(raw.context);
    const extra = typeof raw.extra === "string" ? raw.extra.slice(0, 4000) : "";
    const result = await runPhase5(operation, context, extra, readAiRequestConfig(req));
    return NextResponse.json({ operation, ...result });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid AI request." }, { status: 400 });
  }
}
