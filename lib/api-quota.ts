import { createClient } from "@supabase/supabase-js";

export type PaidRoute =
  | "assess"
  | "call-score"
  | "chat"
  | "grade"
  | "news"
  | "transcribe"
  | "tts"
  | "virtual-call-report"
  | "virtual-call-turn";

export interface QuotaDecision {
  allowed: boolean;
  scope?: "user-day" | "global-minute";
  retryAfterSeconds?: number;
}

interface PaidApiBudget {
  userPerDay: number;
  globalPerMinute: number;
}

/**
 * Provider budgets are deliberately route-specific. A normal day can include
 * one 30-turn virtual call (turn + transcribe + assess + TTS), a lesson with
 * repeated pronunciation attempts, and a few chats; grading/report endpoints
 * stay much tighter because they should run only at activity boundaries.
 */
export const PAID_API_BUDGETS: Readonly<Record<PaidRoute, Readonly<PaidApiBudget>>> = Object.freeze({
  assess: { userPerDay: 180, globalPerMinute: 120 },
  "call-score": { userPerDay: 12, globalPerMinute: 15 },
  chat: { userPerDay: 100, globalPerMinute: 80 },
  grade: { userPerDay: 24, globalPerMinute: 20 },
  news: { userPerDay: 8, globalPerMinute: 15 },
  transcribe: { userPerDay: 220, globalPerMinute: 150 },
  tts: { userPerDay: 220, globalPerMinute: 150 },
  "virtual-call-report": { userPerDay: 8, globalPerMinute: 15 },
  "virtual-call-turn": { userPerDay: 100, globalPerMinute: 90 },
});

class QuotaUnavailableError extends Error {
  constructor() {
    super("Durable quota unavailable");
    this.name = "QuotaUnavailableError";
  }
}

type RpcRow = {
  allowed?: unknown;
  scope?: unknown;
  retry_after_seconds?: unknown;
};

function parseDecision(data: unknown): QuotaDecision {
  if (!Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object") {
    throw new QuotaUnavailableError();
  }
  const row = data[0] as RpcRow;
  if (row.allowed === true) return { allowed: true };
  if (row.allowed !== false || (row.scope !== "user-day" && row.scope !== "global-minute")) {
    throw new QuotaUnavailableError();
  }
  if (!Number.isInteger(row.retry_after_seconds) || (row.retry_after_seconds as number) < 1) {
    throw new QuotaUnavailableError();
  }
  return {
    allowed: false,
    scope: row.scope,
    retryAfterSeconds: row.retry_after_seconds as number,
  };
}

/** Consume both durable windows in one database transaction. */
export async function consumePaidApiQuota(input: {
  userId: string;
  route: PaidRoute;
  now?: Date;
}): Promise<QuotaDecision> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const budget = PAID_API_BUDGETS[input.route];
  if (!url || !serviceKey || !budget) throw new QuotaUnavailableError();

  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new QuotaUnavailableError();

  try {
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("consume_paid_api_quota", {
      p_user_id: input.userId,
      p_route: input.route,
      p_user_day_limit: budget.userPerDay,
      p_global_minute_limit: budget.globalPerMinute,
      p_now: now.toISOString(),
    });
    if (error) throw new QuotaUnavailableError();
    return parseDecision(data);
  } catch {
    // Database and transport details are deliberately not logged or returned:
    // this path can include internal schema/provider information.
    throw new QuotaUnavailableError();
  }
}

/** Convert a durable decision into the stable paid-route HTTP contract. */
export async function enforcePaidApiQuota(input: {
  userId: string;
  route: PaidRoute;
  now?: Date;
}): Promise<Response | null> {
  try {
    const decision = await consumePaidApiQuota(input);
    if (decision.allowed) return null;
    return Response.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "retry-after": String(decision.retryAfterSeconds) },
      },
    );
  } catch {
    return Response.json({ error: "quota_unavailable" }, { status: 503 });
  }
}
