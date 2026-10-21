import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
import type { Schedule, Spot, Trip } from '../lib/models';
import { findAreaCenter } from '../lib/maps';

function MapCanvas({ trip, spots }: { trip: Trip; spots: Spot[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    setTileError(false);
    const map = L.map(container.current, {
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: false,
    });
    L.control.zoom({ zoomInTitle: '拡大', zoomOutTitle: '縮小' }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      // Standard on-demand browser caching only; no bulk download/offline prefetch.
      detectRetina: false,
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    const points = spots.filter(
      (spot): spot is Spot & { latitude: number; longitude: number } =>
        spot.latitude !== undefined && spot.longitude !== undefined,
    );
    points.forEach((spot, i) => {
      const label = document.createElement('span');
      label.textContent = spot.name;
      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: L.divIcon({
          className: 'map-pin',
          html: `<span>${i + 1}</span>`,
          iconSize: [30, 36],
          iconAnchor: [15, 36],
          popupAnchor: [0, -32],
        }),
        title: spot.name,
        alt: spot.name,
      });
      marker.on('add', () => marker.getElement()?.setAttribute('aria-label', spot.name));
      marker.addTo(map).bindPopup(label);
    });
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((spot) => [spot.latitude, spot.longitude])), {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14);
    } else {
      const center =
        trip.latitude !== undefined && trip.longitude !== undefined
          ? ([trip.latitude, trip.longitude] as [number, number])
          : findAreaCenter(trip.area);
      map.setView(center ?? [36.5, 137.5], center ? 12 : 5);
    }
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [trip.area, trip.latitude, trip.longitude, spots]);
  return (
    <>
      <div ref={container} className="trip-map" aria-label={`${trip.area}の地図`} />
      {tileError && (
        <p className="map-network-note" role="status">
          地図タイルを読み込めません。通信状態を確認してください。予定の編集・保存は利用できます。
        </p>
      )}
    </>
  );
}

export function TripMap({
  trip,
  schedules,
  spots,
}: {
  trip: Trip;
  schedules: Schedule[];
  spots: Spot[];
}) {
  const [expanded, setExpanded] = useState(true);
  const ids = new Set(schedules.map((item) => item.spotId));
  // Serialize only relevant data, keeping a stable dependency across unrelated schedule edits.
  const serializedSpots = JSON.stringify(spots.filter((spot) => ids.has(spot.id)));
  const mapSpots = useMemo(() => JSON.parse(serializedSpots) as Spot[], [serializedSpots]);
  const locatedCount = mapSpots.filter((spot) => spot.latitude !== undefined).length;
  const hasCenter = trip.latitude !== undefined || !!findAreaCenter(trip.area);
  return (
    <section className="map-section" aria-label="旅の地図">
      <div className="map-heading">
        <div>
          <MapIcon size={16} />
          <span>{trip.area}</span>
          <span className="map-count">{locatedCount ? `${locatedCount}地点` : 'エリアマップ'}</span>
        </div>
        <button
          className="text-button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="map-content"
        >
          {expanded ? '地図を閉じる' : '地図を開く'}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {expanded && (
        <div id="map-content">
          <MapCanvas trip={trip} spots={mapSpots} />
          {!locatedCount && (
            <p className="map-caption">
              {hasCenter
                ? '行先エリアの周辺を表示しています。予定に座標を設定すると、ピンが表示されます。'
                : '日本全体を表示しています。「旅行を編集」から行先の中心座標を設定できます。'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
