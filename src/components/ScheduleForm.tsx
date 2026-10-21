import { useRef, useState } from 'react';
import { AlignLeft, MapPin, TrainFront, Trash2, TriangleAlert } from 'lucide-react';
import {
  categories,
  transports,
  scheduleSchema,
  spotSchema,
  type Schedule,
  type Spot,
  type Trip,
} from '../lib/models';
import { duration, formatDate, formatMinutes, tripDates } from '../lib/dates';
import { saveSchedule } from '../lib/db';
import { overlaps } from '../lib/schedule';
import { Dialog, ErrorMessage, useUnsavedGuard } from './Dialog';

type SpotFields = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  savedToList: boolean;
};
const emptySpot: SpotFields = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  googleMapsUrl: '',
  savedToList: false,
};
const spotFields = (spot?: Spot): SpotFields =>
  spot
    ? {
        name: spot.name,
        address: spot.address,
        latitude: spot.latitude?.toString() ?? '',
        longitude: spot.longitude?.toString() ?? '',
        googleMapsUrl: spot.googleMapsUrl,
        savedToList: spot.savedToList,
      }
    : { ...emptySpot };

export function ScheduleForm({
  trip,
  date,
  schedule,
  schedules,
  spots,
  onClose,
  onSaved,
  onDelete,
}: {
  trip: Trip;
  date: string;
  schedule?: Schedule;
  schedules: Schedule[];
  spots: Spot[];
  onClose: () => void;
  onSaved: (date: string) => void;
  onDelete: (schedule: Schedule) => Promise<void>;
}) {
  const currentSpot = spots.find((spot) => spot.id === schedule?.spotId);
  const [draft, setDraft] = useState({
    title: schedule?.title ?? '',
    date: schedule?.date ?? date,
    startTime: schedule?.startTime ?? '09:00',
    endTime: schedule?.endTime ?? '',
    category: schedule?.category ?? '観光',
    transport: schedule?.transport ?? 'なし',
    departureTime: schedule?.departureTime ?? '',
    travelMinutes: schedule?.travelMinutes?.toString() ?? '',
    memo: schedule?.memo ?? '',
  });
  const [mode, setMode] = useState<'none' | 'new' | 'existing'>(currentSpot ? 'existing' : 'none');
  const [selectedSpotId, setSelectedSpotId] = useState(currentSpot?.id ?? '');
  const [spotDraft, setSpotDraft] = useState(spotFields(currentSpot));
  const serialized = JSON.stringify({ draft, mode, selectedSpotId, spotDraft });
  const initial = useRef(serialized);
  const canClose = useUnsavedGuard(initial.current !== serialized);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (field: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const updateSpot = <K extends keyof SpotFields>(field: K, value: SpotFields[K]) =>
    setSpotDraft((current) => ({ ...current, [field]: value }));
  const stay = duration(draft.startTime, draft.endTime);
  const preview: Schedule = {
    ...draft,
    id: schedule?.id ?? 'preview',
    tripId: trip.id,
    order: schedule?.order ?? 0,
    travelMinutes: draft.travelMinutes === '' ? undefined : Number(draft.travelMinutes),
  };
  const hasOverlap = schedules.some((item) => overlaps(preview, item));
  const selectableSpots = spots.filter((spot) => spot.savedToList || spot.id === currentSpot?.id);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    let spot: Spot | undefined;
    if (mode !== 'none') {
      if (mode === 'existing' && !selectedSpotId) {
        setError('登録済みのスポットを選んでください');
        return;
      }
      const result = spotSchema.safeParse({
        ...spotDraft,
        id: mode === 'existing' ? selectedSpotId : crypto.randomUUID(),
        name: spotDraft.name.trim() || draft.title.trim(),
        latitude: spotDraft.latitude === '' ? undefined : Number(spotDraft.latitude),
        longitude: spotDraft.longitude === '' ? undefined : Number(spotDraft.longitude),
        googleMapsUrl: spotDraft.googleMapsUrl.trim(),
      });
      if (!result.success) {
        setError(result.error.issues.map((issue) => issue.message).join(' ／ '));
        return;
      }
      spot = result.data;
    }
    const result = scheduleSchema.safeParse({
      ...draft,
      id: schedule?.id ?? crypto.randomUUID(),
      tripId: trip.id,
      spotId: spot?.id,
      endTime: draft.endTime || undefined,
      departureTime: ['電車', 'バス'].includes(draft.transport)
        ? draft.departureTime || undefined
        : undefined,
      travelMinutes: draft.travelMinutes === '' ? undefined : Number(draft.travelMinutes),
      order: schedule?.order ?? 0,
    });
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(' ／ '));
      return;
    }
    if (
      schedules.some((item) => overlaps(result.data, item)) &&
      !window.confirm('予定が重なっています。このまま保存しますか？')
    )
      return;
    setBusy(true);
    try {
      await saveSchedule(result.data, spot);
      onSaved(result.data.date);
    } catch {
      setError(
        '予定を保存できませんでした。空き容量や旅行の日程を確認して、もう一度お試しください。',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={schedule ? '予定を編集' : '予定を追加'}
      onClose={() => {
        if (!busy && canClose()) onClose();
      }}
    >
      <form className="dialog-form" onSubmit={save} noValidate>
        <div className="dialog-body form-stack">
          <label>
            予定名・行先 <span className="required">必須</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="例：海地獄を散策"
              maxLength={200}
              required
            />
          </label>
          <label>
            日付
            <select value={draft.date} onChange={(e) => update('date', e.target.value)}>
              {tripDates(trip.startDate, trip.endDate).map((day, i) => (
                <option key={day} value={day}>
                  DAY {i + 1} · {formatDate(day, true)}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              開始時刻 <span className="required">必須</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                required
              />
            </label>
            <label>
              終了時刻 <span className="optional">任意</span>
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => update('endTime', e.target.value)}
              />
            </label>
          </div>
          {stay !== undefined && (
            <p className={stay >= 0 ? 'duration-hint' : 'error-message'}>
              {stay >= 0
                ? `滞在時間 ${formatMinutes(stay)}`
                : '終了時刻は開始時刻以降にしてください'}
            </p>
          )}
          <label>
            カテゴリ
            <select value={draft.category} onChange={(e) => update('category', e.target.value)}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          {hasOverlap && (
            <p className="warning" role="status">
              <TriangleAlert size={17} /> 予定が重なっています。確認して保存できます。
            </p>
          )}
          <details className="form-details" open={undefined}>
            <summary>
              <TrainFront size={18} /> 移動・スポット情報
            </summary>
            <div className="details-body form-stack">
              <p className="field-hint">この目的地に向かう移動を入力してください。</p>
              <label>
                移動手段
                <select
                  value={draft.transport}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      transport: e.target.value as Schedule['transport'],
                      departureTime: ['電車', 'バス'].includes(e.target.value)
                        ? current.departureTime
                        : '',
                    }))
                  }
                >
                  {transports.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              {['電車', 'バス'].includes(draft.transport) && (
                <label>
                  発車時刻
                  <input
                    type="time"
                    value={draft.departureTime}
                    onChange={(e) => update('departureTime', e.target.value)}
                  />
                </label>
              )}
              <label>
                移動時間（分）
                <input
                  type="number"
                  min="0"
                  max="10080"
                  step="1"
                  inputMode="numeric"
                  value={draft.travelMinutes}
                  onChange={(e) => update('travelMinutes', e.target.value)}
                  placeholder="例：20"
                />
              </label>
              <p className="field-hint">
                移動時間は手動入力です。予定間の時間からは差し引きません。
              </p>
              <div className="form-divider" />
              <label>
                <span className="inline-label">
                  <MapPin size={17} /> スポット連携
                </span>
                <select
                  value={mode}
                  onChange={(e) => {
                    const next = e.target.value as typeof mode;
                    setMode(next);
                    if (next === 'new') {
                      setSelectedSpotId('');
                      setSpotDraft({ ...emptySpot, name: draft.title });
                    }
                    if (next === 'existing') {
                      setSelectedSpotId(currentSpot?.id ?? '');
                      setSpotDraft(spotFields(currentSpot));
                    }
                  }}
                >
                  <option value="none">連携しない（名前で地図検索）</option>
                  <option value="new">新しいスポットを設定</option>
                  <option value="existing">登録済みスポットを選ぶ</option>
                </select>
              </label>
              {mode === 'existing' && (
                <>
                  <label>
                    登録済みスポット
                    <select
                      value={selectedSpotId}
                      onChange={(e) => {
                        setSelectedSpotId(e.target.value);
                        setSpotDraft(spotFields(spots.find((spot) => spot.id === e.target.value)));
                      }}
                    >
                      <option value="">選んでください</option>
                      {selectableSpots.map((spot) => (
                        <option key={spot.id} value={spot.id}>
                          {spot.name}
                          {!spot.savedToList ? '（この予定の地点）' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="field-hint">
                    スポット情報の変更は、同じスポットを使うほかの予定にも反映されます。
                  </p>
                </>
              )}
              {(mode === 'new' || (mode === 'existing' && selectedSpotId)) && (
                <>
                  <label>
                    スポット名
                    <input
                      value={spotDraft.name}
                      onChange={(e) => updateSpot('name', e.target.value)}
                      maxLength={200}
                      placeholder={draft.title || '例：海地獄'}
                    />
                  </label>
                  <label>
                    住所
                    <input
                      value={spotDraft.address}
                      onChange={(e) => updateSpot('address', e.target.value)}
                      maxLength={500}
                      placeholder="例：大分県別府市鉄輪"
                    />
                  </label>
                  <div className="field-row">
                    <label>
                      緯度
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="-90"
                        max="90"
                        value={spotDraft.latitude}
                        onChange={(e) => updateSpot('latitude', e.target.value)}
                        placeholder="33.3150"
                      />
                    </label>
                    <label>
                      経度
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="-180"
                        max="180"
                        value={spotDraft.longitude}
                        onChange={(e) => updateSpot('longitude', e.target.value)}
                        placeholder="131.4680"
                      />
                    </label>
                  </div>
                  <p className="field-hint">
                    ピンを表示するには緯度・経度を両方入力してください。住所・URLからの自動変換は行いません。
                  </p>
                  <label>
                    GoogleマップURL
                    <input
                      type="url"
                      inputMode="url"
                      value={spotDraft.googleMapsUrl}
                      onChange={(e) => updateSpot('googleMapsUrl', e.target.value)}
                      placeholder="https://maps.app.goo.gl/…"
                      maxLength={2048}
                    />
                  </label>
                  <p className="field-hint">HTTPSのGoogleマップURLのみ利用できます。</p>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={spotDraft.savedToList}
                      onChange={(e) => updateSpot('savedToList', e.target.checked)}
                    />{' '}
                    スポット一覧に保存して、別の予定でも使う
                  </label>
                </>
              )}
            </div>
          </details>
          <details className="form-details">
            <summary>
              <AlignLeft size={18} /> メモ{draft.memo ? ' · 入力あり' : ''}
            </summary>
            <div className="details-body">
              <label>
                メモ
                <textarea
                  rows={5}
                  value={draft.memo}
                  onChange={(e) => update('memo', e.target.value)}
                  maxLength={10000}
                  placeholder="予約番号、入場料、気をつけたいことなど"
                />
              </label>
            </div>
          </details>
          {schedule && (
            <button
              type="button"
              className="button danger-quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(schedule);
                } catch {
                  setError('削除できませんでした');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={17} /> この予定を削除する
            </button>
          )}
          <ErrorMessage message={error} />
        </div>
        <footer className="dialog-footer">
          <button className="button primary full-width" type="submit" disabled={busy}>
            {busy ? '保存中…' : '予定を保存する'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
