import { db } from './db';
import { localToday, tripDates } from './dates';
import type { Schedule, Spot, Trip } from './models';

export async function createSampleTrip(): Promise<string> {
  const startDate = localToday();
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  const endDate = end.toISOString().slice(0, 10);
  const trip: Trip = {
    id: crypto.randomUUID(),
    name: '別府',
    area: '大分県 別府市',
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
  };
  const spots: Spot[] = [
    {
      id: crypto.randomUUID(),
      name: '別府駅',
      address: '大分県別府市駅前町',
      latitude: 33.2795,
      longitude: 131.5001,
      googleMapsUrl: '',
      savedToList: true,
    },
    {
      id: crypto.randomUUID(),
      name: '海地獄',
      address: '大分県別府市鉄輪559-1',
      latitude: 33.3156,
      longitude: 131.4692,
      googleMapsUrl: '',
      savedToList: true,
    },
    {
      id: crypto.randomUUID(),
      name: '地獄蒸し工房 鉄輪',
      address: '大分県別府市風呂本5組',
      latitude: 33.315,
      longitude: 131.4775,
      googleMapsUrl: '',
      savedToList: true,
    },
  ];
  const base = {
    tripId: trip.id,
    date: startDate,
    category: '観光' as const,
    transport: 'なし' as const,
    memo: '',
  };
  const schedules: Schedule[] = [
    {
      ...base,
      id: crypto.randomUUID(),
      spotId: spots[0].id,
      title: '別府駅に到着',
      startTime: '09:30',
      endTime: '10:00',
      order: 0,
      memo: '駅で荷物を預けて、身軽に出発。\n※この旅は操作を試すためのサンプルです。交通時刻や営業情報はご自身で確認してください。',
    },
    {
      ...base,
      id: crypto.randomUUID(),
      spotId: spots[1].id,
      title: '海地獄を散策',
      startTime: '11:00',
      endTime: '12:00',
      order: 1,
      transport: 'バス',
      departureTime: '10:20',
      travelMinutes: 25,
      memo: '青い湯けむりを眺めながら、ゆっくり散策。',
    },
    {
      ...base,
      id: crypto.randomUUID(),
      spotId: spots[2].id,
      title: '鉄輪で地獄蒸しランチ',
      startTime: '12:30',
      endTime: '13:30',
      order: 2,
      category: '食事',
      transport: '徒歩',
      travelMinutes: 12,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      date: tripDates(startDate, endDate)[1],
      title: '温泉街を気ままに歩く',
      startTime: '10:00',
      category: '観光',
      order: 0,
      transport: '徒歩',
    },
  ];
  await db.transaction('rw', db.trips, db.schedules, db.spots, async () => {
    await db.trips.add(trip);
    await db.spots.bulkAdd(spots);
    await db.schedules.bulkAdd(schedules);
  });
  return trip.id;
}
