import { supabase } from "./supabase-client.js";
import { computeNextDueDate, formatDateString, listDueItems } from "./dates.js";

function dateStringToNumber(dateString) {
  return Number(dateString.replaceAll("-", ""));
}

export function getNearestReminderDate(item, referenceDate = new Date()) {
  if (!item?.dueDate) {
    return "—";
  }
  const remindOffsets = item.payment?.remind_offsets;
  if (!Array.isArray(remindOffsets) || remindOffsets.length === 0) {
    return "—";
  }

  const dueDateBase = new Date(`${item.dueDate}T00:00:00Z`);
  const reminderDates = remindOffsets.map((offset) => {
    const date = new Date(dueDateBase);
    date.setUTCDate(date.getUTCDate() + Number(offset));
    const formatted = formatDateString(date);
    return { date: formatted, number: dateStringToNumber(formatted) };
  });

  const todayNumber = dateStringToNumber(formatDateString(referenceDate));
  const upcoming = reminderDates
    .filter((reminder) => reminder.number >= todayNumber)
    .sort((a, b) => a.number - b.number);
  if (upcoming.length > 0) {
    return upcoming[0].date;
  }

  const past = reminderDates.sort((a, b) => a.number - b.number);
  return past.length > 0 ? past[past.length - 1].date : "—";
}

export const paymentTypes = [
  "Podatek od nieruchomości",
  "Podatek od gruntu",
  "Podatek (PIT)",
  "Podatek (VAT)",
  "ZUS",
  "Badanie techniczne",
  "OC",
  "AC",
  "OC/AC",
  "Ubezpieczenie nieruchomości",
  "Ubezpieczenie zdrowotne prywatne",
  "Ubezpieczenie życia",
  "Ubezpieczenie NNW",
  "Ubezpieczenie turystyczne",
  "Ubezpieczenie roweru",
  "Ubezpieczenie hulajnogi",
  "Ubezpieczenie sprzętu",
  "NNW szkolne",
  "Serwis klimatyzacji",
  "Kominiarz",
  "Przegląd elektryczny",
  "Serwis auta",
  "Przeglądy sprzętu / gwarancje",
  "Kolonie",
  "Zajęcia dodatkowe",
  "Żłobek",
  "Przedszkole",
  "Kredyt hipoteczny",
  "Kredyt konsumencki",
  "Rata 0%",
  "Karta kredytowa (min spłata)",
  "Leasing auta",
  "Leasing sprzętu",
  "Księgowość",
  "Księgowość online",
  "Opłaty bankowe",
  "Abonament parkingowy",
  "Groomer",
  "Weterynarz",
  "Ubezpieczenie zwierzęcia",
  "Alarm",
  "Monitoring",
  "Miejsce parkingowe",
  "Garaż",
  "Śmieci",
  "Ogrzewanie",
  "Czynsz",
  "Prąd",
  "Gaz",
  "Woda",
  "Internet",
  "Telefon komórkowy",
  "Telewizja"
];

export function renderPaymentTypeOptions(select, types = paymentTypes) {
  select.innerHTML = "";
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  }
}

