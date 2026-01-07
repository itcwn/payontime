const defaultTimezone = "Europe/Warsaw";

function pad(value) {
  return value.toString().padStart(2, "0");
}

export function formatDateString(date, timezone = defaultTimezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDateString(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateStringToNumber(dateString) {
  return Number(dateString.replaceAll("-", ""));
}

export function computeNextDueDate(payment, fromDate = new Date(), timezone = defaultTimezone) {
  if (payment.schedule_mode === "one_time") {
    if (!payment.due_date) {
      return null;
    }

    const today = formatDateString(fromDate, timezone);
    return dateStringToNumber(payment.due_date) >= dateStringToNumber(today)
      ? payment.due_date
      : null;
  }

  const { year, month, day } = parseDateString(
    formatDateString(fromDate, timezone)
  );
  const monthLastDay = lastDayOfMonth(year, month);
  const baseDay = payment.is_last_day
    ? monthLastDay
    : Math.min(payment.day_of_month ?? 1, monthLastDay);
  const shouldMoveToNextMonth = day > baseDay;

  const nextMonth = shouldMoveToNextMonth ? month + 1 : month;
  const nextYear = nextMonth > 12 ? year + 1 : year;
  const normalizedMonth = nextMonth > 12 ? 1 : nextMonth;
  const nextMonthLastDay = lastDayOfMonth(nextYear, normalizedMonth);
  const nextDay = payment.is_last_day
    ? nextMonthLastDay
    : Math.min(payment.day_of_month ?? 1, nextMonthLastDay);

  return buildDateString(nextYear, normalizedMonth, nextDay);
}

export function listDueItems(payments, windowStart, windowEnd, timezone = defaultTimezone) {
  const startDateString = formatDateString(windowStart, timezone);
  const endDateString = formatDateString(windowEnd, timezone);
  const startNumber = dateStringToNumber(startDateString);
  const endNumber = dateStringToNumber(endDateString);

  const results = [];

  for (const payment of payments) {
    if (!payment.is_active) {
      continue;
    }

    if (payment.schedule_mode === "one_time") {
      if (!payment.due_date) {
        continue;
      }
      const dueNumber = dateStringToNumber(payment.due_date);
      if (dueNumber >= startNumber && dueNumber <= endNumber) {
        results.push({ payment, dueDate: payment.due_date });
      }
      continue;
    }

    const { year: startYear, month: startMonth } = parseDateString(
      startDateString
    );
    const { year: endYear, month: endMonth } = parseDateString(endDateString);

    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthLastDay = lastDayOfMonth(year, month);
      const day = payment.is_last_day
        ? monthLastDay
        : Math.min(payment.day_of_month ?? 1, monthLastDay);
      const dueDate = buildDateString(year, month, day);
      const dueNumber = dateStringToNumber(dueDate);

      if (dueNumber >= startNumber && dueNumber <= endNumber) {
        results.push({ payment, dueDate });
      }

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return results;
}
