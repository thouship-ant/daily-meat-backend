// IST-aligned [start, end) range for a dashboard period; end is null when open-ended. Null if unknown period.
function getISTRange(period, startStr = null, endStr = null) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  // Start of an IST calendar day, expressed as a UTC instant
  const istDayStart = (y, m, d) => new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);

  let start;
  let end = null;
  if (period === 'today') {
    start = istDayStart(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
  } else if (period === 'week') {
    start = istDayStart(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() - istNow.getUTCDay());
  } else if (period === 'month') {
    start = istDayStart(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1);
  } else if (period === 'custom' && startStr && endStr) {
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    start = istDayStart(sy, sm - 1, sd);
    end = istDayStart(ey, em - 1, ed + 1);
  } else {
    return null;
  }
  return { start, end };
}

module.exports = { getISTRange };
