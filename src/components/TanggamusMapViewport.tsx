import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  AltitudeMode,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Map3D,
  MapMode,
  Marker3D,
  Polyline3D,
  type Map3DCameraChangedEvent,
  type Map3DRef,
} from '@vis.gl/react-google-maps/3d';
import {
  Compass,
  Crosshair,
  Globe2,
  Layers,
  MapPin,
  Minus,
  Navigation,
  Orbit,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  X,
} from 'lucide-react';
import { TANGGAMUS_CENTER } from '../data/tanggamusSeed.ts';
import type { FacilityPoint, FieldAlert, KecamatanRecord } from '../types/tanggamus.ts';
import {
  detectWebGL2Support,
  distanceMeters,
  findNearestKecamatan,
  formatDistance,
  getPriorityColor,
} from '../utils/geo.ts';
import { KecamatanPopupCard } from './KecamatanPopupCard.tsx';
import { SearchLocationBar } from './SearchLocationBar.tsx';

export interface UserLocationState {
  lat: number;
  lng: number;
  accuracy: number;
  mode: 'gps' | 'simulasi';
  updatedAt: string;
}

interface TanggamusMapViewportProps {
  apiKey: string;
  kecamatanList: KecamatanRecord[];
  facilities: FacilityPoint[];
  alerts: FieldAlert[];
  selectedKecamatan: KecamatanRecord | null;
  onSelectKecamatan: (kec: KecamatanRecord | null) => void;
  onEditInAdmin: (kec: KecamatanRecord) => void;
  userLocation: UserLocationState | null;
  onUpdateUserLocation: (loc: UserLocationState | null) => void;
}

interface RouteSummary {
  originLabel: string;
  destinationLabel: string;
  distanceText: string;
  durationText: string;
  path: google.maps.LatLngAltitudeLiteral[];
}

const PATROL_WAYPOINTS: Array<{ lat: number; lng: number }> = [
  { lat: -5.4904, lng: 104.6218 }, // Kota Agung
  { lat: -5.4986, lng: 104.6682 }, // Kota Agung Timur
  { lat: -5.4162, lng: 104.7345 }, // Gisting
  { lat: -5.3824, lng: 104.8056 }, // Talang Padang
  { lat: -5.3948, lng: 104.8642 }, // Pugung
  { lat: -5.3654, lng: 104.7252 }, // Sumberejo
  { lat: -5.4628, lng: 104.5245 }, // Wonosobo
  { lat: -5.4245, lng: 104.4608 }, // Semaka
  { lat: -5.3752, lng: 104.4204 }, // Bandar Negeri Semuong
];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} menit`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours} jam ${rem} mnt`;
}

function RoutePolyline2D({ path }: { path: google.maps.LatLngAltitudeLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || path.length < 2) return;
    const polyline = new google.maps.Polyline({
      path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: '#0D9488',
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map,
    });
    return () => {
      polyline.setMap(null);
    };
  }, [map, path]);

  return null;
}

