import { useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Schedule, Trip } from '../lib/models';
import { tripSchema } from '../lib/models';
import { saveTrip } from '../lib/db';
import { localToday } from '../lib/dates';
import { findAreaCenter } from '../lib/maps';
import { Dialog, ErrorMessage, useUnsavedGuard } from './Dialog';

export function TripForm({
  trip,
  schedules,
  onSaved,
  onClose,
}: {
  trip?: Trip;
  schedules: Schedule[];
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    name: trip?.name ?? '',
    area: trip?.area ?? '',
    startDate: trip?.startDate ?? localToday(),
    endDate: trip?.endDate ?? localToday(),
    latitude: trip?.latitude?.toString() ?? '',
    longitude: trip?.longitude?.toString() ?? '',
  });
  const initial = useRef(JSON.stringify(draft));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canClose = useUnsavedGuard(initial.current !== JSON.stringify(draft));
  const update = (field: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const areaCenter = findAreaCenter(draft.area);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = tripSchema.safeParse({
      ...draft,
      id: trip?.id ?? crypto.randomUUID(),
      createdAt: trip?.createdAt ?? new Date().toISOString(),
      latitude: draft.latitude === '' ? undefined : Number(draft.latitude),
      longitude: draft.longitude === '' ? undefined : Number(draft.longitude),
    });
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(' ／ '));
      return;
    }
    if (
      trip &&
      schedules.some(
        (item) =>
          item.tripId === trip.id && (item.date < draft.startDate || item.date > draft.endDate),
      )
    ) {
      setError(
        '変更後の日程から外れる予定があります。先に予定の日付を変更または削除してください。',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveTrip(result.data);
      onSaved(result.data.id);
    } catch {
      setError(
        '旅行を保存できませんでした。端末の空き容量とブラウザの保存設定を確認してください。',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={trip ? '旅行を編集' : '新しい旅をつくる'}
      onClose={() => {
        if (!busy && canClose()) onClose();
      }}
    >
      <form onSubmit={save} className="dialog-form" noValidate>
        <div className="dialog-body form-stack">
          <p className="muted">行きたい場所と日程から、旅のしおりをつくりましょう。</p>
          <label>
            旅行名 <span className="required">必須</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              maxLength={100}
              placeholder="例：別府"
              required
            />
          </label>
          {draft.name && <p className="field-hint">しおりのタイトル：{draft.name}の旅</p>}
          <div className="field-row">
            <label>
              開始日
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => {
                  setDraft((current) => ({
                    ...current,
                    startDate: e.target.value,
                    endDate: current.endDate < e.target.value ? e.target.value : current.endDate,
                  }));
                }}
                required
              />
            </label>
            <label>
              終了日
              <input
                type="date"
                value={draft.endDate}
                min={draft.startDate}
                onChange={(e) => update('endDate', e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            行先エリア <span className="required">必須</span>
            <input
              value={draft.area}
              onChange={(e) => update('area', e.target.value)}
              placeholder="例：大分県 別府市"
              maxLength={200}
              required
            />
          </label>
          <details className="form-details">
            <summary>
              <MapPin size={18} /> 地図の中心を設定
            </summary>
            <div className="details-body form-stack">
              <p className="field-hint">
                {areaCenter
                  ? 'このエリアはおおよその中心を表示できます。必要に応じて座標を指定してください。'
                  : '座標が未設定の場合は日本全体を表示します。行先エリアの緯度・経度を指定すると、その周辺を表示できます。'}
              </p>
              <div className="field-row">
                <label>
                  中心の緯度
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    inputMode="decimal"
                    placeholder={areaCenter?.[0].toString() ?? '例：33.2846'}
                    value={draft.latitude}
                    onChange={(e) => update('latitude', e.target.value)}
                  />
                </label>
                <label>
                  中心の経度
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    inputMode="decimal"
                    placeholder={areaCenter?.[1].toString() ?? '例：131.4912'}
                    value={draft.longitude}
                    onChange={(e) => update('longitude', e.target.value)}
                  />
                </label>
              </div>
              <p className="field-hint">住所やURLからの自動変換は行いません。</p>
            </div>
          </details>
          <ErrorMessage message={error} />
        </div>
        <footer className="dialog-footer">
          <button type="submit" className="button primary full-width" disabled={busy}>
            {busy ? '保存中…' : '旅行を保存する'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
