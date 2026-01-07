import { requireSession, getUser } from "./auth.js";
import {
  buildDashboardSections,
  fetchPayments,
  renderTable,
  togglePayment
} from "./payments.js";

const errorEl = document.getElementById("error");
const todayBody = document.getElementById("today-body");
const upcomingBody = document.getElementById("upcoming-body");
const overdueBody = document.getElementById("overdue-body");
const allBody = document.getElementById("all-body");
const todayCount = document.getElementById("today-count");
const upcomingCount = document.getElementById("upcoming-count");
const overdueCount = document.getElementById("overdue-count");
const allCount = document.getElementById("all-count");
const userEmail = document.getElementById("user-email");

async function loadDashboard() {
  await requireSession();
  const user = await getUser();
  if (userEmail && user) {
    userEmail.textContent = user.email ?? "";
  }

  try {
    const payments = await fetchPayments();
    const sections = buildDashboardSections(payments);

    renderTable(todayBody, sections.today);
    renderTable(upcomingBody, sections.upcoming);
    renderTable(overdueBody, sections.overdue);
    renderTable(allBody, sections.all);

    todayCount.textContent = sections.today.length;
    upcomingCount.textContent = sections.upcoming.length;
    overdueCount.textContent = sections.overdue.length;
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
