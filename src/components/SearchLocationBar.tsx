import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Building2, Compass, MapPin, Search, X } from 'lucide-react';
import type { FacilityPoint, KecamatanRecord } from '../types/tanggamus.ts';
import { formatNumber } from '../utils/geo.ts';

interface SearchLocationBarProps {
  kecamatanList: KecamatanRecord[];
  facilities: FacilityPoint[];
  mapsEnabled: boolean;
  onSelectKecamatan: (kec: KecamatanRecord) => void;
  onSelectCoordinates: (target: {
    label: string;
    subtitle: string;
    lat: number;
    lng: number;
  }) => void;
}

export function SearchLocationBar({
  kecamatanList,
  facilities,
  mapsEnabled,
  onSelectKecamatan,
  onSelectCoordinates,
}: SearchLocationBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const placesLib = useMapsLibrary('places');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Local instant matches for 20 Kecamatan & key facilities
  const localKecamatanMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return kecamatanList.slice(0, 6);
    return kecamatanList
      .filter(
        (k) =>
          k.nama.toLowerCase().includes(q) ||
          k.ibuKota.toLowerCase().includes(q) ||
          k.kodeKemendagri.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [kecamatanList, query]);

  const localFacilityMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return facilities
      .filter(
        (f) =>
          f.nama.toLowerCase().includes(q) ||
          f.subJenis.toLowerCase().includes(q) ||
          f.alamat.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [facilities, query]);

  // Modern Places API (New) AutocompleteSuggestion with session token
  useEffect(() => {
    const trimmed = query.trim();
    if (!mapsEnabled || !placesLib || trimmed.length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoadingPlaces(true);
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['id'],
          language: 'id',
          locationBias: {
            center: { lat: -5.4585, lng: 104.658 },
            radius: 50000,
          },
        });
        if (!cancelled) {
          setPlaceSuggestions(response.suggestions.slice(0, 5));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setPlaceSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPlaces(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mapsEnabled, placesLib, query]);

  const handleSelectPlaceSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const loc = place.location;
      if (loc) {
        onSelectCoordinates({
          label: place.displayName || suggestion.placePrediction.text.text,
          subtitle: place.formattedAddress || 'Kabupaten Tanggamus, Lampung',
          lat: loc.lat(),
          lng: loc.lng(),
        });
      }
      setQuery(place.displayName || suggestion.placePrediction.text.text);
      setOpen(false);
      sessionTokenRef.current = null;
      setPlaceSuggestions([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-3.5 py-2 gap-2.5 focus-within:ring-2 focus-within:ring-teal-600 focus-within:border-teal-600 transition-all">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Cari kecamatan, pekon, sekolah, atau puskesmas..."
          aria-label="Pencarian lokasi Kabupaten Tanggamus"
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setPlaceSuggestions([]);
            }}
            aria-label="Hapus pencarian"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40 max-h-[65vh] overflow-y-auto">
          {localKecamatanMatches.length > 0 && (
            <div className="py-1.5">
              <div className="px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500 border-b border-slate-100">
                {query.trim() ? 'Kecamatan di Tanggamus' : 'Akses Cepat Kecamatan'}
              </div>
              {localKecamatanMatches.map((kec) => (
                <button
                  key={kec.id}
                  type="button"
                  onClick={() => {
                    onSelectKecamatan(kec);
                    setQuery(kec.nama);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors border-b border-slate-50 last:border-b-0"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Compass className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        Kec. {kec.nama}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        Ibu Kota {kec.ibuKota} · {kec.jumlahPekon + kec.jumlahKelurahan} Pekon/Kel
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                    {formatNumber(kec.pendudukTotal)} jiwa
                  </div>
                </button>
              ))}
            </div>
          )}

          {localFacilityMatches.length > 0 && (
            <div className="py-1.5 border-t border-slate-100">
              <div className="px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500 border-b border-slate-100">
                Fasilitas Kesehatan & Pendidikan
              </div>
              {localFacilityMatches.map((fac) => (
                <button
                  key={fac.id}
                  type="button"
                  onClick={() => {
                    onSelectCoordinates({
                      label: fac.nama,
                      subtitle: `${fac.subJenis} · ${fac.alamat}`,
                      lat: fac.latitude,
                      lng: fac.longitude,
                    });
                    setQuery(fac.nama);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {fac.nama}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {fac.subJenis} · {fac.alamat}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mapsEnabled && query.trim().length >= 3 && (
            <div className="py-1.5 border-t border-slate-100">
              <div className="px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500 border-b border-slate-100 flex items-center justify-between">
                <span>Pencarian Lokasi Google Places</span>
                {loadingPlaces && <span className="text-teal-600">Mencari...</span>}
              </div>
              {placeSuggestions.length === 0 && !loadingPlaces ? (
                <div className="px-3.5 py-2.5 text-xs text-slate-500">
                  Tidak ada saran alamat tambahan untuk kata kunci ini.
                </div>
              ) : (
                placeSuggestions.map((s, idx) => (
                  <button
                    key={s.placePrediction?.placeId || idx}
                    type="button"
                    onClick={() => void handleSelectPlaceSuggestion(s)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-start gap-2.5 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {s.placePrediction?.mainText?.text || s.placePrediction?.text.text}
                      </div>
                      {s.placePrediction?.secondaryText?.text && (
                        <div className="text-xs text-slate-500 truncate">
                          {s.placePrediction.secondaryText.text}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {localKecamatanMatches.length === 0 &&
            localFacilityMatches.length === 0 &&
            placeSuggestions.length === 0 &&
            !loadingPlaces && (
              <div className="px-4 py-5 text-center text-xs text-slate-500">
                Lokasi tidak ditemukan di Kabupaten Tanggamus. Coba nama kecamatan seperti Kota Agung, Gisting, atau Talang Padang.
              </div>
            )}
        </div>
      )}
    </div>
  );
}
