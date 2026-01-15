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

async function sendReminderEmail(to: string, subject: string, text: string) {
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
      text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Resend API error (${response.status})`);
  }
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
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response("Missing Supabase environment configuration.", { status: 500 });
  }

  if (!resendApiKey || !resendFrom) {
    return new Response("Missing Resend configuration.", { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: payments, error: paymentsError } = await adminClient
    .from("payments")
    .select(
      "id,user_id,payment_type,name,provider_address,schedule_mode,due_date,day_of_month,is_last_day,interval_unit,interval_months,interval_weeks,remind_offsets,is_active"
    );

  if (paymentsError) {
    return new Response(paymentsError.message, { status: 500 });
  }

  const { data: settings, error: settingsError } = await adminClient
    .from("user_settings")
    .select("user_id,timezone,email_enabled");

  if (settingsError) {
    return new Response(settingsError.message, { status: 500 });
  }

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

    const messageLines = [
      "Cześć, tu ZapłaćNaCzas!",
      "Oto Twoje zbliżające się płatności:",
      ...items.map(
        (item) =>
          `- ${item.name} | Termin płatności: ${item.due_date ?? "—"} | ${item.provider_address ?? "Brak linku"}`
      )
    ];

    return {
      user_id: userId,
      timezone: entry.timezone,
      email_enabled: entry.emailEnabled,
      raw_items: entry.items,
      items,
      message: messageLines.join("\n")
    };
  });

  const results: Array<{ user_id: string; email: string | null; status: string; error?: string }> = [];

  for (const user of users) {
    if (!user.email_enabled) {
      results.push({ user_id: user.user_id, email: null, status: "skipped_email_disabled" });
      continue;
    }

    const email = await fetchUserEmail(adminClient, user.user_id);
    if (!email) {
      results.push({ user_id: user.user_id, email: null, status: "skipped_missing_email" });
      continue;
    }

    try {
      await sendReminderEmail(email, "Przypomnienia o płatnościach", user.message);
      results.push({ user_id: user.user_id, email, status: "sent" });

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
        await adminClient
          .from("notification_log")
          .upsert(logs, { onConflict: "user_id,payment_id,due_date,offset_days,channel" });
      }
    }
  }

  const responseUsers = users.map(({ raw_items, ...rest }) => rest);

  return new Response(JSON.stringify({ users: responseUsers, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
