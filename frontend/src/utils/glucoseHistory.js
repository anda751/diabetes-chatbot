function parseGlucoseTimestamp(record) {
  const value = record?.recordedAt || record?.recorded_at || record?.date || '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFallbackPeriodKey(record) {
  const timestamp = parseGlucoseTimestamp(record);
  if (timestamp) {
    const dayKey = timestamp.toISOString().slice(0, 10);
    const phaseKey = String(record?.phase || '').trim() || 'unknown';
    return `day:${dayKey}|phase:${phaseKey}`;
  }

  const dateKey = String(record?.date || '').trim() || 'unknown-date';
  const phaseKey = String(record?.phase || '').trim() || 'unknown';
  return `date:${dateKey}|phase:${phaseKey}`;
}

function getMealNameFromReminderKey(reminderKey) {
  const reminderId = String(reminderKey || '').split(':')[1] || '';

  if (reminderId === 'breakfast') return 'มื้อเช้า';
  if (reminderId === 'lunch') return 'มื้อกลางวัน';
  if (reminderId === 'dinner') return 'มื้อเย็น';

  return '';
}

export function getGlucosePeriodKey(record) {
  const reminderKey = String(record?.reminderSlotKey || record?.reminder_slot_key || '').trim();
  if (reminderKey) {
    const phaseKey = String(record?.phase || '').trim() || 'unknown';
    return `slot:${reminderKey}|phase:${phaseKey}`;
  }

  return buildFallbackPeriodKey(record);
}

export function getGlucoseMealName(record) {
  const reminderKey = String(record?.reminderSlotKey || record?.reminder_slot_key || '').trim();
  if (!reminderKey) return '';

  const mealName = getMealNameFromReminderKey(reminderKey);
  if (mealName) return mealName;

  const reminderId = String(reminderKey).split(':')[1] || '';
  const reminderTime = String(reminderKey).split(':')[2] || '';
  if (reminderId && reminderTime) {
    return `มื้อ ${reminderTime}`;
  }

  if (reminderId) {
    return `มื้อ ${reminderId}`;
  }

  return '';
}

export function dedupeGlucoseHistoryByLatestPeriod(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  const sortedHistory = [...history].sort((left, right) => {
    const leftTime = parseGlucoseTimestamp(left)?.getTime() ?? 0;
    const rightTime = parseGlucoseTimestamp(right)?.getTime() ?? 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return Number(right?.id || 0) - Number(left?.id || 0);
  });

  const seenKeys = new Set();
  const deduped = [];

  for (const record of sortedHistory) {
    const periodKey = getGlucosePeriodKey(record);
    if (seenKeys.has(periodKey)) continue;

    seenKeys.add(periodKey);
    deduped.push(record);
  }

  return deduped;
}
