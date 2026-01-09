import { requireSession, getUser } from "./auth.js";
import {
  buildDashboardSections,
  fetchPayments,
  renderTable,
  togglePayment
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

async function loadDashboard() {
  await requireSession();
  const user = await getUser();
  if (userEmail && user) {
    userEmail.textContent = user.email ?? "";
  }

  try {
    const payments = await fetchPayments();
    const sections = buildDashboardSections(payments);

    renderTable(sevenBody, sections.sevenDays);
    renderTable(thirtyBody, sections.thirtyDays);
    renderTable(allBody, sections.all);

    sevenCount.textContent = sections.sevenDays.length;
    thirtyCount.textContent = sections.thirtyDays.length;
    allCount.textContent = sections.all.length;

    document.querySelectorAll("button[data-toggle]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.toggle;
        const item = sections.all.find((entry) => entry.payment.id === id);
        if (!item) return;
        try {
          await togglePayment(id, !item.payment.is_active);
          await loadDashboard();
        } catch (error) {
          errorEl.textContent = error.message;
        }
      });
    });
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

loadDashboard();
