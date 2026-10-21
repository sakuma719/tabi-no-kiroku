import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Download,
  Map,
  MapPin,
  Pencil,
  Plus,
  Route,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { db, deleteTrip, readData, reorderSchedules } from './lib/db';
import { formatDate, tripDates } from './lib/dates';
import { sortSchedules } from './lib/schedule';
import { createSampleTrip } from './lib/sample';
import type { Schedule, Trip } from './lib/models';
import { TripForm } from './components/TripForm';
import { ScheduleForm } from './components/ScheduleForm';
import { Timeline } from './components/Timeline';
import { BackupDialog } from './components/BackupDialog';

const TripMap = lazy(() =>
  import('./components/TripMap').then((module) => ({ default: module.TripMap })),
);

function routeTripId(): string {
  try {
    return decodeURIComponent(window.location.hash.match(/^#\/trip\/([^/]+)$/)?.[1] ?? '');
  } catch {
    return '';
  }
}
function dateRange(trip: Trip): string {
  return `${trip.startDate.slice(0, 4)}年 ${formatDate(trip.startDate)} — ${trip.startDate === trip.endDate ? '日帰り' : `${trip.endDate.slice(0, 4) !== trip.startDate.slice(0, 4) ? `${trip.endDate.slice(0, 4)}年 ` : ''}${formatDate(trip.endDate)}`}`;
}

export default function App() {
  const data = useLiveQuery(() => readData());
  const [selectedId, setSelectedId] = useState(routeTripId);
  const acceptedHash = useRef(window.location.hash);
  const [day, setDay] = useState('');
  const [tripForm, setTripForm] = useState<{ trip?: Trip } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ schedule?: Schedule; date: string } | null>(
    null,
  );
  const [backupOpen, setBackupOpen] = useState(false);
  const [deleted, setDeleted] = useState<Schedule | null>(null);
  const [error, setError] = useState('');
  const [sampleBusy, setSampleBusy] = useState(false);
  const trip = data?.trips.find((item) => item.id === selectedId);
  const selectedDay =
    trip && day >= trip.startDate && day <= trip.endDate ? day : (trip?.startDate ?? '');
  const schedules = data?.schedules.filter((item) => item.tripId === trip?.id) ?? [];
  const dayItems = sortSchedules(schedules.filter((item) => item.date === selectedDay));

  useEffect(() => {
    const handler = () => {
      const event = new Event('travel:before-navigate', { cancelable: true });
      if (!window.dispatchEvent(event)) {
        history.replaceState(
          null,
          '',
          `${location.pathname}${location.search}${acceptedHash.current}`,
        );
        return;
      }
      acceptedHash.current = location.hash;
      setSelectedId(routeTripId());
      setDay('');
      setScheduleForm(null);
      setTripForm(null);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    document.title = trip ? `${trip.name}の旅 | 旅のきろく` : '旅のきろく — デジタル旅のしおり';
  }, [trip]);

  function navigate(id = '') {
    // pushState avoids a hashchange racing the dirty-form effect during save.
    const hash = id ? `#/trip/${encodeURIComponent(id)}` : '#/';
    if (location.hash !== hash)
      history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
    acceptedHash.current = hash;
    setSelectedId(id);
    setDay('');
    setError('');
    window.scrollTo({ top: 0 });
  }
  function reportError() {
    setError(
      '操作を保存できませんでした。端末の空き容量とブラウザの保存設定を確認して、もう一度お試しください。',
    );
  }
  async function removeSchedule(item: Schedule) {
    await db.schedules.delete(item.id);
    setDeleted(item);
    setScheduleForm(null);
  }
  async function undo() {
    if (!deleted) return;
    try {
      await db.transaction('rw', db.trips, db.schedules, async () => {
        const parent = await db.trips.get(deleted.tripId);
        if (!parent || deleted.date < parent.startDate || deleted.date > parent.endDate)
          throw new Error('旅行が変更されています');
        const items = sortSchedules(
          await db.schedules
            .where('[tripId+date]')
            .equals([deleted.tripId, deleted.date])
            .toArray(),
        );
        items.splice(Math.min(deleted.order, items.length), 0, deleted);
        await db.schedules.bulkPut(items.map((item, order) => ({ ...item, order })));
      });
      setDeleted(null);
    } catch {
      setError(
        '取り消しできませんでした。元の旅行の日程が変更または削除されていないか確認してください。',
      );
    }
  }
  async function removeTrip() {
    if (
      !trip ||
      !window.confirm(
        `「${trip.name}の旅」と、その旅行のすべての予定を削除します。この操作は取り消せません。よろしいですか？`,
      )
    )
      return;
    try {
      await deleteTrip(trip.id);
      setDeleted(null);
      navigate();
    } catch {
      reportError();
    }
  }
  async function sample() {
    setSampleBusy(true);
    try {
      navigate(await createSampleTrip());
    } catch {
      reportError();
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        本文へ移動
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate()} aria-label="旅のきろく 旅行一覧へ">
            <span className="brand-mark">
              <Map size={23} strokeWidth={1.5} />
            </span>
            <span>
              旅のきろく<span className="brand-subtitle">わたしだけの、旅のしおり</span>
            </span>
          </button>
          <button className="button backup-button" onClick={() => setBackupOpen(true)}>
            <Download size={17} />
            <span>バックアップ</span>
          </button>
        </div>
      </header>
      <main id="main-content" className="main-container" tabIndex={-1}>
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="エラーを閉じる"
              onClick={() => setError('')}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!data ? (
          <p className="loading" role="status">
            旅のきろくを読み込んでいます…
          </p>
        ) : trip ? (
          <>
            <nav className="back-nav">
              <button className="text-button" onClick={() => navigate()}>
                <ArrowLeft size={16} /> 旅行一覧に戻る
              </button>
              <button className="text-button" onClick={() => setTripForm({ trip })}>
                <Pencil size={15} /> 旅行を編集
              </button>
            </nav>
            <section className="trip-hero">
              <p className="eyebrow">MY TRAVEL ITINERARY</p>
              <h1>
                {trip.name}
                <span>の旅</span>
              </h1>
              <div className="trip-meta">
                <span>
                  <CalendarDays size={16} />
                  {dateRange(trip)}
                </span>
                <span className="trip-day-count">
                  {tripDates(trip.startDate, trip.endDate).length}日間
                </span>
              </div>
              <p className="hero-message">楽しみな予定も、寄り道も。この一冊に。</p>
            </section>
            <Suspense
              fallback={
                <p className="map-caption" role="status">
                  地図を準備しています…
                </p>
              }
            >
              <TripMap trip={trip} schedules={schedules} spots={data.spots} />
            </Suspense>
            <section className="itinerary-section" aria-label="日別のしおり">
              <div className="day-tabs" role="tablist" aria-label="旅行の日付">
                {tripDates(trip.startDate, trip.endDate).map((date, index) => (
                  <button
                    key={date}
                    id={`tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={selectedDay === date}
                    aria-controls="day-panel"
                    tabIndex={selectedDay === date ? 0 : -1}
                    className={`day-tab ${selectedDay === date ? 'active' : ''}`}
                    onClick={() => setDay(date)}
                    onKeyDown={(event) => {
                      const dates = tripDates(trip.startDate, trip.endDate);
                      let next = index;
                      if (event.key === 'ArrowRight') next = (index + 1) % dates.length;
                      else if (event.key === 'ArrowLeft')
                        next = (index - 1 + dates.length) % dates.length;
                      else if (event.key === 'Home') next = 0;
                      else if (event.key === 'End') next = dates.length - 1;
                      else return;
                      event.preventDefault();
                      setDay(dates[next]);
                      document.getElementById(`tab-${next}`)?.focus();
                    }}
                  >
                    <span>DAY {index + 1}</span>
                    <span>{formatDate(date, true)}</span>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div
                id="day-panel"
                role="tabpanel"
                aria-labelledby={`tab-${tripDates(trip.startDate, trip.endDate).indexOf(selectedDay)}`}
                tabIndex={0}
              >
                <div className="section-heading">
                  <div>
                    <h2>この日のスケジュール</h2>
                    <span>{dayItems.length}件の予定</span>
                  </div>
                  <span className="tiny-label">
                    <GripHint /> 長押し・ドラッグで並び替え
                  </span>
                </div>
                {dayItems.length ? (
                  <Timeline
                    items={dayItems}
                    spots={data.spots}
                    trip={trip}
                    onEdit={(item) => setScheduleForm({ schedule: item, date: item.date })}
                    onDelete={(item) => removeSchedule(item).catch(reportError)}
                    onReorder={async (ids) => {
                      try {
                        await reorderSchedules(trip.id, selectedDay, ids);
                      } catch {
                        reportError();
                      }
                    }}
                  />
                ) : (
                  <div className="empty-day">
                    <Compass size={38} strokeWidth={1.1} />
                    <h3>今日は、どこへ行こう。</h3>
                    <p>
                      行きたい場所をひとつずつ、
                      <br />
                      この日のしおりに加えましょう。
                    </p>
                  </div>
                )}
                <button
                  className="add-schedule-button"
                  onClick={() => setScheduleForm({ date: selectedDay })}
                >
                  <Plus size={20} /> 予定を追加する
                </button>
                <p className="gesture-hint">
                  カードを左にスワイプすると削除ボタンが表示されます。
                  <br className="mobile-only" /> 編集画面からも削除できます。
                </p>
              </div>
            </section>
            <div className="trip-bottom">
              <span>
                <Check size={14} /> このブラウザに自動保存
              </span>
              <button className="text-button danger-text" onClick={() => void removeTrip()}>
                <Trash2 size={14} />
                旅行を削除
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="list-hero">
              <p className="eyebrow">A LITTLE PLAN, A GREAT JOURNEY</p>
              <h1>
                次の旅を、
                <br className="mobile-only" />
                思い描こう。
              </h1>
              <p>行きたい場所をつないで、あなたらしい旅のしおりに。</p>
            </section>
            <div className="list-section-heading">
              <div>
                <h2>わたしの旅</h2>
                <span>{data.trips.length}件の旅行</span>
              </div>
              <button className="button primary" onClick={() => setTripForm({})}>
                <Plus size={18} /> 新しい旅行
              </button>
            </div>
            {data.trips.length ? (
              <div className="trip-grid">
                {[...data.trips]
                  .sort(
                    (a, b) =>
                      b.startDate.localeCompare(a.startDate) ||
                      b.createdAt.localeCompare(a.createdAt),
                  )
                  .map((item, index) => (
                    <button
                      className="trip-list-card"
                      key={item.id}
                      onClick={() => navigate(item.id)}
                    >
                      <div className="trip-card-visual">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <Route size={62} strokeWidth={0.7} />
                        <span>{tripDates(item.startDate, item.endDate).length} DAYS</span>
                      </div>
                      <div className="trip-card-body">
                        <span className="trip-card-area">
                          <MapPin size={13} />
                          {item.area}
                        </span>
                        <h3>
                          {item.name}の旅
                          <ArrowRight size={20} />
                        </h3>
                        <p>
                          <CalendarDays size={14} />
                          {dateRange(item)}
                        </p>
                        <span className="trip-card-count">
                          {data.schedules.filter((schedule) => schedule.tripId === item.id).length}
                          件の予定
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="welcome-card">
                <div className="welcome-illustration">
                  <Map size={60} strokeWidth={1} />
                  <span className="welcome-compass">
                    <Compass size={27} strokeWidth={1.1} />
                  </span>
                </div>
                <h2>旅は、計画する時間から。</h2>
                <p>
                  日程、行きたい場所、ちょっとしたメモ。
                  <br />
                  次の旅の楽しみを、ここに集めてみませんか。
                </p>
                <button className="button primary" onClick={() => setTripForm({})}>
                  <Plus size={18} /> はじめての旅をつくる
                </button>
                <button
                  className="text-button sample-button"
                  disabled={sampleBusy}
                  onClick={() => void sample()}
                >
                  {sampleBusy ? '準備中…' : 'サンプルの「別府の旅」を試す'}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
            <aside className="storage-note">
              <span className="storage-note-icon">
                <Download size={20} strokeWidth={1.4} />
              </span>
              <div>
                <h3>大切な旅を、手元にも。</h3>
                <p>
                  データはこのブラウザに保存されます。端末の変更や履歴の削除に備えて、定期的にバックアップしましょう。
                </p>
              </div>
              <button className="text-button" onClick={() => setBackupOpen(true)}>
                バックアップ
                <ArrowRight size={15} />
              </button>
            </aside>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>旅のきろく</span>
        <p>まだ見ぬ景色へ、わたしのペースで。</p>
      </footer>
      {tripForm && data && (
        <TripForm
          trip={tripForm.trip}
          schedules={data.schedules}
          onClose={() => setTripForm(null)}
          onSaved={(id) => {
            setTripForm(null);
            navigate(id);
          }}
        />
      )}
      {scheduleForm && trip && data && (
        <ScheduleForm
          key={scheduleForm.schedule?.id ?? `new-${scheduleForm.date}`}
          trip={trip}
          date={scheduleForm.date}
          schedule={scheduleForm.schedule}
          schedules={schedules}
          spots={data.spots}
          onClose={() => setScheduleForm(null)}
          onSaved={(date) => {
            setDay(date);
            setScheduleForm(null);
          }}
          onDelete={removeSchedule}
        />
      )}
      {backupOpen && (
        <BackupDialog
          onClose={() => setBackupOpen(false)}
          onRestored={() => {
            setDeleted(null);
            setScheduleForm(null);
            navigate();
          }}
        />
      )}
      {deleted && (
        <div className="undo-toast" role="status">
          <span>「{deleted.title}」を削除しました</span>
          <button onClick={() => void undo()}>
            <Undo2 size={16} />
            取り消す
          </button>
          <button
            className="toast-close"
            aria-label="取り消し通知を閉じる"
            onClick={() => setDeleted(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function GripHint() {
  return <span aria-hidden="true">⠿</span>;
}
