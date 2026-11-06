// Dates and times in conversations, in the admin's language.

const DAY_MS = 86400000;

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

/** Which calendar day a message is on, in the browser's time zone, for grouping. */
export const dayKey = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

// Whole days from `time` to today, counting calendar days rather than 24-hour periods.
const daysAgo = (time, now) => Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);

/**
 * The divider above a day's messages: 今天, 昨天, or the date.
 * @param t - i18next's t, for today and yesterday
 */
export const dayLabel = (time, { t, language, now = new Date() }) => {
  const date = new Date(time);
  const days = daysAgo(date, now);
  if (days === 0) return t('today');
  if (days === 1) return t('yesterday');
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(language, { ...(sameYear ? {} : { year: 'numeric' }), month: 'long', day: 'numeric', weekday: 'short' });
};

/** A message's time, such as 14:05. */
export const timeLabel = (time, { language }) => new Date(time).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false });

/** When the last message of a conversation was: its time today, 昨天, the weekday this week, or the date. */
export const listTimeLabel = (time, { t, language, now = new Date() }) => {
  if (!time) return '';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '';
  const days = daysAgo(date, now);
  if (days <= 0) return timeLabel(date, { language });
  if (days === 1) return t('yesterday');
  if (days < 7) return date.toLocaleDateString(language, { weekday: 'short' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(language, { ...(sameYear ? {} : { year: 'numeric' }), month: 'numeric', day: 'numeric' });
};

/** A full date and time, for the customer panel. */
export const dateTimeLabel = (time, { language }) => (time ? new Date(time).toLocaleString(language, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
