import { supabase } from "./supabase-client.js";
import { computeNextDueDate, formatDateString, listDueItems } from "./dates.js";

export const paymentTypes = [
  "czynsz",
  "prąd",
  "gaz",
  "woda",
  "ZUS",
  "podatek od nieruchomości",
  "ubezpieczenie od nieruchomości",
  "OC/AC",
  "abonament RTV"
];

export function renderPaymentTypeOptions(select) {
  select.innerHTML = "";
  for (const type of paymentTypes) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function fetchPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function buildDashboardSections(payments) {
  const today = new Date();
  const todayString = formatDateString(today);

  const todayItems = listDueItems(payments, today, today);
  const upcomingItems = listDueItems(payments, addDays(today, 1), addDays(today, 7));
  const overdueItems = listDueItems(payments, addDays(today, -30), addDays(today, -1));
  const allItems = payments.map((payment) => {
    const nextDue = computeNextDueDate(payment, today);
    const isOverdue =
      payment.schedule_mode === "one_time" &&
      payment.due_date &&
      payment.due_date < todayString;

    return {
      payment,
      dueDate: nextDue ?? payment.due_date,
      isOverdue
    };
  });

  return {
    today: todayItems,
    upcoming: upcomingItems,
    overdue: overdueItems,
    all: allItems
  };
}

export function renderTable(target, items) {
  target.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${item.payment.payment_type}</strong></td>
      <td>${item.payment.name ?? "—"}</td>
      <td>${item.payment.amount ? `${item.payment.amount} ${item.payment.currency}` : "—"}</td>
      <td>${item.dueDate ?? "Brak"}
        ${item.isOverdue ? '<span class="badge badge-danger">po terminie</span>' : ""}
      </td>
      <td>${item.payment.provider_address}</td>
      <td>
        ${item.payment.is_active
          ? '<span class="badge badge-success">aktywna</span>'
          : '<span class="badge badge-muted">wstrzymana</span>'}
      </td>
      <td>
        <div class="table-actions">
          <a class="link" href="/payments-edit.html?id=${item.payment.id}">Edytuj</a>
          <button class="button button-secondary" data-toggle="${item.payment.id}" style="font-size:0.75rem;padding:6px 12px;">
            ${item.payment.is_active ? "Dezaktywuj" : "Aktywuj"}
          </button>
        </div>
      </td>
    `;
    target.appendChild(row);
  }
}

export async function togglePayment(id, isActive) {
  const { error } = await supabase
    .from("payments")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPayment(payload) {
  const { error } = await supabase.from("payments").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePayment(id, payload) {
  const { error } = await supabase
    .from("payments")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPayment(id) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
