import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TravelDB, readData, reorderSchedules, saveSchedule, saveTrip } from './db';
import { createBackup, parseBackup, restoreBackup } from './backup';
import type { AppData, Schedule, Spot } from './models';

const trip = {
  id: 't1',
  name: '別府',
  area: '別府市',
  startDate: '2026-10-21',
  endDate: '2026-10-23',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const spot: Spot = {
  id: 'p1',
  name: '海地獄',
  address: '',
  latitude: 33.3156,
  longitude: 131.4692,
  googleMapsUrl: '',
  savedToList: true,
};
const schedule: Schedule = {
  id: 's1',
  tripId: 't1',
  spotId: 'p1',
  date: '2026-10-21',
  title: '海地獄',
  startTime: '10:00',
  endTime: '11:00',
  category: '観光',
  transport: '徒歩',
  memo: '',
  order: 0,
};
const data: AppData = { trips: [trip], schedules: [schedule], spots: [spot] };
let database: TravelDB;
beforeEach(async () => {
  database = new TravelDB(`test-${crypto.randomUUID()}`);
  await database.open();
});
afterEach(async () => {
  await database.delete();
});

describe('IndexedDBの保存', () => {
  it('旅行の短縮で既存の予定を日程外にしない', async () => {
    await restoreBackup(createBackup(data), database);
    await expect(saveTrip({ ...trip, startDate: '2026-10-22' }, database)).rejects.toThrow(
      '日程から外れる',
    );
    expect(await database.trips.get(trip.id)).toEqual(trip);
  });
  it('予定とスポットをIDで共有し、二重保存しない', async () => {
    await database.trips.add(trip);
    await saveSchedule(schedule, spot, database);
    await saveSchedule(
      { ...schedule, id: 's2', startTime: '12:00', endTime: undefined },
      spot,
      database,
    );
    expect(await database.spots.count()).toBe(1);
    expect((await database.schedules.toArray()).every((item) => item.spotId === 'p1')).toBe(true);
    expect(await database.schedules.count()).toBe(2);
  });
  it('追加は時刻順に挿入し、並び替えは時刻を維持して永続化する', async () => {
    await database.trips.add(trip);
    await saveSchedule(schedule, spot, database);
    await saveSchedule(
      { ...schedule, id: 's2', startTime: '09:00', endTime: '09:30' },
      undefined,
      database,
    );
    expect((await database.schedules.get('s2'))?.order).toBe(0);
    await reorderSchedules('t1', schedule.date, ['s1', 's2'], database);
    database.close();
    await database.open();
    expect((await database.schedules.get('s1'))?.order).toBe(0);
    expect((await database.schedules.get('s2'))?.startTime).toBe('09:00');
  });
  it('編集で日付を移動してもIDとスポットを維持する', async () => {
    await database.trips.add(trip);
    await saveSchedule(schedule, spot, database);
    await saveSchedule({ ...schedule, date: '2026-10-22' }, undefined, database);
    expect(await database.schedules.count()).toBe(1);
    expect((await database.schedules.get('s1'))?.date).toBe('2026-10-22');
  });
  it('旅行外の日付や不完全な並び替えを拒否する', async () => {
    await database.trips.add(trip);
    await expect(
      saveSchedule({ ...schedule, date: '2026-10-24' }, spot, database),
    ).rejects.toThrow();
    expect(await database.spots.count()).toBe(0);
    await saveSchedule(schedule, spot, database);
    await expect(reorderSchedules('t1', schedule.date, [], database)).rejects.toThrow();
    expect((await database.schedules.get('s1'))?.order).toBe(0);
  });
});

describe('安全なJSON復元', () => {
  it('バックアップの往復で全データと関連を復元する', async () => {
    await restoreBackup(createBackup(data), database);
    expect(await readData(database)).toEqual(data);
  });
  it.each([
    ['不正なJSON', '{bad'],
    ['未知の形式', '{}'],
    ['参照切れ', createBackup({ ...data, spots: [] })],
    ['重複ID', createBackup({ ...data, trips: [trip, trip] })],
    ['旅行外の日付', createBackup({ ...data, schedules: [{ ...schedule, date: '2026-10-24' }] })],
    [
      '無効なURL',
      createBackup({ ...data, spots: [{ ...spot, googleMapsUrl: 'javascript:alert(1)' }] }),
    ],
    ['座標範囲外', createBackup({ ...data, spots: [{ ...spot, latitude: 100 }] })],
  ])('%sを拒否し、既存データを保持する', async (_name, json) => {
    await restoreBackup(createBackup(data), database);
    await expect(restoreBackup(json, database)).rejects.toThrow();
    expect(await readData(database)).toEqual(data);
  });
  it('書き込み途中の失敗でも全テーブルをロールバックする', async () => {
    await restoreBackup(createBackup(data), database);
    const fail = () => {
      throw new Error('simulated storage failure');
    };
    database.schedules.hook('creating', fail);
    await expect(
      restoreBackup(createBackup({ ...data, trips: [{ ...trip, name: '変更後' }] }), database),
    ).rejects.toThrow();
    database.schedules.hook('creating').unsubscribe(fail);
    expect(await readData(database)).toEqual(data);
  });
  it('容量上限を超えるファイルを拒否する', () => {
    expect(() => parseBackup(' '.repeat(10 * 1024 * 1024 + 1))).toThrow('10MB');
  });
});
