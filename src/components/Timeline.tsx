import { Fragment, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BusFront,
  CarFront,
  ChevronDown,
  Footprints,
  GripVertical,
  MapPin,
  Pencil,
  TrainFront,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { Schedule, Spot, Trip } from '../lib/models';
import { duration, formatMinutes, minutes } from '../lib/dates';
import { overlappingIds } from '../lib/schedule';
import { googleMapsUrl } from '../lib/maps';

function TravelIcon({ mode }: { mode: Schedule['transport'] }) {
  if (mode === '電車') return <TrainFront size={15} />;
  if (mode === 'バス') return <BusFront size={15} />;
  if (mode === '車') return <CarFront size={15} />;
  if (mode === '徒歩') return <Footprints size={15} />;
  return <ArrowUpRight size={15} />;
}

function ScheduleCard({
  item,
  spot,
  trip,
  warning,
  index,
  total,
  onEdit,
  onDelete,
  onMove,
}: {
  item: Schedule;
  spot?: Spot;
  trip: Trip;
  warning: boolean;
  index: number;
  total: number;
  onEdit: (item: Schedule) => void;
  onDelete: (item: Schedule) => Promise<void>;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const swipe = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
  };
  const stay = duration(item.startTime, item.endTime);
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest('button, a, summary, input, textarea, select')
    )
      return;
    swipe.current = { x: event.clientX, y: event.clientY, horizontal: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    if (!start) return;
    const x = event.clientX - start.x,
      y = event.clientY - start.y;
    if (!start.horizontal && Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) {
      swipe.current = null;
      return;
    }
    if (!start.horizontal && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y)) {
      start.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.horizontal) setOffset(Math.max(-88, Math.min(0, (revealed ? -88 : 0) + x)));
  }
  function pointerUp() {
    if (swipe.current?.horizontal) {
      const show = offset < -40;
      setRevealed(show);
      setOffset(show ? -88 : 0);
    }
    swipe.current = null;
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`timeline-item ${isDragging ? 'dragging' : ''}`}
      data-schedule-id={item.id}
    >
      <div className="time-column">
        <span className="timeline-dot" />
        <time>{item.startTime}</time>
        {item.endTime && <span className="end-time">{item.endTime}</span>}
      </div>
      <div className="swipe-shell">
        <button
          className={`swipe-delete ${revealed ? 'visible' : ''}`}
          aria-label={`${item.title}を削除`}
          tabIndex={revealed ? 0 : -1}
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await onDelete(item);
            } finally {
              setDeleting(false);
            }
          }}
        >
          <Trash2 size={20} />
          削除
        </button>
        <div
          className="schedule-card"
          style={{ transform: `translateX(${offset}px)` }}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            swipe.current = null;
            setOffset(revealed ? -88 : 0);
          }}
        >
          <div className="card-topline">
            <span
              className={`category category-${item.category === '食事' ? 'food' : item.category === '宿泊' ? 'stay' : 'default'}`}
            >
              {item.category}
            </span>
            {stay !== undefined && <span className="stay-time">滞在 {formatMinutes(stay)}</span>}
            <div className="card-tools">
              {revealed && (
                <button
                  className="icon-button"
                  aria-label="削除ボタンを閉じる"
                  onClick={() => {
                    setRevealed(false);
                    setOffset(0);
                  }}
                >
                  <X size={17} />
                </button>
              )}
              <button
                className="icon-button drag-handle"
                {...attributes}
                {...listeners}
                aria-label={`${item.title}をドラッグして並び替え`}
              >
                <GripVertical size={19} />
              </button>
            </div>
          </div>
          <div className="card-title-row">
            <h3>{item.title}</h3>
            <button
              className="icon-button edit-button"
              aria-label={`${item.title}を編集`}
              onClick={() => onEdit(item)}
            >
              <Pencil size={16} />
            </button>
          </div>
          {spot?.address && (
            <p className="spot-address">
              <MapPin size={13} />
              {spot.address}
            </p>
          )}
          {(item.transport !== 'なし' || item.travelMinutes !== undefined) && (
            <div className="travel-info">
              <TravelIcon mode={item.transport} />
              <span>
                ここへ：{item.transport !== 'なし' ? item.transport : '移動'}
                {item.departureTime ? ` · ${item.departureTime}発` : ''}
                {item.travelMinutes !== undefined ? ` · ${formatMinutes(item.travelMinutes)}` : ''}
              </span>
            </div>
          )}
          {warning && (
            <p className="overlap-warning">
              <TriangleAlert size={14} /> 予定が重なっています
            </p>
          )}
          <div className="card-bottom">
            <a
              className="map-link"
              href={googleMapsUrl(spot?.googleMapsUrl, item.title, trip.area)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={14} />
              Googleマップ
              <ArrowUpRight size={13} />
            </a>
            <div className="move-controls">
              <button
                className="icon-button"
                aria-label={`${item.title}を上へ移動`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={`${item.title}を下へ移動`}
                disabled={index === total - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </div>
          {item.memo && (
            <details className="card-memo">
              <summary>
                メモを見る
                <ChevronDown size={14} />
              </summary>
              <p>{item.memo}</p>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

export function Timeline({
  items,
  spots,
  trip,
  onEdit,
  onDelete,
  onReorder,
}: {
  items: Schedule[];
  spots: Spot[];
  trip: Trip;
  onEdit: (item: Schedule) => void;
  onDelete: (item: Schedule) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const warnings = overlappingIds(items);
  const outOfOrder = items.some((item, i) => i > 0 && item.startTime < items[i - 1].startTime);
  function move(from: number, to: number) {
    if (from !== to)
      void onReorder(
        arrayMove(
          items.map((item) => item.id),
          from,
          to,
        ),
      );
  }
  function dragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id)
      move(
        items.findIndex((item) => item.id === active.id),
        items.findIndex((item) => item.id === over.id),
      );
  }
  return (
    <>
      {outOfOrder && (
        <p className="warning" role="status">
          <TriangleAlert size={17} /> 並び順と時刻が前後しています。時刻は自動変更されません。
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'スペースキーで予定を持ち上げ、上下の矢印キーで移動し、スペースキーでもう一度確定します。Escapeキーで取り消します。',
          },
          announcements: {
            onDragStart: () => '予定を持ち上げました。',
            onDragOver: () => '予定を移動しています。',
            onDragEnd: () => '並び替えを終了しました。',
            onDragCancel: () => '並び替えを取り消しました。',
          },
        }}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="timeline">
            {items.map((item, index) => {
              const next = items[index + 1];
              const gap =
                next && item.endTime ? minutes(next.startTime) - minutes(item.endTime) : undefined;
              return (
                <Fragment key={item.id}>
                  <ScheduleCard
                    item={item}
                    spot={spots.find((spot) => spot.id === item.spotId)}
                    trip={trip}
                    index={index}
                    total={items.length}
                    warning={warnings.has(item.id)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={move}
                  />
                  {gap !== undefined && (
                    <li className={`schedule-gap ${gap < 0 ? 'gap-warning' : ''}`}>
                      {gap >= 0
                        ? `次の予定まで ${formatMinutes(gap)}`
                        : next.startTime < item.startTime
                          ? '時刻の順序を確認してください'
                          : '予定が重なっています'}
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}
