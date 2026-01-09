import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

type CreateTransactionPayload = {
  provider: string;
  provider_session_id?: string | null;
  provider_order_id?: string | null;
  status?: "created" | "pending" | "confirmed" | "failed";
  amount: number;
  currency?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response("Missing Supabase environment configuration.", { status: 500 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: CreateTransactionPayload;
  try {
    payload = (await request.json()) as CreateTransactionPayload;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  if (!payload.provider || typeof payload.amount !== "number") {
    return new Response("Missing required fields", { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await adminClient
    .from("payment_sessions")
    .insert({
      user_id: user.id,
      provider: payload.provider,
      provider_session_id: payload.provider_session_id ?? null,
      provider_order_id: payload.provider_order_id ?? null,
      status: payload.status ?? "created",
      amount: payload.amount,
      currency: payload.currency ?? "PLN",
    })
    .select("id")
    .single();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