function MapViewportInner({
  apiKey,
  kecamatanList,
  facilities,
  alerts,
  selectedKecamatan,
  onSelectKecamatan,
  onEditInAdmin,
  userLocation,
  onUpdateUserLocation,
}: TanggamusMapViewportProps) {
  const webgl2Available = useMemo(() => detectWebGL2Support(), []);
  const [viewMode, setViewMode] = useState<'3d-hybrid' | '3d-satellite' | '2d'>(
    webgl2Available ? '3d-hybrid' : '2d'
  );
  const [map3dError, setMap3dError] = useState(false);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showDistrictStrip, setShowDistrictStrip] = useState(true);

  const [cameraState, setCameraState] = useState({
    center: TANGGAMUS_CENTER,
    range: 46000,
    heading: 10,
    tilt: 56,
    roll: 0,
  });

  const [searchPin, setSearchPin] = useState<{
    label: string;
    subtitle: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [activeRoute, setActiveRoute] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState<'off' | 'gps' | 'simulasi'>('off');

  const map3dRef = useRef<Map3DRef | null>(null);
  const map2d = useMap();
  const routesLib = useMapsLibrary('routes');
  const watchIdRef = useRef<number | null>(null);
  const patrolIndexRef = useRef(0);

  const is3DActive = viewMode !== '2d' && webgl2Available && !map3dError && Boolean(apiKey);

  const flyToLocation = useCallback(
    (lat: number, lng: number, range = 7500, tilt = 62, heading = 18) => {
      if (is3DActive && map3dRef.current) {
        try {
          map3dRef.current.flyCameraTo({
            endCamera: {
              center: { lat, lng, altitude: 120 },
              range,
              tilt,
              heading,
              roll: 0,
            },
            durationMillis: 1400,
          });
        } catch {
          setCameraState((prev) => ({
            ...prev,
            center: { lat, lng, altitude: 120 },
            range,
            tilt,
            heading,
          }));
        }
      } else if (map2d) {
        map2d.panTo({ lat, lng });
        map2d.setZoom(range < 10000 ? 13 : 11);
      }
    },
    [is3DActive, map2d]
  );

  const handleOrbitKecamatan = useCallback(
    (kec: KecamatanRecord) => {
      if (is3DActive && map3dRef.current) {
        try {
          map3dRef.current.flyCameraAround({
            camera: {
              center: { lat: kec.latitude, lng: kec.longitude, altitude: kec.altitude },
              range: 5500,
              tilt: 64,
              heading: cameraState.heading,
              roll: 0,
            },
            durationMillis: 9000,
            repeatCount: 1,
          });
        } catch {
          flyToLocation(kec.latitude, kec.longitude, 5500, 64, 25);
        }
      } else {
        flyToLocation(kec.latitude, kec.longitude, 5500, 64, 25);
      }
    },
    [is3DActive, cameraState.heading, flyToLocation]
  );

  const handleSelectKecamatan = useCallback(
    (kec: KecamatanRecord) => {
      onSelectKecamatan(kec);
      setSearchPin(null);
      flyToLocation(kec.latitude, kec.longitude, 8500, 60, 15);
    },
    [onSelectKecamatan, flyToLocation]
  );

  const handleResetView = useCallback(() => {
    setSearchPin(null);
    if (is3DActive && map3dRef.current) {
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: TANGGAMUS_CENTER,
          range: 46000,
          tilt: 56,
          heading: 10,
          roll: 0,
        },
        durationMillis: 1200,
      });
    } else if (map2d) {
      map2d.panTo({ lat: TANGGAMUS_CENTER.lat, lng: TANGGAMUS_CENTER.lng });
      map2d.setZoom(10);
    }
  }, [is3DActive, map2d]);

  // Real-time GPS & Simulation Patrol Tracking
  useEffect(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (trackingMode === 'off') {
      onUpdateUserLocation(null);
      setGpsError(null);
      return;
    }

    if (trackingMode === 'gps') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsError('Browser tidak mendukung GPS Geolocation.');
        setTrackingMode('off');
        return;
      }
      setGpsError(null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          onUpdateUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            mode: 'gps',
            updatedAt: new Date().toISOString(),
          });
        },
        (err) => {
          setGpsError(
            err.code === 1
              ? 'Izin lokasi ditolak. Aktifkan izin lokasi browser atau gunakan Simulasi Patroli.'
              : 'Sinyal GPS tidak tersedia saat ini.'
          );
          setTrackingMode('off');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }

    // Simulasi patroli lapangan menyusuri kecamatan Tanggamus
    setGpsError(null);
    const initialPt = PATROL_WAYPOINTS[patrolIndexRef.current % PATROL_WAYPOINTS.length];
    onUpdateUserLocation({
      lat: initialPt.lat,
      lng: initialPt.lng,
      accuracy: 12,
      mode: 'simulasi',
      updatedAt: new Date().toISOString(),
    });
    flyToLocation(initialPt.lat, initialPt.lng, 14000, 58, 12);

    const timer = window.setInterval(() => {
      patrolIndexRef.current = (patrolIndexRef.current + 1) % PATROL_WAYPOINTS.length;
      const wp = PATROL_WAYPOINTS[patrolIndexRef.current];
      onUpdateUserLocation({
        lat: wp.lat,
        lng: wp.lng,
        accuracy: 10,
        mode: 'simulasi',
        updatedAt: new Date().toISOString(),
      });
    }, 5500);

    return () => window.clearInterval(timer);
  }, [trackingMode, onUpdateUserLocation, flyToLocation]);

  // Compute route using modern Google Maps Routes SDK (Route.computeRoutes)
  const handleNavigateToKecamatan = useCallback(
    async (target: KecamatanRecord) => {
      setRouteError(null);
      const origin = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : { lat: -5.4904, lng: 104.6218 }; // Kota Agung pusat
      const originLabel = userLocation ? 'Lokasi Anda Saat Ini' : 'Kota Agung (Pusat Kab.)';

      // Fallback straight geodesic path if Maps SDK unavailable
      if (!routesLib || !apiKey) {
        const directDist = distanceMeters(
          origin.lat,
          origin.lng,
          target.latitude,
          target.longitude
        );
        setActiveRoute({
          originLabel,
          destinationLabel: `Kec. ${target.nama}`,
          distanceText: formatDistance(directDist),
          durationText: formatDuration((directDist / 1000 / 42) * 3600),
          path: [
            { lat: origin.lat, lng: origin.lng, altitude: 35 },
            { lat: target.latitude, lng: target.longitude, altitude: target.altitude },
          ],
        });
        flyToLocation(target.latitude, target.longitude, 18000, 52, 10);
        return;
      }

      try {
        setRouteLoading(true);
        const RouteClass = routesLib.Route as unknown as {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              path?: google.maps.LatLng[];
              polyline?: { encodedPolyline?: string };
            }>;
          }>;
        };

        const response = await RouteClass.computeRoutes({
          origin,
          destination: { lat: target.latitude, lng: target.longitude },
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis'],
        });

        const route = response.routes?.[0];
        if (!route) {
          throw new Error('Rute jalan tidak ditemukan untuk koordinat tujuan.');
        }

        const routePath: google.maps.LatLngAltitudeLiteral[] = (route.path || []).map(
          (pt) => ({
            lat: typeof pt.lat === 'function' ? pt.lat() : Number(pt.lat),
            lng: typeof pt.lng === 'function' ? pt.lng() : Number(pt.lng),
            altitude: 25,
          })
        );

        const distMeters =
          route.distanceMeters ??
          distanceMeters(origin.lat, origin.lng, target.latitude, target.longitude);
        const durSec = route.durationMillis
          ? route.durationMillis / 1000
          : (distMeters / 1000 / 40) * 3600;

        setActiveRoute({
          originLabel,
          destinationLabel: `Kec. ${target.nama}`,
          distanceText: formatDistance(distMeters),
          durationText: formatDuration(durSec),
          path:
            routePath.length >= 2
              ? routePath
              : [
                  { lat: origin.lat, lng: origin.lng, altitude: 25 },
                  { lat: target.latitude, lng: target.longitude, altitude: 25 },
                ],
        });

        flyToLocation(
          (origin.lat + target.latitude) / 2,
          (origin.lng + target.longitude) / 2,
          26000,
          50,
          15
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        // Graceful fallback geodesic line with clear message
        const directDist = distanceMeters(
          origin.lat,
          origin.lng,
          target.latitude,
          target.longitude
        );
        setActiveRoute({
          originLabel,
          destinationLabel: `Kec. ${target.nama}`,
          distanceText: `${formatDistance(directDist)} (estimasi garis lurus)`,
          durationText: formatDuration((directDist / 1000 / 40) * 3600),
          path: [
            { lat: origin.lat, lng: origin.lng, altitude: 30 },
            { lat: target.latitude, lng: target.longitude, altitude: target.altitude },
          ],
        });
        setRouteError('Menampilkan rute estimasi jarak langsung.');
      } finally {
        setRouteLoading(false);
      }
    },
    [userLocation, routesLib, apiKey, flyToLocation]
  );

  const nearestInfo = useMemo(() => {
    if (!userLocation) return null;
    return findNearestKecamatan(userLocation.lat, userLocation.lng, kecamatanList);
  }, [userLocation, kecamatanList]);

  const handleCameraChanged = useCallback((ev: Map3DCameraChangedEvent) => {
    setCameraState({
      center: ev.detail.center,
      range: ev.detail.range,
      heading: ev.detail.heading,
      tilt: ev.detail.tilt,
      roll: ev.detail.roll,
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-[600px] bg-slate-950 overflow-hidden">
      {/* Main 3D / 2D Map Canvas */}
      {apiKey ? (
        is3DActive ? (
          <Map3D
            ref={map3dRef}
            id="tanggamus-3d-map"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            mode={viewMode === '3d-satellite' ? MapMode.SATELLITE : MapMode.HYBRID}
            defaultCenter={TANGGAMUS_CENTER}
            defaultRange={46000}
            defaultHeading={10}
            defaultTilt={56}
            defaultRoll={0}
            onCameraChanged={handleCameraChanged}
            onError={() => {
              setMap3dError(true);
              setViewMode('2d');
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {kecamatanList.map((kec) => {
              const isSelected = selectedKecamatan?.id === kec.id;
              const pColor = getPriorityColor(kec.prioritasLayanan);
              return (
                <Marker3D
                  key={kec.id}
                  position={{
                    lat: kec.latitude,
                    lng: kec.longitude,
                    altitude: isSelected ? 180 : 90,
                  }}
                  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                  extruded
                  label={`Kec. ${kec.nama}`}
                  title={`Klik untuk statistik Kecamatan ${kec.nama}`}
                  onClick={() => handleSelectKecamatan(kec)}
                >
                  <Pin
                    background={isSelected ? '#0F172A' : pColor.hex}
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={isSelected ? 1.35 : 1.05}
                  />
                </Marker3D>
              );
            })}

            {showFacilities &&
              facilities.map((fac) => (
                <Marker3D
                  key={fac.id}
                  position={{ lat: fac.latitude, lng: fac.longitude, altitude: 45 }}
                  altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                  label={fac.nama}
                  title={`${fac.nama} (${fac.subJenis})`}
                  onClick={() => {
                    const parent = kecamatanList.find((k) => k.id === fac.kecamatanId);
                    if (parent) handleSelectKecamatan(parent);
                  }}
                >
                  <Pin
                    background={fac.jenis === 'kesehatan' ? '#0284C7' : '#7C3AED'}
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={0.8}
                  />
                </Marker3D>
              ))}

            {showAlerts &&
              alerts
                .filter((a) => a.aktif)
                .map((alert) => (
                  <Marker3D
                    key={alert.id}
                    position={{ lat: alert.latitude, lng: alert.longitude, altitude: 130 }}
                    altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                    extruded
                    label={`Peringatan: ${alert.kecamatanNama}`}
                    title={alert.judul}
                    onClick={() => {
                      const parent = kecamatanList.find((k) => k.id === alert.kecamatanId);
                      if (parent) handleSelectKecamatan(parent);
                    }}
                  >
                    <Pin
                      background={
                        alert.severity === 'critical'
                          ? '#DC2626'
                          : alert.severity === 'warning'
                            ? '#D97706'
                            : '#2563EB'
                      }
                      borderColor="#FEF3C7"
                      glyphColor="#FFFFFF"
                      scale={0.95}
                    />
                  </Marker3D>
                ))}

            {userLocation && (
              <Marker3D
                position={{
                  lat: userLocation.lat,
                  lng: userLocation.lng,
                  altitude: 70,
                }}
                altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                extruded
                label={userLocation.mode === 'gps' ? 'Posisi GPS Anda' : 'Unit Patroli'}
              >
                <Pin
                  background="#16A34A"
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                  scale={1.15}
                />
              </Marker3D>
            )}

            {searchPin && (
              <Marker3D
                position={{ lat: searchPin.lat, lng: searchPin.lng, altitude: 95 }}
                altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                extruded
                label={searchPin.label}
              >
                <Pin
                  background="#0F172A"
                  borderColor="#5EEAD4"
                  glyphColor="#FFFFFF"
                  scale={1.2}
                />
              </Marker3D>
            )}

            {activeRoute && activeRoute.path.length >= 2 && (
              <Polyline3D
                coordinates={activeRoute.path}
                altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                strokeColor="#0D9488"
                outerColor="#FFFFFF"
                outerWidth={2}
                strokeWidth={8}
              />
            )}
          </Map3D>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: TANGGAMUS_CENTER.lat, lng: TANGGAMUS_CENTER.lng }}
            defaultZoom={10}
            mapTypeId="hybrid"
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
          >
            {kecamatanList.map((kec) => {
              const isSelected = selectedKecamatan?.id === kec.id;
              const pColor = getPriorityColor(kec.prioritasLayanan);
              return (
                <AdvancedMarker
                  key={kec.id}
                  position={{ lat: kec.latitude, lng: kec.longitude }}
                  onClick={() => handleSelectKecamatan(kec)}
                  title={`Kecamatan ${kec.nama}`}
                >
                  <div
                    className={`px-2.5 py-1 rounded-lg shadow-md border text-xs font-semibold transition-transform cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-slate-900 text-white border-teal-400 scale-110'
                        : 'bg-white/95 text-slate-900 border-slate-200 hover:scale-105'
                    }`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: pColor.hex }}
                    />
                    {kec.nama}
                  </div>
                </AdvancedMarker>
              );
            })}

            {userLocation && (
              <AdvancedMarker
                position={{ lat: userLocation.lat, lng: userLocation.lng }}
                title="Lokasi Real-Time"
              >
                <Pin background="#16A34A" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
              </AdvancedMarker>
            )}

            {searchPin && (
              <AdvancedMarker
                position={{ lat: searchPin.lat, lng: searchPin.lng }}
                title={searchPin.label}
              >
                <Pin background="#0F172A" borderColor="#5EEAD4" glyphColor="#FFFFFF" />
              </AdvancedMarker>
            )}

            {activeRoute && activeRoute.path.length >= 2 && (
              <RoutePolyline2D path={activeRoute.path} />
            )}
          </GoogleMap>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-200 p-6 text-center">
          <div className="max-w-md space-y-2">
            <Globe2 className="w-10 h-10 text-teal-400 mx-auto" />
            <h3 className="text-lg font-semibold">Kunci API Google Maps Belum Tersedia</h3>
            <p className="text-sm text-slate-400">
              Tambahkan <code className="font-mono text-teal-300">VITE_GOOGLE_MAPS_API_KEY</code> pada environment untuk memuat ubin peta 3D Kabupaten Tanggamus.
            </p>
          </div>
        </div>
      )}

      {/* Top Left Overlay: Search + Quick District Directory */}
      <div className="absolute top-4 left-4 right-4 md:right-auto z-20 flex flex-col gap-2.5 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <SearchLocationBar
            kecamatanList={kecamatanList}
            facilities={facilities}
            mapsEnabled={Boolean(apiKey)}
            onSelectKecamatan={handleSelectKecamatan}
            onSelectCoordinates={(target) => {
              setSearchPin(target);
              onSelectKecamatan(null);
              flyToLocation(target.lat, target.lng, 4500, 62, 15);
            }}
          />

          <button
            type="button"
            onClick={() => setShowDistrictStrip((v) => !v)}
            className="px-3.5 py-2.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>20 Kecamatan</span>
          </button>
        </div>

        {/* Clickable Kecamatan names bar */}
        {showDistrictStrip && (
          <div className="pointer-events-auto max-w-2xl bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-xl p-2 shadow-xl">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {kecamatanList.map((kec) => {
                const active = selectedKecamatan?.id === kec.id;
                return (
                  <button
                    key={kec.id}
                    type="button"
                    onClick={() => handleSelectKecamatan(kec)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-white/10 text-slate-100 hover:bg-white/20'
                    }`}
                  >
                    {kec.nama}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active search pin banner */}
        {searchPin && !selectedKecamatan && (
          <div className="pointer-events-auto max-w-md bg-white border border-slate-200 rounded-xl p-3.5 shadow-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {searchPin.label}
                </div>
                <div className="text-xs text-slate-500 truncate">{searchPin.subtitle}</div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                  {searchPin.lat.toFixed(5)}, {searchPin.lng.toFixed(5)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSearchPin(null)}
              aria-label="Tutup penanda pencarian"
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Left HUD: Real-time Navigation, GPS & 3D Camera Controls */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2.5 max-w-sm pointer-events-auto">
        {/* Active Route Banner */}
        {activeRoute && (
          <div className="bg-slate-950/90 backdrop-blur-md text-white border border-white/15 rounded-xl p-3.5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
                <RouteIcon className="w-3.5 h-3.5" />
                <span>Navigasi Rute Aktif</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoute(null)}
                aria-label="Hentikan rute"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-1.5 text-sm font-semibold">
              {activeRoute.originLabel} → {activeRoute.destinationLabel}
            </div>
            <div className="mt-1 text-xs text-slate-300 font-mono tabular-nums flex items-center gap-3">
              <span>Jarak: {activeRoute.distanceText}</span>
              <span>·</span>
              <span>Estimasi: {activeRoute.durationText}</span>
            </div>
            {routeError && (
              <div className="mt-1 text-[11px] text-amber-300">{routeError}</div>
            )}
          </div>
        )}

        {/* Real-time GPS & Camera Control Card */}
        <div className="bg-slate-950/85 backdrop-blur-md text-white border border-white/15 rounded-xl p-3 shadow-xl space-y-2.5">
          {/* Map mode switcher */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg">
              {webgl2Available && !map3dError && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewMode('3d-hybrid')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      viewMode === '3d-hybrid'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3D Hybrid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('3d-satellite')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      viewMode === '3d-satellite'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3D Satelit
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setViewMode('2d')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === '2d'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Peta 2D
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetView}
              title="Reset tampilan seluruh Kabupaten Tanggamus"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {!webgl2Available && (
            <div className="text-[11px] text-amber-300">
              Mode 2D aktif otomatis karena WebGL2 tidak tersedia pada perangkat ini.
            </div>
          )}

          {/* 3D camera zoom/tilt controls when in 3D */}
          {is3DActive && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-mono tabular-nums">
                <Compass className="w-3.5 h-3.5 text-teal-400" />
                <span>Tilt {Math.round(cameraState.tilt)}°</span>
                <span>·</span>
                <span>{Math.round(cameraState.range / 1000)} km</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    flyToLocation(
                      cameraState.center.lat,
                      cameraState.center.lng,
                      Math.max(1200, cameraState.range * 0.65),
                      cameraState.tilt,
                      cameraState.heading
                    )
                  }
                  aria-label="Perbesar kamera 3D"
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    flyToLocation(
                      cameraState.center.lat,
                      cameraState.center.lng,
                      Math.min(80000, cameraState.range * 1.4),
                      cameraState.tilt,
                      cameraState.heading
                    )
                  }
                  aria-label="Perkecil kamera 3D"
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    flyToLocation(
                      cameraState.center.lat,
                      cameraState.center.lng,
                      cameraState.range,
                      cameraState.tilt > 40 ? 15 : 64,
                      (cameraState.heading + 45) % 360
                    )
                  }
                  aria-label="Ubah sudut kemiringan 3D"
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md"
                  title="Putar & Ubah Kemiringan 3D"
                >
                  <Orbit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Layer toggles & Real-time GPS buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
            <button
              type="button"
              onClick={() =>
                setTrackingMode((m) => (m === 'gps' ? 'off' : 'gps'))
              }
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                trackingMode === 'gps'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{trackingMode === 'gps' ? 'GPS Aktif' : 'Pantau GPS'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setTrackingMode((m) => (m === 'simulasi' ? 'off' : 'simulasi'))
              }
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                trackingMode === 'simulasi'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>
                {trackingMode === 'simulasi' ? 'Hentikan Patroli' : 'Simulasi Patroli'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowFacilities((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                showFacilities
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-slate-400'
              }`}
            >
              Fasilitas
            </button>

            <button
              type="button"
              onClick={() => setShowAlerts((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                showAlerts
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-slate-400'
              }`}
            >
              Notifikasi
            </button>
          </div>

          {userLocation && nearestInfo && (
            <div className="pt-1.5 border-t border-white/10 text-xs text-slate-200 flex items-center justify-between gap-2 tabular-nums">
              <span className="truncate">
                Terdekat: <strong>Kec. {nearestInfo.kecamatan.nama}</strong>
              </span>
              <span className="font-mono text-teal-300 shrink-0">
                {formatDistance(nearestInfo.distance)}
              </span>
            </div>
          )}

          {gpsError && (
            <div className="text-[11px] text-amber-300">{gpsError}</div>
          )}
          {routeLoading && (
            <div className="text-[11px] text-teal-300">Menghitung rute navigasi...</div>
          )}
        </div>
      </div>

      {/* Right Floating Kecamatan Popup Card */}
      {selectedKecamatan && (
        <div className="absolute top-20 right-4 left-4 md:left-auto z-30 flex justify-end pointer-events-none">
          <div className="pointer-events-auto w-full md:w-auto">
            <KecamatanPopupCard
              kecamatan={selectedKecamatan}
              facilities={facilities}
              onClose={() => onSelectKecamatan(null)}
              onFlyOrbit={handleOrbitKecamatan}
              onNavigateTo={(kec) => void handleNavigateToKecamatan(kec)}
              onEditInAdmin={onEditInAdmin}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function TanggamusMapViewport(props: TanggamusMapViewportProps) {
  if (!props.apiKey) {
    return <MapViewportInner {...props} />;
  }

  return (
    <APIProvider
      apiKey={props.apiKey}
      version="alpha"
      language="id"
      region="ID"
      libraries={['maps3d', 'marker', 'places', 'routes']}
    >
      <MapViewportInner {...props} />
    </APIProvider>
  );
}
