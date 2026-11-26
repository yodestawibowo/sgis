import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Info, MapPin, Navigation, ShieldAlert } from 'lucide-react';
import type { AlertSeverity, FieldAlert } from '../types/tanggamus.ts';
import { distanceMeters, formatDistance } from '../utils/geo.ts';
import type { UserLocationState } from './TanggamusMapViewport.tsx';

interface NotificationsDrawerProps {
  alerts: FieldAlert[];
  userLocation: UserLocationState | null;
  onFocusAlertOnMap: (alert: FieldAlert) => void;
}

export function NotificationsDrawer({
  alerts,
  userLocation,
  onFocusAlertOnMap,
}: NotificationsDrawerProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'aktif' | 'semua'>('aktif');

  const enrichedAlerts = useMemo(() => {
    return alerts
      .filter((a) => (statusFilter === 'aktif' ? a.aktif : true))
      .filter((a) => (severityFilter === 'all' ? true : a.severity === severityFilter))
      .map((a) => {
        const dist = userLocation
          ? distanceMeters(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
          : null;
        const inGeofence = dist !== null && dist <= a.radiusMeter;
        return { alert: a, dist, inGeofence };
      })
      .sort((a, b) => {
        if (a.inGeofence !== b.inGeofence) return a.inGeofence ? -1 : 1;
        return b.alert.createdAt.localeCompare(a.alert.createdAt);
      });
  }, [alerts, userLocation, severityFilter, statusFilter]);

  const proximityHits = enrichedAlerts.filter((item) => item.inGeofence && item.alert.aktif);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-semibold text-teal-700">
            Pemantauan Kondisi Lapangan Real-Time
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Notifikasi Berbasis Lokasi Kabupaten Tanggamus
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Peringatan otomatis berbasis koordinat geografis dan radius geofence untuk mendukung respons cepat lintas sektor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['aktif', 'Aktif'],
                ['semua', 'Semua Riwayat'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === val
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', 'Semua'],
                ['critical', 'Kritis'],
                ['warning', 'Peringatan'],
                ['info', 'Info'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setSeverityFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  severityFilter === val
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Geofence Proximity Banner */}
      {userLocation ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Navigation className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Pemantauan Geofence Aktif ({userLocation.mode === 'gps' ? 'GPS Perangkat' : 'Simulasi Patroli'})
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Posisi: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} · Akurasi ±{userLocation.accuracy} m
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold tabular-nums">
            {proximityHits.length > 0 ? (
              <span className="text-rose-700">
                {proximityHits.length} peringatan dalam radius Anda
              </span>
            ) : (
              <span className="text-emerald-700">
                Tidak ada insiden dalam radius lokasi Anda
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Aktifkan <strong>Pantau GPS</strong> atau <strong>Simulasi Patroli</strong> di halaman Peta 3D untuk menghitung jarak dan memicu peringatan radius lokasi secara otomatis.
          </span>
        </div>
      )}

      {/* Alerts List */}
      {enrichedAlerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Tidak ada notifikasi lokasi yang sesuai filter saat ini.
        </div>
      ) : (
        <div className="space-y-3">
          {enrichedAlerts.map(({ alert, dist, inGeofence }) => {
            const Icon =
              alert.severity === 'critical'
                ? ShieldAlert
                : alert.severity === 'warning'
                  ? AlertTriangle
                  : Info;
            const iconColor =
              alert.severity === 'critical'
                ? 'text-rose-700'
                : alert.severity === 'warning'
                  ? 'text-amber-700'
                  : 'text-sky-700';

            return (
              <div
                key={alert.id}
                className={`bg-white border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  inGeofence ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className={`font-semibold ${iconColor}`}>
                        {alert.severity === 'critical'
                          ? 'Prioritas Kritis'
                          : alert.severity === 'warning'
                            ? 'Peringatan'
                            : 'Informasi Lapangan'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">
                        Kec. {alert.kecamatanNama}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{alert.kategori}</span>
                      {inGeofence && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-rose-700">
                            Anda berada di dalam radius ({formatDistance(dist!)})
                          </span>
                        </>
                      )}
                      {!alert.aktif && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">Selesai</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{alert.judul}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{alert.deskripsi}</p>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums pt-1 flex flex-wrap gap-3">
                      <span>
                        Koordinat: {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </span>
                      <span>Radius Geofence: {formatDistance(alert.radiusMeter)}</span>
                      {dist !== null && <span>Jarak dari Anda: {formatDistance(dist)}</span>}
                      <span>Pelapor: {alert.createdBy}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onFocusAlertOnMap(alert)}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-center whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Lihat di Peta 3D</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
