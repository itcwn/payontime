import { requireSession } from "./auth.js";
import { computeNextDueDate, formatDateString } from "./dates.js";
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
const typeSelect = document.getElementById("payment-type");
const isActiveInput = document.getElementById("is-active");
const isFixedInput = document.getElementById("is-fixed");
const isAutomaticInput = document.getElementById("is-automatic");
const dayOfMonthInput = document.getElementById("day-of-month");
const reminderPreview = document.getElementById("reminder-preview");

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
    if (dayOfMonthInput) {
      dayOfMonthInput.required = false;
    }
  } else {
    dueDateField.style.display = "none";
    recurringField.style.display = "flex";
    if (dayOfMonthInput) {
      dayOfMonthInput.required = true;
    }
  }
}

scheduleRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    updateScheduleVisibility();
    buildReminderPreview();
  });
});

function parseIntervalOption(value) {
  if (value?.endsWith("w")) {
    return { interval_unit: "weeks", interval_weeks: Number(value.replace("w", "")), interval_months: null };
  }
  if (value?.endsWith("m")) {
    return { interval_unit: "months", interval_months: Number(value.replace("m", "")), interval_weeks: null };
  }
  return { interval_unit: "months", interval_months: 1, interval_weeks: null };
}

function getSelectedIntervalOption() {
  return intervalSelect?.value ?? "1m";
}

function buildReminderPreview() {
  if (!reminderPreview) return;
  const scheduleMode = document.querySelector("input[name='schedule_mode']:checked").value;
  const remindOffsets = Array.from(form.querySelectorAll("input[name='remind_offsets']:checked")).map(
    (checkbox) => Number(checkbox.value)
  );
  if (!remindOffsets.length) {
    reminderPreview.textContent = "Terminy najbliższych powiadomień: —";
    return;
  }

  let dueDate = null;
  if (scheduleMode === "one_time") {
    dueDate = document.getElementById("due-date").value || null;
  } else {
    const dayOfMonthValue = Number(dayOfMonthInput?.value || 0);
    if (!dayOfMonthValue) {
      reminderPreview.textContent = "Terminy najbliższych powiadomień: uzupełnij dzień płatności.";
      return;
    }
    const intervalConfig = parseIntervalOption(getSelectedIntervalOption());
    const previewPayment = {
      schedule_mode: "recurring",
      day_of_month: dayOfMonthValue,
      interval_unit: intervalConfig.interval_unit,
      interval_months: intervalConfig.interval_months,
      interval_weeks: intervalConfig.interval_weeks,
      is_last_day: false
    };
    dueDate = computeNextDueDate(previewPayment, new Date());
  }

  if (!dueDate) {
    reminderPreview.textContent = "Terminy najbliższych powiadomień: uzupełnij termin płatności.";
    return;
  }

  const dueDateObj = new Date(`${dueDate}T00:00:00`);
  const reminderDates = remindOffsets
    .sort((a, b) => a - b)
    .map((offset) => {
      const date = new Date(dueDateObj);
      date.setDate(date.getDate() + offset);
      return formatDateString(date);
    });

  reminderPreview.textContent = `Terminy najbliższych powiadomień: ${reminderDates.join(", ")}`;
}

if (intervalSelect) {
  intervalSelect.addEventListener("change", buildReminderPreview);
}

if (dayOfMonthInput) {
  dayOfMonthInput.addEventListener("input", buildReminderPreview);
}

form.querySelectorAll("input[name='remind_offsets']").forEach((checkbox) => {
  checkbox.addEventListener("change", buildReminderPreview);
});

document.getElementById("due-date").addEventListener("change", buildReminderPreview);

async function loadPayment() {
  if (!paymentId) return;
  const payment = await getPayment(paymentId);
  form.querySelector("#payment-type").value = payment.payment_type;
  form.querySelector("#payment-name").value = payment.name ?? "";
  form.querySelector("#payment-amount").value = payment.amount ?? "";
  form.querySelector("#provider-address").value = payment.provider_address;
  if (isActiveInput) {
    isActiveInput.checked = payment.is_active ?? true;
  }
  if (isFixedInput) {
    isFixedInput.checked = payment.is_fixed ?? false;
  }
  if (isAutomaticInput) {
    isAutomaticInput.checked = payment.is_automatic ?? false;
  }
  const scheduleValue = payment.schedule_mode === "monthly" ? "recurring" : payment.schedule_mode;
  form.querySelector(`input[name='schedule_mode'][value='${scheduleValue}']`).checked = true;
  form.querySelector("#due-date").value = payment.due_date ?? "";
  existingDayOfMonth = payment.day_of_month ?? null;
  existingIsLastDay = payment.is_last_day ?? false;
  const intervalUnit = payment.interval_unit ?? (payment.schedule_mode === "monthly" ? "months" : null);
  const intervalMonths = payment.interval_months ?? 1;
  const intervalWeeks = payment.interval_weeks ?? 1;
  const intervalValue =
    intervalUnit === "weeks" ? `${intervalWeeks}w` : `${intervalMonths}m`;
  if (intervalSelect) {
    intervalSelect.value = intervalValue;
  }
  if (dayOfMonthInput) {
    dayOfMonthInput.value = existingDayOfMonth ?? (existingIsLastDay ? 31 : "");
  }

  form.querySelectorAll("input[name='remind_offsets']").forEach((checkbox) => {
    checkbox.checked = payment.remind_offsets?.includes(Number(checkbox.value));
  });

  updateScheduleVisibility();
  buildReminderPreview();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const formData = new FormData(form);
  const scheduleMode = formData.get("schedule_mode");
  const remindOffsets = formData.getAll("remind_offsets").map((value) => Number(value));
  const selectedInterval = formData.get("interval_option");
  const intervalConfig = parseIntervalOption(selectedInterval);
  const recurringDayOfMonth = Number(formData.get("day_of_month")) || existingDayOfMonth || new Date().getDate();
  const isActive = formData.get("is_active") === "on";
  const isFixed = formData.get("is_fixed") === "on";
  const isAutomatic = formData.get("is_automatic") === "on";

  const payload = {
    payment_type: formData.get("payment_type"),
    name: formData.get("name") || null,
    amount: formData.get("amount") ? Number(String(formData.get("amount")).replace(",", ".")) : null,
    currency: "PLN",
    provider_address: formData.get("provider_address") || null,
    schedule_mode: scheduleMode,
    due_date: scheduleMode === "one_time" ? formData.get("due_date") : null,
    interval_unit: scheduleMode === "recurring" ? intervalConfig.interval_unit : null,
    interval_months: scheduleMode === "recurring" ? intervalConfig.interval_months : null,
    interval_weeks: scheduleMode === "recurring" ? intervalConfig.interval_weeks : null,
    day_of_month: scheduleMode === "recurring" ? recurringDayOfMonth : null,
    is_last_day: scheduleMode === "recurring" ? existingIsLastDay : false,
    remind_offsets: remindOffsets.length ? remindOffsets : [-3],
    is_active: isActive,
    is_fixed: isFixed,
    is_automatic: isAutomatic
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
buildReminderPreview();
if (paymentId) {
  await loadPayment();
}