export function createProviderLinkElement(address) {
  if (!address) {
    const placeholder = document.createElement("span");
    placeholder.className = "muted";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "—";
    return placeholder;
  }

  try {
    const url = new URL(address, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
    const link = document.createElement("a");
    link.className = "table-action-link table-action-link--external";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Przejdź do serwisu płatności");
    link.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 7h5a1 1 0 1 0 0-2H6a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V7zm5.293 1.293a1 1 0 0 0 0 1.414L14.586 12H10a1 1 0 1 0 0 2h4.586l-2.293 2.293a1 1 0 0 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414l-4-4a1 1 0 0 0-1.414 0z" />
      </svg>
    `;
    return link;
  } catch (error) {
    const placeholder = document.createElement("span");
    placeholder.className = "muted";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "—";
    return placeholder;
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

  const sevenDaysItems = listDueItems(payments, today, addDays(today, 7));
  const thirtyDaysItems = listDueItems(payments, today, addDays(today, 30));
  const ninetyDaysItems = listDueItems(payments, today, addDays(today, 90));
  const yearAhead = addDays(today, 365);
  const allItems = [];

  for (const payment of payments) {
    if ((payment.schedule_mode === "monthly" || payment.schedule_mode === "recurring") && payment.is_active) {
      const plannedItems = listDueItems([payment], today, yearAhead);
      plannedItems.forEach((item) => {
        allItems.push({ ...item, isOverdue: false });
      });
      continue;
    }

    const dueDate =
      payment.schedule_mode === "one_time"
        ? payment.due_date ?? null
        : computeNextDueDate(payment, today);

    if (!dueDate) {
      continue;
    }

    const isOverdue =
      payment.schedule_mode === "one_time" &&
      payment.due_date &&
      payment.due_date < todayString;

    allItems.push({ payment, dueDate, isOverdue });
  }

  return {
    sevenDays: sevenDaysItems,
    thirtyDays: thirtyDaysItems,
    ninetyDays: ninetyDaysItems,
    all: allItems
  };
}

export function renderTable(target, items) {
  target.innerHTML = "";
  for (const item of items) {
    const nearestReminder = getNearestReminderDate(item);
    const row = document.createElement("tr");
    const paymentCell = document.createElement("td");
    paymentCell.dataset.label = "Płatność za";
    const paymentType = document.createElement("strong");
    paymentType.textContent = item.payment.payment_type ?? "—";
    const paymentName = document.createElement("span");
    paymentName.className = "table-subtext";
    paymentName.textContent = item.payment.name ?? "—";
    paymentCell.append(paymentType, paymentName);

    const amountCell = document.createElement("td");
    amountCell.dataset.label = "Kwota";
    amountCell.textContent = item.payment.amount
      ? `${item.payment.amount} ${item.payment.currency}`
      : "—";

    const reminderCell = document.createElement("td");
    reminderCell.dataset.label = "Najbliższe powiadomienie";
    reminderCell.textContent = nearestReminder;

    const dueCell = document.createElement("td");
    dueCell.dataset.label = "Najbliższy termin";
    dueCell.textContent = item.dueDate ?? "Brak";
    if (item.isOverdue) {
      const overdueBadge = document.createElement("span");
      overdueBadge.className = "badge badge-danger";
      overdueBadge.textContent = "po terminie";
      dueCell.appendChild(overdueBadge);
    }

    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Status";
    const statusBadge = document.createElement("span");
    statusBadge.className = item.payment.is_active ? "badge badge-success" : "badge badge-muted";
    statusBadge.textContent = item.payment.is_active ? "aktywna" : "wstrzymana";
    statusCell.appendChild(statusBadge);

    const actionsCell = document.createElement("td");
    actionsCell.dataset.label = "Akcje";
    const actions = document.createElement("div");
    actions.className = "table-actions";
    actions.appendChild(createProviderLinkElement(item.payment.provider_address));
    const editLink = document.createElement("a");
    editLink.className = "table-action-link table-action-link--edit";
    editLink.href = `./payments-edit.html?id=${item.payment.id}`;
    editLink.setAttribute("aria-label", "Edytuj płatność");
    editLink.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L7.06 19.653a1.5 1.5 0 0 1-.636.38l-3.323.945a.75.75 0 0 1-.927-.927l.945-3.323a1.5 1.5 0 0 1 .38-.636L16.862 3.487zm-1.06 2.121L4.78 16.63l-.53 1.86 1.86-.53L17.923 6.669a.75.75 0 0 0-1.06-1.06l-1.06-1.06z" />
      </svg>
    `;
    actions.appendChild(editLink);
    actionsCell.appendChild(actions);

    row.append(paymentCell, amountCell, reminderCell, dueCell, statusCell, actionsCell);
    target.appendChild(row);
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

export async function deletePayment(id) {
  const { error } = await supabase
    .from("payments")
    .delete()
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
