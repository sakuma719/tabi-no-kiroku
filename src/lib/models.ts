import { z } from 'zod';
import { isDate, tripDates } from './dates';
import { isGoogleMapsUrl } from './maps';

z.setErrorMap((issue) => {
  if (issue.code === 'too_big') return { message: `入力の上限（${issue.maximum}）を超えています` };
  if (issue.code === 'too_small')
    return {
      message:
        issue.type === 'string'
          ? '必須項目を入力してください'
          : `値は${issue.minimum}以上にしてください`,
    };
  return { message: '入力内容が正しくありません。日付・時刻・数値などを確認してください' };
});

export const categories = ['観光', '食事', '宿泊', '買い物', 'その他'] as const;
export const transports = ['なし', '徒歩', '電車', 'バス', '車', 'その他'] as const;
const id = z.string().min(1).max(100);
const date = z.string().refine(isDate, '日付が正しくありません');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時刻が正しくありません');
const latitude = z.number().finite().min(-90).max(90).optional();
const longitude = z.number().finite().min(-180).max(180).optional();
const coordinatePair = (value: { latitude?: number; longitude?: number }) =>
  (value.latitude === undefined) === (value.longitude === undefined);

export const tripSchema = z
  .object({
    id,
    name: z.string().trim().min(1, '旅行名を入力してください').max(100),
    area: z.string().trim().min(1, '行先エリアを入力してください').max(200),
    startDate: date,
    endDate: date,
    latitude,
    longitude,
    createdAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, '終了日は開始日以降にしてください')
  .refine(
    (v) => tripDates(v.startDate, v.endDate).length <= 366,
    '旅行期間は366日以内にしてください',
  )
  .refine(coordinatePair, '緯度と経度は両方入力してください');

export const spotSchema = z
  .object({
    id,
    name: z.string().trim().min(1, 'スポット名を入力してください').max(200),
    address: z.string().max(500),
    latitude,
    longitude,
    googleMapsUrl: z
      .string()
      .max(2048)
      .refine((v) => !v || isGoogleMapsUrl(v), 'HTTPSのGoogleマップURLを入力してください'),
    savedToList: z.boolean(),
  })
  .strict()
  .refine(coordinatePair, '緯度と経度は両方入力してください');

export const scheduleSchema = z
  .object({
    id,
    tripId: id,
    spotId: id.optional(),
    date,
    title: z.string().trim().min(1, '予定名を入力してください').max(200),
    startTime: time,
    endTime: time.optional(),
    category: z.enum(categories),
    transport: z.enum(transports),
    departureTime: time.optional(),
    travelMinutes: z.number().int().min(0).max(10080).optional(),
    memo: z.string().max(10000),
    order: z.number().int().min(0).max(1000000),
  })
  .strict()
  .refine(
    (v) => !v.endTime || v.endTime >= v.startTime,
    '終了時刻は開始時刻以降にしてください（日をまたぐ予定は日付ごとに分けてください）',
  )
  .refine(
    (v) => !v.departureTime || v.transport === '電車' || v.transport === 'バス',
    '発車時刻は電車・バスでのみ設定できます',
  );

export type Trip = z.infer<typeof tripSchema>;
export type Spot = z.infer<typeof spotSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export interface AppData {
  trips: Trip[];
  schedules: Schedule[];
  spots: Spot[];
}
