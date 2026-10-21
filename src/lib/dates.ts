export function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function tripDates(start: string, end: string): string[] {
  if (!isDate(start) || !isDate(end) || end < start) return [];
  const days: string[] = [];
  const date = new Date(`${start}T00:00:00Z`);
  while (date.toISOString().slice(0, 10) <= end && days.length <= 366) {
    days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

export function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: string, weekday = false): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    ...(weekday ? { weekday: 'short' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function minutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function duration(start: string, end?: string): number | undefined {
  return end ? minutes(end) - minutes(start) : undefined;
}

export function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours ? `${hours}時間` : ''}${mins || !hours ? `${mins}分` : ''}`;
}
