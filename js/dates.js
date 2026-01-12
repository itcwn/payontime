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

function buildUTCDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(year, month, increment) {
  const totalMonths = month + increment - 1;
  const nextYear = year + Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

function getIntervalConfig(payment) {
  if (payment.interval_unit === "weeks") {
    return { unit: "weeks", value: payment.interval_weeks ?? 1 };
  }
  if (payment.interval_unit === "months") {
    return { unit: "months", value: payment.interval_months ?? 1 };
  }
  if (payment.schedule_mode === "monthly") {
    return { unit: "months", value: 1 };
  }
  if (payment.interval_months) {
    return { unit: "months", value: payment.interval_months };
  }
  return { unit: "months", value: 1 };
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

  const { year, month, day } = parseDateString(formatDateString(fromDate, timezone));
  const interval = getIntervalConfig(payment);
  const baseDay = Math.min(payment.day_of_month ?? day, lastDayOfMonth(year, month));

  if (interval.unit === "weeks") {
    const todayString = formatDateString(fromDate, timezone);
    let candidate = buildUTCDate(year, month, baseDay);
    while (dateStringToNumber(formatDateString(candidate, timezone)) < dateStringToNumber(todayString)) {
      candidate = addDays(candidate, interval.value * 7);
    }
    return formatDateString(candidate, timezone);
  }

  const monthLastDay = lastDayOfMonth(year, month);
  const normalizedBaseDay = payment.is_last_day ? monthLastDay : Math.min(baseDay, monthLastDay);
  const shouldMoveToNextMonth = day > normalizedBaseDay;
  const { year: nextYear, month: normalizedMonth } = addMonths(
    year,
    month,
    shouldMoveToNextMonth ? interval.value : 0
  );
  const nextMonthLastDay = lastDayOfMonth(nextYear, normalizedMonth);
  const nextDay = payment.is_last_day
    ? nextMonthLastDay
    : Math.min(payment.day_of_month ?? normalizedBaseDay, nextMonthLastDay);

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

    const interval = getIntervalConfig(payment);

    if (interval.unit === "weeks") {
      const monthLastDay = lastDayOfMonth(startYear, startMonth);
      const baseDay = Math.min(payment.day_of_month ?? 1, monthLastDay);
      let candidate = buildUTCDate(startYear, startMonth, baseDay);
      while (dateStringToNumber(formatDateString(candidate, timezone)) < startNumber) {
        candidate = addDays(candidate, interval.value * 7);
      }

      while (dateStringToNumber(formatDateString(candidate, timezone)) <= endNumber) {
        results.push({ payment, dueDate: formatDateString(candidate, timezone) });
        candidate = addDays(candidate, interval.value * 7);
      }
      continue;
    }

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

      const next = addMonths(year, month, interval.value);
      year = next.year;
      month = next.month;
    }
  }

  return results;
}
