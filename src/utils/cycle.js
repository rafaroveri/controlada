function normalizeDateInput(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time);
  }

  if (typeof value === 'string') {
    const normalized = value.length > 10 ? value.slice(0, 10) : value;
    const iso = `${normalized}T00:00:00Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeCycleKey(value, cycleStartDay = 1) {
  const date = normalizeDateInput(value);
  if (!date) {
    return null;
  }

  const startDay = Math.min(Math.max(Number.parseInt(cycleStartDay, 10) || 1, 1), 31);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (day < startDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

module.exports = {
  computeCycleKey
};
