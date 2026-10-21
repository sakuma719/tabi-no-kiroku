import { describe, expect, it } from 'vitest';
import { duration, formatMinutes, isDate, minutes, tripDates } from './dates';
import { googleMapsUrl, isGoogleMapsUrl } from './maps';
import { overlaps, overlappingIds, sortSchedules } from './schedule';
import { scheduleSchema, tripSchema, type Schedule } from './models';

export const exampleSchedule: Schedule = {
  id: 's1',
  tripId: 't1',
  date: '2026-10-21',
  title: '海地獄',
  startTime: '10:00',
  endTime: '11:00',
  category: '観光',
  transport: '徒歩',
  memo: '',
  order: 0,
};
export const exampleTrip = {
  id: 't1',
  name: '別府',
  area: '別府市',
  startDate: '2026-10-21',
  endDate: '2026-10-23',
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('日付と時間', () => {
  it('うるう日と月をまたぐDAYを生成する', () => {
    expect(tripDates('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
    expect(isDate('2026-02-30')).toBe(false);
    expect(tripDates('2026-10-23', '2026-10-21')).toEqual([]);
  });
  it('滞在・間隔を分で計算し、終了時刻なしは計算しない', () => {
    expect(duration('09:30', '11:00')).toBe(90);
    expect(duration('09:30', undefined)).toBeUndefined();
    expect(minutes('12:30') - minutes('11:00')).toBe(90);
    expect(formatMinutes(90)).toBe('1時間30分');
    expect(formatMinutes(60)).toBe('1時間');
    expect(formatMinutes(0)).toBe('0分');
  });
  it('不正な時刻・日をまたぐ時刻・片方だけの座標・長すぎる旅行を拒否する', () => {
    expect(scheduleSchema.safeParse({ ...exampleSchedule, startTime: '25:00' }).success).toBe(
      false,
    );
    expect(scheduleSchema.safeParse({ ...exampleSchedule, endTime: '09:00' }).success).toBe(false);
    expect(tripSchema.safeParse({ ...exampleTrip, latitude: 33 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...exampleTrip, endDate: '2028-01-01' }).success).toBe(false);
  });
});

describe('予定の順番と重複', () => {
  it('接する時刻は重複せず、実際に重なる区間を警告する', () => {
    expect(
      overlaps(exampleSchedule, {
        ...exampleSchedule,
        id: 's2',
        startTime: '11:00',
        endTime: '12:00',
      }),
    ).toBe(false);
    expect(
      overlaps(exampleSchedule, {
        ...exampleSchedule,
        id: 's2',
        startTime: '10:30',
        endTime: undefined,
      }),
    ).toBe(true);
    expect(
      overlaps(exampleSchedule, {
        ...exampleSchedule,
        id: 's2',
        startTime: '10:00',
        endTime: undefined,
      }),
    ).toBe(true);
    expect(overlaps(exampleSchedule, { ...exampleSchedule, id: 's2', date: '2026-10-22' })).toBe(
      false,
    );
  });
  it('隣接しない長い予定の重複も検知する', () => {
    const items = [
      exampleSchedule,
      { ...exampleSchedule, id: 's2', startTime: '10:15', endTime: '10:20' },
      { ...exampleSchedule, id: 's3', startTime: '10:50', endTime: '12:00' },
    ];
    expect([...overlappingIds(items)].sort()).toEqual(['s1', 's2', 's3']);
  });
  it('手動の並び順を優先し、時刻を変更しない', () => {
    const later = { ...exampleSchedule, id: 's2', startTime: '15:00', order: 0 };
    const earlier = { ...exampleSchedule, order: 1 };
    expect(sortSchedules([earlier, later]).map((item) => item.startTime)).toEqual([
      '15:00',
      '10:00',
    ]);
  });
});

describe('GoogleマップURL', () => {
  it.each([
    'https://www.google.com/maps/search/?api=1&query=別府',
    'https://maps.app.goo.gl/test',
    'https://goo.gl/maps/test',
    'https://maps.google.co.jp/?q=別府',
  ])('正規URLを許可: %s', (url) => expect(isGoogleMapsUrl(url)).toBe(true));
  it.each([
    'javascript:alert(1)',
    'http://www.google.com/maps',
    'https://google.com.evil.test/maps',
    'https://google.com@evil.test/maps',
    'https://user:pass@google.com/maps',
    'https://www.google.com/url?q=evil',
    'https://maps.app.goo.gl:444/test',
    'https://evil.test/',
  ])('危険または対象外URLを拒否: %s', (url) => expect(isGoogleMapsUrl(url)).toBe(false));
  it('登録済みURLを優先し、未登録や無効なら名前とエリアで検索する', () => {
    expect(googleMapsUrl('https://maps.app.goo.gl/example', '海地獄', '別府')).toBe(
      'https://maps.app.goo.gl/example',
    );
    expect(new URL(googleMapsUrl(undefined, '海地獄', '別府')).searchParams.get('query')).toBe(
      '海地獄 別府',
    );
    expect(googleMapsUrl('javascript:alert(1)', '海地獄', '別府')).toContain(
      'https://www.google.com/maps/search/',
    );
  });
});
