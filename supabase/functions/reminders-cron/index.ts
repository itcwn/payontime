import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

type PaymentRecord = {
  id: string;
  user_id: string;
  payment_type: string;
  name: string | null;
  provider_address: string | null;
  schedule_mode: string;
  due_date: string | null;
  day_of_month: number | null;
  is_last_day: boolean;
  interval_unit: string | null;
  interval_months: number | null;
  interval_weeks: number | null;
  remind_offsets: number[] | null;
  is_active: boolean;
};

type UserSettings = {
  user_id: string;
  timezone: string;
  email_enabled: boolean;
};

const defaultTimezone = "Europe/Warsaw";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM") ?? "";

function logStep(step: string, details?: Record<string, unknown>) {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[reminders-cron] ${step}${payload}`);
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDateString(date: Date, timezone = defaultTimezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDateString(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateStringToNumber(dateString: string) {
  return Number(dateString.replaceAll("-", ""));
}

function buildUTCDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(year: number, month: number, increment: number) {
  const totalMonths = month + increment - 1;
  const nextYear = year + Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReminderEmailText(items: Array<{ name: string; due_date: string | null; provider_address: string | null }>) {
  const messageLines = [
    "Cześć, tu ZapłaćNaCzas!",
    "Oto Twoje zbliżające się płatności:",
    ...items.map(
      (item) =>
        `- ${item.name} | Termin płatności: ${item.due_date ?? "—"} | ${item.provider_address ?? "Brak linku"}`
    ),
    "",
    "Twój asystent ZapłaćNaCzas"
  ];

  return messageLines.join("\n");
}

function buildReminderEmailHtml(items: Array<{ name: string; due_date: string | null; provider_address: string | null }>) {
  const rows = items
    .map((item) => {
      const name = escapeHtml(item.name);
      const dueDate = escapeHtml(item.due_date ?? "—");
      const provider = item.provider_address
        ? `<a href="${escapeHtml(item.provider_address)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(
            item.provider_address
          )}</a>`
        : `<span style="color:#9ca3af;">Brak linku</span>`;
      return `
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;">${name}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;">${dueDate}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;">${provider}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <div style="background:#f8fafc;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:24px;border-bottom:1px solid #e2e8f0;">
        <img src="https://itcwn.github.io/payontime/css/logo_m.png" alt="ZapłaćNaCzas" style="height:36px;width:auto;display:block;" />
      </div>
      <div style="padding:24px 24px 8px;">
        <h2 style="margin:0 0 8px;font-size:20px;">Cześć, tu ZapłaćNaCzas!</h2>
        <p style="margin:0 0 16px;color:#475569;">Oto Twoje zbliżające się płatności:</p>
      </div>
      <div style="padding:0 24px 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr>
              <th style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;color:#9ca3af;">
                Nazwa
              </th>
              <th style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;color:#9ca3af;">
                Termin
              </th>
              <th style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;color:#9ca3af;">
                Dostawca
              </th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div style="padding:20px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
        <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;">
          <div style="min-width:200px;">
            <img src="https://itcwn.github.io/payontime/css/logo_m.png" alt="ZapłaćNaCzas" style="height:28px;width:auto;display:block;margin-bottom:8px;" />
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
              ZapłaćNaCzas sp. z o.o.<br />
              ul. Przykładowa 12, 00-001 Warszawa
            </p>
          </div>
          <div style="min-width:160px;">
            <p style="margin:0 0 6px;font-weight:600;">Kontakt</p>
            <p style="margin:0;color:#475569;font-size:13px;">
              <a href="mailto:kontakt@zaplacnaczas.pl" style="color:#2563eb;text-decoration:none;">kontakt@zaplacnaczas.pl</a><br />
              +48 123 456 789
            </p>
          </div>
        </div>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Twój asystent ZapłaćNaCzas</p>
      </div>
    </div>
  </div>
  `;
}

async function sendReminderEmail(to: string, subject: string, text: string, html: string) {
  logStep("resend:request", {
    to,
    from: resendFrom,
    subject,
    hasResendApiKey: Boolean(resendApiKey)
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logStep("resend:error", {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });
    throw new Error(errorBody || `Resend API error (${response.status})`);
  }

  logStep("resend:success", { status: response.status });
}

async function fetchUserEmail(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) {
    return null;
  }
  return data.user?.email ?? null;
}

function getIntervalConfig(payment: PaymentRecord) {
  if (payment.interval_unit === "weeks") {
    return { unit: "weeks", value: payment.interval_weeks ?? 1 };
  }
  if (payment.interval_unit === "months") {
    return { unit: "months", value: payment.interval_months ?? 1 };
  }
  if (payment.schedule_mode === "monthly") {
    return { unit: "months", value: 1 };
  }
  if (payment.interval_months) {
    return { unit: "months", value: payment.interval_months };
  }
  return { unit: "months", value: 1 };
}

function computeNextDueDate(payment: PaymentRecord, fromDate = new Date(), timezone = defaultTimezone) {
  if (payment.schedule_mode === "one_time") {
    if (!payment.due_date) {
      return null;
    }

    const today = formatDateString(fromDate, timezone);
    return dateStringToNumber(payment.due_date) >= dateStringToNumber(today)
      ? payment.due_date
      : null;
  }

  const { year, month, day } = parseDateString(formatDateString(fromDate, timezone));
  const interval = getIntervalConfig(payment);
  const baseDay = Math.min(payment.day_of_month ?? day, lastDayOfMonth(year, month));

  if (interval.unit === "weeks") {
    const todayString = formatDateString(fromDate, timezone);
    let candidate = buildUTCDate(year, month, baseDay);
    while (dateStringToNumber(formatDateString(candidate, timezone)) < dateStringToNumber(todayString)) {
      candidate = addDays(candidate, interval.value * 7);
    }
    return formatDateString(candidate, timezone);
  }

  const monthLastDay = lastDayOfMonth(year, month);
  const normalizedBaseDay = payment.is_last_day ? monthLastDay : Math.min(baseDay, monthLastDay);
  const shouldMoveToNextMonth = day > normalizedBaseDay;
  const { year: nextYear, month: normalizedMonth } = addMonths(
    year,
    month,
    shouldMoveToNextMonth ? interval.value : 0
  );
  const nextMonthLastDay = lastDayOfMonth(nextYear, normalizedMonth);
  const nextDay = payment.is_last_day
    ? nextMonthLastDay
    : Math.min(payment.day_of_month ?? normalizedBaseDay, nextMonthLastDay);

  return buildDateString(nextYear, normalizedMonth, nextDay);
}

serve(async (request) => {
  logStep("request:start", { method: request.method, url: request.url });
  if (request.method !== "POST") {
    logStep("request:method_not_allowed", { method: request.method });
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    logStep("config:missing_supabase", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey)
    });
    return new Response("Missing Supabase environment configuration.", { status: 500 });
  }

  if (!resendApiKey || !resendFrom) {
    logStep("config:missing_resend", {
      hasResendApiKey: Boolean(resendApiKey),
      hasResendFrom: Boolean(resendFrom)
    });
    return new Response("Missing Resend configuration.", { status: 500 });
  }

  logStep("config:loaded", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
    hasResendApiKey: Boolean(resendApiKey),
    resendFrom
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  logStep("supabase:client_created");
  const { data: payments, error: paymentsError } = await adminClient
    .from("payments")
    .select(
      "id,user_id,payment_type,name,provider_address,schedule_mode,due_date,day_of_month,is_last_day,interval_unit,interval_months,interval_weeks,remind_offsets,is_active"
    );

  if (paymentsError) {
    logStep("supabase:payments_error", { message: paymentsError.message });
    return new Response(paymentsError.message, { status: 500 });
  }

  logStep("supabase:payments_loaded", { count: payments?.length ?? 0 });

  const { data: settings, error: settingsError } = await adminClient
    .from("user_settings")
    .select("user_id,timezone,email_enabled");

  if (settingsError) {
    logStep("supabase:settings_error", { message: settingsError.message });
    return new Response(settingsError.message, { status: 500 });
  }

  logStep("supabase:settings_loaded", { count: settings?.length ?? 0 });

  const settingsByUser = new Map<string, UserSettings>();
  (settings ?? []).forEach((setting: UserSettings) => {
    settingsByUser.set(setting.user_id, setting);
  });

  const grouped = new Map<
    string,
    {
      timezone: string;
      emailEnabled: boolean;
      items: Array<{ payment: PaymentRecord; dueDate: string; offsets: number[] }>;
    }
  >();
  const today = new Date();

  (payments ?? []).forEach((payment: PaymentRecord) => {
    if (!payment.is_active) {
      return;
    }

    const userSettings = settingsByUser.get(payment.user_id);
    const timezone = userSettings?.timezone ?? defaultTimezone;
    const dueDate = computeNextDueDate(payment, today, timezone);
    if (!dueDate) {
      return;
    }

    const offsets = payment.remind_offsets ?? [];
    const todayString = formatDateString(today, timezone);
    const dueDateObj = new Date(`${dueDate}T00:00:00`);
    const offsetsForToday = offsets.filter((offset) => {
      const reminderDate = addDays(dueDateObj, offset);
      return formatDateString(reminderDate, timezone) === todayString;
    });

    if (offsetsForToday.length === 0) {
      return;
    }

    logStep("payment:eligible", {
      payment_id: payment.id,
      user_id: payment.user_id,
      due_date: dueDate,
      offsets: offsetsForToday
    });

    const entry = grouped.get(payment.user_id) ?? {
      timezone,
      emailEnabled: userSettings?.email_enabled ?? true,
      items: []
    };
    entry.items.push({ payment, dueDate, offsets: offsetsForToday });
    grouped.set(payment.user_id, entry);
  });

  const users = Array.from(grouped.entries()).map(([userId, entry]) => {
    const items = entry.items.map(({ payment, dueDate }) => ({
      name: payment.name ?? payment.payment_type,
      payment_type: payment.payment_type,
      due_date: dueDate,
      provider_address: payment.provider_address
    }));

    return {
      user_id: userId,
      timezone: entry.timezone,
      email_enabled: entry.emailEnabled,
      raw_items: entry.items,
      items,
      message: buildReminderEmailText(items),
      html_message: buildReminderEmailHtml(items)
    };
  });

  logStep("users:prepared", { count: users.length });

  const results: Array<{ user_id: string; email: string | null; status: string; error?: string }> = [];

  for (const user of users) {
    logStep("user:processing", {
      user_id: user.user_id,
      email_enabled: user.email_enabled,
      items: user.items.length
    });
    if (!user.email_enabled) {
      logStep("user:skip_email_disabled", { user_id: user.user_id });
      results.push({ user_id: user.user_id, email: null, status: "skipped_email_disabled" });
      continue;
    }

    const email = await fetchUserEmail(adminClient, user.user_id);
    if (!email) {
      logStep("user:skip_missing_email", { user_id: user.user_id });
      results.push({ user_id: user.user_id, email: null, status: "skipped_missing_email" });
      continue;
    }

    try {
      await sendReminderEmail(email, "Przypomnienia o płatnościach", user.message, user.html_message);
      results.push({ user_id: user.user_id, email, status: "sent" });
      logStep("user:email_sent", { user_id: user.user_id, email });

      const now = new Date().toISOString();
      const logs = user.raw_items.flatMap(({ payment, dueDate, offsets }) =>
        offsets.map((offset) => ({
          user_id: user.user_id,
          payment_id: payment.id,
          due_date: dueDate,
          offset_days: offset,
          channel: "email",
          scheduled_for: now,
          sent_at: now,
          status: "sent"
        }))
      );

      if (logs.length > 0) {
        logStep("notification_log:upsert_sent", { user_id: user.user_id, count: logs.length });
        await adminClient
          .from("notification_log")
          .upsert(logs, { onConflict: "user_id,payment_id,due_date,offset_days,channel" });
      }
    } catch (error) {
      results.push({
        user_id: user.user_id,
        email,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      logStep("user:email_failed", {
        user_id: user.user_id,
        email,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      const now = new Date().toISOString();
      const logs = user.raw_items.flatMap(({ payment, dueDate, offsets }) =>
        offsets.map((offset) => ({
          user_id: user.user_id,
          payment_id: payment.id,
          due_date: dueDate,
          offset_days: offset,
          channel: "email",
          scheduled_for: now,
          sent_at: null,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        }))
      );

      if (logs.length > 0) {
        logStep("notification_log:upsert_failed", { user_id: user.user_id, count: logs.length });
        await adminClient
          .from("notification_log")
          .upsert(logs, { onConflict: "user_id,payment_id,due_date,offset_days,channel" });
      }
    }
  }

  const responseUsers = users.map(({ raw_items, ...rest }) => rest);

  logStep("request:complete", { users: responseUsers.length, results: results.length });

  return new Response(JSON.stringify({ users: responseUsers, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
