import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  Printer,
} from 'lucide-react';
import type { KecamatanRecord } from '../types/tanggamus.ts';
import {
  formatNumber,
  getDensity,
  getEducationTotal,
  getHealthTotal,
  getPriorityColor,
  getPriorityLabel,
} from '../utils/geo.ts';

interface AnalyticsPanelProps {
  kecamatanList: KecamatanRecord[];
  storageEngine: 'postgresql' | 'local-store';
  onInspectKecamatan: (kec: KecamatanRecord) => void;
}

type ChartMetric = 'penduduk' | 'kepadatan' | 'kesehatan' | 'pendidikan' | 'infrastruktur' | 'pertanian';
type SortKey = 'nama' | 'pendudukTotal' | 'kepadatan' | 'kesehatan' | 'pendidikan' | 'jalanMantap' | 'pertanian';

export function AnalyticsPanel({
  kecamatanList,
  storageEngine,
  onInspectKecamatan,
}: AnalyticsPanelProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('penduduk');
  const [sortKey, setSortKey] = useState<SortKey>('pendudukTotal');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const totals = useMemo(() => {
    return kecamatanList.reduce(
      (acc, k) => {
        acc.penduduk += k.pendudukTotal;
        acc.kk += k.jumlahKk;
        acc.pekon += k.jumlahPekon + k.jumlahKelurahan;
        acc.luas += k.luasKm2;
        acc.rs += k.rumahSakit;
        acc.puskesmas += k.puskesmas;
        acc.pustu += k.pustu;
        acc.poskesdes += k.klinikPoskesdes;
        acc.apotek += k.apotek;
        acc.nakes += k.tenagaMedis;
        acc.paud += k.paudTk;
        acc.sd += k.sdMi;
        acc.smp += k.smpMts;
        acc.sma += k.smaSmkMa;
        acc.pt += k.perguruanTinggi;
        acc.jalanMantapSum += k.jalanMantapPersen;
        acc.jembatan += k.jembatanLayak;
        acc.bts += k.menaraBts;
        acc.listrikSum += k.cakupanListrikPersen;
        acc.airBersih += k.jaringanAirBersih;
        acc.lahanHa += k.luasLahanPertanianHa;
        acc.padiTon += k.produksiPadiTon;
        acc.kopiTon += k.produksiKopiTon;
        acc.kakaoLadaTon += k.produksiKakaoLadaTon;
        acc.poktan += k.kelompokTani;
        if (k.prioritasLayanan === 'prioritas') acc.prioritasCount += 1;
        return acc;
      },
      {
        penduduk: 0,
        kk: 0,
        pekon: 0,
        luas: 0,
        rs: 0,
        puskesmas: 0,
        pustu: 0,
        poskesdes: 0,
        apotek: 0,
        nakes: 0,
        paud: 0,
        sd: 0,
        smp: 0,
        sma: 0,
        pt: 0,
        jalanMantapSum: 0,
        jembatan: 0,
        bts: 0,
        listrikSum: 0,
        airBersih: 0,
        lahanHa: 0,
        padiTon: 0,
        kopiTon: 0,
        kakaoLadaTon: 0,
        poktan: 0,
        prioritasCount: 0,
      }
    );
  }, [kecamatanList]);

  const totalHealthAll =
    totals.rs + totals.puskesmas + totals.pustu + totals.poskesdes + totals.apotek;
  const totalEduAll = totals.paud + totals.sd + totals.smp + totals.sma + totals.pt;
  const avgJalanMantap =
    kecamatanList.length > 0 ? (totals.jalanMantapSum / kecamatanList.length).toFixed(1) : '0.0';
  const avgListrik =
    kecamatanList.length > 0 ? (totals.listrikSum / kecamatanList.length).toFixed(1) : '0.0';

  const chartData = useMemo(() => {
    const mapped = kecamatanList.map((k) => {
      let value = k.pendudukTotal;
      if (chartMetric === 'kepadatan') value = getDensity(k);
      if (chartMetric === 'kesehatan') value = getHealthTotal(k);
      if (chartMetric === 'pendidikan') value = getEducationTotal(k);
      if (chartMetric === 'infrastruktur') value = k.jalanMantapPersen;
      if (chartMetric === 'pertanian')
        value = k.produksiPadiTon + k.produksiKopiTon + k.produksiKakaoLadaTon;
      return { kec: k, value };
    });
    mapped.sort((a, b) => b.value - a.value);
    const maxVal =
      chartMetric === 'infrastruktur'
        ? 100
        : mapped.reduce((m, item) => Math.max(m, item.value), 1);
    return { items: mapped, maxVal };
  }, [kecamatanList, chartMetric]);

  const filteredAndSorted = useMemo(() => {
    const filtered =
      filterPriority === 'all'
        ? kecamatanList
        : kecamatanList.filter((k) => k.prioritasLayanan === filterPriority);

    return [...filtered].sort((a, b) => {
      let valA: number | string = a.nama;
      let valB: number | string = b.nama;
      if (sortKey === 'pendudukTotal') {
        valA = a.pendudukTotal;
        valB = b.pendudukTotal;
      } else if (sortKey === 'kepadatan') {
        valA = getDensity(a);
        valB = getDensity(b);
      } else if (sortKey === 'kesehatan') {
        valA = getHealthTotal(a);
        valB = getHealthTotal(b);
      } else if (sortKey === 'pendidikan') {
        valA = getEducationTotal(a);
        valB = getEducationTotal(b);
      } else if (sortKey === 'jalanMantap') {
        valA = a.jalanMantapPersen;
        valB = b.jalanMantapPersen;
      } else if (sortKey === 'pertanian') {
        valA = a.produksiPadiTon + a.produksiKopiTon + a.produksiKakaoLadaTon;
        valB = b.produksiPadiTon + b.produksiKopiTon + b.produksiKakaoLadaTon;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return sortDesc
        ? Number(valB) - Number(valA)
        : Number(valA) - Number(valB);
    });
  }, [kecamatanList, filterPriority, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((v) => !v);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const handleExportJson = () => {
    const payload = {
      kabupaten: 'Kabupaten Tanggamus',
      provinsi: 'Lampung',
      exportedAt: new Date().toISOString(),
      ringkasan: {
        totalKecamatan: kecamatanList.length,
        totalPenduduk: totals.penduduk,
        totalFasilitasKesehatan: totalHealthAll,
        totalFasilitasPendidikan: totalEduAll,
        rataJalanMantapPersen: Number(avgJalanMantap),
        totalMenaraBts: totals.bts,
        totalJembatanLayak: totals.jembatan,
        rataElektrifikasiPersen: Number(avgListrik),
        totalAirBersih: totals.airBersih,
        totalLahanPertanianHa: totals.lahanHa,
        totalProduksiPadiTon: totals.padiTon,
        totalProduksiKopiTon: totals.kopiTon,
        totalProduksiKakaoLadaTon: totals.kakaoLadaTon,
        totalKelompokTani: totals.poktan,
      },
      kecamatan: kecamatanList,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geodataset-tanggamus-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header & Report Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="text-xs font-semibold text-teal-700">
            Analisis Geospasial & Pendukung Keputusan Pemkab Tanggamus
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Statistik Demografi, Kesehatan & Pendidikan Wilayah
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Agregasi real-time 20 kecamatan untuk memantau pemerataan layanan dasar, rasio fasilitas terhadap populasi, dan ekspor laporan otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <a
            href="/api/export/csv"
            className="px-3.5 py-2 text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </a>
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>
          <a
            href="/api/export/sql"
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Dump SQL CasaOS</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* 5-column KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Penduduk</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatNumber(totals.penduduk)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {formatNumber(totals.kk)} Kepala Keluarga
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Cakupan Wilayah</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {kecamatanList.length} Kec.
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {totals.pekon} Pekon/Kel · {Math.round(totals.luas)} km²
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Fasilitas Kesehatan</div>
          <div className="text-2xl font-bold text-teal-700 font-mono tabular-nums mt-1">
            {formatNumber(totalHealthAll)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {totals.rs} RS · {totals.puskesmas} Puskesmas · {formatNumber(totals.nakes)} Nakes
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Satuan Pendidikan</div>
          <div className="text-2xl font-bold text-sky-700 font-mono tabular-nums mt-1">
            {formatNumber(totalEduAll)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {totals.sd} SD/MI · {totals.smp} SMP · {totals.sma} SMA/SMK
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-500">Kecamatan Prioritas</div>
          <div className="text-2xl font-bold text-rose-700 font-mono tabular-nums mt-1">
            {totals.prioritasCount} Wilayah
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sumber: {storageEngine === 'postgresql' ? 'PostgreSQL Live' : 'Local Store'}
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive 20-Kecamatan Ranking Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Komparasi 20 Kecamatan Kabupaten Tanggamus
              </h2>
              <p className="text-xs text-slate-500">
                Klik nama kecamatan pada grafik untuk langsung terbang ke lokasi pada peta 3D.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start overflow-x-auto max-w-full">
              {(
                [
                  ['penduduk', 'Penduduk'],
                  ['kepadatan', 'Kepadatan'],
                  ['kesehatan', 'Kesehatan'],
                  ['pendidikan', 'Pendidikan'],
                  ['infrastruktur', 'Infrastruktur'],
                  ['pertanian', 'Pertanian'],
                ] as Array<[ChartMetric, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChartMetric(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartMetric === key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {chartData.items.map(({ kec, value }) => {
              const pct = Math.max(4, Math.round((value / chartData.maxVal) * 100));
              const barColor =
                chartMetric === 'kesehatan'
                  ? 'bg-teal-600'
                  : chartMetric === 'pendidikan'
                    ? 'bg-sky-600'
                    : chartMetric === 'kepadatan'
                      ? 'bg-amber-600'
                      : chartMetric === 'infrastruktur'
                        ? 'bg-emerald-600'
                        : chartMetric === 'pertanian'
                          ? 'bg-lime-600'
                          : 'bg-slate-800';
              return (
                <button
                  key={kec.id}
                  type="button"
                  onClick={() => onInspectKecamatan(kec)}
                  className="w-full group flex items-center gap-3 text-left hover:bg-slate-50 px-2 py-1 -mx-2 rounded-lg transition-colors"
                >
                  <div className="w-36 sm:w-44 text-xs font-medium text-slate-700 group-hover:text-teal-700 truncate shrink-0">
                    {kec.nama}
                  </div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs font-mono tabular-nums text-slate-700 shrink-0">
                    {chartMetric === 'infrastruktur'
                      ? `${value}%`
                      : chartMetric === 'pertanian'
                        ? `${formatNumber(value)} T`
                        : `${formatNumber(value)}${chartMetric === 'kepadatan' ? '/km²' : ''}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Composition Breakdown Cards */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Komposisi Infrastruktur Layanan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian fasilitas kesehatan dan satuan pendidikan se-Kabupaten Tanggamus.
            </p>

            {/* Health Breakdown */}
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Sektor Kesehatan</span>
                <span className="font-mono tabular-nums text-teal-700">
                  {formatNumber(totalHealthAll)} Unit
                </span>
              </div>
              {[
                { label: 'Rumah Sakit (RSUD/Swasta)', val: totals.rs, color: 'bg-teal-700' },
                { label: 'Puskesmas', val: totals.puskesmas, color: 'bg-teal-500' },
                { label: 'Puskesmas Pembantu (Pustu)', val: totals.pustu, color: 'bg-emerald-500' },
                { label: 'Klinik & Poskesdes', val: totals.poskesdes, color: 'bg-emerald-300' },
                { label: 'Apotek Berizin', val: totals.apotek, color: 'bg-slate-400' },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.label}</span>
                    <span className="font-mono tabular-nums font-medium">{row.val}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color}`}
                      style={{ width: `${Math.round((row.val / Math.max(1, totalHealthAll)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Education Breakdown */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Sektor Pendidikan</span>
                <span className="font-mono tabular-nums text-sky-700">
                  {formatNumber(totalEduAll)} Unit
                </span>
              </div>
              {[
                { label: 'PAUD / TK', val: totals.paud, color: 'bg-sky-400' },
                { label: 'SD / MI', val: totals.sd, color: 'bg-sky-600' },
                { label: 'SMP / MTs', val: totals.smp, color: 'bg-indigo-600' },
                { label: 'SMA / SMK / MA', val: totals.sma, color: 'bg-slate-800' },
                { label: 'Perguruan Tinggi', val: totals.pt, color: 'bg-amber-500' },
              ].map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.label}</span>
                    <span className="font-mono tabular-nums font-medium">{row.val}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color}`}
                      style={{ width: `${Math.round((row.val / Math.max(1, totalEduAll)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Infrastructure Summary */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Sektor Infrastruktur</span>
                <span className="font-mono tabular-nums text-amber-700">
                  {avgJalanMantap}% Jalan Mantap
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 tabular-nums">
                <div>Jembatan: <strong className="text-slate-900">{formatNumber(totals.jembatan)}</strong></div>
                <div>Menara BTS: <strong className="text-slate-900">{formatNumber(totals.bts)}</strong></div>
                <div>Elektrifikasi: <strong className="text-slate-900">{avgListrik}%</strong></div>
                <div>Air Bersih: <strong className="text-slate-900">{formatNumber(totals.airBersih)}</strong></div>
              </div>
            </div>

            {/* Agriculture Summary */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Pertanian & Komoditas</span>
                <span className="font-mono tabular-nums text-emerald-700">
                  {formatNumber(totals.lahanHa)} Ha
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 tabular-nums">
                <div>Padi: <strong className="text-slate-900">{formatNumber(totals.padiTon)} T</strong></div>
                <div>Kopi: <strong className="text-slate-900">{formatNumber(totals.kopiTon)} T</strong></div>
                <div>Kakao/Lada: <strong className="text-slate-900">{formatNumber(totals.kakaoLadaTon)} T</strong></div>
                <div>Poktan: <strong className="text-slate-900">{formatNumber(totals.poktan)}</strong></div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Rasio rata-rata: {(totalHealthAll / (totals.penduduk / 10000)).toFixed(1)} faskes &{' '}
              {(totalEduAll / (totals.penduduk / 10000)).toFixed(1)} sekolah per 10.000 penduduk.
            </span>
          </div>
        </div>
      </div>

      {/* Policy Decision-Support Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Matriks Data Lengkap Kecamatan
            </h2>
            <p className="text-xs text-slate-500">
              Data terstruktur untuk evaluasi prioritas pembangunan sektor kesehatan dan pendidikan.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start no-print">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'optimal', label: 'Optimal' },
              { id: 'perlu_perhatian', label: 'Perlu Penguatan' },
              { id: 'prioritas', label: 'Prioritas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterPriority(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterPriority === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('nama')}
                    className="flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Kecamatan</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('pendudukTotal')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Penduduk</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('kepadatan')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Kepadatan</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('kesehatan')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Faskes (Nakes)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('pendidikan')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Sekolah</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('jalanMantap')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Infrastruktur</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('pertanian')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Pertanian</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Status Layanan</th>
                <th className="py-3 px-4 font-semibold text-right no-print">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSorted.map((k) => {
                const pStyle = getPriorityColor(k.prioritasLayanan);
                const health = getHealthTotal(k);
                const edu = getEducationTotal(k);
                const agriTotalTon =
                  k.produksiPadiTon + k.produksiKopiTon + k.produksiKakaoLadaTon;
                return (
                  <tr key={k.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{k.nama}</div>
                      <div className="text-[11px] text-slate-500">
                        {k.kodeKemendagri} · Ibu Kota {k.ibuKota}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatNumber(k.pendudukTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatNumber(getDensity(k))}/km²
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {health} <span className="text-slate-400">({k.tenagaMedis})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {edu}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {k.jalanMantapPersen}%{' '}
                      <span className="text-slate-400">({k.menaraBts} BTS)</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatNumber(agriTotalTon)} T{' '}
                      <span className="text-slate-400">({k.kelompokTani} Poktan)</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${pStyle.text}`}>
                        {getPriorityLabel(k.prioritasLayanan)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      <button
                        type="button"
                        onClick={() => onInspectKecamatan(k)}
                        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Peta 3D</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
