const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** "hace 5 minutos", "ayer"... falling back to a date after a week. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'hace un momento';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return dateTime.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function mm(value: number): string {
  return `${number.format(value)} mm`;
}

export function percent(value: number): string {
  return `${number.format(value)} %`;
}
