import { Navigation, Orbit, Pencil, X } from 'lucide-react';
import type { FacilityPoint, KecamatanRecord } from '../types/tanggamus.ts';
import {
  formatNumber,
  getDensity,
  getEducationTotal,
  getHealthTotal,
  getPriorityColor,
  getPriorityLabel,
} from '../utils/geo.ts';

interface KecamatanPopupCardProps {
  kecamatan: KecamatanRecord;
  facilities: FacilityPoint[];
  onClose: () => void;
  onFlyOrbit: (kec: KecamatanRecord) => void;
  onNavigateTo: (kec: KecamatanRecord) => void;
  onEditInAdmin: (kec: KecamatanRecord) => void;
}

export function KecamatanPopupCard({
  kecamatan,
  facilities,
  onClose,
  onFlyOrbit,
  onNavigateTo,
  onEditInAdmin,
}: KecamatanPopupCardProps) {
  const priorityStyle = getPriorityColor(kecamatan.prioritasLayanan);
  const density = getDensity(kecamatan);
  const totalHealth = getHealthTotal(kecamatan);
  const totalEdu = getEducationTotal(kecamatan);

  const maleRatio =
    kecamatan.pendudukTotal > 0
      ? Math.round((kecamatan.pendudukLaki / kecamatan.pendudukTotal) * 1000) / 10
      : 50;
  const femaleRatio = Math.round((100 - maleRatio) * 10) / 10;

  const localFacilities = facilities.filter((f) => f.kecamatanId === kecamatan.id);

  return (
    <aside
      aria-label={`Detail Kecamatan ${kecamatan.nama}`}
      className="w-full md:w-[410px] max-h-[82vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{kecamatan.kodeKemendagri}</span>
            <span aria-hidden="true">·</span>
            <span>Ibu Kota {kecamatan.ibuKota}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5 truncate">
            Kecamatan {kecamatan.nama}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={`font-semibold ${priorityStyle.text}`}>
              {getPriorityLabel(kecamatan.prioritasLayanan)}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-500 tabular-nums">
              {kecamatan.jumlahPekon} Pekon
              {kecamatan.jumlahKelurahan > 0
                ? ` / ${kecamatan.jumlahKelurahan} Kel`
                : ''}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-500 tabular-nums">{kecamatan.luasKm2} km²</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup popup kecamatan"
          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="p-5 overflow-y-auto space-y-5 text-sm">
        {/* Quick action bar */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onFlyOrbit(kecamatan)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Orbit className="w-3.5 h-3.5 text-teal-700" />
            <span>Orbit 3D</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTo(kecamatan)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Rute Kesini</span>
          </button>
          <button
            type="button"
            onClick={() => onEditInAdmin(kecamatan)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Data</span>
          </button>
        </div>

        {/* Statistik Demografi */}
        <section className="pt-1 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-xs font-bold tracking-wide text-slate-500">
              Statistik Demografi
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Pertumbuhan +{kecamatan.pertumbuhanPersen}%/th
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-xs text-slate-500">Penduduk</div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.pendudukTotal)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Kepadatan</div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(density)}
                <span className="text-[11px] font-normal text-slate-500 ml-0.5">/km²</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Kepala Keluarga</div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.jumlahKk)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 tabular-nums">
              <span>Laki-laki {formatNumber(kecamatan.pendudukLaki)} ({maleRatio}%)</span>
              <span>Perempuan {formatNumber(kecamatan.pendudukPerempuan)} ({femaleRatio}%)</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-teal-600 h-full"
                style={{ width: `${maleRatio}%` }}
              />
              <div
                className="bg-sky-500 h-full"
                style={{ width: `${femaleRatio}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              Rasio usia produktif (15–64 th): <strong className="text-slate-800">{kecamatan.usiaProduktifPersen}%</strong>
            </div>
          </div>
        </section>

        {/* Fasilitas Kesehatan */}
        <section className="pt-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-xs font-bold tracking-wide text-slate-500">
              Fasilitas Kesehatan
            </h3>
            <span className="text-xs font-semibold text-teal-700 font-mono tabular-nums">
              {totalHealth} Unit · {formatNumber(kecamatan.tenagaMedis)} Nakes
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.rumahSakit}
              </div>
              <div className="text-[11px] text-slate-500">RS</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.puskesmas}
              </div>
              <div className="text-[11px] text-slate-500">Puskesmas</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.pustu}
              </div>
              <div className="text-[11px] text-slate-500">Pustu</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.klinikPoskesdes}
              </div>
              <div className="text-[11px] text-slate-500">Poskesdes</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.apotek}
              </div>
              <div className="text-[11px] text-slate-500">Apotek</div>
            </div>
          </div>
        </section>

        {/* Fasilitas Pendidikan */}
        <section className="pt-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-xs font-bold tracking-wide text-slate-500">
              Fasilitas Pendidikan
            </h3>
            <span className="text-xs font-semibold text-sky-700 font-mono tabular-nums">
              {totalEdu} Satuan Pendidikan
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.paudTk}
              </div>
              <div className="text-[11px] text-slate-500">PAUD/TK</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.sdMi}
              </div>
              <div className="text-[11px] text-slate-500">SD/MI</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.smpMts}
              </div>
              <div className="text-[11px] text-slate-500">SMP/MTs</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.smaSmkMa}
              </div>
              <div className="text-[11px] text-slate-500">SMA/SMK</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.perguruanTinggi}
              </div>
              <div className="text-[11px] text-slate-500">PT/Akad</div>
            </div>
          </div>
        </section>

        {/* Data Infrastruktur */}
        <section className="pt-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-2.5">
            <h3 className="text-xs font-bold tracking-wide text-slate-500">
              Data Infrastruktur
            </h3>
            <span className="text-xs font-semibold text-amber-700 font-mono tabular-nums">
              {kecamatan.jalanMantapPersen}% Jalan Mantap · {kecamatan.menaraBts} BTS
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.jalanMantapPersen}%
              </div>
              <div className="text-[11px] text-slate-500">Jln Mantap</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.jembatanLayak}
              </div>
              <div className="text-[11px] text-slate-500">Jembatan</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.menaraBts}
              </div>
              <div className="text-[11px] text-slate-500">BTS</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.cakupanListrikPersen}%
              </div>
              <div className="text-[11px] text-slate-500">Listrik</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.jaringanAirBersih}
              </div>
              <div className="text-[11px] text-slate-500">Air Bersih</div>
            </div>
          </div>
        </section>

        {/* Pertanian & Komoditas */}
        <section className="pt-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs font-bold tracking-wide text-slate-500">
              Pertanian & Komoditas
            </h3>
            <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
              {formatNumber(kecamatan.luasLahanPertanianHa)} Ha · {kecamatan.kelompokTani} Poktan
            </span>
          </div>
          {kecamatan.komoditasUnggulan && (
            <div className="mb-2.5 text-xs text-slate-600">
              Komoditas Utama:{' '}
              <strong className="text-slate-900">{kecamatan.komoditasUnggulan}</strong>
            </div>
          )}
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.luasLahanPertanianHa)}
              </div>
              <div className="text-[11px] text-slate-500">Lahan Ha</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.produksiPadiTon)}
              </div>
              <div className="text-[11px] text-slate-500">Padi (Ton)</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.produksiKopiTon)}
              </div>
              <div className="text-[11px] text-slate-500">Kopi (Ton)</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatNumber(kecamatan.produksiKakaoLadaTon)}
              </div>
              <div className="text-[11px] text-slate-500">Kakao/Lada</div>
            </div>
            <div className="py-2 px-1 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {kecamatan.kelompokTani}
              </div>
              <div className="text-[11px] text-slate-500">Poktan</div>
            </div>
          </div>
        </section>

        {/* Fasilitas Terdaftar */}
        {localFacilities.length > 0 && (
          <section className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold tracking-wide text-slate-500 mb-2">
              Titik Fasilitas Terdaftar ({localFacilities.length})
            </h3>
            <div className="space-y-2">
              {localFacilities.map((fac) => (
                <div
                  key={fac.id}
                  className="py-2 border-b border-slate-100 last:border-b-0 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {fac.nama}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {fac.subJenis} · {fac.kapasitas}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-medium shrink-0 ${
                      fac.statusOperasional === 'aktif'
                        ? 'text-emerald-700'
                        : fac.statusOperasional === 'terbatas'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {fac.statusOperasional === 'aktif'
                      ? 'Aktif'
                      : fac.statusOperasional === 'terbatas'
                        ? 'Terbatas'
                        : 'Perbaikan'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Catatan lapangan & metadata */}
        <section className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold tracking-wide text-slate-500 mb-1.5">
            Catatan Kondisi Lapangan
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {kecamatan.catatanLapangan || 'Belum ada catatan lapangan tambahan.'}
          </p>
          <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between tabular-nums">
            <span>
              Koordinat {kecamatan.latitude.toFixed(4)}, {kecamatan.longitude.toFixed(4)}
            </span>
            <span>
              Pembaruan: {new Date(kecamatan.updatedAt).toLocaleDateString('id-ID')}
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
