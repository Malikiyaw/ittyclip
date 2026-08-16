import { NextResponse } from "next/server";
import { runPhase3, sanitizePhase3Context, type Phase3Operation } from "@/lib/ai/phase3";
import { AiClientError } from "@/lib/ai/server-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPS: Phase3Operation[] = ["caption-intelligence", "caption-style"];

export async function POST(req: Request) {
  try {
    const raw = await req.json() as { operation?: unknown; context?: unknown };
    const operation = raw.operation as Phase3Operation;
    if (!OPS.includes(operation)) return NextResponse.json({ error: "Unsupported Phase 3 operation." }, { status: 400 });
    const context = sanitizePhase3Context(raw.context);
    const result = await runPhase3(operation, context);
    return NextResponse.json({ operation, ...result });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Phase 3 request." }, { status: 400 });
  }
}
