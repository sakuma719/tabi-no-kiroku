import { z } from 'zod';
import { tripSchema, spotSchema, scheduleSchema, type AppData } from './models';
import { db, type TravelDB } from './db';

const backupSchema = z
  .object({
    app: z.literal('tabi-no-kiroku'),
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    data: z
      .object({
        trips: z.array(tripSchema).max(1000),
        schedules: z.array(scheduleSchema).max(50000),
        spots: z.array(spotSchema).max(20000),
      })
      .strict(),
  })
  .strict();

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function parseBackup(json: string): AppData {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES)
    throw new Error('バックアップは10MB以内にしてください');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('JSONファイルを読み取れません');
  }
  const result = backupSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      '旅のきろくの対応するバックアップ形式ではありません。項目・日付・URLを確認してください',
    );
  const { data } = result.data;
  for (const items of [data.trips, data.spots, data.schedules]) {
    if (new Set(items.map((item) => item.id)).size !== items.length)
      throw new Error('IDが重複しています');
  }
  const trips = new Map(data.trips.map((trip) => [trip.id, trip]));
  const spots = new Set(data.spots.map((spot) => spot.id));
  for (const item of data.schedules) {
    const trip = trips.get(item.tripId);
    if (
      !trip ||
      item.date < trip.startDate ||
      item.date > trip.endDate ||
      (item.spotId && !spots.has(item.spotId))
    ) {
      throw new Error('予定の旅行・日付・スポットの関連が正しくありません');
    }
  }
  return data;
}

export function createBackup(data: AppData): string {
  return JSON.stringify(
    { app: 'tabi-no-kiroku', schemaVersion: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

/** All-or-nothing restore: validate first, then replace within one transaction. */
export async function restoreBackup(json: string, database: TravelDB = db): Promise<void> {
  const data = parseBackup(json);
  await database.transaction('rw', database.trips, database.schedules, database.spots, async () => {
    await Promise.all([database.trips.clear(), database.schedules.clear(), database.spots.clear()]);
    await database.trips.bulkAdd(data.trips);
    await database.spots.bulkAdd(data.spots);
    await database.schedules.bulkAdd(data.schedules);
  });
}
