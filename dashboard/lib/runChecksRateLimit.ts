/**
 * Process-local rate limit for POST /api/run-checks. Reduces DoS from repeated heavy runs.
 * For multi-instance or strict guarantees, use an injectable store or platform rate limiting (e.g. Vercel).
 */
import type { NextRequest } from "next/server";

const RUN_CHECKS_COOLDOWN_SEC = 15;
const rateLimitMap = new Map<string, number>();

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function isRunChecksRateLimited(ip: string): boolean {
  const now = Date.now() / 1000;
  const last = rateLimitMap.get(ip);
  if (last != null && now - last < RUN_CHECKS_COOLDOWN_SEC) return true;
  rateLimitMap.set(ip, now);
  if (rateLimitMap.size > 1000) {
    const oldest = Math.min(...rateLimitMap.values());
    for (const [k, v] of rateLimitMap.entries()) if (v === oldest) rateLimitMap.delete(k);
  }
  return false;
}
