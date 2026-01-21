import { requireSession, getUser, getUserLabel } from "./auth.js";
import { computeNextDueDate, formatDateString } from "./dates.js";
import {
  createPayment,
  getPayment,
  paymentTypes,
  renderPaymentTypeOptions,
  updatePayment,
  deletePayment
} from "./payments.js";

const form = document.getElementById("payment-form");
const errorEl = document.getElementById("form-error");
const userEmail = document.getElementById("user-email");
const scheduleRadios = document.querySelectorAll("input[name='schedule_mode']");
const dueDateField = document.getElementById("due-date-field");
const recurringField = document.getElementById("recurring-field");
const intervalInput = document.getElementById("interval-option");
const intervalButtons = document.querySelectorAll("#interval-options .choice-button");
const typeSelect = document.getElementById("payment-type");
const typeSearchToggle = document.getElementById("payment-type-search-toggle");
const typeCustomInput = document.getElementById("payment-type-custom");
const typeToggleButton = document.getElementById("payment-type-toggle");
const isActiveInput = document.getElementById("is-active");
const isFixedInput = document.getElementById("is-fixed");
const isAutomaticInput = document.getElementById("is-automatic");
const dayOfMonthInput = document.getElementById("day-of-month");
const dayOptions = document.getElementById("day-options");
const monthOfYearInput = document.getElementById("month-of-year");
const monthOptions = document.getElementById("month-options");
const monthField = document.getElementById("month-field");
const reminderPreview = document.getElementById("reminder-preview");
const cycleStartDateInput = document.getElementById("cycle-start-date");
const deleteButton = document.getElementById("delete-payment");

let existingDayOfMonth = null;
let existingIsLastDay = false;
let typeSearchBuffer = "";
let typeSearchTimeout = null;
let isTypeSearchActive = false;
const monthNames = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień"
];

const params = new URLSearchParams(window.location.search);
const paymentId = params.get("id");

renderPaymentTypeOptions(typeSelect);
const paymentTypeOptions = [...paymentTypes];

function isCustomPaymentType() {
  return typeCustomInput?.style.display !== "none";
}

function setCustomPaymentType(enabled) {
  if (!typeSelect || !typeCustomInput || !typeToggleButton) return;
  if (enabled) {
    typeSelect.style.display = "none";
    stopTypeSearch();
    if (typeSearchToggle) {
      typeSearchToggle.style.display = "none";
    }
    typeCustomInput.style.display = "block";
    typeToggleButton.textContent = "Wybierz z listy";
    if (!typeCustomInput.value) {
      typeCustomInput.value = typeSelect.value;
    }
    typeCustomInput.focus();
  } else {
    typeSelect.style.display = "block";
    if (typeSearchToggle) {
      typeSearchToggle.style.display = "inline-flex";
    }
    typeCustomInput.style.display = "none";
    typeToggleButton.textContent = "Dodaj własną";
    const customValue = typeCustomInput.value.trim();
    const matchedType = paymentTypeOptions.find((type) => type.toLowerCase() === customValue.toLowerCase());
    if (matchedType) {
      typeSelect.value = matchedType;
    }
  }
}

function filterPaymentTypes(query) {
  if (!typeSelect) return;
  const normalized = query.trim().toLowerCase();
  const filteredTypes = normalized
    ? paymentTypeOptions.filter((type) => type.toLowerCase().includes(normalized))
    : paymentTypeOptions;
  const currentValue = typeSelect.value;
  renderPaymentTypeOptions(typeSelect, filteredTypes);
  if (filteredTypes.includes(currentValue)) {
    typeSelect.value = currentValue;
  }
}

function stopTypeSearch() {
  isTypeSearchActive = false;
  typeSearchBuffer = "";
  if (typeSearchToggle) {
    typeSearchToggle.setAttribute("aria-pressed", "false");
  }
  if (typeSearchTimeout) {
    clearTimeout(typeSearchTimeout);
    typeSearchTimeout = null;
  }
  filterPaymentTypes("");
}

function resetTypeSearchTimeout() {
  if (typeSearchTimeout) {
    clearTimeout(typeSearchTimeout);
  }
  typeSearchTimeout = setTimeout(() => {
    typeSearchBuffer = "";
    filterPaymentTypes("");
  }, 1200);
}

function handleTypeSearchKeydown(event) {
  if (!isTypeSearchActive) return;
  if (event.key === "Escape") {
    stopTypeSearch();
    return;
  }
  if (event.key === "Backspace") {
    typeSearchBuffer = typeSearchBuffer.slice(0, -1);
    filterPaymentTypes(typeSearchBuffer);
    resetTypeSearchTimeout();
    return;
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    typeSearchBuffer += event.key;
    filterPaymentTypes(typeSearchBuffer);
    resetTypeSearchTimeout();
  }
}

