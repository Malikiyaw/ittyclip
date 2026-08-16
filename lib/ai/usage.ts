export type AiUsageRecord = {
  requestId: string;
  operation: string;
  model: string;
  status: "success" | "error" | "cache";
  startedAt: number;
  durationMs: number;
  inputChars: number;
  outputChars: number;
  attempts: number;
};

const records: AiUsageRecord[] = [];
const MAX_RECORDS = 500;

export function recordAiUsage(record: AiUsageRecord): void {
  records.push(record);
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
}

export function getAiUsageSummary() {
  const byOperation: Record<string, { requests: number; errors: number; cacheHits: number; avgMs: number }> = {};
  for (const record of records) {
    const current = byOperation[record.operation] ?? { requests: 0, errors: 0, cacheHits: 0, avgMs: 0 };
    current.requests += 1;
    if (record.status === "error") current.errors += 1;
    if (record.status === "cache") current.cacheHits += 1;
    current.avgMs += record.durationMs;
    byOperation[record.operation] = current;
  }
  for (const value of Object.values(byOperation)) {
    value.avgMs = value.requests ? Math.round(value.avgMs / value.requests) : 0;
  }
  return { total: records.length, byOperation };
}
