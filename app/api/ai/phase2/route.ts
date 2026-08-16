import { NextResponse } from "next/server";
import { runPhase2, sanitizeContext, type Phase2Operation } from "@/lib/ai/phase2";
import { AiClientError } from "@/lib/ai/server-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPERATIONS: Phase2Operation[] = ["insights", "hooks", "titles", "captions", "trim"];

export async function POST(req: Request) {
  try {
    const raw = await req.json() as { operation?: unknown; context?: unknown; extra?: unknown };
    const operation = raw.operation as Phase2Operation;
    if (!OPERATIONS.includes(operation)) return NextResponse.json({ error: "Unsupported AI operation." }, { status: 400 });
    const context = sanitizeContext(raw.context);
    const extra = typeof raw.extra === "string" ? raw.extra.slice(0, 5000) : "";
    const result = await runPhase2(operation, context, extra);
    return NextResponse.json({ operation, ...result });
  } catch (error) {
    if (error instanceof AiClientError) {
      const status = error.code === "NOT_CONFIGURED" ? 503 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code, attempts: error.attempts }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid AI request." }, { status: 400 });
  }
}
