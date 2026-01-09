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
const recurringField = document.getElementById("recurring-field");
const intervalSelect = document.getElementById("interval-option");
const customIntervalField = document.getElementById("custom-interval-field");
const customIntervalInput = document.getElementById("custom-interval-months");
const typeSelect = document.getElementById("payment-type");

let existingDayOfMonth = null;
let existingIsLastDay = false;

const params = new URLSearchParams(window.location.search);
const paymentId = params.get("id");

renderPaymentTypeOptions(typeSelect);

function updateScheduleVisibility() {
  const mode = document.querySelector("input[name='schedule_mode']:checked").value;
  if (mode === "one_time") {
    dueDateField.style.display = "block";
    recurringField.style.display = "none";
    customIntervalInput.required = false;
  } else {
    dueDateField.style.display = "none";
    recurringField.style.display = "flex";
    updateCustomIntervalVisibility();
  }
}

function updateCustomIntervalVisibility() {
  const option = intervalSelect.value;
  if (option === "custom") {
    customIntervalField.style.display = "flex";
    customIntervalInput.required = true;
  } else {
    customIntervalField.style.display = "none";
    customIntervalInput.required = false;
  }
}

scheduleRadios.forEach((radio) => {
  radio.addEventListener("change", updateScheduleVisibility);
});

intervalSelect.addEventListener("change", updateCustomIntervalVisibility);

async function loadPayment() {
  if (!paymentId) return;
  const payment = await getPayment(paymentId);
  form.querySelector("#payment-type").value = payment.payment_type;
  form.querySelector("#payment-name").value = payment.name ?? "";
  form.querySelector("#payment-amount").value = payment.amount ?? "";
  form.querySelector("#provider-address").value = payment.provider_address;
  const scheduleValue = payment.schedule_mode === "monthly" ? "recurring" : payment.schedule_mode;
  form.querySelector(`input[name='schedule_mode'][value='${scheduleValue}']`).checked = true;
  form.querySelector("#due-date").value = payment.due_date ?? "";
  existingDayOfMonth = payment.day_of_month ?? null;
  existingIsLastDay = payment.is_last_day ?? false;
  const intervalMonths = payment.interval_months ?? 1;
  const intervalValue = ["1", "2", "3", "6", "12"].includes(String(intervalMonths))
    ? String(intervalMonths)
    : "custom";
  intervalSelect.value = intervalValue;
  if (intervalValue === "custom") {
    customIntervalInput.value = intervalMonths || "";
  }

  form.querySelectorAll("input[name='remind_offsets']").forEach((checkbox) => {
    checkbox.checked = payment.remind_offsets?.includes(Number(checkbox.value));
  });

  updateScheduleVisibility();
  updateCustomIntervalVisibility();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const formData = new FormData(form);
  const scheduleMode = formData.get("schedule_mode");
  const remindOffsets = formData.getAll("remind_offsets").map((value) => Number(value));
  const selectedInterval = formData.get("interval_option");
  const intervalMonths =
    selectedInterval === "custom"
      ? Number(formData.get("custom_interval_months"))
      : Number(selectedInterval);
  const recurringDayOfMonth = existingDayOfMonth ?? new Date().getDate();

  const payload = {
    payment_type: formData.get("payment_type"),
    name: formData.get("name") || null,
    amount: formData.get("amount") ? Number(String(formData.get("amount")).replace(",", ".")) : null,
    currency: "PLN",
    provider_address: formData.get("provider_address") || null,
    schedule_mode: scheduleMode,
    due_date: scheduleMode === "one_time" ? formData.get("due_date") : null,
    interval_months: scheduleMode === "recurring" ? intervalMonths : null,
    day_of_month: scheduleMode === "recurring" ? recurringDayOfMonth : null,
    is_last_day: scheduleMode === "recurring" ? existingIsLastDay : false,
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
