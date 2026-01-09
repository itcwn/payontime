import { requireSession } from "./auth.js";
import {
  createPayment,
  getPayment,
  paymentTypes,
  renderPaymentTypeOptions,
  updatePayment
} from "./payments.js";

const form = document.getElementById("payment-form");
const errorEl = document.getElementById("form-error");
const scheduleRadios = document.querySelectorAll("input[name='schedule_mode']");
const dueDateField = document.getElementById("due-date-field");
const monthlyField = document.getElementById("monthly-field");
const typeSelect = document.getElementById("payment-type");
const lastDayCheckbox = document.getElementById("is-last-day");
const dayInput = document.getElementById("day-of-month");

const params = new URLSearchParams(window.location.search);
const paymentId = params.get("id");

renderPaymentTypeOptions(typeSelect);

function updateScheduleVisibility() {
  const mode = document.querySelector("input[name='schedule_mode']:checked").value;
  if (mode === "one_time") {
    dueDateField.style.display = "block";
    monthlyField.style.display = "none";
  } else {
    dueDateField.style.display = "none";
    monthlyField.style.display = "block";
  }
}

scheduleRadios.forEach((radio) => {
  radio.addEventListener("change", updateScheduleVisibility);
});

lastDayCheckbox.addEventListener("change", () => {
  dayInput.disabled = lastDayCheckbox.checked;
});

async function loadPayment() {
  if (!paymentId) return;
  const payment = await getPayment(paymentId);
  form.querySelector("#payment-type").value = payment.payment_type;
  form.querySelector("#payment-name").value = payment.name ?? "";
  form.querySelector("#payment-amount").value = payment.amount ?? "";
  form.querySelector("#provider-address").value = payment.provider_address;
  form.querySelector(`input[name='schedule_mode'][value='${payment.schedule_mode}']`).checked = true;
  form.querySelector("#due-date").value = payment.due_date ?? "";
  form.querySelector("#day-of-month").value = payment.day_of_month ?? "";
  form.querySelector("#is-last-day").checked = payment.is_last_day;
  dayInput.disabled = payment.is_last_day;

  form.querySelectorAll("input[name='remind_offsets']").forEach((checkbox) => {
    checkbox.checked = payment.remind_offsets?.includes(Number(checkbox.value));
  });

  updateScheduleVisibility();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const formData = new FormData(form);
  const scheduleMode = formData.get("schedule_mode");
  const isLastDay = formData.get("is_last_day") === "on";
  const remindOffsets = formData.getAll("remind_offsets").map((value) => Number(value));

  const payload = {
    payment_type: formData.get("payment_type"),
    name: formData.get("name") || null,
    amount: formData.get("amount") ? Number(String(formData.get("amount")).replace(",", ".")) : null,
    currency: "PLN",
    provider_address: formData.get("provider_address"),
    schedule_mode: scheduleMode,
    due_date: scheduleMode === "one_time" ? formData.get("due_date") : null,
    day_of_month: scheduleMode === "monthly" && !isLastDay ? Number(formData.get("day_of_month")) : null,
    is_last_day: scheduleMode === "monthly" ? isLastDay : false,
    remind_offsets: remindOffsets.length ? remindOffsets : [-3, 0],
    is_active: true
  };

  try {
    const session = await requireSession();
    if (!session) {
      return;
    }
    const payloadWithUser = {
      ...payload,
      user_id: session.user.id
    };
    if (paymentId) {
      await updatePayment(paymentId, payload);
    } else {
      await createPayment(payloadWithUser);
    }
    window.location.href = "./app.html";
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

await requireSession();
updateScheduleVisibility();
if (paymentId) {
  await loadPayment();
}
