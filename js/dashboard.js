import { requireSession, signOut, getUser, getUserLabel } from "./auth.js";
import {
  buildDashboardSections,
  createProviderLinkElement,
  fetchPayments,
  getNearestReminderDate,
  renderTable
} from "./payments.js";

const errorEl = document.getElementById("error");
const sevenBody = document.getElementById("seven-body");
const thirtyBody = document.getElementById("thirty-body");
const ninetyBody = document.getElementById("ninety-body");
const allBody = document.getElementById("all-body");
const sevenCount = document.getElementById("seven-count");
const thirtyCount = document.getElementById("thirty-count");
const ninetyCount = document.getElementById("ninety-count");
const allCount = document.getElementById("all-count");
const userEmail = document.getElementById("user-email");
const logoutButton = document.getElementById("logout-button");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const allNearestToggle = document.getElementById("all-nearest-toggle");
const allGroupToggle = document.getElementById("all-group-toggle");
const allTabToolbar = document.getElementById("all-tab-toolbar");
const monthlyTotalEl = document.getElementById("monthly-total");
const monthlyTotalMeta = document.getElementById("monthly-total-meta");
let allItemsSorted = [];
const groupedState = new Map();

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
  });

  if (allTabToolbar) {
    const showToolbar = tabName === "all";
    allTabToolbar.classList.toggle("is-hidden", !showToolbar);
    allTabToolbar.setAttribute("aria-hidden", showToolbar ? "false" : "true");
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});

function sortAllItems(items) {
  return [...items].sort((first, second) => {
    const firstDate = first.dueDate ?? "";
    const secondDate = second.dueDate ?? "";
    if (firstDate === secondDate) {
      return (first.payment.name ?? "").localeCompare(second.payment.name ?? "");
    }
    return firstDate.localeCompare(secondDate);
  });
}

function buildPaymentRow(item) {
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
  return row;
}

function setGroupExpanded(target, groupKey, isExpanded) {
  groupedState.set(groupKey, isExpanded);
  const rows = Array.from(target.querySelectorAll("tr[data-group]")).filter(
    (row) => row.dataset.group === groupKey
  );
  rows.forEach((row, index) => {
    if (index === 0) return;
    row.classList.toggle("is-collapsed", !isExpanded);
  });
}

function updateGroupToggle(toggleButton, isExpanded) {
  toggleButton.setAttribute("aria-expanded", String(isExpanded));
  toggleButton.setAttribute("aria-label", isExpanded ? "Zwiń pozycje" : "Rozwiń pozycje");
  toggleButton.innerHTML = `<span class="group-toggle-icon">${isExpanded ? "−" : "+"}</span>`;
}

function renderGroupedTable(target, items) {
  target.innerHTML = "";
  if (items.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "table-empty-row";
    emptyRow.innerHTML = '<td colspan="6">Brak płatności</td>';
    target.appendChild(emptyRow);
    return;
  }

  const groupedItems = new Map();
  items.forEach((item) => {
    const groupName = item.payment.payment_type ?? "Inne";
    const paymentId = item.payment.id ?? "—";
    const groupKey = `${groupName}::${paymentId}`;
    const groupLabel = groupName;
    if (!groupedItems.has(groupKey)) {
      groupedItems.set(groupKey, { label: groupLabel, items: [] });
    }
    groupedItems.get(groupKey).items.push(item);
  });

  groupedItems.forEach((groupData, groupKey) => {
    const { items: groupItems } = groupData;
    const isExpanded = groupedState.get(groupKey) ?? true;
    groupItems.forEach((item, index) => {
      const row = buildPaymentRow(item);
      row.dataset.group = groupKey;
      row.classList.add("table-group-item");
      if (index > 0 && !isExpanded) {
        row.classList.add("is-collapsed");
      }
      if (index === 0 && groupItems.length > 1) {
        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "group-toggle";
        updateGroupToggle(toggleButton, isExpanded);
        toggleButton.addEventListener("click", () => {
          const nextState = !(groupedState.get(groupKey) ?? true);
          setGroupExpanded(target, groupKey, nextState);
          updateGroupToggle(toggleButton, nextState);
        });
        const firstCell = row.querySelector("td");
        if (firstCell) {
          firstCell.prepend(toggleButton);
        }
      }
      target.appendChild(row);
    });
  });
}

function getNearestItems(items) {
  const seenPayments = new Set();
  return items.filter((item) => {
    const key = item.payment.id ?? null;
    if (key === null) {
      return true;
    }
    if (seenPayments.has(key)) {
      return false;
    }
    seenPayments.add(key);
    return true;
  });
}

function renderAllPage() {
  if (!allBody) return;
  const itemsToRender = allNearestToggle?.checked
    ? getNearestItems(allItemsSorted)
    : allItemsSorted;
  if (allGroupToggle?.checked) {
    renderGroupedTable(allBody, itemsToRender);
  } else {
    renderTable(allBody, itemsToRender);
  }
}

function getMonthlySummary(payments) {
  let total = 0;
  let count = 0;
  const monthlyFactor = 52 / 12;

  payments.forEach((payment) => {
    if (!payment?.is_active) return;
    if (payment.schedule_mode === "one_time") return;
    if (!payment.amount || Number.isNaN(Number(payment.amount))) return;

    count += 1;
    const amount = Number(payment.amount);
    const intervalUnit = payment.interval_unit ?? (payment.schedule_mode === "monthly" ? "months" : "months");
    const intervalMonths = payment.interval_months ?? 1;
    const intervalWeeks = payment.interval_weeks ?? 1;

    if (intervalUnit === "weeks") {
      total += (amount / intervalWeeks) * monthlyFactor;
    } else {
      total += amount / intervalMonths;
    }
  });

  return { total, count };
}

function renderMonthlySummary(payments) {
  if (!monthlyTotalEl) return;
  const { total, count } = getMonthlySummary(payments);
  const formattedTotal = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(total);

  monthlyTotalEl.textContent = `${formattedTotal} PLN`;
  if (monthlyTotalMeta) {
    monthlyTotalMeta.textContent =
      count > 0 ? `Na podstawie ${count} aktywnych płatności.` : "Brak aktywnych płatności cyklicznych.";
  }
}

if (allNearestToggle) {
  allNearestToggle.addEventListener("change", () => {
    renderAllPage();
  });
}

if (allGroupToggle) {
  allGroupToggle.addEventListener("change", () => {
    renderAllPage();
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut();
  });
}

async function loadDashboard() {
  await requireSession();
  const user = await getUser();
  if (userEmail && user) {
    userEmail.textContent = getUserLabel(user);
  }

  try {
    const payments = await fetchPayments();
    const sections = buildDashboardSections(payments);
    allItemsSorted = sortAllItems(sections.all);

    renderTable(sevenBody, sections.sevenDays);
    renderTable(thirtyBody, sections.thirtyDays);
    renderTable(ninetyBody, sections.ninetyDays);
    renderAllPage();
    renderMonthlySummary(payments);

    sevenCount.textContent = sections.sevenDays.length;
    thirtyCount.textContent = sections.thirtyDays.length;
    ninetyCount.textContent = sections.ninetyDays.length;
    allCount.textContent = sections.all.length;

  } catch (error) {
    errorEl.textContent = error.message;
  }
}

loadDashboard();
