import Dexie, { type EntityTable } from 'dexie';
import type { AppData, Schedule, Spot, Trip } from './models';
import { sortSchedules } from './schedule';

export class TravelDB extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  schedules!: EntityTable<Schedule, 'id'>;
  spots!: EntityTable<Spot, 'id'>;

  constructor(name = 'tabi-no-kiroku') {
    super(name);
    // Extend with version(2).stores(...) and upgrade(...) for future logs/collections.
    this.version(1).stores({
      trips: 'id, startDate, createdAt',
      schedules: 'id, tripId, [tripId+date], spotId',
      spots: 'id, name',
    });
  }
}
export const db = new TravelDB();

export async function saveTrip(trip: Trip, database = db): Promise<void> {
  await database.transaction('rw', database.trips, database.schedules, async () => {
    const items = await database.schedules.where('tripId').equals(trip.id).toArray();
    if (items.some((item) => item.date < trip.startDate || item.date > trip.endDate)) {
      throw new Error(
        '変更後の日程から外れる予定があります。先に予定の日付を変更または削除してください。',
      );
    }
    await database.trips.put(trip);
  });
}

export async function readData(database = db): Promise<AppData> {
  return database.transaction(
    'r',
    database.trips,
    database.schedules,
    database.spots,
    async () => ({
      trips: await database.trips.toArray(),
      schedules: await database.schedules.toArray(),
      spots: await database.spots.toArray(),
    }),
  );
}

/** Change a schedule and its normalized spot in the same transaction. */
export async function saveSchedule(schedule: Schedule, spot?: Spot, database = db): Promise<void> {
  await database.transaction('rw', database.trips, database.schedules, database.spots, async () => {
    const trip = await database.trips.get(schedule.tripId);
    if (!trip || schedule.date < trip.startDate || schedule.date > trip.endDate)
      throw new Error('旅行の日程を確認してください');
    if (spot) await database.spots.put(spot);
    if (schedule.spotId && !(await database.spots.get(schedule.spotId)))
      throw new Error('スポットが見つかりません');
    const previous = await database.schedules.get(schedule.id);
    if (!previous || previous.date !== schedule.date) {
      const items = sortSchedules(
        await database.schedules
          .where('[tripId+date]')
          .equals([schedule.tripId, schedule.date])
          .toArray(),
      );
      const index = items.findIndex((item) => item.startTime > schedule.startTime);
      items.splice(index < 0 ? items.length : index, 0, schedule);
      await database.schedules.bulkPut(items.map((item, order) => ({ ...item, order })));
    } else {
      await database.schedules.put({ ...schedule, order: previous.order });
    }
  });
}

export async function reorderSchedules(
  tripId: string,
  date: string,
  ids: string[],
  database = db,
): Promise<void> {
  await database.transaction('rw', database.schedules, async () => {
    const items = await database.schedules.where('[tripId+date]').equals([tripId, date]).toArray();
    if (
      ids.length !== items.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !items.some((item) => item.id === id))
    ) {
      throw new Error('予定が更新されました。もう一度並び替えてください');
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    await database.schedules.bulkPut(ids.map((id, order) => ({ ...byId.get(id)!, order })));
  });
}

export async function deleteTrip(tripId: string): Promise<void> {
  await db.transaction('rw', db.trips, db.schedules, async () => {
    await db.schedules.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
  });
}
