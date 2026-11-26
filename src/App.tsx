import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Download, X } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.tsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.tsx';
import {
  TanggamusMapViewport,
  type UserLocationState,
} from './components/TanggamusMapViewport.tsx';
import {
  INITIAL_ALERTS,
  INITIAL_FACILITIES,
  INITIAL_KECAMATAN,
} from './data/tanggamusSeed.ts';
import type {
  AppRuntimeConfig,
  FacilityPoint,
  FieldAlert,
  KecamatanRecord,
} from './types/tanggamus.ts';
import { distanceMeters, formatDistance } from './utils/geo.ts';

type AppView = 'map' | 'analytics' | 'notifications' | 'admin';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('map');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [runtimeConfig, setRuntimeConfig] = useState<AppRuntimeConfig>({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    storageEngine: 'local-store',
    kabupatenName: 'Kabupaten Tanggamus',
  });

  const [kecamatanList, setKecamatanList] =
    useState<KecamatanRecord[]>(INITIAL_KECAMATAN);
  const [facilities, setFacilities] = useState<FacilityPoint[]>(INITIAL_FACILITIES);
  const [alerts, setAlerts] = useState<FieldAlert[]>(INITIAL_ALERTS);
  const [selectedKecamatan, setSelectedKecamatan] =
    useState<KecamatanRecord | null>(null);
  const [adminSelectedKecamatanId, setAdminSelectedKecamatanId] = useState<
    string | null
  >(null);

  // Admin bearer token kept strictly in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Real-time GPS / Patrol location & proximity alert banner
  const [userLocation, setUserLocation] = useState<UserLocationState | null>(null);
  const [proximityToast, setProximityToast] = useState<{
    alert: FieldAlert;
    distance: number;
  } | null>(null);
  const notifiedAlertIdsRef = useRef<Record<string, boolean>>({});

  // Listen to global Google Maps quota events
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Load runtime config & initial PostgreSQL/server datasets
  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      try {
        const [cfgRes, kecRes, facRes, alertRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/kecamatan'),
          fetch('/api/facilities'),
          fetch('/api/alerts'),
        ]);

        if (!active) return;

        if (cfgRes.ok) {
          const cfg = (await cfgRes.json()) as AppRuntimeConfig;
          setRuntimeConfig((prev) => ({
            ...cfg,
            googleMapsApiKey:
              cfg.googleMapsApiKey || prev.googleMapsApiKey || '',
          }));
        }
        if (kecRes.ok) {
          const kecData = (await kecRes.json()) as KecamatanRecord[];
          if (Array.isArray(kecData) && kecData.length > 0) {
            setKecamatanList(kecData);
          }
        }
        if (facRes.ok) {
          const facData = (await facRes.json()) as FacilityPoint[];
          if (Array.isArray(facData)) {
            setFacilities(facData);
          }
        }
        if (alertRes.ok) {
          const alertData = (await alertRes.json()) as FieldAlert[];
          if (Array.isArray(alertData)) {
            setAlerts(alertData);
          }
        }
      } catch (err) {
        console.error('Gagal memuat data awal dari server:', err);
      }
    };

    void loadAll();
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to Server-Sent Events (SSE) for real-time updates
  useEffect(() => {
    const source = new EventSource('/api/events');
    source.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as {
          event: string;
          payload: unknown;
        };
        if (parsed.event === 'kecamatan_updated') {
          const updated = parsed.payload as KecamatanRecord;
          setKecamatanList((prev) =>
            prev.map((k) => (k.id === updated.id ? updated : k))
          );
          setSelectedKecamatan((prev) =>
            prev && prev.id === updated.id ? updated : prev
          );
        } else if (parsed.event === 'facility_created') {
          const fac = parsed.payload as FacilityPoint;
          setFacilities((prev) =>
            prev.some((f) => f.id === fac.id) ? prev : [...prev, fac]
          );
        } else if (parsed.event === 'alert_created') {
          const alert = parsed.payload as FieldAlert;
          setAlerts((prev) =>
            prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]
          );
        } else if (parsed.event === 'alert_updated') {
          const alert = parsed.payload as FieldAlert;
          setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
        } else if (parsed.event === 'alert_deleted') {
          const { id } = parsed.payload as { id: string };
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }
      } catch {
        // ignore keep-alive or malformed messages
      }
    };

    return () => {
      source.close();
    };
  }, []);

  // Geofence location-based notification evaluator
  useEffect(() => {
    if (!userLocation) {
      setProximityToast(null);
      return;
    }

    const activeAlerts = alerts.filter((a) => a.aktif);
    for (const alert of activeAlerts) {
      const dist = distanceMeters(
        userLocation.lat,
        userLocation.lng,
        alert.latitude,
        alert.longitude
      );
      if (dist <= alert.radiusMeter && !notifiedAlertIdsRef.current[alert.id]) {
        notifiedAlertIdsRef.current[alert.id] = true;
        setProximityToast({ alert, distance: dist });
        break;
      }
    }
  }, [userLocation, alerts]);

  const handleKecamatanUpdated = useCallback((updated: KecamatanRecord) => {
    setKecamatanList((prev) =>
      prev.map((k) => (k.id === updated.id ? updated : k))
    );
    setSelectedKecamatan((prev) =>
      prev && prev.id === updated.id ? updated : prev
    );
  }, []);

  const handleEditInAdmin = useCallback((kec: KecamatanRecord) => {
    setAdminSelectedKecamatanId(kec.id);
    setActiveView('admin');
  }, []);

  const handleInspectFromAnalytics = useCallback((kec: KecamatanRecord) => {
    setSelectedKecamatan(kec);
    setActiveView('map');
  }, []);

  const handleFocusAlertOnMap = useCallback(
    (alert: FieldAlert) => {
      const target =
        kecamatanList.find((k) => k.id === alert.kecamatanId) || null;
      setSelectedKecamatan(target);
      setActiveView('map');
    },
    [kecamatanList]
  );

  const activeAlertsCount = alerts.filter((a) => a.aktif).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Mandatory Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm no-print">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0 z-30 no-print">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveView('map')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
        >
          WebGIS Tanggamus
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navigasi utama"
          className="flex items-center gap-5 sm:gap-7 text-sm font-medium overflow-x-auto"
        >
          {(
            [
              ['map', 'Peta 3D'],
              ['analytics', 'Statistik'],
              [
                'notifications',
                activeAlertsCount > 0
                  ? `Notifikasi (${activeAlertsCount})`
                  : 'Notifikasi',
              ],
              ['admin', 'Admin'],
            ] as Array<[AppView, string]>
          ).map(([view, label]) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="hidden sm:flex items-center shrink-0">
          <a
            href="/api/export/csv"
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Laporan</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {activeView === 'map' && (
          <div className="h-[calc(100vh-4rem)] w-full">
            <TanggamusMapViewport
              apiKey={runtimeConfig.googleMapsApiKey}
              kecamatanList={kecamatanList}
              facilities={facilities}
              alerts={alerts}
              selectedKecamatan={selectedKecamatan}
              onSelectKecamatan={setSelectedKecamatan}
              onEditInAdmin={handleEditInAdmin}
              userLocation={userLocation}
              onUpdateUserLocation={setUserLocation}
            />
          </div>
        )}

        {activeView === 'analytics' && (
          <AnalyticsPanel
            kecamatanList={kecamatanList}
            storageEngine={runtimeConfig.storageEngine}
            onInspectKecamatan={handleInspectFromAnalytics}
          />
        )}

        {activeView === 'notifications' && (
          <NotificationsDrawer
            alerts={alerts}
            userLocation={userLocation}
            onFocusAlertOnMap={handleFocusAlertOnMap}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            kecamatanList={kecamatanList}
            alerts={alerts}
            storageEngine={runtimeConfig.storageEngine}
            initialSelectedKecamatanId={adminSelectedKecamatanId}
            authToken={adminToken}
            onSetAuthToken={setAdminToken}
            onKecamatanUpdated={handleKecamatanUpdated}
            onAlertCreated={(alert) =>
              setAlerts((prev) =>
                prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]
              )
            }
            onAlertUpdated={(alert) =>
              setAlerts((prev) =>
                prev.map((a) => (a.id === alert.id ? alert : a))
              )
            }
            onAlertDeleted={(id) =>
              setAlerts((prev) => prev.filter((a) => a.id !== id))
            }
            onFacilityCreated={(fac) =>
              setFacilities((prev) =>
                prev.some((f) => f.id === fac.id) ? prev : [...prev, fac]
              )
            }
          />
        )}
      </main>

      {/* Location-based proximity alert toast */}
      {proximityToast && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm bg-slate-950 text-white border border-teal-500/40 rounded-xl p-4 shadow-2xl no-print">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <BellRing className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="text-xs font-semibold text-amber-300">
                  Peringatan Radius Lokasi · {formatDistance(proximityToast.distance)}
                </div>
                <div className="text-sm font-bold leading-snug">
                  {proximityToast.alert.judul}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {proximityToast.alert.deskripsi}
                </p>
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleFocusAlertOnMap(proximityToast.alert);
                      setProximityToast(null);
                    }}
                    className="text-xs font-semibold text-teal-300 hover:text-teal-200 underline"
                  >
                    Fokus Kec. {proximityToast.alert.kecamatanNama}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProximityToast(null)}
              aria-label="Tutup peringatan lokasi"
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