function getPaymentTypeValue() {
  if (typeCustomInput && typeCustomInput.style.display !== "none") {
    return typeCustomInput.value.trim();
  }
  return typeSelect?.value ?? "";
}

function updateScheduleVisibility() {
  const mode = document.querySelector("input[name='schedule_mode']:checked").value;
  if (mode === "one_time") {
    dueDateField.style.display = "block";
    recurringField.style.display = "none";
    if (dayOfMonthInput) {
      dayOfMonthInput.required = false;
    }
    if (cycleStartDateInput) {
      cycleStartDateInput.required = false;
    }
    if (monthField) {
      monthField.style.display = "none";
    }
  } else {
    dueDateField.style.display = "none";
    recurringField.style.display = "flex";
    if (dayOfMonthInput) {
      dayOfMonthInput.required = true;
    }
    if (cycleStartDateInput) {
      cycleStartDateInput.required = true;
      if (!cycleStartDateInput.value) {
        cycleStartDateInput.value = formatDateString(new Date());
      }
    }
    updateMonthVisibility();
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
  return intervalInput?.value ?? "1m";
}

function isYearlyInterval() {
  const intervalConfig = parseIntervalOption(getSelectedIntervalOption());
  return intervalConfig.interval_unit === "months" && intervalConfig.interval_months === 12;
}

function getMaxDaysForInterval() {
  const intervalConfig = parseIntervalOption(getSelectedIntervalOption());
  if (intervalConfig.interval_unit === "weeks" && intervalConfig.interval_weeks) {
    return intervalConfig.interval_weeks * 7;
  }
  return 31;
}

function getCycleStartDateParts() {
  if (cycleStartDateInput?.value) {
    const [year, month, day] = cycleStartDateInput.value.split("-").map(Number);
    if (year && month && day) {
      return { year, month, day };
    }
  }
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
}

function updateCycleStartDateFromMonthDay() {
  if (!cycleStartDateInput || !isYearlyInterval()) return;
  const selectedMonth = Number(monthOfYearInput?.value || 0);
  if (!selectedMonth) return;
  const { year } = getCycleStartDateParts();
  const selectedDay = Number(dayOfMonthInput?.value || existingDayOfMonth || new Date().getDate());
  const lastDay = new Date(year, selectedMonth, 0).getDate();
  const safeDay = Math.min(selectedDay, lastDay);
  cycleStartDateInput.value = formatDateString(new Date(Date.UTC(year, selectedMonth - 1, safeDay)));
}

function buildDayOptions() {
  if (!dayOptions || !dayOfMonthInput) return;
  dayOptions.textContent = "";
  const maxDays = getMaxDaysForInterval();
  let selectedDay = Number(dayOfMonthInput.value || existingDayOfMonth || "");
  if (selectedDay > maxDays) {
    selectedDay = maxDays;
    dayOfMonthInput.value = String(maxDays);
  }
  for (let day = 1; day <= maxDays; day += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = String(day);
    button.dataset.value = String(day);
    if (selectedDay === day) {
      button.classList.add("is-selected");
    }
    button.addEventListener("click", () => {
      dayOfMonthInput.value = String(day);
      dayOptions.querySelectorAll(".choice-button").forEach((btn) => btn.classList.remove("is-selected"));
      button.classList.add("is-selected");
      updateCycleStartDateFromMonthDay();
      buildReminderPreview();
    });
    dayOptions.appendChild(button);
  }
}

function buildMonthOptions() {
  if (!monthOptions || !monthOfYearInput) return;
  monthOptions.textContent = "";
  let selectedMonth = Number(monthOfYearInput.value || getCycleStartDateParts().month);
  if (selectedMonth < 1 || selectedMonth > 12) {
    selectedMonth = getCycleStartDateParts().month;
  }
  monthOfYearInput.value = String(selectedMonth);
  monthNames.forEach((label, index) => {
    const month = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = label;
    button.dataset.value = String(month);
    if (selectedMonth === month) {
      button.classList.add("is-selected");
    }
    button.addEventListener("click", () => {
      monthOfYearInput.value = String(month);
      monthOptions.querySelectorAll(".choice-button").forEach((btn) => btn.classList.remove("is-selected"));
      button.classList.add("is-selected");
      updateCycleStartDateFromMonthDay();
      buildReminderPreview();
    });
    monthOptions.appendChild(button);
  });
}

function updateMonthVisibility() {
  if (!monthField) return;
  const shouldShow = isYearlyInterval();
  monthField.style.display = shouldShow ? "flex" : "none";
  if (!shouldShow) {
    return;
  }
  buildMonthOptions();
}

function setIntervalOption(value) {
  if (!intervalInput) return;
  intervalInput.value = value;
  intervalButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.value === value);
  });
  buildDayOptions();
  updateMonthVisibility();
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
    const cycleStartDateValue = cycleStartDateInput?.value || null;
    if (!cycleStartDateValue) {
      reminderPreview.textContent = "Terminy najbliższych powiadomień: uzupełnij start cyklu.";
      return;
    }
    const dayOfMonthValue = Number(dayOfMonthInput?.value || 0);
    if (!dayOfMonthValue) {
      reminderPreview.textContent = "Terminy najbliższych powiadomień: uzupełnij dzień płatności.";
      return;
    }
    const intervalConfig = parseIntervalOption(getSelectedIntervalOption());
    const previewPayment = {
      schedule_mode: "recurring",
      day_of_month: dayOfMonthValue,
      cycle_start_date: cycleStartDateValue,
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

if (intervalInput) {
  intervalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setIntervalOption(button.dataset.value);
      buildReminderPreview();
    });
  });
}

