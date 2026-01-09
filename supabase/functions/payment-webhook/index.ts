import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const receivedAt = new Date().toISOString();
  let payload: Record<string, unknown> | null = null;

  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const provider =
    pickFirst(
      typeof payload?.provider === "string" ? payload?.provider : undefined,
      req.headers.get("x-provider") ?? undefined
    ) ?? "unknown";

  const eventType =
    pickFirst(
      typeof payload?.event_type === "string" ? payload?.event_type : undefined,
      typeof payload?.type === "string" ? payload?.type : undefined,
      req.headers.get("x-event-type") ?? undefined
    ) ?? "unknown";

  const providerTransactionId =
    pickFirst(
      typeof payload?.provider_transaction_id === "string"
        ? payload?.provider_transaction_id
        : undefined,
      typeof payload?.transaction_id === "string" ? payload?.transaction_id : undefined,
      typeof payload?.id === "string" ? payload?.id : undefined,
      typeof payload?.data === "object" && payload?.data &&
        typeof (payload.data as Record<string, unknown>).id === "string"
        ? (payload.data as Record<string, unknown>).id
        : undefined
    ) ?? null;

  const userId = pickFirst(
    typeof payload?.user_id === "string" ? payload?.user_id : undefined,
    typeof payload?.userId === "string" ? payload?.userId : undefined,
    typeof payload?.data === "object" && payload?.data &&
      typeof (payload.data as Record<string, unknown>).user_id === "string"
      ? (payload.data as Record<string, unknown>).user_id
      : undefined,
    typeof payload?.metadata === "object" && payload?.metadata &&
      typeof (payload.metadata as Record<string, unknown>).user_id === "string"
      ? (payload.metadata as Record<string, unknown>).user_id
      : undefined
  );

  const { error } = await supabase.from("payment_events").insert({
    user_id: userId,
    provider,
    event_type: eventType,
    provider_transaction_id: providerTransactionId,
    payload: payload ?? {},
    received_at: receivedAt
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
