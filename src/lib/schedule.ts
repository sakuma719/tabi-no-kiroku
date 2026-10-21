import type { Schedule } from './models';
import { minutes } from './dates';

export function sortSchedules(items: Schedule[]): Schedule[] {
  return [...items].sort(
    (a, b) =>
      a.order - b.order || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
  );
}

export function overlaps(a: Schedule, b: Schedule): boolean {
  if (a.id === b.id || a.tripId !== b.tripId || a.date !== b.date) return false;
  const startA = minutes(a.startTime),
    startB = minutes(b.startTime);
  return (
    startA === startB ||
    (startA < startB && !!a.endTime && minutes(a.endTime) > startB) ||
    (startB < startA && !!b.endTime && minutes(b.endTime) > startA)
  );
}

export function overlappingIds(items: Schedule[]): Set<string> {
  const ids = new Set<string>();
  const days = new Map<string, Schedule[]>();
  for (const item of items) {
    const key = JSON.stringify([item.tripId, item.date]);
    const day = days.get(key) ?? [];
    day.push(item);
    days.set(key, day);
  }
  // Sweep by start time, remembering the interval ending latest. This also
  // finds non-adjacent overlaps without quadratic work on large imports.
  for (const day of days.values()) {
    const sorted = [...day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    let farthest: Schedule | undefined;
    let previous: Schedule | undefined;
    let latestEnd = -1;
    for (const item of sorted) {
      const start = minutes(item.startTime);
      if (farthest && latestEnd > start) {
        ids.add(farthest.id);
        ids.add(item.id);
      }
      if (previous?.startTime === item.startTime) {
        ids.add(previous.id);
        ids.add(item.id);
      }
      const end = minutes(item.endTime ?? item.startTime);
      if (end > latestEnd) {
        latestEnd = end;
        farthest = item;
      }
      previous = item;
    }
  }
  return ids;
}