if (dayOfMonthInput) {
  dayOfMonthInput.addEventListener("change", () => {
    updateCycleStartDateFromMonthDay();
    buildReminderPreview();
  });
}

if (cycleStartDateInput) {
  cycleStartDateInput.addEventListener("change", () => {
    if (isYearlyInterval()) {
      const { month, day } = getCycleStartDateParts();
      if (monthOfYearInput) {
        monthOfYearInput.value = String(month);
        buildMonthOptions();
      }
      if (dayOfMonthInput) {
        dayOfMonthInput.value = String(day);
        buildDayOptions();
      }
    }
    buildReminderPreview();
  });
}

form.querySelectorAll("input[name='remind_offsets']").forEach((checkbox) => {
  checkbox.addEventListener("change", buildReminderPreview);
});

document.getElementById("due-date").addEventListener("change", buildReminderPreview);

if (typeSearchToggle && typeSelect) {
  typeSearchToggle.setAttribute("aria-pressed", "false");
  typeSearchToggle.addEventListener("click", () => {
    isTypeSearchActive = true;
    typeSearchToggle.setAttribute("aria-pressed", "true");
    typeSearchBuffer = "";
    filterPaymentTypes("");
    typeSelect.focus();
    if (typeof typeSelect.showPicker === "function") {
      typeSelect.showPicker();
    }
  });
}

if (typeSelect) {
  typeSelect.addEventListener("keydown", handleTypeSearchKeydown);
  typeSelect.addEventListener("blur", () => {
    if (isTypeSearchActive) {
      stopTypeSearch();
    }
  });
}

if (typeToggleButton) {
  typeToggleButton.addEventListener("click", () => {
    setCustomPaymentType(!isCustomPaymentType());
  });
}

async function loadPayment() {
  if (!paymentId) return;
  const payment = await getPayment(paymentId);
  const paymentTypeValue = payment.payment_type ?? "";
  const matchedType = paymentTypeOptions.find((type) => type.toLowerCase() === paymentTypeValue.toLowerCase());
  if (matchedType) {
    setCustomPaymentType(false);
    form.querySelector("#payment-type").value = matchedType;
  } else {
    setCustomPaymentType(true);
    if (typeCustomInput) {
      typeCustomInput.value = paymentTypeValue;
    }
  }
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
  if (cycleStartDateInput) {
    cycleStartDateInput.value = payment.cycle_start_date ?? "";
  }
  if (dayOfMonthInput) {
    dayOfMonthInput.value = existingDayOfMonth ?? (existingIsLastDay ? 31 : "");
  }
  if (monthOfYearInput && payment.cycle_start_date) {
    const [, month] = payment.cycle_start_date.split("-").map(Number);
    monthOfYearInput.value = month ? String(month) : "";
  }
  setIntervalOption(intervalValue);

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
  const cycleStartDate = formData.get("cycle_start_date") || null;

  const payload = {
    payment_type: getPaymentTypeValue(),
    name: formData.get("name") || null,
    amount: formData.get("amount") ? Number(String(formData.get("amount")).replace(",", ".")) : null,
    currency: "PLN",
    provider_address: formData.get("provider_address") || null,
    schedule_mode: scheduleMode,
    due_date: scheduleMode === "one_time" ? formData.get("due_date") : null,
    cycle_start_date: scheduleMode === "recurring" ? cycleStartDate : null,
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

if (deleteButton) {
  deleteButton.addEventListener("click", async () => {
    if (!paymentId) {
      form.reset();
      updateScheduleVisibility();
      buildDayOptions();
      updateMonthVisibility();
      buildReminderPreview();
      return;
    }
    if (!window.confirm("Czy na pewno chcesz usunąć tę płatność?")) {
      return;
    }
    try {
      const session = await requireSession();
      if (!session) {
        return;
      }
      await deletePayment(paymentId);
      window.location.href = "./app.html";
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
}

await requireSession();
const user = await getUser();
if (userEmail && user) {
  userEmail.textContent = getUserLabel(user);
}
if (intervalInput) {
  setIntervalOption(getSelectedIntervalOption());
  buildDayOptions();
}
updateScheduleVisibility();
updateMonthVisibility();
buildReminderPreview();
if (paymentId) {
  await loadPayment();
}
