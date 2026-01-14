import { requireSession, getUser, getUserLabel } from "./auth.js";
import {
  buildDashboardSections,
  fetchPayments,
  renderTable
} from "./payments.js";

const errorEl = document.getElementById("error");
const sevenBody = document.getElementById("seven-body");
const thirtyBody = document.getElementById("thirty-body");
const allBody = document.getElementById("all-body");
const sevenCount = document.getElementById("seven-count");
const thirtyCount = document.getElementById("thirty-count");
const allCount = document.getElementById("all-count");
const userEmail = document.getElementById("user-email");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const allPrev = document.getElementById("all-prev");
const allNext = document.getElementById("all-next");
const allRange = document.getElementById("all-range");
const allPageInfo = document.getElementById("all-page-info");
const monthlyTotalEl = document.getElementById("monthly-total");
const monthlyTotalMeta = document.getElementById("monthly-total-meta");
const pageSize = 20;
let currentAllPage = 1;
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

function renderAllPage() {
  if (!allBody) return;
  const totalItems = allItemsSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  currentAllPage = Math.min(Math.max(1, currentAllPage), totalPages);
  const startIndex = (currentAllPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  renderTable(allBody, allItemsSorted.slice(startIndex, endIndex));

  if (allRange) {
    allRange.textContent =
      totalItems === 0
        ? "Brak wpisów"
        : `${startIndex + 1}-${Math.min(endIndex, totalItems)} z ${totalItems}`;
  }

  if (allPageInfo) {
    allPageInfo.textContent = `Strona ${currentAllPage} z ${totalPages}`;
  }

  if (allPrev) {
    allPrev.disabled = currentAllPage <= 1;
  }

  if (allNext) {
    allNext.disabled = currentAllPage >= totalPages;
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

if (allPrev) {
  allPrev.addEventListener("click", () => {
    currentAllPage -= 1;
    renderAllPage();
  });
}

if (allNext) {
  allNext.addEventListener("click", () => {
    currentAllPage += 1;
    renderAllPage();
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
    currentAllPage = 1;

    renderTable(sevenBody, sections.sevenDays);
    renderTable(thirtyBody, sections.thirtyDays);
    renderAllPage();
    renderMonthlySummary(payments);

    sevenCount.textContent = sections.sevenDays.length;
    thirtyCount.textContent = sections.thirtyDays.length;
    allCount.textContent = sections.all.length;

  } catch (error) {
    errorEl.textContent = error.message;
  }
}

loadDashboard();
