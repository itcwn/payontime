import { requireSession, signOut, getUser, getUserLabel } from "./auth.js";
import {
  buildDashboardSections,
  fetchPayments,
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
  const row = document.createElement("tr");
  row.innerHTML = `
      <td><strong>${item.payment.payment_type}</strong></td>
      <td>${item.payment.name ?? "—"}</td>
      <td>${item.payment.amount ? `${item.payment.amount} ${item.payment.currency}` : "—"}</td>
      <td>${item.dueDate ?? "Brak"}
        ${item.isOverdue ? '<span class="badge badge-danger">po terminie</span>' : ""}
      </td>
      <td>${item.payment.provider_address || "—"}</td>
      <td>
        ${item.payment.is_active
          ? '<span class="badge badge-success">aktywna</span>'
          : '<span class="badge badge-muted">wstrzymana</span>'}
      </td>
      <td>
        <div class="table-actions">
          <a class="link" href="./payments-edit.html?id=${item.payment.id}" aria-label="Edytuj płatność">✏️</a>
        </div>
      </td>
    `;
  return row;
}

function renderGroupedTable(target, items) {
  target.innerHTML = "";
  if (items.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "table-empty-row";
    emptyRow.innerHTML = '<td colspan="7">Brak płatności</td>';
    target.appendChild(emptyRow);
    return;
  }

  const groupedItems = new Map();
  items.forEach((item) => {
    const groupName = item.payment.payment_type ?? "Inne";
    const paymentId = item.payment.id ?? "—";
    const groupKey = `${groupName}::${paymentId}`;
    const groupLabel = `${groupName} · ID: ${paymentId}`;
    if (!groupedItems.has(groupKey)) {
      groupedItems.set(groupKey, { label: groupLabel, items: [] });
    }
    groupedItems.get(groupKey).items.push(item);
  });

  groupedItems.forEach((groupData) => {
    const { label, items: groupItems } = groupData;
    const groupRow = document.createElement("tr");
    groupRow.className = "table-group-row";
    groupRow.innerHTML = `<td colspan="7">${label} <span class="muted">(${groupItems.length})</span></td>`;
    target.appendChild(groupRow);
    groupItems.forEach((item) => {
      target.appendChild(buildPaymentRow(item));
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
